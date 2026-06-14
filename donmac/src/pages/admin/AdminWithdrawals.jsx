import { useState, useEffect } from 'react'
import { getAllWithdrawals } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, Empty, Btn } from '../../components/ui'
import toast from 'react-hot-toast'

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    try { setWithdrawals(await getAllWithdrawals()) } catch {} finally { setLoading(false) }
  }

  async function handle(wd, action) {
    try {
      await supabase.from('withdrawals').update({ status: action }).eq('id', wd.id)
      if (action === 'paid') {
        // Deduct from reseller profit
        const { data: reseller } = await supabase.from('profiles').select('profit').eq('id', wd.reseller_id).single()
        if (reseller) {
          await supabase.from('profiles').update({ profit: Math.max(0, (reseller.profit || 0) - wd.amount) }).eq('id', wd.reseller_id)
        }
        await supabase.from('transactions').insert({
          user_id: wd.reseller_id, type: 'debit',
          description: 'Withdrawal paid out', amount: wd.amount, status: 'success'
        })
      }
      toast.success(`Withdrawal ${action}`)
      load()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : withdrawals.length === 0 ? (
          <Empty icon="💸" title="No withdrawal requests" />
        ) : (
          <Table headers={['Date', 'Reseller', 'Phone', 'Amount', 'Status', 'Actions']}>
            {withdrawals.map(w => (
              <tr key={w.id} className="hover:bg-gray-50">
                <Td className="text-xs text-gray-400">{formatDate(w.created_at)}</Td>
                <Td className="font-semibold">{w.reseller?.name || '—'}</Td>
                <Td>{w.reseller?.phone || '—'}</Td>
                <Td><span className="font-bold text-gray-900">{formatCurrency(w.amount)}</span></Td>
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
