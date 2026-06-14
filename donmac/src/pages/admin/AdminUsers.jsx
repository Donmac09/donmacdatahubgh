import { useState, useEffect } from 'react'
import { getAllUsers } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, Btn, Input, Modal, Empty } from '../../components/ui'
import toast from 'react-hot-toast'

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [creditModal, setCreditModal] = useState(null)
  const [creditAmt, setCreditAmt] = useState('')
  const [creditType, setCreditType] = useState('credit')

  useEffect(() => { load() }, [])

  async function load() {
    try { setUsers(await getAllUsers()) } catch {} finally { setLoading(false) }
  }

  async function handleCredit() {
    const amt = parseFloat(creditAmt)
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return }
    try {
      const user = creditModal
      const newBal = creditType === 'credit' ? user.balance + amt : Math.max(0, user.balance - amt)
      await supabase.from('profiles').update({ balance: newBal }).eq('id', user.id)
      await supabase.from('transactions').insert({
        user_id: user.id, type: creditType,
        description: `Admin ${creditType} of ${formatCurrency(amt)}`,
        amount: amt, status: 'success'
      })
      toast.success(`User ${creditType}ed ₵${amt}`)
      setCreditModal(null); setCreditAmt(''); load()
    } catch (e) { toast.error(e.message) }
  }

  async function handleBlock(user) {
    const newStatus = user.status === 'blocked' ? 'active' : 'blocked'
    await supabase.from('profiles').update({ status: newStatus }).eq('id', user.id)
    toast.success(`User ${newStatus}`)
    load()
  }

  async function handleDelete(userId) {
    if (!confirm('Delete this user?')) return
    await supabase.from('profiles').delete().eq('id', userId)
    toast.success('User deleted')
    load()
  }

  const filtered = users.filter(u => {
    if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase()) && !u.phone?.includes(search)) return false
    if (role && u.role !== role) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input className="w-56" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone..." icon="🔍" />
        <select value={role} onChange={e => setRole(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="reseller">Reseller</option>
          <option value="customer">Customer</option>
        </select>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : (
          <Table headers={['Name', 'Email', 'Phone', 'Role', 'Reseller', 'Balance', 'Profit', 'Status', 'Actions']}>
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <Td className="font-semibold">{u.name}</Td>
                <Td className="text-xs">{u.email}</Td>
                <Td>{u.phone}</Td>
                <Td>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : u.role === 'reseller' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-50 text-blue-600'}`}>
                    {u.role}
                  </span>
                </Td>
                <Td className="text-xs text-gray-400">{u.reseller?.name || '—'}</Td>
                <Td className="font-bold text-indigo-600">{formatCurrency(u.balance)}</Td>
                <Td className="font-semibold text-emerald-600">{formatCurrency(u.profit || 0)}</Td>
                <Td><StatusBadge status={u.status || 'active'} /></Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => { setCreditModal(u); setCreditType('credit') }}
                      className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition">+Credit</button>
                    <button onClick={() => { setCreditModal(u); setCreditType('debit') }}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition">-Debit</button>
                    <button onClick={() => handleBlock(u)}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition">
                      {u.status === 'blocked' ? 'Unblock' : 'Block'}
                    </button>
                    <button onClick={() => handleDelete(u.id)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 transition">Del</button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {creditModal && (
        <Modal title={`${creditType === 'credit' ? '+ Credit' : '- Debit'} — ${creditModal.name}`} onClose={() => { setCreditModal(null); setCreditAmt('') }} size="sm">
          <div className="space-y-4">
            <div className="flex gap-2 mb-2">
              <Btn onClick={() => setCreditType('credit')} variant={creditType === 'credit' ? 'success' : 'secondary'} size="sm" className="flex-1">+ Credit</Btn>
              <Btn onClick={() => setCreditType('debit')} variant={creditType === 'debit' ? 'danger' : 'secondary'} size="sm" className="flex-1">- Debit</Btn>
            </div>
            <p className="text-sm text-gray-500">Current balance: <strong>{formatCurrency(creditModal.balance)}</strong></p>
            <Input label="Amount (₵)" type="number" value={creditAmt} onChange={e => setCreditAmt(e.target.value)} placeholder="0.00" icon="₵" />
            <Btn onClick={handleCredit} variant={creditType === 'credit' ? 'success' : 'danger'} className="w-full" size="lg">
              {creditType === 'credit' ? '+ Add Credit' : '- Debit'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
