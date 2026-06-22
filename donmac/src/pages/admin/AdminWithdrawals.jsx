import { useState, useEffect } from 'react'
import { getAllWithdrawals } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, Empty, Btn, DateFilters } from '../../components/ui'
import { useTodayDateRange } from '../../hooks/useTodayDateRange'
import toast from 'react-hot-toast'

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const { from: dateFrom, to: dateTo, setFrom: setDateFrom, setTo: setDateTo, resetToToday } = useTodayDateRange()

  useEffect(() => { load() }, [])

  async function load() {
    try { setWithdrawals(await getAllWithdrawals()) } catch {} finally { setLoading(false) }
  }

  async function handle(wd, action) {
    try {
      await supabase.from('withdrawals').update({ status: action }).eq('id', wd.id)
      if (action === 'paid') {
        // Deduct the FULL gross amount from reseller profit (the 1% fee is the
        // platform's revenue, not something the reseller keeps). The actual
        // MoMo payout to the reseller should be net_amount, shown below.
        const { data: reseller } = await supabase.from('profiles').select('profit').eq('id', wd.reseller_id).single()
        if (reseller) {
          await supabase.from('profiles').update({ profit: Math.max(0, (reseller.profit || 0) - wd.amount) }).eq('id', wd.reseller_id)
        }
        await supabase.from('transactions').insert({
          user_id: wd.reseller_id, type: 'debit',
          description: `Withdrawal paid out (₵${(wd.net_amount ?? wd.amount).toFixed(2)} net after ₵${(wd.fee_amount ?? 0).toFixed(2)} fee)`,
          amount: wd.amount, status: 'success'
        })
      }
      toast.success(`Withdrawal ${action}`)
      load()
    } catch (e) { toast.error(e.message) }
  }

  const filtered = withdrawals.filter(w => {
    if (dateFrom && new Date(w.created_at) < new Date(dateFrom)) return false
    if (dateTo && new Date(w.created_at) > new Date(dateTo + 'T23:59:59Z')) return false
    return true
  })

  const totalFeesCollected = filtered
    .filter(w => w.status === 'paid')
    .reduce((s, w) => s + (w.fee_amount || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="px-4 py-3 inline-flex items-center gap-2 border border-emerald-100">
          <span className="text-xs text-gray-500">Platform fees collected (filtered range)</span>
          <span className="font-black text-emerald-600">{formatCurrency(totalFeesCollected)}</span>
        </Card>
        <DateFilters from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} onReset={resetToToday} />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="💸" title="No withdrawal requests" />
        ) : (
          <Table headers={['Date', 'Reseller', 'Phone', 'Requested', 'Fee (1%)', 'Pay Out', 'Status', 'Actions']}>
            {filtered.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <Td className="text-xs text-gray-400">{formatDate(w.created_at)}</Td>
                <Td className="font-semibold">{w.reseller?.name || '—'}</Td>
                <Td>{w.reseller?.phone || '—'}</Td>
                <Td><span className="font-bold text-gray-900">{formatCurrency(w.amount)}</span></Td>
                <Td><span className="text-red-500 text-sm">{formatCurrency(w.fee_amount ?? w.amount * 0.01)}</span></Td>
                <Td><span className="font-black text-emerald-600">{formatCurrency(w.net_amount ?? w.amount * 0.99)}</span></Td>
                <Td><StatusBadge status={w.status} /></Td>
                <Td>
                  {w.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => handle(w, 'paid')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition">
                        ✓ Mark Paid
                      </button>
                      <button onClick={() => handle(w, 'rejected')}
                        className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition">
                        ✕ Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
