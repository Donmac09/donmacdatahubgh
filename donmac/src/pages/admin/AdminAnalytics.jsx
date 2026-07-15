import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { StatCard, Card } from '../../components/ui'

export default function AdminAnalytics() {
  const [stats, setStats] = useState({ 
    revenue: 0, 
    users: 0, 
    orders: 0, 
    pending: 0, 
    resellers: 0, 
    delivered: 0,
    totalUserBalance: 0  // NEW
  })
  const [topResellers, setTopResellers] = useState([])
  const [balances, setBalances] = useState({ platform: null, ghdata: null, ghdataError: null, loading: true })

  useEffect(() => {
    load()
    loadBalances()
  }, [])

  async function loadBalances() {
    setBalances(b => ({ ...b, loading: true }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('No session')

      const res = await fetch('/api/admin/ghdata-balance', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      setBalances({
        platform: result.platform_balance,
        ghdata: result.ghdata_balance,
        ghdataError: result.ghdata_error,
        loading: false,
      })
    } catch (e) {
      setBalances(b => ({ ...b, loading: false, ghdataError: e.message }))
    }
  }

  async function load() {
    try {
      const [{ data: orders }, { data: users }] = await Promise.all([
        supabase.from('orders').select('amount,status'),
        supabase.from('profiles').select('id,name,profit,role,balance'), // Added balance
      ])
      
      // ============================================================
      // Calculate total user wallet balance (customers + resellers)
      // ============================================================
      const totalUserBalance = (users || [])
        .filter(u => u.role !== 'admin') // Exclude admin
        .reduce((sum, u) => sum + (u.balance || 0), 0)
      
      setStats({
        revenue: (orders || []).filter(o => o.status === 'delivered').reduce((s, o) => s + o.amount, 0),
        users: (users || []).filter(u => u.role === 'customer').length,
        orders: (orders || []).length,
        pending: (orders || []).filter(o => o.status === 'pending' || o.status === 'processing').length,
        resellers: (users || []).filter(u => u.role === 'reseller').length,
        delivered: (orders || []).filter(o => o.status === 'delivered').length,
        totalUserBalance: totalUserBalance, // NEW
      })
      
      const resellers = (users || []).filter(u => u.role === 'reseller').sort((a, b) => (b.profit || 0) - (a.profit || 0)).slice(0, 3)
      setTopResellers(resellers)
    } catch {}
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6">
      {/* My Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-xs font-semibold uppercase tracking-wide">My Platform Balance</p>
              <p className="text-3xl font-black mt-1">
                {balances.loading ? '…' : formatCurrency(balances.platform || 0)}
              </p>
              <p className="text-indigo-200 text-xs mt-1">Admin wallet on Donmac Data Hub</p>
            </div>
            <span className="text-4xl opacity-80">💼</span>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wide">GHData Wallet Balance</p>
              <p className="text-3xl font-black mt-1">
                {balances.loading ? '…' : balances.ghdata !== null ? formatCurrency(balances.ghdata) : '—'}
              </p>
              <p className="text-emerald-200 text-xs mt-1">
                {balances.ghdataError ? `⚠️ ${balances.ghdataError}` : 'Wholesale funding balance'}
              </p>
            </div>
            <button onClick={loadBalances} className="text-2xl opacity-80 hover:opacity-100 transition" title="Refresh">
              🔄
            </button>
          </div>
        </Card>

        {/* NEW: Total Users Wallet Balance */}
        <Card className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-xs font-semibold uppercase tracking-wide">👥 Total Users Wallet Balance</p>
              <p className="text-3xl font-black mt-1">{formatCurrency(stats.totalUserBalance)}</p>
              <p className="text-amber-200 text-xs mt-1">Combined balance of all customers &amp; resellers</p>
            </div>
            <span className="text-4xl opacity-80">💰</span>
          </div>
        </Card>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={formatCurrency(stats.revenue)} color="emerald" />
        <StatCard icon="👥" label="Total Customers" value={stats.users} color="blue" />
        <StatCard icon="📦" label="Total Orders" value={stats.orders} color="indigo" />
        <StatCard icon="⏳" label="Active Orders" value={stats.pending} color="amber" />
        <StatCard icon="✅" label="Delivered" value={stats.delivered} color="emerald" />
        <StatCard icon="🏪" label="Resellers" value={stats.resellers} color="purple" />
      </div>

      {/* Top Resellers */}
      <Card className="p-6">
        <h3 className="font-bold text-gray-900 mb-4">🏆 Top Resellers</h3>
        {topResellers.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">No resellers yet</p>
        ) : (
          <div className="space-y-3">
            {topResellers.map((r, i) => (
              <div key={r.id} className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white border border-gray-100">
                <span className="text-3xl">{medals[i]}</span>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                  {r.name?.charAt(0) || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{r.name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">Reseller</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">{formatCurrency(r.profit || 0)}</p>
                  <p className="text-xs text-gray-400">Total Profit</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
