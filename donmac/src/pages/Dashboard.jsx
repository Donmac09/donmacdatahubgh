// pages/Dashboard.jsx
import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { PACKAGES } from '../lib/packages'
import { getPackagesConfig, getResellerPrices, getAnnouncements } from '../lib/supabase'
import { formatCurrency, generateRef } from '../lib/utils'
import { StatCard, Card, Modal, Btn, Input } from '../components/ui'
import PackageCard from '../components/PackageCard'
import BuyModal from '../components/BuyModal'
import { supabase } from '../lib/supabase'
import { sounds } from '../lib/sounds'
import toast from 'react-hot-toast'

// ============================================================
// STYLES
// ============================================================
const ANN_STYLES = {
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
}

const ANN_ICONS = {
  info: 'ℹ️',
  warning: '⚠️',
  success: '✅',
  error: '🚨',
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function Dashboard({ setPage }) {
  // ============================================================
  // STATE
  // ============================================================
  const { profile, refreshProfile } = useAuthStore()
  
  // Time
  const [now, setNow] = useState(new Date())
  
  // Packages
  const [pkgConfig, setPkgConfig] = useState([])
  const [resellerPrices, setResellerPrices] = useState({})
  const [buyState, setBuyState] = useState(null)
  
  // Modals
  const [showTopup, setShowTopup] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  
  // Reference
  const [myRef, setMyRef] = useState('')
  const [refLoading, setRefLoading] = useState(false)
  
  // Claim
  const [claimTxId, setClaimTxId] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  
  // Orders
  const [orders, setOrders] = useState([])
  
  // Announcement
  const [announcement, setAnnouncement] = useState(null)

  // ============================================================
  // EFFECTS
  // ============================================================
  
  // Load reference code
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

  // Update clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load all data on mount and when profile changes
  useEffect(() => {
    if (!profile?.id) return
    
    loadConfig()
    loadRecentOrders()
    loadAnnouncement()
  }, [profile])

  // ============================================================
  // DATA LOADING FUNCTIONS
  // ============================================================
  
  async function loadConfig() {
    try {
      const cfg = await getPackagesConfig()
      setPkgConfig(cfg)
      
      const resellerId = profile?.reseller_id || profile?.reseller?.id
      if (resellerId) {
        const prices = await getResellerPrices(resellerId)
        const map = {}
        prices.forEach(p => { map[p.package_key] = p.price })
        setResellerPrices(map)
      }
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  async function loadRecentOrders() {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setOrders(data || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  async function loadAnnouncement() {
    try {
      const userRole = profile?.role || 'customer'
      const anns = await getAnnouncements(true, userRole)
      setAnnouncement(anns[0] || null)
    } catch (error) {
      console.error('Error loading announcement:', error)
    }
  }

  // ============================================================
  // FIXED: HANDLE CLAIM FUNCTION - Properly adds amount to balance
  // ============================================================
  async function handleClaim() {
    if (!claimTxId.trim()) {
      toast.error('Enter transaction ID')
      return
    }
    
    setClaimLoading(true)
    try {
      // Get the topup record
      const { data: topup, error } = await supabase
        .from('topups')
        .select('*')
        .eq('transaction_id', claimTxId.trim())
        .single()
        
      if (error || !topup) {
        throw new Error('Transaction ID not found. Contact admin.')
      }
      
      if (topup.status === 'claimed') {
        throw new Error('This transaction has already been claimed.')
      }

      // ============================================================
      // FIX: Use the claim_topup RPC function for atomic operation
      // ============================================================
      const { data: result, error: rpcError } = await supabase.rpc('claim_topup', {
        p_transaction_id: claimTxId.trim(),
        p_user_id: profile.id
      })

      if (rpcError) throw rpcError

      if (result?.success) {
        await refreshProfile()
        sounds.topup()
        toast.success(`₵${topup.amount} claimed successfully!`)
        setShowClaim(false)
        setClaimTxId('')
      } else {
        throw new Error(result?.message || 'Failed to claim')
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setClaimLoading(false)
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  
  const greeting = () => {
    const h = now.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const dateStr = now.toLocaleDateString('en-GH', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })
  
  const timeStr = now.toLocaleTimeString('en-GH', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })

  // ============================================================
  // RENDER
  // ============================================================
  return (
    // FIX: Added relative z-0 to prevent content hiding behind hamburger
    <div className="space-y-6 animate-fade-in relative z-0">
      
      {/* ===== 1. HERO BANNER ===== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/10 pointer-events-none" />
        <div className="absolute -right-4 bottom-0 w-40 h-40 rounded-full bg-purple-500/10 pointer-events-none" />
        <div className="absolute left-1/2 top-0 w-24 h-24 rounded-full bg-yellow-400/10 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <p className="text-indigo-300 text-sm font-medium mb-1">{dateStr}</p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-1">
              {greeting()}, {profile?.name?.split(' ')[0] || 'User'}! 👋
            </h2>
            <p className="text-slate-400 text-sm">Welcome back to Donmac Data Hub</p>
            <p className="text-indigo-200 font-mono text-base mt-2">{timeStr}</p>
          </div>
          
          <div className="flex flex-col items-start sm:items-end gap-1">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Wallet Balance
            </p>
            <p className="text-4xl font-black text-white">
              {formatCurrency(profile?.balance || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* ===== 2. ANNOUNCEMENT BANNER ===== */}
      {announcement && (
        <div className={`flex items-center gap-3 px-4 sm:px-6 py-3 rounded-xl border shadow-sm ${ANN_STYLES[announcement.type] || ANN_STYLES.info}`}>
          <span className="text-xl flex-shrink-0">
            {ANN_ICONS[announcement.type] || '📢'}
          </span>
          <div className="flex-1">
            {announcement.title && (
              <span className="font-bold text-sm mr-2">{announcement.title}:</span>
            )}
            <span className="text-sm font-medium">{announcement.message}</span>
          </div>
          <span className="text-xs opacity-60 flex-shrink-0">
            {new Date(announcement.created_at).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* ===== 3. STAT CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard 
          icon="💰" 
          label="Wallet Balance" 
          value={formatCurrency(profile?.balance || 0)} 
          color="indigo" 
        />
        <StatCard 
          icon="📦" 
          label="Total Orders" 
          value={orders.length} 
          color="amber" 
        />
        <StatCard 
          icon="💳" 
          label="Top Ups" 
          value={profile?.role || '—'} 
          sub="Account type" 
          color="emerald" 
        />
        <StatCard 
          icon="📊" 
          label="Account Status" 
          value={profile?.status === 'blocked' ? 'Blocked' : 'Active'} 
          color={profile?.status === 'blocked' ? 'red' : 'emerald'} 
        />
      </div>

      {/* ===== 4. QUICK ACTIONS ===== */}
      <Card className="p-5">
        <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wider">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <button
            onClick={() => setShowTopup(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">💳</span>
            <span className="text-sm font-semibold text-emerald-700">Top Up</span>
          </button>
          
          <button
            onClick={() => setShowRef(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🔑</span>
            <span className="text-sm font-semibold text-indigo-700">Reference Code</span>
          </button>
          
          <button
            onClick={() => setShowClaim(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">🧾</span>
            <span className="text-sm font-semibold text-amber-700">Claim with TxID</span>
          </button>
          
          <button
            onClick={() => setPage('orders')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
            <span className="text-sm font-semibold text-blue-700">My Orders</span>
          </button>
          
          <button
            onClick={() => setPage('transactions')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">💰</span>
            <span className="text-sm font-semibold text-purple-700">Transactions</span>
          </button>
          
          <button
            onClick={() => setPage('topups')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-100 hover:shadow-md transition group"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">📜</span>
            <span className="text-sm font-semibold text-rose-700">Top Up History</span>
          </button>
        </div>
      </Card>

      {/* ===== 5. PACKAGES ===== */}
      <div>
        <h3 className="font-bold text-gray-900 text-lg mb-4">Available Packages</h3>
        <div className="space-y-4">
          {Object.entries(PACKAGES).map(([key, group]) => (
            <PackageCard
              key={key}
              groupKey={key}
              group={group}
              pkgConfig={pkgConfig}
              resellerPrices={resellerPrices}
              onBuy={(gk, item, price, costPrice) => 
                setBuyState({ groupKey: gk, item, price, costPrice })
              }
            />
          ))}
        </div>
      </div>

      {/* ============================================================
          MODALS
      ============================================================ */}

      {/* Buy Modal */}
      {buyState && (
        <BuyModal {...buyState} onClose={() => setBuyState(null)} />
      )}

      {/* Top Up Modal */}
      {showTopup && (
        <Modal title="💳 Top Up Wallet" onClose={() => setShowTopup(false)} size="sm">
          <div className="space-y-4">
            <div className="rounded-xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
              <p className="font-bold text-blue-800 text-sm mb-3">💳 MoMo Payment Details</p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">MoMo Name</span>
                  <span className="font-bold text-gray-900">Osei Michael</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">MoMo Number</span>
                  <span className="font-bold text-gray-900">0549358359</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 bg-amber-50 border border-amber-100">
              <p className="text-amber-800 font-semibold text-sm mb-2">📋 How to top up:</p>
              <ol className="text-sm text-amber-700 space-y-1 list-decimal list-inside">
                <li>Copy your Reference Code below</li>
                <li>Send MoMo to <strong>0549358359</strong></li>
                <li>Include the Reference Code in your transfer note</li>
                <li>Your wallet will be credited automatically!</li>
              </ol>
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2 font-medium">Your Reference Code</p>
              <div className="inline-flex items-center gap-3 bg-indigo-50 border-2 border-dashed border-indigo-300 rounded-xl px-6 py-4">
                <span className="font-mono text-3xl font-black text-indigo-700 tracking-[0.3em]">
                  {refLoading ? '······' : myRef}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Include this code when making payment</p>
            </div>

            <div className="rounded-xl p-4 bg-gray-50 border border-gray-200 text-center">
              <p className="text-sm text-gray-600">Didn't use your reference code?</p>
              <button
                onClick={() => {
                  setShowTopup(false)
                  setShowClaim(true)
                }}
                className="mt-2 text-indigo-600 font-semibold text-sm hover:underline"
              >
                Claim with Transaction ID →
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reference Code Modal */}
      {showRef && (
        <Modal title="🔑 Your Reference Code" onClose={() => setShowRef(false)} size="sm">
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-500">
              Use this code in your MoMo transfer description for automatic wallet credit
            </p>
            <div className="py-6">
              <div className="inline-block bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-dashed border-indigo-300 rounded-2xl px-8 py-6">
                <p className="font-mono text-4xl font-black text-indigo-700 tracking-[0.4em]">
                  {refLoading ? '······' : myRef}
                </p>
              </div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100 text-left">
              <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ Important</p>
              <p className="text-xs text-yellow-700">
                This code is linked to your account. Always include it in the description of your MoMo transfer to auto-credit your wallet.
              </p>
            </div>
            <Btn
              onClick={() => {
                navigator.clipboard?.writeText(myRef)
                toast.success('Copied!')
              }}
              className="w-full"
            >
              📋 Copy Code
            </Btn>
          </div>
        </Modal>
      )}

      {/* Claim with TxID Modal - UPDATED */}
      {showClaim && (
        <Modal title="🧾 Claim with Transaction ID" onClose={() => setShowClaim(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm text-blue-700">
                If you made a payment but didn't include your reference code, enter the transaction ID from your MoMo receipt to claim the amount.
              </p>
            </div>
            <Input
              label="Transaction ID"
              value={claimTxId}
              onChange={e => setClaimTxId(e.target.value)}
              placeholder="e.g. GH123456789"
              icon="🔍"
            />
            <Btn onClick={handleClaim} loading={claimLoading} className="w-full" size="lg">
              💰 Claim Amount
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
