import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { getTransactions } from '../lib/supabase'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Table, Td, StatusBadge, DateFilters, Empty } from '../components/ui'

export default function Transactions() {
  const { profile } = useAuthStore()
  const [txs, setTxs] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => { load() }, [profile])

  async function load() {
    try {
      const data = await getTransactions(profile?.id, { dateFrom, dateTo })
      setTxs(data)
    } catch {} finally { setLoading(false) }
  }

  const filtered = txs.filter(t => {
    if (dateFrom && new Date(t.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(t.created_at) > new Date(dateTo + 'T23:59:59Z')) return false
    return true
  })

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900">Transactions</h2>
        <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
      </div>
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="💰" title="No transactions yet" description="All credits and debits appear here" />
        ) : (
          <Table headers={['Date & Time', 'Type', 'Description', 'Amount', 'Status']}>
            {filtered.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition">
                <Td className="text-xs text-gray-400">{formatDate(t.created_at)}</Td>
                <Td>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${t.type === 'credit' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {t.type === 'credit' ? '▲' : '▼'} {t.type.toUpperCase()}
                  </span>
                </Td>
                <Td className="max-w-xs truncate text-gray-600">{t.description}</Td>
                <Td>
                  <span className={`font-bold text-base ${t.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </Td>
                <Td><StatusBadge status={t.status} /></Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
