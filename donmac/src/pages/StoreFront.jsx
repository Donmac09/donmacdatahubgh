import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getStoreBySlug, getResellerPrices, getPackagesConfig, getNotifications, markNotifRead, subscribeNotifications } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { PACKAGES } from '../lib/packages'
import { formatCurrency, formatDate, generateRef, timeAgo } from '../lib/utils'
import { sounds } from '../lib/sounds'
import { StatusBadge, NetworkBadge, Modal, Input, Card, Btn, Table, Td, Empty, DateFilters, StatCard } from '../components/ui'
import { useTodayDateRange } from '../hooks/useTodayDateRange'
import PackageCard from '../components/PackageCard'
import BuyModal from '../components/BuyModal'
import CartDrawer from '../components/CartDrawer'
import toast from 'react-hot-toast'

// ─── Auth Screen ───────────────────────────────────────────────
function StoreAuthScreen({ store, onAuth }) {
  const { login, register } = useAuthStore()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e?.preventDefault()
    setErr(''); setLoading(true)
    try {
      if (mode === 'login') {
        const p = await login(form.email, form.password)
        // Customer must belong to this reseller OR be the reseller/admin themselves
        if (p.role === 'customer' && p.reseller_id !== store.reseller_id) {
          await useAuthStore.getState().logout()
          setErr('This account is not registered under this store. Please register or use the correct store link.')
          return
        }
        toast.success('Welcome back!')
        onAuth(p)
      } else {
        if (!form.name || !form.email || !form.phone || !form.password) { setErr('All fields are required'); return }
        if (form.password.length < 6) { setErr('Password must be at least 6 characters'); return }
        const p = await register(form.email, form.password, {
          name: form.name, phone: form.phone,
          role: 'customer', reseller_id: store.reseller_id
        })
        toast.success('Account created! Welcome!')
        onAuth(p)
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Store branding */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-2xl mb-4 animate-float">🏪</div>
          <h1 className="text-3xl font-black text-white">{store.name}</h1>
          {store.welcome && <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto leading-relaxed">"{store.welcome}"</p>}
          <p className="text-slate-500 text-xs mt-2">Powered by Donmac Data Hub</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Mode tabs */}
          <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
            {[['login', 'Sign In'], ['register', 'Register']].map(([m, l]) => (
              <button key={m} onClick={() => { setMode(m); setErr('') }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${mode === m ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                {l}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Full Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name"
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Phone Number *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0XX XXX XXXX"
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Email Address *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@email.com"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1.5">Password *</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
            </div>

            {err && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm text-center">{err}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/30">
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : mode === 'login' ? 'Sign In →' : 'Create Account →'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Store Dashboard (logged-in) ────────────────────────────────
function StoreDashboard({ store, resellerId, whatsapp }) {
  const { profile, logout, refreshProfile } = useAuthStore()
  const { open: cartOpen, setOpen: setCartOpen, items: cartItems } = useCartStore()
  const [page, setPage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resellerPrices, setResellerPrices] = useState({})
  const [pkgConfig, setPkgConfig] = useState([])
  const [buyState, setBuyState] = useState(null)
  const [now, setNow] = useState(new Date())
  // Orders
  const [orders, setOrders] = useState([])
  const { from: orderDateFrom, to: orderDateTo, setFrom: setOrderDateFrom, setTo: setOrderDateTo, resetToToday: resetOrderToToday } = useTodayDateRange()
  // TopUps
  const [topups, setTopups] = useState([])
  const { from: topupDateFrom, to: topupDateTo, setFrom: setTopupDateFrom, setTo: setTopupDateTo, resetToToday: resetTopupToToday } = useTodayDateRange()
  const [showTopup, setShowTopup] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [myRef, setMyRef] = useState('')
  const [refLoading, setRefLoading] = useState(false)

  useEffect(() => {
    if (!profile?.id) return
    setRefLoading(true)
    supabase.rpc('get_or_create_reference_code', { p_user_id: profile.id })
      .then(({ data, error }) => {
        if (!error && data) setMyRef(data)
        else setMyRef(generateRef())
      })
      .finally(() => setRefLoading(false))
  }, [profile?.id])
  const [claimTxId, setClaimTxId] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  // Transactions
  const [txs, setTxs] = useState([])
  const { from: txDateFrom, to: txDateTo, setFrom: setTxDateFrom, setTo: setTxDateTo, resetToToday: resetTxToToday } = useTodayDateRange()
  // Profile
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })

  // ── Notifications ────────────────────────────────────────────
  const [notifs, setNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    if (!profile?.id) return
    loadNotifs()

    const sub = subscribeNotifications(profile.id, (payload) => {
      const n = payload.new
      setNotifs(prev => [n, ...prev])
      sounds.notification()
      setShowNotifs(true)
    })

    return () => {
      supabase.removeChannel(sub)
    }
  }, [profile?.id])

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadNotifs() {
    try {
      const data = await getNotifications(profile.id)
      setNotifs(data)
    } catch {}
  }

  async function handleMarkRead(id) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await markNotifRead(id)
    } catch {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: false } : n))
    }
  }

  async function handleMarkAllRead() {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await Promise.all(unreadIds.map(id => markNotifRead(id)))
    } catch {
      loadNotifs()
    }
  }

  const unreadCount = notifs.filter(n => !n.read).length

  useEffect(() => {
    loadData()
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [profile?.id])

  async function loadData() {
    if (!profile?.id) return
    try {
      const [priceRows, cfgRows, orderRows, topupRows, txRows] = await Promise.all([
        getResellerPrices(resellerId),
        getPackagesConfig(),
        supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('topups').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      ])
      const priceMap = {}
      priceRows.forEach(p => { priceMap[p.package_key] = parseFloat(p.price) })
      setResellerPrices(priceMap)
      setPkgConfig(cfgRows)
      setOrders(orderRows.data || [])
      setTopups(topupRows.data || [])
      setTxs(txRows.data || [])
    } catch (e) { console.error(e) }
  }

  async function handleClaim() {
    if (!claimTxId.trim()) { toast.error('Enter transaction ID'); return }
    setClaimLoading(true)
    try {
      const { data: topup, error } = await supabase.from('topups').select('*').eq('transaction_id', claimTxId.trim()).single()
      if (error || !topup) throw new Error('Transaction ID not found. Contact the store owner.')
      if (topup.status === 'claimed') throw new Error('This transaction has already been claimed.')
      await supabase.from('topups').update({ status: 'claimed', claimed_by: profile.id, user_id: profile.id }).eq('id', topup.id)
      const newBal = (profile.balance || 0) + topup.amount
      await supabase.from('profiles').update({ balance: newBal }).eq('id', profile.id)
      await supabase.from('transactions').insert({ user_id: profile.id, type: 'credit', description: 'Manual claim TxID: ' + claimTxId, amount: topup.amount, status: 'success' })
      await refreshProfile()
      sounds.topup()
      toast.success(`₵${topup.amount} claimed!`)
      setShowClaim(false); setClaimTxId('')
      loadData()
    } catch (e) { toast.error(e.message) } finally { setClaimLoading(false) }
  }

  const greeting = () => {
    const h = now.getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  }

  // Nav items — no My Store, no Admin
  const navItems = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'orders', icon: '📦', label: 'Orders' },
    { id: 'topups', icon: '💳', label: 'Top Ups' },
    { id: 'transactions', icon: '💰', label: 'Transactions' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ]

  const filteredOrders = orders.filter(o => {
    if (orderDateFrom && new Date(o.created_at) < new Date(orderDateFrom)) return false
    if (orderDateTo && new Date(o.created_at) > new Date(orderDateTo + 'T23:59:59Z')) return false
    return true
  })
  const filteredTopups = topups.filter(t => {
    if (topupDateFrom && new Date(t.created_at) < new Date(topupDateFrom)) return false
    if (topupDateTo && new Date(t.created_at) > new Date(topupDateTo + 'T23:59:59Z')) return false
    return true
  })
  const filteredTxs = txs.filter(t => {
    if (txDateFrom && new Date(t.created_at) < new Date(txDateFrom)) return false
    if (txDateTo && new Date(t.created_at) > new Date(txDateTo + 'T23:59:59Z')) return false
    return true
  })

  const waNumber = `233${whatsapp.replace(/^0/, '')}`

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-screen z-30 flex flex-col bg-gradient-to-b from-slate-900 to-slate-800 border-r border-white/5 transition-all duration-300 w-56 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Store branding */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg flex-shrink-0">🏪</div>
          <div className="overflow-hidden">
            <p className="font-bold text-white text-sm truncate">{store.name}</p>
            <p className="text-slate-500 text-[10px]">Powered by Donmac Hub</p>
          </div>
        </div>

        {/* Balance pill */}
        <div className="mx-3 mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2 text-center">
          <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Wallet</p>
          <p className="text-lg font-black text-emerald-300">{formatCurrency(profile?.balance || 0)}</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setPage(item.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${page === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'home' && cartItems.length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{cartItems.length}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 rounded-xl bg-white/5 mb-2">
            <p className="text-xs text-white font-semibold truncate">{profile?.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{profile?.role}</p>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-sm font-medium">
            <span>🚪</span><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:ml-56 flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 shadow-sm h-14 flex items-center justify-between px-4 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(p => !p)} className="lg:hidden p-2 hover:bg-gray-100 rounded-xl text-gray-600">☰</button>
            <h1 className="font-bold text-gray-900 text-base capitalize">
              {page === 'home' ? store.name : page === 'topups' ? '💳 Top Ups' : page === 'orders' ? '📦 Orders' : page === 'transactions' ? '💰 Transactions' : '👤 Profile'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">{formatCurrency(profile?.balance || 0)}</span>

            {/* Notifications */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotifs(p => !p)} className="relative p-2 hover:bg-gray-100 rounded-xl transition">
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-96 flex flex-col overflow-hidden animate-slide-in-right">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="font-semibold text-sm text-gray-900">Notifications</p>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-xs text-indigo-600 hover:underline">Mark all read</button>
                    )}
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {notifs.length === 0 ? (
                      <p className="text-center py-8 text-gray-400 text-sm">No notifications yet</p>
                    ) : notifs.map(n => (
                      <div key={n.id} onClick={() => handleMarkRead(n.id)}
                        className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${!n.read ? 'bg-indigo-50/50' : ''}`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm">{n.type === 'order' ? '📦' : n.type === 'topup' ? '💳' : '💰'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => setCartOpen(true)} className="relative p-2 hover:bg-gray-100 rounded-xl">
              <span className="text-xl">🛒</span>
              {cartItems.length > 0 && <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">

            {/* ── HOME ── */}
            {page === 'home' && (
              <div className="space-y-6 animate-fade-in">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6 text-white">
                  <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/10" />
                  <div className="relative">
                    <p className="text-indigo-300 text-sm">{now.toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <h2 className="text-2xl font-bold mt-1">{greeting()}, {profile?.name?.split(' ')[0]}! 👋</h2>
                    <p className="text-slate-400 text-sm mt-1">{store.name}</p>
                    <p className="font-mono text-indigo-200 mt-2">{now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                  </div>
                  <div className="absolute right-6 top-6">
                    <p className="text-slate-400 text-xs text-right">Wallet</p>
                    <p className="text-3xl font-black">{formatCurrency(profile?.balance || 0)}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: '💳', label: 'Top Up', color: 'from-emerald-50 to-teal-50 border-emerald-100', text: 'text-emerald-700', action: () => setShowTopup(true) },
                    { icon: '🔑', label: 'Ref Code', color: 'from-indigo-50 to-purple-50 border-indigo-100', text: 'text-indigo-700', action: () => setShowRef(true) },
                    { icon: '🧾', label: 'Claim TxID', color: 'from-amber-50 to-orange-50 border-amber-100', text: 'text-amber-700', action: () => setShowClaim(true) },
                  ].map(a => (
                    <button key={a.label} onClick={a.action}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${a.color} border hover:shadow-md transition group`}>
                      <span className="text-2xl group-hover:scale-110 transition-transform">{a.icon}</span>
                      <span className={`text-xs font-semibold ${a.text}`}>{a.label}</span>
                    </button>
                  ))}
                </div>

                {/* Packages */}
                <div>
                  <h3 className="font-bold text-gray-900 text-lg mb-4">Available Packages</h3>
                  <div className="space-y-4">
                    {Object.entries(PACKAGES).map(([key, group]) => (
                      <PackageCard key={key} groupKey={key} group={group} pkgConfig={pkgConfig}
                        resellerPrices={resellerPrices}
                        onBuy={(gk, item, price, costPrice) => setBuyState({ groupKey: gk, item, price, costPrice })} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ORDERS ── */}
            {page === 'orders' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
                  <DateFilters from={orderDateFrom} to={orderDateTo} onFrom={setOrderDateFrom} onTo={setOrderDateTo} onReset={resetOrderToToday} />
                </div>
                <Card className="p-0 overflow-hidden">
                  {filteredOrders.length === 0 ? <Empty icon="📦" title="No orders yet" description="Buy a data package to get started" /> : (
                    <Table headers={['Ref', 'Network', 'Package', 'Phone', 'Amount', 'Status', 'Date']}>
                      {filteredOrders.map(o => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <Td><code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{o.ref}</code></Td>
                          <Td><NetworkBadge network={o.network} /></Td>
                          <Td className="font-semibold">{o.package}</Td>
                          <Td>{o.phone}</Td>
                          <Td className="font-bold">{formatCurrency(o.amount)}</Td>
                          <Td><StatusBadge status={o.status} /></Td>
                          <Td className="text-xs text-gray-400">{formatDate(o.created_at)}</Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              </div>
            )}

            {/* ── TOP UPS ── */}
            {page === 'topups' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-900">Top Ups</h2>
                  <div className="flex gap-2 flex-wrap">
                    <Btn onClick={() => setShowTopup(true)} variant="success" size="sm">💳 Top Up</Btn>
                    <Btn onClick={() => setShowClaim(true)} variant="secondary" size="sm">🧾 Claim TxID</Btn>
                    <DateFilters from={topupDateFrom} to={topupDateTo} onFrom={setTopupDateFrom} onTo={setTopupDateTo} onReset={resetTopupToToday} />
                  </div>
                </div>
                <Card className="p-0 overflow-hidden">
                  {filteredTopups.length === 0 ? <Empty icon="💳" title="No top-ups yet" /> : (
                    <Table headers={['Date', 'Transaction ID', 'Method', 'Amount', 'Status']}>
                      {filteredTopups.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <Td className="text-xs text-gray-400">{formatDate(t.created_at)}</Td>
                          <Td><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{t.transaction_id || '—'}</code></Td>
                          <Td>{t.method || 'MoMo'}</Td>
                          <Td className="font-bold text-emerald-600">{formatCurrency(t.amount)}</Td>
                          <Td><StatusBadge status={t.status} /></Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              </div>
            )}

            {/* ── TRANSACTIONS ── */}
            {page === 'transactions' && (
              <div className="space-y-5 animate-fade-in">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
                  <DateFilters from={txDateFrom} to={txDateTo} onFrom={setTxDateFrom} onTo={setTxDateTo} onReset={resetTxToToday} />
                </div>
                <Card className="p-0 overflow-hidden">
                  {filteredTxs.length === 0 ? <Empty icon="💰" title="No transactions yet" /> : (
                    <Table headers={['Date', 'Type', 'Description', 'Amount', 'Status']}>
                      {filteredTxs.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <Td className="text-xs text-gray-400">{formatDate(t.created_at)}</Td>
                          <Td>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${t.type === 'credit' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                              {t.type === 'credit' ? '▲' : '▼'} {t.type.toUpperCase()}
                            </span>
                          </Td>
                          <Td className="text-xs text-gray-500 max-w-xs truncate">{t.description}</Td>
                          <Td className={`font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                            {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                          </Td>
                          <Td><StatusBadge status={t.status} /></Td>
                        </tr>
                      ))}
                    </Table>
                  )}
                </Card>
              </div>
            )}

            {/* ── PROFILE ── */}
            {page === 'profile' && (
              <div className="max-w-lg space-y-5 animate-fade-in">
                <h2 className="text-xl font-bold text-gray-900">My Profile</h2>
                <Card className="p-6">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {profile?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-lg">{profile?.name}</p>
                      <p className="text-gray-400 text-sm">{profile?.email}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full capitalize">{profile?.role}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { label: 'Phone', value: profile?.phone },
                      { label: 'Balance', value: formatCurrency(profile?.balance || 0) },
                      { label: 'Store', value: store.name },
                      { label: 'Status', value: profile?.status || 'active' },
                    ].map(f => (
                      <div key={f.label} className="bg-gray-50 rounded-xl p-3">
                        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{f.label}</p>
                        <p className="font-semibold text-gray-800">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Change password */}
                <Card className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Change Password</h3>
                  <div className="space-y-3">
                    {[
                      { field: 'current', label: 'Current Password' },
                      { field: 'newPw', label: 'New Password' },
                      { field: 'confirm', label: 'Confirm New Password' },
                    ].map(f => (
                      <div key={f.field}>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                        <input type="password" value={pwForm[f.field]} onChange={e => setPwForm(p => ({ ...p, [f.field]: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                      </div>
                    ))}
                    <Btn onClick={async () => {
                      if (!pwForm.newPw || pwForm.newPw !== pwForm.confirm) { toast.error("Passwords don't match"); return }
                      if (pwForm.newPw.length < 6) { toast.error('Min 6 characters'); return }
                      try {
                        const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
                        if (error) throw error
                        toast.success('Password changed!')
                        setPwForm({ current: '', newPw: '', confirm: '' })
                      } catch (e) { toast.error(e.message) }
                    }} className="w-full mt-1" variant="danger">Change Password</Btn>
                  </div>
                </Card>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Modals */}
      {buyState && <BuyModal {...buyState} onClose={() => setBuyState(null)} />}
      {cartOpen && <CartDrawer onOrderPlaced={loadData} />}

      {/* Top Up Modal */}
      {showTopup && (
        <Modal title="💳 Top Up Wallet" onClose={() => setShowTopup(false)} size="sm">
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <p className="font-bold text-blue-800 text-sm mb-3">Send MoMo Payment To:</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">MoMo Name</span><span className="font-bold">Osei Michael</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">MoMo Number</span><span className="font-bold">0549358359</span></div>
              </div>
            </div>
            <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
              <p className="font-semibold text-amber-800 text-sm mb-2">📋 Steps:</p>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>Copy your Reference Code below</li>
                <li>Send MoMo to <strong>0549358359</strong></li>
                <li>Include the code in the transfer note/description</li>
                <li>Wallet is credited automatically!</li>
              </ol>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Your Reference Code</p>
              <div className="inline-flex items-center gap-3 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl px-8 py-4">
                <span className="font-mono text-3xl font-black text-indigo-700 tracking-[0.3em]">{myRef}</span>
              </div>
            </div>
            <Btn onClick={() => { navigator.clipboard?.writeText(myRef); toast.success('Copied!') }} className="w-full">📋 Copy Reference Code</Btn>
            <button onClick={() => { setShowTopup(false); setShowClaim(true) }} className="w-full text-xs text-gray-400 hover:text-indigo-600 transition">
              Already paid without ref code? Claim with Transaction ID →
            </button>
          </div>
        </Modal>
      )}

      {showRef && (
        <Modal title="🔑 Reference Code" onClose={() => setShowRef(false)} size="sm">
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">Include this code when sending MoMo to auto-credit your wallet.</p>
            <div className="py-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border-2 border-dashed border-indigo-300">
              <p className="font-mono text-4xl font-black text-indigo-700 tracking-[0.4em]">{myRef}</p>
            </div>
            <Btn onClick={() => { navigator.clipboard?.writeText(myRef); toast.success('Copied!') }} className="w-full">📋 Copy Code</Btn>
          </div>
        </Modal>
      )}

      {showClaim && (
        <Modal title="🧾 Claim with Transaction ID" onClose={() => setShowClaim(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-blue-700">
              Paid MoMo but forgot to include your reference code? Enter the transaction ID from your receipt.
            </div>
            <Input label="Transaction ID" value={claimTxId} onChange={e => setClaimTxId(e.target.value)} placeholder="e.g. GH123456789" icon="🔍" />
            <Btn onClick={handleClaim} loading={claimLoading} className="w-full" size="lg">Claim Amount</Btn>
          </div>
        </Modal>
      )}

      {/* WhatsApp */}
      <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 left-5 z-40 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 transition-all hover:scale-110">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </div>
  )
}

// ─── Main StoreFront Component ──────────────────────────────────
export default function StoreFront() {
  const { slug } = useParams()
  const { user, profile, setStorefront } = useAuthStore()
  const [store, setStore] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStore() }, [slug])

  async function loadStore() {
    setLoading(true)
    try {
      const storeData = await getStoreBySlug(slug)
      if (!storeData) { setNotFound(true); return }
      setStore(storeData)
      setStorefront({ storeId: storeData.id, resellerId: storeData.reseller_id })
    } catch {
      setNotFound(true)
    } finally { setLoading(false) }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="text-center text-white">
        <div className="w-12 h-12 border-2 border-indigo-300 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading store…</p>
      </div>
    </div>
  )

  if (notFound || !store) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="text-center text-white p-8">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-slate-400 mt-2 text-sm">The store <code className="bg-white/10 px-2 py-0.5 rounded font-mono">/store/{slug}</code> doesn't exist or is unavailable.</p>
      </div>
    </div>
  )

  if (store.reseller?.status === 'blocked') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="text-center text-white p-8">
        <p className="text-6xl mb-4">🚫</p>
        <h1 className="text-2xl font-bold">Store unavailable</h1>
        <p className="text-slate-400 mt-2 text-sm">This store is currently unavailable.</p>
      </div>
    </div>
  )

  // Not logged in — show auth screen
  if (!user || !profile) {
    return <StoreAuthScreen store={store} onAuth={() => {}} />
  }

  // Logged in — show full dashboard
  return (
    <StoreDashboard
      store={store}
      resellerId={store.reseller_id}
      whatsapp={store.whatsapp || '0549358359'}
    />
  )
}
