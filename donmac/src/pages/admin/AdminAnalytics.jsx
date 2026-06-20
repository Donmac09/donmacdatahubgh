import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/utils'
import { StatCard, Card } from '../../components/ui'

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ 
    revenue: 0, 
    users: 0, 
    orders: 0, 
    pending: 0, 
    resellers: 0, 
    delivered: 0 
  })
  const [topResellers, setTopResellers] = useState([])

  useEffect(() => { 
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
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
    } finally {
      setLoading(false)
    }
  }

  const medals = ['🥇', '🥈', '🥉']

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">Loading analytics...</p>
        </div>
      </div>
    )
  }

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
