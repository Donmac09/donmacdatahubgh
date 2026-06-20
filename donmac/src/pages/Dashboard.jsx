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

export default function Dashboard({ setPage }) {
  const { profile, refreshProfile } = useAuthStore()
  const [now, setNow] = useState(new Date())
  const [pkgConfig, setPkgConfig] = useState([])
  const [resellerPrices, setResellerPrices] = useState({})
  const [buyState, setBuyState] = useState(null) // { groupKey, item, price }
  const [showTopup, setShowTopup] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [myRef] = useState(generateRef())
  const [claimTxId, setClaimTxId] = useState('')
  const [claimLoading, setClaimLoading] = useState(false)
  const [orders, setOrders] = useState([])
  const [announcement, setAnnouncement] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
  loadConfig()
  loadRecentOrders()
  getAnnouncements(true).then(a => setAnnouncement(a[0] || null)).catch(() => {})
}, [profile])
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
    } catch {}
  }

  async function loadRecentOrders() {
    try {
      const { data } = await supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(5)
      setOrders(data || [])
    } catch {}
  }

  async function handleClaim() {
    if (!claimTxId.trim()) { toast.error('Enter transaction ID'); return }
    setClaimLoading(true)
    try {
      const { data: topup, error } = await supabase.from('topups')
        .select('*').eq('transaction_id', claimTxId.trim()).single()
      if (error || !topup) throw new Error('Transaction ID not found. Contact admin.')
      if (topup.status === 'claimed') throw new Error('This transaction has already been claimed.')

      await supabase.from('topups').update({ status: 'claimed', claimed_by: profile.id, user_id: profile.id }).eq('id', topup.id)

      const newBal = (profile.balance || 0) + topup.amount
      await supabase.from('profiles').update({ balance: newBal }).eq('id', profile.id)
      await supabase.from('transactions').insert({
        user_id: profile.id, type: 'credit',
        description: 'Manual claim via TxID: ' + claimTxId,
        amount: topup.amount, status: 'success'
      })

      await refreshProfile()
      sounds.topup()
      toast.success(`₵${topup.amount} claimed successfully!`)
      setShowClaim(false)
      setClaimTxId('')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setClaimLoading(false)
    }
  }

  const greeting = () => {
    const h = now.getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const dateStr = now.toLocaleDateString('en-GH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-4 animate-fade-in bg-slate-50/50 min-h-screen">
      
      {/* Dynamic Announcement Banner */}
      {announcement && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-3 rounded-xl shadow-sm flex items-center gap-3 animate-pulse">
          <span className="text-xl">📢</span>
          <div className="text-sm font-medium">{announcement.message || announcement}</div>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-xl shadow-slate-950/20">
        <div className="absolute -right-10 -top-10 w-72 h-72 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -right-20 bottom-0 w-52 h-52 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <span>{dateStr}</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-indigo-300">{timeStr}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {greeting()}, <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">{profile?.name?.split(' ')[0] || 'User'}</span>! 👋
            </h2>
            <p className="text-slate-400 text-sm">Manage your premium packages and data balances layout effortlessly.</p>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 min-w-[240px] flex flex-col items-start md:items-end shadow-inner">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Available Balance</p>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-emerald-400 font-mono">
              {formatCurrency(profile?.balance || 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Stats - Wallet Balance, Account Level, Gateway Connection */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon="💰" label="Wallet Balance" value={formatCurrency(profile?.balance || 0)} color="indigo" />
        <StatCard 
          icon="🛡️" 
          label="Account Level" 
          value={profile?.role ? profile.role.toUpperCase() : 'CUSTOMER'} 
          color={profile?.role === 'reseller' ? 'purple' : 'emerald'} 
        />
        <StatCard 
          icon="⚡" 
          label="Gateway Connection" 
          value={profile?.status === 'blocked' ? 'Suspended' : 'Operational'} 
          color={profile?.status === 'blocked' ? 'red' : 'emerald'} 
        />
      </div>

      {/* System Control Actions - Removed: Purchase Logs, Ledger Audits, Load History */}
      <Card className="p-6 bg-white border border-slate-100 shadow-sm rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-widest">System Control & Operations</h3>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button onClick={() => setShowTopup(true)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all duration-200 group shadow-sm">
            <span className="text-xl group-hover:scale-110 transition-transform bg-white p-2 rounded-lg shadow-sm">💳</span>
            <span className="text-xs font-bold text-slate-700">Top Up Wallet</span>
          </button>

          <button onClick={() => setShowRef(true)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all duration-200 group shadow-sm">
            <span className="text-xl group-hover:scale-110 transition-transform bg-white p-2 rounded-lg shadow-sm">🔑</span>
            <span className="text-xs font-bold text-slate-700">Reference ID</span>
          </button>

          <button onClick={() => setShowClaim(true)}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all duration-200 group shadow-sm">
            <span className="text-xl group-hover:scale-110 transition-transform bg-white p-2 rounded-lg shadow-sm">🧾</span>
            <span className="text-xs font-bold text-slate-700">Claim Token</span>
          </button>
        </div>
      </Card>

      {/* Packages - Full width, removed Live Activity Feeds sidebar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
          <h3 className="font-extrabold text-slate-900 text-lg">Product Rate Packages</h3>
          <span className="text-xs text-slate-500 font-medium">Updated live</span>
        </div>
        <div className="space-y-4">
          {Object.entries(PACKAGES).map(([key, group]) => (
            <PackageCard
              key={key}
              groupKey={key}
              group={group}
              pkgConfig={pkgConfig}
              resellerPrices={resellerPrices}
              onBuy={(gk, item, price) => setBuyState({ groupKey: gk, item, price })}
            />
          ))}
        </div>
      </div>

      {/* Modal Overlay Pipelines */}
      {buyState && (
        <BuyModal {...buyState} onClose={() => setBuyState(null)} />
      )}

      {/* Top Up Modal */}
      {showTopup && (
        <Modal title="💳 Deposit Gateway Manual Panel" onClose={() => setShowTopup(false)} size="sm">
          <div className="space-y-4 pt-2">
            <div className="rounded-xl p-4 bg-slate-900 text-white border border-slate-800 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 text-slate-800 text-7xl font-black select-none pointer-events-none translate-y-4 translate-x-2">MTN</div>
              <p className="font-bold text-indigo-400 text-xs uppercase tracking-wider mb-3">Merchant Receiver Info</p>
              <div className="space-y-2 relative z-10">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-bold text-slate-100">Osei Michael</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Account Number:</span>
                  <span className="font-bold text-emerald-400 font-mono tracking-wide">0549358359</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl p-4 bg-amber-50/60 border border-amber-100/80">
              <p className="text-amber-800 font-bold text-xs uppercase tracking-wider mb-2">Deposit Pipeline Protocol:</p>
              <ol className="text-xs text-amber-700 space-y-1.5 list-decimal list-inside font-medium">
                <li>Copy the system tracking reference key below.</li>
                <li>Transfer funds to the verified number above.</li>
                <li>Paste the string inside the transfer reference description note field.</li>
                <li>The system automation listener credits the client profile.</li>
              </ol>
            </div>

            <div className="text-center bg-slate-50 border border-slate-200/60 rounded-xl py-4 px-2">
              <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-widest">Active Reference Token</p>
              <div className="inline-block font-mono text-2xl font-black text-indigo-600 tracking-widest select-all bg-white px-4 py-2 rounded-lg border border-slate-200">
                {myRef}
              </div>
            </div>

            <div className="rounded-xl p-3 bg-indigo-50/50 border border-indigo-100 text-center">
              <p className="text-xs text-indigo-900 font-medium">Missing tracking notes on deposit transaction?</p>
              <button onClick={() => { setShowTopup(false); setShowClaim(true) }}
                className="mt-1 text-indigo-600 font-bold text-xs hover:underline block mx-auto">
                Trigger Manual ID Query Recovery →
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reference Code Modal */}
      {showRef && (
        <Modal title="🔑 System Reference Routing Identifier" onClose={() => setShowRef(false)} size="sm">
          <div className="text-center space-y-4 pt-2">
            <p className="text-xs text-slate-500 px-2">This distinct alphanumeric string dynamically connects network processing logs straight to your wallet.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl py-6 px-4 shadow-inner">
              <p className="font-mono text-3xl font-black text-emerald-400 tracking-widest select-all">{myRef}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 text-left text-xs text-amber-800 space-y-1">
              <p className="font-bold uppercase tracking-wider">⚠️ Critical Disclaimer</p>
              <p className="font-medium">Failure to include this exact identifier sequence blocks auto-processing, forcing manual lookup reconciliation.</p>
            </div>
            <Btn onClick={() => { navigator.clipboard?.writeText(myRef); toast.success('Copied token to clipboard!') }} className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              Copy Reference Token
            </Btn>
          </div>
        </Modal>
      )}

      {/* Claim with TxID */}
      {showClaim && (
        <Modal title="🧾 Manual TxID Reconcile Panel" onClose={() => setShowClaim(false)} size="sm">
          <div className="space-y-4 pt-2">
            <div className="bg-blue-50/60 rounded-xl p-4 border border-blue-100 text-xs text-blue-800 leading-relaxed">
              Input the raw electronic ledger hash transaction reference ID listed on your mobile operator money distribution notification receipt below.
            </div>
            <Input
              label="Transaction Hash reference ID"
              value={claimTxId}
              onChange={e => setClaimTxId(e.target.value)}
              placeholder="e.g. 42938472938"
              icon="🔍"
            />
            <Btn onClick={handleClaim} loading={claimLoading} className="w-full shadow-sm" size="lg">
              Verify & Reconcile Transaction
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
