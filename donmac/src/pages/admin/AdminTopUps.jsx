import { useState, useEffect } from 'react'
import { getAllTopups } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, DateFilters, Empty } from '../../components/ui'
import { useTodayDateRange } from '../../hooks/useTodayDateRange'
import toast from 'react-hot-toast'

export default function AdminTopUps() {
  const [topups, setTopups] = useState([])
  const [loading, setLoading] = useState(true)
  const { from: dateFrom, to: dateTo, setFrom: setDateFrom, setTo: setDateTo, resetToToday } = useTodayDateRange()
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try { setTopups(await getAllTopups()) } catch {} finally { setLoading(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record?')) return
    await supabase.from('topups').delete().eq('id', id)
    toast.success('Deleted')
    load()
  }

  const filtered = topups.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59Z')) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Status</option>
          <option value="claimed">Claimed</option>
          <option value="unclaimed">Unclaimed</option>
        </select>
        <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onReset={resetToToday} />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="💳" title="No top-up records" />
        ) : (
          <Table headers={['Ref Code', 'Transaction ID', 'Amount', 'Network', 'Status', 'Claimed By', 'Date', 'Action']}>
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <Td>
                  <code className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                    {t.reference_code || '—'}
                  </code>
                </Td>
                <Td>
                  <code className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                    {t.transaction_id || '—'}
                  </code>
                </Td>
                <Td><span className="font-bold text-emerald-600">{formatCurrency(t.amount)}</span></Td>
                <Td>{t.network || 'MoMo'}</Td>
                <Td><StatusBadge status={t.status} /></Td>
                <Td className="text-xs text-gray-500">{t.claimer?.name || t.user?.name || '—'}</Td>
                <Td className="text-xs text-gray-400">{formatDate(t.created_at)}</Td>
                <Td>
                  <button onClick={() => handleDelete(t.id)}
                    className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
