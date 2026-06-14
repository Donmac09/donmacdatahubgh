import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { getTopups } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Table, Td, StatusBadge, DateFilters, Empty } from '../components/ui'

export default function TopUps() {
  const { profile } = useAuthStore()
  const [topups, setTopups] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [profile])

  async function load() {
    try {
      const data = await getTopups(profile?.id)
      setTopups(data)
    } catch {} finally { setLoading(false) }
  }

  const filtered = topups.filter(t => {
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59Z')) return false
    return true
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Top Up History</h2>
        <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="💳" title="No top-ups found" description="Your top-up history will appear here" />
        ) : (
          <Table headers={['Date & Time', 'Transaction ID', 'Method', 'Amount', 'Status']}>
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition">
                <Td className="text-xs text-gray-500">{formatDate(t.created_at)}</Td>
                <Td><code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{t.transaction_id || '—'}</code></Td>
                <Td>{t.method || 'MoMo'}</Td>
                <Td><span className="font-bold text-emerald-600">{formatCurrency(t.amount)}</span></Td>
                <Td><StatusBadge status={t.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
