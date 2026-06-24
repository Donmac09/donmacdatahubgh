import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { getOrders } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Table, Td, StatusBadge, NetworkBadge, DateFilters, Empty } from '../components/ui'
import { useTodayDateRange } from '../hooks/useTodayDateRange'

export default function Orders() {
  const { profile } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { from: dateFrom, to: dateTo, setFrom: setDateFrom, setTo: setDateTo, resetToToday } = useTodayDateRange()

  useEffect(() => { load() }, [profile, dateFrom, dateTo])

  async function load() {
    try {
      const data = await getOrders({ userId: profile?.id, dateFrom, dateTo })
      setOrders(data)
    } catch {} finally { setLoading(false) }
  }

  const filtered = orders.filter(o => {
    if (dateFrom && new Date(o.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(o.created_at) > new Date(dateTo + 'T23:59:59Z')) return false
    return true
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
        <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onReset={resetToToday} />
      </div>
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="📦" title="No orders yet" description="Your data orders will appear here" />
        ) : (
          <Table headers={['Ref', 'Network', 'Package', 'Phone', 'Amount', 'Status', 'Date']}>
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 transition">
                <Td><code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">{o.ref}</code></Td>
                <Td><NetworkBadge network={o.network} /></Td>
                <Td className="font-semibold">{o.package}</Td>
                <Td>{o.phone}</Td>
                <Td><span className="font-bold">{formatCurrency(o.amount)}</span></Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td className="text-xs text-gray-400">{formatDate(o.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
