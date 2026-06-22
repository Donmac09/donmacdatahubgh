import { useState, useEffect, useCallback } from 'react'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import { PACKAGES } from '../lib/packages'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Btn, Input, Table, Td, StatusBadge, Empty, Modal, DateFilters } from '../components/ui'
import { useTodayDateRange } from '../hooks/useTodayDateRange'
import toast from 'react-hot-toast'

export default function MyStore() {
  const { profile, refreshProfile } = useAuthStore()

  // ── Store state ─────────────────────────────────────────────
  const [storeData, setStoreData] = useState(null)      // loaded directly from DB
  const [storeLoading, setStoreLoading] = useState(true)

  // ── Prices ──────────────────────────────────────────────────
  const [prices, setPrices] = useState({})
  const [savedPrices, setSavedPrices] = useState({})
  const [editPrices, setEditPrices] = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)

  // ── Withdrawals ─────────────────────────────────────────────
  const [withdrawals, setWithdrawals] = useState([])
  const [wdAmount, setWdAmount] = useState('')
  const [showWdModal, setShowWdModal] = useState(false)
  const [wdLoading, setWdLoading] = useState(false)
  const { from: wdDateFrom, to: wdDateTo, setFrom: setWdDateFrom, setTo: setWdDateTo, resetToToday: resetWdToToday } = useTodayDateRange()

  // ── Profit ──────────────────────────────────────────────────
  const [profit, setProfit] = useState(0)

  // ── Recent Orders (from customers under this reseller) ───────
  const [recentOrders, setRecentOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // ── UI ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('overview')
  const [savingStore, setSavingStore] = useState(false)
  const [showEditStore, setShowEditStore] = useState(false)
  const [editStoreForm, setEditStoreForm] = useState({})

  // ── Create Store form ────────────────────────────────────────
  const [storeForm, setStoreForm] = useState({ name: '', slug: '', whatsapp: '', welcome: '' })
  const [slugError, setSlugError] = useState('')

  // Load store directly from DB (not from profile join — avoids stale cache)
  const loadStore = useCallback(async () => {
    if (!profile?.id) return
    setStoreLoading(true)
    try {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('reseller_id', profile.id)
        .single()
      setStoreData(data || null)
    } catch {
      setStoreData(null)
    } finally {
      setStoreLoading(false)
    }
  }, [profile?.id])

  // Load prices
  const loadPrices = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('reseller_prices')
        .select('*')
        .eq('reseller_id', profile.id)
      const map = {}
      ;(data || []).forEach(p => { map[p.package_key] = parseFloat(p.price) })
      setSavedPrices(map)
      setPrices(map)
    } catch (e) { console.error('loadPrices:', e) }
  }, [profile?.id])

  // Load withdrawals
  const loadWithdrawals = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reseller_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setWithdrawals(data || [])
    } catch (e) { console.error('loadWithdrawals:', e) }
  }, [profile?.id])

  // Load profit directly from profiles
  const loadProfit = useCallback(async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('profiles')
        .select('profit')
        .eq('id', profile.id)
        .single()
      setProfit(parseFloat(data?.profit) || 0)
    } catch (e) { console.error('loadProfit:', e) }
  }, [profile?.id])

  const loadRecentOrders = useCallback(async () => {
    if (!profile?.id) return
    setOrdersLoading(true)
    try {
      // Orders placed by customers registered under this reseller.
      // Always use `ref` (the 6-char human-facing code) for display —
      // this is the SAME field shown in the customer's Orders tab and
      // in Admin > Orders, so they will always match.
      const { data, error } = await supabase
        .from('orders')
        .select('id, ref, network, package, phone, amount, status, created_at, user:user_id(name)')
        .eq('reseller_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      setRecentOrders(data || [])
    } catch (e) {
      console.error('loadRecentOrders:', e)
    } finally {
      setOrdersLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    loadStore()
  }, [loadStore])

  useEffect(() => {
    if (storeData) {
      loadPrices()
      loadWithdrawals()
      loadProfit()
      loadRecentOrders()
    }
  }, [storeData, loadPrices, loadWithdrawals, loadProfit, loadRecentOrders])

  // ── Create store ────────────────────────────────────────────
  function cleanSlug(val) {
    return val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function handleCreateStore() {
    const { name, slug, whatsapp, welcome } = storeForm
    if (!name.trim())     { toast.error('Store name is required'); return }
    if (!slug.trim())     { toast.error('Store URL slug is required'); return }
    if (!whatsapp.trim()) { toast.error('WhatsApp number is required'); return }
    if (slugError)        { toast.error('Fix the slug error first'); return }

    setSavingStore(true)
    try {
      // Check slug availability
      const { data: existing } = await supabase
        .from('stores').select('id').eq('slug', slug.trim()).maybeSingle()
      if (existing) {
        setSlugError('This slug is already taken. Choose another.')
        setSavingStore(false)
        return
      }

      const { error } = await supabase.from('stores').insert({
        reseller_id: profile.id,
        name: name.trim(),
        slug: slug.trim(),
        whatsapp: whatsapp.trim(),
        welcome: welcome.trim(),
      })
      if (error) throw error

      toast.success('🎉 Store created! Now set your prices.')
      // Reload store from DB
      await loadStore()
      await refreshProfile()
      // Go straight to prices tab
      setActiveTab('prices')
    } catch (e) {
      toast.error(e.message || 'Failed to create store')
    } finally {
      setSavingStore(false)
    }
  }

  // ── Save prices ─────────────────────────────────────────────
  async function handleSavePrices() {
    setSavingPrices(true)
    try {
      const rows = Object.entries(prices)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([package_key, price]) => ({
          reseller_id: profile.id,
          package_key,
          price: parseFloat(price),
        }))

      if (rows.length === 0) { toast.error('No prices to save'); return }

      const { error } = await supabase
        .from('reseller_prices')
        .upsert(rows, { onConflict: 'reseller_id,package_key' })
      if (error) throw error

      setSavedPrices({ ...prices })
      setEditPrices(false)
      toast.success(`✅ ${rows.length} prices saved!`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingPrices(false)
    }
  }

  // ── Withdrawal ──────────────────────────────────────────────
  const WITHDRAWAL_FEE_PCT = 0.01 // 1% — must match the DB trigger enforce_withdrawal_fee()

  async function handleWithdraw() {
    const amt = parseFloat(wdAmount)
    if (!amt || amt < 30)  { toast.error('Minimum withdrawal is ₵30'); return }
    if (amt > profit)      { toast.error(`Insufficient profit. Available: ${formatCurrency(profit)}`); return }
    setWdLoading(true)
    try {
      // fee_amount/net_amount sent here are advisory only — the DB trigger
      // (enforce_withdrawal_fee) always recalculates them server-side,
      // so this can never be bypassed from the client.
      const { error } = await supabase
        .from('withdrawals')
        .insert({ reseller_id: profile.id, amount: amt, status: 'pending' })
      if (error) throw error
      const fee = Math.round(amt * WITHDRAWAL_FEE_PCT * 100) / 100
      const net = amt - fee
      toast.success(`Withdrawal request submitted! You'll receive ${formatCurrency(net)} after the ${formatCurrency(fee)} (1%) fee.`)
      setShowWdModal(false)
      setWdAmount('')
      await loadWithdrawals()
      await loadProfit()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setWdLoading(false)
    }
  }

  // ── Update store ─────────────────────────────────────────────
  async function handleUpdateStore() {
    const { name, whatsapp, welcome } = editStoreForm
    if (!name?.trim())     { toast.error('Store name required'); return }
    if (!whatsapp?.trim()) { toast.error('WhatsApp number required'); return }
    try {
      const { error } = await supabase
        .from('stores')
        .update({ name: name.trim(), whatsapp: whatsapp.trim(), welcome: (welcome || '').trim() })
        .eq('id', storeData.id)
      if (error) throw error
      await loadStore()
      setShowEditStore(false)
      toast.success('Store updated!')
    } catch (e) { toast.error(e.message) }
  }

  // ── Loading ──────────────────────────────────────────────────
  if (storeLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // CREATE STORE — shown when reseller has no store yet
  // ═══════════════════════════════════════════════════════════
  if (!storeData) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-xl mb-4 animate-float">
            🏪
          </div>
          <h2 className="text-2xl font-black text-gray-900">Create Your Storefront</h2>
          <p className="text-gray-500 text-sm mt-2 max-w-sm mx-auto">
            Set up your reseller store and share the link with customers to start earning.
          </p>
        </div>

        <Card className="p-6 space-y-5">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Store Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeForm.name}
              onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Kwame Data Hub"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <p className="text-xs text-gray-400 mt-1">This is the name your customers will see.</p>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Store URL <span className="text-red-500">*</span>
            </label>
            <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition">
              <span className="bg-gray-100 border-r border-gray-200 px-3 py-3 text-xs text-gray-500 font-mono flex items-center whitespace-nowrap">
                /store/
              </span>
              <input
                type="text"
                value={storeForm.slug}
                onChange={e => {
                  const clean = cleanSlug(e.target.value)
                  setStoreForm(p => ({ ...p, slug: clean }))
                  setSlugError('')
                }}
                placeholder="kwame-data"
                className="flex-1 px-3 py-3 text-sm focus:outline-none font-mono bg-white"
              />
            </div>
            {slugError && (
              <p className="text-xs text-red-500 mt-1 font-medium">⚠️ {slugError}</p>
            )}
            {storeForm.slug && !slugError && (
              <p className="text-xs text-indigo-500 mt-1 font-mono truncate">
                {typeof window !== 'undefined' ? window.location.origin : 'https://yoursite.com'}/store/{storeForm.slug}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers and hyphens. Cannot be changed later.</p>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-stretch rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition">
              <span className="bg-green-50 border-r border-gray-200 px-4 py-3 text-lg flex items-center">📱</span>
              <input
                type="tel"
                value={storeForm.whatsapp}
                onChange={e => setStoreForm(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="0XX XXX XXXX"
                className="flex-1 px-3 py-3 text-sm focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Customers on your store chat with this number.</p>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">
              Welcome Message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={storeForm.welcome}
              onChange={e => setStoreForm(p => ({ ...p, welcome: e.target.value }))}
              placeholder="e.g. Welcome! We offer the best data deals at the lowest prices."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Shown on your store's login page.</p>
          </div>

          {/* Preview */}
          {(storeForm.name || storeForm.slug) && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">Preview</p>
              <p className="font-black text-gray-900 text-lg">{storeForm.name || '—'}</p>
              <p className="text-xs text-indigo-400 font-mono mt-0.5 truncate">
                /store/{storeForm.slug || 'your-slug'}
              </p>
              {storeForm.whatsapp && (
                <p className="text-xs text-gray-500 mt-1">📱 {storeForm.whatsapp}</p>
              )}
            </div>
          )}

          <button
            onClick={handleCreateStore}
            disabled={savingStore}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 text-base"
          >
            {savingStore
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating…</>
              : '🏪 Create My Store'}
          </button>
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // STORE DASHBOARD — shown after store is created
  // ═══════════════════════════════════════════════════════════
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/store/${storeData.slug}`
  const totalWithdrawn = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + (w.amount || 0), 0)
  const pendingWd = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount || 0), 0)

  const tabs = [
    { id: 'overview',    label: '📊 Overview' },
    { id: 'prices',      label: '💰 Set Prices' },
    { id: 'withdrawals', label: '💸 Withdrawals' },
    { id: 'settings',    label: '⚙️ Settings' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-6 text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-purple-500/10 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">My Reseller Store</span>
              <span className="bg-green-500/20 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-500/30">● LIVE</span>
            </div>
            <h2 className="text-2xl font-black truncate">{storeData.name}</h2>
            <p className="text-indigo-300 text-sm mt-0.5">📱 {storeData.whatsapp}</p>
            {storeData.welcome && (
              <p className="text-slate-400 text-xs mt-2 italic max-w-md line-clamp-2">"{storeData.welcome}"</p>
            )}
          </div>

          {/* Profit Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[150px] border border-white/10 flex-shrink-0">
            <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider">Profit Balance</p>
            <p className="text-4xl font-black text-white mt-1">{formatCurrency(profit)}</p>
            <button
              onClick={() => setShowWdModal(true)}
              className="mt-3 w-full bg-amber-400 hover:bg-amber-500 text-amber-900 font-bold text-xs py-2 px-3 rounded-xl transition-all"
            >
              💸 Withdraw
            </button>
          </div>
        </div>

        {/* Share link */}
        <div className="relative mt-5 flex items-center gap-2 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
          <span className="text-indigo-300 text-xs font-mono flex-1 truncate">{shareLink}</span>
          <button
            onClick={() => { navigator.clipboard?.writeText(shareLink); toast.success('Link copied!') }}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap"
          >
            📋 Copy
          </button>
          <a href={shareLink} target="_blank" rel="noopener noreferrer"
            className="text-xs bg-indigo-500/40 hover:bg-indigo-500/60 px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap">
            👁 Preview
          </a>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Profit',     value: formatCurrency(profit),          color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-100' },
          { label: 'Total Withdrawn',  value: formatCurrency(totalWithdrawn),  color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-100' },
          { label: 'Pending Withdrawal', value: formatCurrency(pendingWd),     color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-100' },
          { label: 'Total Requests',   value: withdrawals.length,              color: 'text-gray-700',    bg: 'bg-gray-50',     border: 'border-gray-100' },
        ].map(s => (
          <Card key={s.label} className={`p-4 border ${s.border}`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition-all min-w-[90px]
              ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          OVERVIEW TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <Card className="p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-base">Store Information</h3>
            <button
              onClick={() => { setEditStoreForm({ name: storeData.name, whatsapp: storeData.whatsapp, welcome: storeData.welcome || '' }); setShowEditStore(true) }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              ✏️ Edit
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Store Name',      value: storeData.name },
              { label: 'Store URL Slug',  value: `/${storeData.slug}` },
              { label: 'WhatsApp',        value: storeData.whatsapp },
              { label: 'Welcome Message', value: storeData.welcome || '(none)' },
            ].map(f => (
              <div key={f.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">{f.label}</p>
                <p className="text-sm font-semibold text-gray-800 break-words">{f.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
            <p className="text-xs font-bold text-indigo-600 mb-1">💡 Next steps</p>
            <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
              <li>Go to <button onClick={() => setActiveTab('prices')} className="underline font-bold">Set Prices</button> tab to set your selling prices</li>
              <li>Share your store link with customers</li>
              <li>Profit is automatically added when orders are <strong>Delivered</strong></li>
              <li>Withdraw profits of ₵30 or more anytime</li>
            </ul>
          </div>
        </Card>
      )}

      {/* Recent Orders from customers under this store */}
      {activeTab === 'overview' && (
        <Card className="p-0 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Recent Orders</h3>
              <p className="text-xs text-gray-400 mt-0.5">Latest orders from your store's customers</p>
            </div>
            <button
              onClick={loadRecentOrders}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
            >
              🔄 Refresh
            </button>
          </div>

          {ordersLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : recentOrders.length === 0 ? (
            <Empty icon="📦" title="No orders yet" description="Orders from your storefront customers will appear here" />
          ) : (
            <Table headers={['Ref', 'Customer', 'Network', 'Package', 'Phone', 'Amount', 'Status', 'Date']}>
              {recentOrders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50 transition">
                  <Td>
                    <code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">{o.ref}</code>
                  </Td>
                  <Td className="text-xs text-gray-600">{o.user?.name || '—'}</Td>
                  <Td className="text-xs">{o.network}</Td>
                  <Td className="font-semibold text-sm">{o.package}</Td>
                  <Td className="text-xs">{o.phone}</Td>
                  <Td><span className="font-bold text-gray-900">{formatCurrency(o.amount)}</span></Td>
                  <Td><StatusBadge status={o.status} /></Td>
                  <Td className="text-xs text-gray-400">{formatDate(o.created_at)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════
          PRICES TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'prices' && (
        <Card className="p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-gray-900 text-base">Set Your Selling Prices</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Set prices higher than the cost price to earn profit. Leave blank to use default (cost) price.
              </p>
            </div>
            {!editPrices ? (
              <button
                onClick={() => setEditPrices(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                ✏️ Edit Prices
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSavePrices}
                  disabled={savingPrices}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                >
                  {savingPrices ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  💾 Save All
                </button>
                <button
                  onClick={() => { setPrices(savedPrices); setEditPrices(false) }}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Profit key */}
          <div className="flex gap-3 mb-5 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Profit (your price − cost)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Your selling price
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border">
              <span className="w-2 h-2 rounded-full bg-gray-300" /> Wholesale cost
            </span>
          </div>

          <div className="space-y-6">
            {Object.entries(PACKAGES).map(([key, group]) => {
              const isMTN     = group.networkKey === 'mtn'
              const isTelecel = group.networkKey === 'telecel'
              const headerColor = isMTN ? 'bg-yellow-50 border-yellow-200' : isTelecel ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
              const dotColor    = isMTN ? 'bg-yellow-400' : isTelecel ? 'bg-red-500' : 'bg-blue-600'

              return (
                <div key={key}>
                  {/* Group Header */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border mb-3 ${headerColor}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <p className="font-bold text-gray-800 text-sm">{group.label}</p>
                    <span className="text-xs text-gray-400 ml-auto">{group.validity}</span>
                  </div>

                  {/* Package grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {group.items.map(item => {
                      const cost    = item.price
                      const myPrice = prices[item.id] !== undefined ? parseFloat(prices[item.id]) : cost
                      const profit  = myPrice - cost

                      return (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-100 hover:border-gray-200 rounded-xl p-3 transition shadow-sm"
                        >
                          <p className="font-black text-gray-900 text-sm">{item.data}</p>
                          <p className="text-[10px] text-gray-400 mb-2">Cost: {formatCurrency(cost)}</p>

                          {editPrices ? (
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₵</span>
                              <input
                                type="number"
                                step="0.01"
                                min={0}
                                value={prices[item.id] ?? ''}
                                onChange={e => setPrices(p => ({
                                  ...p,
                                  [item.id]: e.target.value === '' ? undefined : e.target.value
                                }))}
                                placeholder={cost.toFixed(2)}
                                className="w-full border border-indigo-300 rounded-lg pl-6 pr-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-indigo-50"
                              />
                            </div>
                          ) : (
                            <div>
                              <p className="font-black text-sm text-indigo-700">{formatCurrency(myPrice)}</p>
                              {profit > 0 ? (
                                <span className="inline-block text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded mt-0.5">
                                  +{formatCurrency(profit)} profit
                                </span>
                              ) : profit < 0 ? (
                                <span className="inline-block text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded mt-0.5">
                                  {formatCurrency(profit)} loss
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded mt-0.5">
                                  no markup
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {editPrices && (
            <div className="mt-6 flex gap-3 sticky bottom-0 bg-white pt-4 pb-2 border-t border-gray-100">
              <button
                onClick={handleSavePrices}
                disabled={savingPrices}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
              >
                {savingPrices && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                💾 Save All Prices
              </button>
              <button
                onClick={() => { setPrices(savedPrices); setEditPrices(false) }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition"
              >
                Cancel
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════
          WITHDRAWALS TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center border border-emerald-100">
              <p className="text-xl font-black text-emerald-600">{formatCurrency(profit)}</p>
              <p className="text-xs text-gray-500 mt-1">Available Profit</p>
            </Card>
            <Card className="p-4 text-center border border-amber-100">
              <p className="text-xl font-black text-amber-600">{formatCurrency(pendingWd)}</p>
              <p className="text-xs text-gray-500 mt-1">Pending</p>
            </Card>
            <Card className="p-4 text-center border border-indigo-100">
              <p className="text-xl font-black text-indigo-600">{formatCurrency(totalWithdrawn)}</p>
              <p className="text-xs text-gray-500 mt-1">Total Paid Out</p>
            </Card>
          </div>

          {/* Request button + fee notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-gray-500">Minimum withdrawal: <span className="font-bold text-gray-700">₵30</span></p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">⚠️ A 1% withdrawal fee applies to all requests</p>
            </div>
            <button
              onClick={() => setShowWdModal(true)}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition shadow-sm whitespace-nowrap"
            >
              💸 Request Withdrawal
            </button>
          </div>

          {/* Date filters */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="font-bold text-gray-900 text-sm">Withdrawal History</h3>
            <DateFilters from={wdDateFrom} to={wdDateTo} onFrom={setWdDateFrom} onTo={setWdDateTo} onReset={resetWdToToday} />
          </div>

          {/* History table */}
          <Card className="p-0 overflow-hidden">
            {(() => {
              const filteredWd = withdrawals.filter(w => {
                if (wdDateFrom && new Date(w.created_at) < new Date(wdDateFrom)) return false
                if (wdDateTo && new Date(w.created_at) > new Date(wdDateTo + 'T23:59:59Z')) return false
                return true
              })
              if (filteredWd.length === 0) {
                return (
                  <Empty
                    icon="💸"
                    title="No withdrawals found"
                    description={withdrawals.length === 0 ? "You can request a withdrawal once you have ₵30 or more in profit" : "Try adjusting the date filter"}
                  />
                )
              }
              return (
                <Table headers={['Date', 'Requested', 'Fee (1%)', 'You Receive', 'Status']}>
                  {filteredWd.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50 transition">
                      <Td className="text-xs text-gray-400">{formatDate(w.created_at)}</Td>
                      <Td>
                        <span className="font-bold text-gray-900">{formatCurrency(w.amount)}</span>
                      </Td>
                      <Td>
                        <span className="text-red-500 text-sm">-{formatCurrency(w.fee_amount ?? w.amount * 0.01)}</span>
                      </Td>
                      <Td>
                        <span className="font-black text-emerald-600">{formatCurrency(w.net_amount ?? w.amount * 0.99)}</span>
                      </Td>
                      <Td><StatusBadge status={w.status} /></Td>
                    </tr>
                  ))}
                </Table>
              )
            })()}
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SETTINGS TAB
      ══════════════════════════════════════════════════════ */}
      {activeTab === 'settings' && (
        <Card className="p-6 space-y-5 animate-fade-in">
          <h3 className="font-bold text-gray-900 text-base">Store Settings</h3>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Store Name *</label>
            <input
              type="text"
              value={editStoreForm.name ?? storeData.name}
              onChange={e => setEditStoreForm(p => ({ ...p, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">WhatsApp Number *</label>
            <input
              type="tel"
              value={editStoreForm.whatsapp ?? storeData.whatsapp}
              onChange={e => setEditStoreForm(p => ({ ...p, whatsapp: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Welcome Message</label>
            <textarea
              value={editStoreForm.welcome ?? storeData.welcome ?? ''}
              onChange={e => setEditStoreForm(p => ({ ...p, welcome: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-semibold">⚠️ Store slug cannot be changed.</p>
            <p className="text-xs text-amber-500 font-mono mt-0.5">/store/{storeData.slug}</p>
          </div>

          <button
            onClick={handleUpdateStore}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition"
          >
            Save Changes
          </button>
        </Card>
      )}

      {/* ── Withdraw Modal ── */}
      {showWdModal && (
        <Modal title="💸 Request Withdrawal" onClose={() => setShowWdModal(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600 font-medium">Available Profit</p>
                <p className="text-2xl font-black text-emerald-600">{formatCurrency(profit)}</p>
              </div>
              <p className="text-xs text-emerald-500 mt-1">Minimum: ₵30 · 1% withdrawal fee applies · Paid via MoMo within 24hrs</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Amount (₵) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₵</span>
                <input
                  type="number"
                  min="30"
                  step="0.01"
                  max={profit}
                  value={wdAmount}
                  onChange={e => setWdAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {parseFloat(wdAmount) > 0 && parseFloat(wdAmount) < 30 && (
              <p className="text-xs text-red-500 font-medium">⚠️ Minimum withdrawal is ₵30</p>
            )}
            {parseFloat(wdAmount) > profit && (
              <p className="text-xs text-red-500 font-medium">⚠️ Amount exceeds available profit ({formatCurrency(profit)})</p>
            )}

            {/* Live fee breakdown */}
            {parseFloat(wdAmount) >= 30 && parseFloat(wdAmount) <= profit && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Amount requested</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(parseFloat(wdAmount))}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-600">Withdrawal fee (1%)</span>
                  <span className="font-semibold text-red-500">-{formatCurrency(parseFloat(wdAmount) * 0.01)}</span>
                </div>
                <div className="flex justify-between text-sm pt-1.5 border-t border-amber-200">
                  <span className="font-bold text-gray-800">You will receive</span>
                  <span className="font-black text-emerald-600">{formatCurrency(parseFloat(wdAmount) * 0.99)}</span>
                </div>
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={wdLoading || !wdAmount || parseFloat(wdAmount) < 30 || parseFloat(wdAmount) > profit}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition flex items-center justify-center gap-2"
            >
              {wdLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Submit Withdrawal Request
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit Store Modal ── */}
      {showEditStore && (
        <Modal title="✏️ Edit Store Info" onClose={() => setShowEditStore(false)} size="sm">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Store Name *</label>
              <input type="text" value={editStoreForm.name || ''} onChange={e => setEditStoreForm(p => ({ ...p, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">WhatsApp Number *</label>
              <input type="tel" value={editStoreForm.whatsapp || ''} onChange={e => setEditStoreForm(p => ({ ...p, whatsapp: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Welcome Message</label>
              <textarea value={editStoreForm.welcome || ''} onChange={e => setEditStoreForm(p => ({ ...p, welcome: e.target.value }))}
                rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <button onClick={handleUpdateStore}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition">
              Save Changes
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
