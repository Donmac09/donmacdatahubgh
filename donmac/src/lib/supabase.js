import { createClient } from '@supabase/supabase-js'

// 1. Grab raw environment values safely
const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

// 2. Clean out trailing spaces and hidden line breaks (\n, \r, %0A)
const SUPABASE_URL = rawUrl.trim()
const SUPABASE_ANON_KEY = rawKey.trim().replace(/[\n\r]/g, '')

// 3. Initialize with the perfectly sanitized values
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(email, password, meta) {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: meta } })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, store:stores(*), reseller:reseller_id(id,name,store:stores(*))')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()
  if (error) throw error
  return data
}

export async function placeOrder(order) {
  const { data, error } = await supabase.from('orders').insert(order).select().single()
  if (error) throw error
  return data
}

export async function getOrders(filters = {}) {
  let q = supabase.from('orders')
    .select('*, user:user_id(name,email,phone), reseller:reseller_id(name)')
    .order('created_at', { ascending: false })
  if (filters.userId) q = q.eq('user_id', filters.userId)
  if (filters.status) q = q.eq('status', filters.status)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59Z')
  if (filters.phone) q = q.ilike('phone', '%' + filters.phone + '%')
  if (filters.network) q = q.ilike('network', '%' + filters.network + '%')
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function updateOrderStatus(orderId, status) {
  const { data, error } = await supabase.from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId).select().single()
  if (error) throw error
  return data
}

export async function getTopups(userId) {
  let q = supabase.from('topups')
    .select('*, user:user_id(name,phone), claimer:claimed_by(name)')
    .order('created_at', { ascending: false })
  if (userId) q = q.eq('user_id', userId)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getAllTopups() {
  const { data, error } = await supabase.from('topups')
    .select('*, user:user_id(name,phone), claimer:claimed_by(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTransactions(userId, filters = {}) {
  let q = supabase.from('transactions').select('*').order('created_at', { ascending: false })
  if (userId) q = q.eq('user_id', userId)
  if (filters.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters.dateTo) q = q.lte('created_at', filters.dateTo + 'T23:59:59Z')
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getStoreBySlug(slug) {
  const { data, error } = await supabase.from('stores')
    .select('*, reseller:reseller_id(id,name,phone,status)')
    .eq('slug', slug).single()
  if (error) throw error
  return data
}

export async function createStore(storeData) {
  const { data, error } = await supabase.from('stores').insert(storeData).select().single()
  if (error) throw error
  return data
}

export async function updateStore(storeId, updates) {
  const { data, error } = await supabase.from('stores').update(updates).eq('id', storeId).select().single()
  if (error) throw error
  return data
}

export async function getResellerPrices(resellerId) {
  const { data, error } = await supabase.from('reseller_prices').select('*').eq('reseller_id', resellerId)
  if (error) throw error
  return data || []
}

export async function upsertResellerPrices(resellerId, prices) {
  const rows = Object.entries(prices).map(([package_key, price]) => ({ reseller_id: resellerId, package_key, price: parseFloat(price) }))
  const { data, error } = await supabase.from('reseller_prices').upsert(rows, { onConflict: 'reseller_id,package_key' }).select()
  if (error) throw error
  return data
}

export async function getPackagesConfig() {
  const { data, error } = await supabase.from('packages_config').select('*')
  if (error) throw error
  return data || []
}

export async function upsertPackageConfig(configRow) {
  const { error } = await supabase.from('packages_config').upsert(configRow, { onConflict: 'package_group,package_key' })
  if (error) throw error
}

export async function getAnnouncements(activeOnly = false) {
  let q = supabase.from('announcements').select('*').order('created_at', { ascending: false })
  if (activeOnly) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getNotifications(userId) {
  const { data, error } = await supabase.from('notifications').select('*')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data || []
}

export async function markNotifRead(id) {
  await supabase.from('notifications').update({ read: true }).eq('id', id)
}

export async function getAllUsers() {
  const { data, error } = await supabase.from('profiles')
    .select('*, store:stores(*), reseller:reseller_id(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllWithdrawals() {
  const { data, error } = await supabase.from('withdrawals')
    .select('*, reseller:reseller_id(name,phone)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getSettings() {
  const { data, error } = await supabase.from('settings').select('*')
  if (error) throw error
  const obj = {}
  ;(data || []).forEach(s => { obj[s.key] = s.value })
  return obj
}

export async function setSetting(key, value) {
  const { error } = await supabase.from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

export function subscribeOrders(userId, isAdmin, cb) {
  const filter = isAdmin ? undefined : 'user_id=eq.' + userId
  const ch = supabase.channel('orders-ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter }, cb)
    .subscribe()
  return ch
}

export function subscribeNotifications(userId, cb) {
  return supabase.channel('notif-' + userId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId }, cb)
    .subscribe()
}

export function subscribeTopups(cb) {
  return supabase.channel('topups-ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'topups' }, cb)
    .subscribe()
}

export function subscribeAnnouncements(cb) {
  return supabase.channel('ann-ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, cb)
    .subscribe()
}
