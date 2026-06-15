import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getAllUsers } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, Btn, Input, Modal, Empty } from '../../components/ui'
import toast from 'react-hot-toast'

async function adminApiCall(endpoint, body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [creditModal, setCreditModal] = useState(null)
  const [creditAmt, setCreditAmt] = useState('')
  const [creditType, setCreditType] = useState('credit')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getAllUsers()
      setUsers(data)
    } catch (e) {
      toast.error('Failed to load users: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleCredit() {
    const amt = parseFloat(creditAmt)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setActionLoading(true)
    try {
      await adminApiCall('/api/admin/update-user', {
        action: creditType,
        userId: creditModal.id,
        amount: amt,
      })
      toast.success(`₵${amt.toFixed(2)} ${creditType === 'credit' ? 'added to' : 'deducted from'} ${creditModal.name}'s wallet`)
      setCreditModal(null)
      setCreditAmt('')
      load()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleBlock(user) {
    const action = user.status === 'blocked' ? 'unblock' : 'block'
    try {
      await adminApiCall('/api/admin/update-user', { action, userId: user.id })
      toast.success(`${user.name} ${action === 'block' ? 'blocked' : 'unblocked'}`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return
    try {
      await adminApiCall('/api/admin/update-user', { action: 'delete', userId: user.id })
      toast.success(`${user.name} deleted`)
      load()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const filtered = users.filter(u => {
    if (search) {
      const s = search.toLowerCase()
      if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s) && !u.phone?.includes(search)) return false
    }
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          className="w-56"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          icon="🔍"
        />
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="reseller">Reseller</option>
          <option value="customer">Customer</option>
        </select>
        <span className="text-sm text-gray-400 self-center">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Empty icon="👥" title="No users found" />
        ) : (
          <Table headers={['Name', 'Email', 'Phone', 'Role', 'Reseller', 'Balance', 'Profit', 'Status', 'Joined', 'Actions']}>
            {filtered.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <Td className="font-semibold whitespace-nowrap">{u.name}</Td>
                <Td className="text-xs text-gray-500">{u.email}</Td>
                <Td className="text-sm">{u.phone}</Td>
                <Td>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                    ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      u.role === 'reseller' ? 'bg-indigo-100 text-indigo-700' :
                      'bg-blue-50 text-blue-600'}`}>
                    {u.role}
                  </span>
                </Td>
                <Td className="text-xs text-gray-400">{u.reseller?.name || '—'}</Td>
                <Td><span className="font-bold text-indigo-600">{formatCurrency(u.balance)}</span></Td>
                <Td><span className="font-semibold text-emerald-600">{formatCurrency(u.profit || 0)}</span></Td>
                <Td><StatusBadge status={u.status || 'active'} /></Td>
                <Td className="text-xs text-gray-400 whitespace-nowrap">{formatDate(u.created_at)}</Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => { setCreditModal(u); setCreditType('credit'); setCreditAmt('') }}
                      className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-200 transition whitespace-nowrap"
                    >
                      + Credit
                    </button>
                    <button
                      onClick={() => { setCreditModal(u); setCreditType('debit'); setCreditAmt('') }}
                      className="px-2.5 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-200 transition whitespace-nowrap"
                    >
                      − Debit
                    </button>
                    <button
                      onClick={() => handleBlock(u)}
                      className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-200 transition"
                    >
                      {u.status === 'blocked' ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      className="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg text-xs font-semibold hover:bg-red-100 hover:text-red-600 transition"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Credit / Debit Modal */}
      {creditModal && (
        <Modal
          title={`${creditType === 'credit' ? '➕ Credit' : '➖ Debit'} Wallet — ${creditModal.name}`}
          onClose={() => { setCreditModal(null); setCreditAmt('') }}
          size="sm"
        >
          <div className="space-y-4">
            {/* Toggle credit/debit */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                onClick={() => setCreditType('credit')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${creditType === 'credit' ? 'bg-green-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ➕ Credit
              </button>
              <button
                onClick={() => setCreditType('debit')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${creditType === 'debit' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ➖ Debit
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
              <span className="text-gray-500">Current balance: </span>
              <span className="font-bold text-indigo-600">{formatCurrency(creditModal.balance)}</span>
            </div>

            <Input
              label="Amount (₵) *"
              type="number"
              min="0.01"
              step="0.01"
              value={creditAmt}
              onChange={e => setCreditAmt(e.target.value)}
              placeholder="0.00"
              icon="₵"
            />

            {creditAmt && parseFloat(creditAmt) > 0 && (
              <div className={`rounded-xl px-4 py-2 text-sm font-medium ${creditType === 'credit' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                New balance will be: {formatCurrency(
                  creditType === 'credit'
                    ? (creditModal.balance || 0) + parseFloat(creditAmt || 0)
                    : Math.max(0, (creditModal.balance || 0) - parseFloat(creditAmt || 0))
                )}
              </div>
            )}

            <Btn
              onClick={handleCredit}
              loading={actionLoading}
              variant={creditType === 'credit' ? 'success' : 'danger'}
              className="w-full"
              size="lg"
            >
              {creditType === 'credit' ? `Add ₵${creditAmt || '0'} to Wallet` : `Deduct ₵${creditAmt || '0'} from Wallet`}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
