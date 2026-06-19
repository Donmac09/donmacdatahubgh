import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { createStore, getResellerPrices, upsertResellerPrices } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { PACKAGES } from '../lib/packages'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Btn, Input, Textarea, Table, Td, StatusBadge, Empty, Modal } from '../components/ui'
import toast from 'react-hot-toast'

export default function MyStore() {
  const { profile, refreshProfile } = useAuthStore()
  const [storeForm, setStoreForm] = useState({ name: '', slug: '', whatsapp: '', welcome: '' })
  const [slugError, setSlugError] = useState('')
  const [prices, setPrices] = useState({})
  const [savedPrices, setSavedPrices] = useState({})
  const [withdrawals, setWithdrawals] = useState([])
  const [wdAmount, setWdAmount] = useState('')
  const [savingStore, setSavingStore] = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)
  const [editPrices, setEditPrices] = useState(false)
  const [showWdModal, setShowWdModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [editStore, setEditStore] = useState(false)
  const [editStoreForm, setEditStoreForm] = useState({})
  const [storeOrders, setStoreOrders] = useState([])
  const [storeStats, setStoreStats] = useState({ totalSales: 0, totalOrders: 0, totalProfit: 0 })
  const [loading, setLoading] = useState(true)
  const [storeData, setStoreData] = useState(null)
  const [hasStore, setHasStore] = useState(false)

  // FIX: Check for store when component mounts AND when profile changes
  useEffect(() => {
    // Only run if we have a profile
    if (profile?.id) {
      checkStore()
    } else {
      // If no profile, wait for it
      const unsubscribe = useAuthStore.subscribe((state) => {
        if (state.profile?.id) {
          checkStore()
        }
      })
      return () => unsubscribe?.()
    }
  }, [profile?.id])

  async function checkStore() {
    if (!profile?.id) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      console.log('🔍 Checking store for user:', profile.id)
      
      // Check if store exists in the stores table
      const { data: store, error } = await supabase
        .from('stores')
        .select('*')
        .eq('reseller_id', profile.id)
        .maybeSingle()
      
      console.log('Store data:', store, 'Error:', error)
      
      if (store) {
        setStoreData(store)
        setHasStore(true)
        console.log('✅ Store found:', store.name)
        
        // Load all data
        await Promise.all([
          loadPrices(),
          loadWithdrawals(),
          loadStoreOrders(),
          loadStoreStats()
        ])
      } else {
        setStoreData(null)
        setHasStore(false)
        console.log('❌ No store found for user:', profile.id)
        
        // Check if there are any stores at all
        const { data: allStores, error: allError } = await supabase
          .from('stores')
          .select('count')
        console.log('Total stores in DB:', allStores)
      }
    } catch (error) {
      console.error('Error checking store:', error)
      setHasStore(false)
      setStoreData(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadPrices() {
    try {
      const data = await getResellerPrices(profile.id)
      const map = {}
      data.forEach(p => { map[p.package_key] = parseFloat(p.price) })
      setSavedPrices(map)
      setPrices(map)
    } catch (e) { console.error('Error loading prices:', e) }
  }

  async function loadWithdrawals() {
    try {
      const { data } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('reseller_id', profile.id)
        .order('created_at', { ascending: false })
      setWithdrawals(data || [])
    } catch (e) { console.error('Error loading withdrawals:', e) }
  }

  async function loadStoreOrders() {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('reseller_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20)
      setStoreOrders(data || [])
    } catch (e) { console.error('Error loading orders:', e) }
  }

  async function loadStoreStats() {
    try {
      const { data } = await supabase
        .from('orders')
        .select('amount, profit')
        .eq('reseller_id', profile.id)
        .eq('status', 'completed')
      
      if (data) {
        const totalSales = data.reduce((sum, order) => sum + (order.amount || 0), 0)
        const totalProfit = data.reduce((sum, order) => sum + (order.profit || 0), 0)
        setStoreStats({
          totalSales,
          totalOrders: data.length,
          totalProfit
        })
      }
    } catch (e) { console.error('Error loading stats:', e) }
  }

  function validateSlug(val) {
    const clean = val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    return clean
  }

  async function checkSlugAvailable(slug) {
    const { data } = await supabase.from('stores').select('id').eq('slug', slug).maybeSingle()
    return !data
  }

  async function handleCreateStore() {
    const { name, slug, whatsapp, welcome } = storeForm
    if (!name.trim()) { toast.error('Store name is required'); return }
    if (!slug.trim()) { toast.error('Store URL slug is required'); return }
    if (!whatsapp.trim() || whatsapp.length < 10) { toast.error('Valid WhatsApp number is required'); return }
    if (slugError) { toast.error('Please fix the slug error first'); return }

    setSavingStore(true)
    try {
      const available = await checkSlugAvailable(slug)
      if (!available) {
        setSlugError('This slug is already taken. Try another.')
        setSavingStore(false)
        return
      }
      
      const { data: newStore, error } = await supabase
        .from('stores')
        .insert({
          reseller_id: profile.id,
          name: name.trim(),
          slug: slug.trim(),
          whatsapp: whatsapp.trim(),
          welcome: welcome.trim(),
        })
        .select()
        .single()
      
      if (error) throw error
      
      setStoreData(newStore)
      setHasStore(true)
      
      await refreshProfile()
      
      toast.success('🎉 Your store has been created!')
    } catch (e) {
      console.error('Create store error:', e)
      toast.error(e.message || 'Failed to create store')
    } finally {
      setSavingStore(false)
    }
  }

  async function handleUpdateStore() {
    const { name, whatsapp, welcome } = editStoreForm
    if (!name.trim()) { toast.error('Store name is required'); return }
    if (!whatsapp.trim()) { toast.error('WhatsApp number is required'); return }
    
    try {
      const { data: updatedStore, error } = await supabase
        .from('stores')
        .update({ 
          name: name.trim(), 
          whatsapp: whatsapp.trim(), 
          welcome: welcome.trim() 
        })
        .eq('id', storeData.id)
        .select()
        .single()
      
      if (error) throw error
      
      setStoreData(updatedStore)
      await refreshProfile()
      setEditStore(false)
      toast.success('Store updated!')
    } catch (e) { 
      console.error('Update store error:', e)
      toast.error(e.message || 'Failed to update store') 
    }
  }

  async function handleSavePrices() {
    setSavingPrices(true)
    try {
      await upsertResellerPrices(profile.id, prices)
      setSavedPrices({ ...prices })
      setEditPrices(false)
      toast.success('Prices saved!')
    } catch (e) { 
      console.error('Save prices error:', e)
      toast.error(e.message) 
    } finally { 
      setSavingPrices(false) 
    }
  }

  async function handleWithdraw() {
    const amt = parseFloat(wdAmount)
    if (!amt || amt < 30) { toast.error('Minimum withdrawal is ₵30'); return }
    if (amt > (profile.profit || 0)) { toast.error('Insufficient profit balance'); return }
    try {
      await supabase.from('withdrawals').insert({ 
        reseller_id: profile.id, 
        amount: amt, 
        status: 'pending',
        bank_name: 'MTN MoMo',
        account_number: profile.phone || 'N/A'
      })
      toast.success('Withdrawal request submitted!')
      setShowWdModal(false)
      setWdAmount('')
      await loadWithdrawals()
      await refreshProfile()
    } catch (e) { 
      console.error('Withdraw error:', e)
      toast.error(e.message) 
    }
  }

  const shareLink = hasStore && storeData ? `${window.location.origin}/store/${storeData.slug}` : ''
  const totalWithdrawn = withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + (w.amount || 0), 0)
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (w.amount || 0), 0)

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading your store...</p>
        </div>
      </div>
    )
  }

  // ── CREATE STORE SCREEN ──────────────────────────────────────
  if (!hasStore || !storeData) {
    return (
      <div className="animate-fade-in max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-xl mb-4 animate-float">
            🏪
          </div>
          <h2 className="text-2xl font-black text-gray-900">Create Your Store</h2>
          <p className="text-gray-500 text-sm mt-2">Set up your reseller storefront and start selling data to your customers.</p>
        </div>

        <Card className="p-6 space-y-5">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Store Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeForm.name}
              onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Kwame Data Hub"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
            />
            <p className="text-xs text-gray-400 mt-1">This is the name customers will see on your storefront.</p>
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Store URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-0 rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition">
              <span className="bg-gray-100 px-3 py-3 text-xs text-gray-500 font-mono border-r border-gray-200 whitespace-nowrap">/store/</span>
              <input
                type="text"
                value={storeForm.slug}
                onChange={e => {
                  const clean = validateSlug(e.target.value)
                  setStoreForm(p => ({ ...p, slug: clean }))
                  setSlugError('')
                }}
                placeholder="kwame-data"
                className="flex-1 px-3 py-3 text-sm focus:outline-none font-mono bg-white"
              />
            </div>
            {slugError && <p className="text-xs text-red-500 mt-1">⚠️ {slugError}</p>}
            {storeForm.slug && !slugError && (
              <p className="text-xs text-indigo-500 mt-1 font-mono">
                {window.location.origin}/store/{storeForm.slug}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Only lowercase letters, numbers and hyphens. This cannot be changed later.</p>
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-0 rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 transition">
              <span className="bg-green-50 px-3 py-3 text-lg border-r border-gray-200">📱</span>
              <input
                type="tel"
                value={storeForm.whatsapp}
                onChange={e => setStoreForm(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="0XX XXX XXXX"
                className="flex-1 px-3 py-3 text-sm focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Customers on your storefront will chat with this number.</p>
          </div>

          {/* Welcome Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Welcome Message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={storeForm.welcome}
              onChange={e => setStoreForm(p => ({ ...p, welcome: e.target.value }))}
              placeholder="e.g. Welcome to Kwame Data Hub! We offer the best data deals at the lowest prices. Contact us for bulk orders."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Shown to customers on your store's login page.</p>
          </div>

          {/* Preview */}
          {(storeForm.name || storeForm.slug) && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-2">Preview</p>
              <p className="font-bold text-gray-900">{storeForm.name || 'Your Store Name'}</p>
              <p className="text-xs text-indigo-500 font-mono mt-0.5">{window.location.origin}/store/{storeForm.slug || 'your-slug'}</p>
              {storeForm.whatsapp && <p className="text-xs text-gray-500 mt-0.5">📱 {storeForm.whatsapp}</p>}
            </div>
          )}

          <Btn
            onClick={handleCreateStore}
            loading={savingStore}
            className="w-full"
            size="lg"
          >
            🏪 Create My Store
          </Btn>
        </Card>
      </div>
    )
  }

  // ── STORE DASHBOARD ──────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'prices', label: '💰 Prices' },
    { id: 'withdrawals', label: '💸 Withdrawals' },
    { id: 'settings', label: '⚙️ Settings' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-6 text-white">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-20 bottom-0 w-32 h-32 rounded-full bg-purple-500/10 pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-indigo-300 text-xs font-semibold uppercase tracking-widest">My Reseller Store</span>
              <span className="bg-green-500/20 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded-full">● LIVE</span>
            </div>
            <h2 className="text-2xl font-black">{storeData.name}</h2>
            <p className="text-indigo-300 text-sm mt-0.5">📱 {storeData.whatsapp}</p>
            {storeData.welcome && (
              <p className="text-slate-400 text-xs mt-2 max-w-md italic">"{storeData.welcome}"</p>
            )}
          </div>

          {/* Profit Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 text-center min-w-[160px] border border-white/10">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1">Profit Balance</p>
            <p className="text-4xl font-black text-white">{formatCurrency(profile.profit || 0)}</p>
            <Btn
              onClick={() => setShowWdModal(true)}
              variant="warning"
              size="sm"
              className="mt-3 w-full"
            >
              💸 Withdraw
            </Btn>
          </div>
        </div>

        {/* Share Link Bar */}
        <div className="relative mt-5 flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5 border border-white/10">
          <span className="text-indigo-300 text-xs hidden sm:block">🔗 Store Link:</span>
          <span className="text-white text-xs font-mono flex-1 truncate">{shareLink}</span>
          <button
            onClick={() => { navigator.clipboard?.writeText(shareLink); toast.success('Link copied!') }}
            className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition font-semibold whitespace-nowrap"
          >
            📋 Copy
          </button>
          <a href={shareLink} target="_blank" rel="noopener noreferrer"
            className="text-xs bg-indigo-500/40 hover:bg-indigo-500/60 px-3 py-1.5 rounded-lg transition font-semibold whitespace-nowrap">
            👁 Preview
          </a>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Profit', value: formatCurrency(profile.profit || 0), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Sales', value: formatCurrency(storeStats.totalSales), color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Orders', value: storeStats.totalOrders, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Pending Withdrawals', value: formatCurrency(pendingWithdrawals), color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(s => (
          <Card key={s.label} className="p-4 text-center">
            <div className={`${s.bg} rounded-xl p-3 mb-2`}>
              <p className={`text-lg font-black ${s.color} truncate`}>{s.value}</p>
            </div>
            <p className="text-xs text-gray-500 font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === 'overview' && (
        <>
          <Card className="p-6">
            <h3 className="font-bold text-gray-900 mb-4">Store Information</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { label: 'Store Name', value: storeData.name },
                { label: 'Store Slug', value: `/${storeData.slug}` },
                { label: 'WhatsApp', value: storeData.whatsapp },
                { label: 'Welcome Message', value: storeData.welcome || '(none set)' },
              ].map(f => (
                <div key={f.label} className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{f.label}</p>
                  <p className="text-sm font-semibold text-gray-800">{f.value}</p>
                </div>
              ))}
            </div>
            <Btn 
              onClick={() => { 
                setEditStoreForm({ 
                  name: storeData.name, 
                  whatsapp: storeData.whatsapp, 
                  welcome: storeData.welcome || '' 
                }); 
                setEditStore(true) 
              }}
              variant="secondary" 
              size="sm" 
              className="mt-5"
            >
              ✏️ Edit Store Info
            </Btn>
          </Card>

          {/* Recent Orders */}
          {storeOrders.length > 0 && (
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Recent Orders</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 border-b">
                      <th className="pb-2 font-semibold">Order ID</th>
                      <th className="pb-2 font-semibold">Customer</th>
                      <th className="pb-2 font-semibold">Package</th>
                      <th className="pb-2 font-semibold">Amount</th>
                      <th className="pb-2 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeOrders.map(order => (
                      <tr key={order.id} className="border-b border-gray-50">
                        <td className="py-2 text-xs font-mono text-gray-500">#{order.id.slice(0, 8)}</td>
                        <td className="py-2 text-xs">{order.customer_name || 'N/A'}</td>
                        <td className="py-2 text-xs">{order.package_name || 'N/A'}</td>
                        <td className="py-2 text-xs font-semibold">{formatCurrency(order.amount)}</td>
                        <td className="py-2"><StatusBadge status={order.status} /></td>
                        <td className="py-2 text-xs text-gray-400">{formatDate(order.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Prices Tab ── */}
      {activeTab === 'prices' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-gray-900">My Package Prices</h3>
              <p className="text-xs text-gray-400 mt-0.5">Set prices higher than cost to earn profit on each sale.</p>
            </div>
            {!editPrices ? (
              <Btn onClick={() => setEditPrices(true)} variant="secondary" size="sm">✏️ Edit Prices</Btn>
            ) : (
              <div className="flex gap-2">
                <Btn onClick={handleSavePrices} loading={savingPrices} size="sm">💾 Save All</Btn>
                <Btn onClick={() => { setPrices(savedPrices); setEditPrices(false) }} variant="secondary" size="sm">Cancel</Btn>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {Object.entries(PACKAGES).map(([key, group]) => (
              <div key={key}>
                {/* Group header */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: group.color }} />
                  <p className="font-bold text-gray-800 text-sm">{group.label}</p>
                  <span className="text-xs text-gray-400">· {group.validity}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {group.items.map(item => {
                    const cost = item.price
                    const myPrice = prices[item.id] !== undefined ? prices[item.id] : cost
                    const profit = myPrice - cost
                    return (
                      <div key={item.id}
                        className="border border-gray-100 rounded-xl p-3 bg-gray-50 hover:bg-white hover:shadow-sm transition">
                        <p className="font-bold text-sm text-gray-900">{item.data}</p>
                        <p className="text-[10px] text-gray-400 mb-2">Cost: {formatCurrency(cost)}</p>
                        {editPrices ? (
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={prices[item.id] ?? ''}
                            onChange={e => setPrices(p => ({ ...p, [item.id]: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                            placeholder={cost.toFixed(2)}
                            className="w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white font-mono"
                          />
                        ) : (
                          <div className="flex items-center justify-between mt-1">
                            <span className="font-extrabold text-sm text-indigo-600">{formatCurrency(myPrice)}</span>
                            {profit > 0 ? (
                              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">+{formatCurrency(profit)}</span>
                            ) : profit < 0 ? (
                              <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{formatCurrency(profit)}</span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {editPrices && (
            <div className="mt-5 pt-4 border-t border-gray-100 flex gap-3">
              <Btn onClick={handleSavePrices} loading={savingPrices} size="lg" className="flex-1">💾 Save All Prices</Btn>
              <Btn onClick={() => { setPrices(savedPrices); setEditPrices(false) }} variant="secondary" size="lg" className="flex-1">Cancel</Btn>
            </div>
          )}
        </Card>
      )}

      {/* ── Withdrawals Tab ── */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900">Withdrawal History</p>
              <p className="text-xs text-gray-400 mt-0.5">Minimum withdrawal: ₵30</p>
            </div>
            <Btn onClick={() => setShowWdModal(true)} variant="success" size="sm">💸 Request Withdrawal</Btn>
          </div>
          <Card className="p-0 overflow-hidden">
            {withdrawals.length === 0 ? (
              <Empty icon="💸" title="No withdrawals yet" description="Request your first withdrawal when you have ₵30+ profit" />
            ) : (
              <Table headers={['Date', 'Amount', 'Status', 'Reference']}>
                {withdrawals.map(w => (
                  <tr key={w.id} className="hover:bg-gray-50 transition">
                    <Td className="text-xs text-gray-400">{formatDate(w.created_at)}</Td>
                    <Td><span className="font-bold text-gray-900">{formatCurrency(w.amount)}</span></Td>
                    <Td><StatusBadge status={w.status} /></Td>
                    <Td className="text-xs text-gray-400">{w.reference || '—'}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ── Settings Tab ── */}
      {activeTab === 'settings' && (
        <Card className="p-6 space-y-5">
          <h3 className="font-bold text-gray-900">Store Settings</h3>
          <Input 
            label="Store Name *" 
            value={editStoreForm.name ?? storeData.name ?? ''}
            onChange={e => setEditStoreForm(p => ({ ...p, name: e.target.value }))} 
            placeholder="Store name" 
          />
          <Input 
            label="WhatsApp Number *" 
            value={editStoreForm.whatsapp ?? storeData.whatsapp ?? ''}
            onChange={e => setEditStoreForm(p => ({ ...p, whatsapp: e.target.value }))} 
            placeholder="0XX XXX XXXX" 
            icon="📱" 
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Welcome Message</label>
            <textarea
              value={editStoreForm.welcome ?? storeData.welcome ?? ''}
              onChange={e => setEditStoreForm(p => ({ ...p, welcome: e.target.value }))}
              placeholder="Welcome message for your storefront..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
            />
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-700 font-medium">⚠️ Store slug cannot be changed after creation.</p>
            <p className="text-xs text-amber-600 mt-0.5 font-mono">/store/{storeData.slug}</p>
          </div>
          <Btn onClick={() => handleUpdateStore()} className="w-full" size="lg">Save Changes</Btn>
        </Card>
      )}

      {/* Withdraw Modal */}
      {showWdModal && (
        <Modal title="💸 Request Withdrawal" onClose={() => setShowWdModal(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-emerald-800">Available Profit</p>
              <p className="text-3xl font-black text-emerald-600 mt-1">{formatCurrency(profile.profit || 0)}</p>
              <p className="text-xs text-emerald-500 mt-1">Minimum withdrawal: ₵30</p>
            </div>
            <Input
              label="Amount to Withdraw (₵)"
              type="number"
              min="30"
              step="0.01"
              max={profile.profit || 0}
              value={wdAmount}
              onChange={e => setWdAmount(e.target.value)}
              placeholder="0.00"
              icon="₵"
            />
            {wdAmount && parseFloat(wdAmount) >= 30 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Admin will process your withdrawal within 24 hours.
              </div>
            )}
            <Btn onClick={handleWithdraw} className="w-full" size="lg" variant="success">Submit Request</Btn>
          </div>
        </Modal>
      )}

      {/* Edit Store Modal */}
      {editStore && (
        <Modal title="✏️ Edit Store" onClose={() => setEditStore(false)} size="sm">
          <div className="space-y-4">
            <Input 
              label="Store Name *" 
              value={editStoreForm.name || ''} 
              onChange={e => setEditStoreForm(p => ({ ...p, name: e.target.value }))} 
              placeholder="Store name" 
            />
            <Input 
              label="WhatsApp Number *" 
              value={editStoreForm.whatsapp || ''} 
              onChange={e => setEditStoreForm(p => ({ ...p, whatsapp: e.target.value }))} 
              placeholder="0XX XXX XXXX" 
              icon="📱" 
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Welcome Message</label>
              <textarea 
                value={editStoreForm.welcome || ''} 
                onChange={e => setEditStoreForm(p => ({ ...p, welcome: e.target.value }))} 
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" 
              />
            </div>
            <Btn onClick={handleUpdateStore} className="w-full" size="lg">Save Changes</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
