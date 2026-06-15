import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, Btn, Input, Modal, Empty } from '../../components/ui'
import toast from 'react-hot-toast'

export default function AdminResellers() {
  const [resellers, setResellers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, store:stores(*)')
        .eq('role', 'reseller')
        .order('created_at', { ascending: false })

      if (error) throw error
      setResellers(data || [])
    } catch (e) {
      toast.error('Failed to load resellers: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({ name: '', email: '', phone: '', password: '' })
    setFormError('')
  }

  async function handleCreate() {
    setFormError('')
    const { name, email, phone, password } = form

    // Client-side validation
    if (!name.trim()) return setFormError('Full name is required')
    if (!email.trim() || !email.includes('@')) return setFormError('Valid email is required')
    if (!phone.trim() || phone.length < 10) return setFormError('Valid phone number is required')
    if (!password || password.length < 6) return setFormError('Password must be at least 6 characters')

    setCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated. Please log in again.')

      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ 
          name: name.trim(), 
          email: email.trim().toLowerCase(), 
          phone: phone.trim(), 
          password, 
          role: 'reseller' 
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || `Server error (${response.status})`)
      }

      toast.success(result.message || 'Reseller created successfully!')
      setShowCreate(false)
      resetForm()

      // Optimistic UI state update so you don't depend on artificial timeouts
      if (result.user) {
        const newReseller = {
          id: result.user.id,
          name: name.trim(),
          phone: phone.trim(),
          balance: 0,
          profit: 0,
          store: null,
          status: 'active',
          created_at: new Date().toISOString()
        }
        setResellers(prev => [newReseller, ...prev])
      } else {
        // Fallback to fetch data if the endpoint does not return the created user object
        load()
      }

    } catch (e) {
      setFormError(e.message)
    } finally {
      setCreating(false)
    }
  }

  function handleClose() {
    setShowCreate(false)
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {resellers.length} reseller{resellers.length !== 1 ? 's' : ''}
        </p>
        <Btn onClick={() => setShowCreate(true)} size="sm">+ Create Reseller</Btn>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : resellers.length === 0 ? (
          <Empty icon="🏪" title="No resellers yet" description="Create a reseller to get started" />
        ) : (
          <Table headers={['Name', 'Phone', 'Balance', 'Profit', 'Store', 'Status', 'Joined']}>
            {resellers.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <Td className="font-semibold">{r.name}</Td>
                <Td>{r.phone}</Td>
                <Td className="font-bold text-indigo-600">{formatCurrency(r.balance || 0)}</Td>
                <Td className="font-semibold text-emerald-600">{formatCurrency(r.profit || 0)}</Td>
                <Td>
                  {r.store ? (
                    <div>
                      <span className="text-xs text-emerald-600 font-semibold">✓ {r.store.name}</span>
                      <p className="text-[10px] text-gray-400">/{r.store.slug}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 italic">No store yet</span>
                  )}
                </Td>
                <Td><StatusBadge status={r.status || 'active'} /></Td>
                <Td className="text-xs text-gray-400">{formatDate(r.created_at)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {showCreate && (
        <Modal title="🏪 Create New Reseller" onClose={handleClose} size="sm">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs text-blue-700 font-medium">
                ℹ️ The reseller will be able to log in immediately with these credentials. No email verification needed.
              </p>
            </div>

            <Input
              label="Full Name *"
              value={form.name}
              onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setFormError('') }}
              placeholder="e.g. Kwame Mensah"
              icon="👤"
            />
            <Input
              label="Email Address *"
              type="email"
              value={form.email}
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setFormError('') }}
              placeholder="reseller@example.com"
              icon="✉️"
            />
            <Input
              label="Phone Number *"
              type="tel"
              value={form.phone}
              onChange={e => { setForm(p => ({ ...p, phone: e.target.value })); setFormError('') }}
              placeholder="0XX XXX XXXX"
              icon="📞"
            />
            <Input
              label="Password *"
              type="password"
              value={form.password}
              onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setFormError('') }}
              placeholder="Min. 6 characters"
              icon="🔒"
            />

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <p className="text-red-600 text-sm font-medium">⚠️ {formError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Btn onClick={handleCreate} loading={creating} className="flex-1" size="lg">
                {creating ? 'Creating...' : 'Create Reseller'}
              </Btn>
              <Btn onClick={handleClose} variant="secondary" size="lg" className="flex-1">
                Cancel
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
