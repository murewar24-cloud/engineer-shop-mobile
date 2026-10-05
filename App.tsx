import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, StatusBar,
} from 'react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Product = { id: number; name: string; price: number }
type CartRow = { product_id: number; quantity: number; products: any }

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [tab, setTab] = useState<'shop' | 'cart'>('shop')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) return <View style={s.screen}><Text>Loading...</Text></View>
  if (!session) return <Login />

  return (
    <View style={s.screen}>
      <StatusBar barStyle="light-content" />
      <View style={s.header}>
        <Text style={s.title}>⚙️ Engineer Shop</Text>
        <TouchableOpacity onPress={() => supabase.auth.signOut()}>
          <Text style={s.link}>Sign out</Text>
        </TouchableOpacity>
      </View>
      <Text style={s.email}>Signed in as {session.user.email}</Text>

      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, tab === 'shop' && s.tabOn]} onPress={() => setTab('shop')}>
          <Text style={s.tabText}>Shop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'cart' && s.tabOn]} onPress={() => setTab('cart')}>
          <Text style={s.tabText}>Cart</Text>
        </TouchableOpacity>
      </View>

      {tab === 'shop' ? <Shop userId={session.user.id} /> : <Cart userId={session.user.id} />}
    </View>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')

  const signIn = async () => {
    setMsg('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMsg(error.message)
  }
  const signUp = async () => {
    setMsg('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) setMsg(error.message)
    else if (!data.session) setMsg('Account created. Now tap Sign in.')
  }

  return (
    <View style={[s.screen, { padding: 24, justifyContent: 'center' }]}>
      <Text style={[s.title, { color: '#0f172a', marginBottom: 20 }]}>⚙️ Engineer Shop</Text>
      <TextInput
        style={s.input} placeholder="Email" autoCapitalize="none"
        keyboardType="email-address" value={email} onChangeText={setEmail}
      />
      <TextInput
        style={s.input} placeholder="Password" secureTextEntry
        value={password} onChangeText={setPassword}
      />
      {!!msg && <Text style={{ color: 'red', marginBottom: 10 }}>{msg}</Text>}
      <TouchableOpacity style={s.button} onPress={signIn}>
        <Text style={s.buttonText}>Sign in</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.button, { backgroundColor: '#e2e8f0' }]} onPress={signUp}>
        <Text style={[s.buttonText, { color: '#0f172a' }]}>Create new account</Text>
      </TouchableOpacity>
    </View>
  )
}

function Shop({ userId }: { userId: string }) {
  const [products, setProducts] = useState<Product[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    supabase.from('products').select('id, name, price').order('id')
      .then(({ data }) => setProducts((data as Product[]) ?? []))
  }, [])

  const add = async (productId: number) => {
    const { data: existing } = await supabase
      .from('cart_items').select('quantity')
      .eq('user_id', userId).eq('product_id', productId).maybeSingle()
    const { error } = await supabase.from('cart_items').upsert(
      { user_id: userId, product_id: productId, quantity: (existing?.quantity ?? 0) + 1 },
      { onConflict: 'user_id,product_id' }
    )
    setNote(error ? error.message : 'Added to cart!')
    setTimeout(() => setNote(''), 1500)
  }

  return (
    <View style={{ flex: 1 }}>
      {!!note && <Text style={s.note}>{note}</Text>}
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.price}>₦{Number(item.price).toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={s.addBtn} onPress={() => add(item.id)}>
              <Text style={s.buttonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  )
}

function Cart({ userId }: { userId: string }) {
  const [rows, setRows] = useState<CartRow[]>([])

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('cart_items')
      .select('product_id, quantity, products(name, price)')
      .eq('user_id', userId)
      .order('product_id')
    setRows((data as any) ?? [])
  }, [userId])

  useEffect(() => {
    load()
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
  }, [load])

  const change = async (productId: number, qty: number) => {
    if (qty <= 0) {
      await supabase.from('cart_items').delete().eq('user_id', userId).eq('product_id', productId)
    } else {
      await supabase.from('cart_items').upsert(
        { user_id: userId, product_id: productId, quantity: qty },
        { onConflict: 'user_id,product_id' }
      )
    }
    load()
  }

  const info = (r: CartRow) => (Array.isArray(r.products) ? r.products[0] : r.products)
  const total = rows.reduce((sum, r) => sum + Number(info(r)?.price ?? 0) * r.quantity, 0)

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => String(r.product_id)}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40 }}>Your cart is empty.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{info(item)?.name}</Text>
              <Text style={s.price}>₦{Number(info(item)?.price ?? 0).toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={s.qtyBtn} onPress={() => change(item.product_id, item.quantity - 1)}>
              <Text>-</Text>
            </TouchableOpacity>
            <Text style={{ width: 28, textAlign: 'center' }}>{item.quantity}</Text>
            <TouchableOpacity style={s.qtyBtn} onPress={() => change(item.product_id, item.quantity + 1)}>
              <Text>+</Text>
            </TouchableOpacity>
          </View>
        )}
      />
      <Text style={s.total}>Total: ₦{total.toFixed(2)}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 40 },
  header: {
    backgroundColor: '#0f172a', padding: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  title: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  link: { color: '#93c5fd' },
  email: { padding: 10, color: '#475569', textAlign: 'center' },
  tabs: { flexDirection: 'row' },
  tab: { flex: 1, padding: 14, alignItems: 'center', borderBottomWidth: 3, borderColor: 'transparent' },
  tabOn: { borderColor: '#2563eb' },
  tabText: { fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 12,
    marginBottom: 12, backgroundColor: 'white',
  },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 30, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: 'white', fontWeight: '600' },
  card: {
    backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  name: { fontWeight: '600', fontSize: 16 },
  price: { color: '#1d4ed8', fontWeight: 'bold' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  qtyBtn: { backgroundColor: '#e2e8f0', width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  total: { fontSize: 20, fontWeight: 'bold', padding: 16 },
  note: { textAlign: 'center', color: '#15803d', paddingTop: 8 },
})