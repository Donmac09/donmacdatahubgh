import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { StatCard, Card } from '../../components/ui'
import { getGHDataWalletBalance, GHDATA_TOKEN } from '../../lib/packages'
import useAuthStore from '../../store/authStore'
import toast from 'react-hot-toast'

export default function AdminAnalytics() {
  const { profile } = useAuthStore()
  const [stats, setStats] = useState({ 
    revenue: 0, 
    users: 0, 
    orders: 0, 
    pending: 0, 
    resellers: 0, 
    delivered: 0 
  })
  const [topResellers, setTopResellers] = useState([])
  const [ghdataBalance, setGhdataBalance] = useState(null)
  const [loadingBalance, setLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState(null)

  useEffect(() => { 
    load()
    fetchGHDataBalance()
  }, [])

  async function load() {
    try {
      const [{ data: orders }, { data: users }] = await Promise.all([
        supabase.from('orders').select('amount,status'),
        supabase.from('profiles').select('id,name,profit,role'),
      ])
      setStats({
        revenue: (orders || []).filter(o => o.status === 'delivered').reduce((s, o) => s + o.amount, 0),
        users: (users || []).filter(u => u.role === 'customer').length,
        orders: (orders || []).length,
        pending: (orders || []).filter(o => o.status === 'pending' || o.status === 'processing').length,
        resellers: (users || []).filter(u => u.role === 'reseller').length,
        delivered: (orders || []).filter(o => o.status === 'delivered').length,
      })
      const resellers = (users || []).filter(u => u.role === 'reseller').sort((a, b) => (b.profit || 0) - (a.profit || 0)).slice(0, 3)
      setTopResellers(resellers)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  async function fetchGHDataBalance() {
    setLoadingBalance(true)
    setBalanceError(null)
    try {
      // Use the GHData token directly
      const balance = await getGHDataWalletBalance(GHDATA_TOKEN)
      console.log('GHData Balance Response:', balance)
      setGhdataBalance(balance)
    } catch (error) {
      console.error('Error fetching GHData balance:', error)
      setBalanceError(error.message || 'Failed to fetch balance')
      // Don't show toast - just show error in UI
    } finally {
      setLoadingBalance(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon="💰" label="Total Revenue" value={formatCurrency(stats.revenue)} color="emerald" />
        <StatCard icon="👥" label="Total Customers" value={stats.users} color="blue" />
        <StatCard icon="📦" label="Total Orders" value={stats.orders} color="indigo" />
        <StatCard icon="⏳" label="Active Orders" value={stats.pending} color="amber" />
        <StatCard icon="✅" label="Delivered" value={stats.delivered} color="emerald" />
        <StatCard icon="🏪" label="Resellers" value={stats.resellers} color="purple" />
      </div>

      {/* GHData Wallet Balance */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">📡 GHData Wallet Balance</h3>
            <p className="text-xs text-gray-400 mt-0.5">Connected to GHDataConnect API</p>
          </div>
          <button 
            onClick={fetchGHDataBalance} 
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            disabled={loadingBalance}
          >
            {loadingBalance ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
        
        <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
          {loadingBalance ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : balanceError ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-500">⚠️ {balanceError}</p>
              <p className="text-xs text-gray-400 mt-1">Check your API token and connection</p>
            </div>
          ) : ghdataBalance ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Available Balance</p>
                <p className="text-3xl font-black text-indigo-600">
                  {formatCurrency(ghdataBalance.balance || 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Last updated</p>
                <p className="text-xs text-gray-500">{new Date().toLocaleString()}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No balance data available</p>
              <p className="text-xs text-gray-400 mt-1">Click refresh to try again</p>
            </div>
          )}
        </div>
      </Card>

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
