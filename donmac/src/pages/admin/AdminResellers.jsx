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

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const { data } = await supabase.from('profiles')
        .select('*, store:stores(*)')
        .eq('role', 'reseller')
        .order('created_at', { ascending: false })
      setResellers(data || [])
    } catch {} finally { setLoading(false) }
  }

  async function handleCreate() {
    if (!form.name || !form.email || !form.phone || !form.password) { toast.error('All fields required'); return }
    setCreating(true)
    try {
      // Create auth user
      const { data, error } = await supabase.auth.admin.createUser({
        email: form.email, password: form.password,
        user_metadata: { name: form.name, phone: form.phone, role: 'reseller' },
        email_confirm: true
      })
      if (error) throw error
      toast.success('Reseller created! They can now log in.')
      setShowCreate(false)
      setForm({ name: '', email: '', phone: '', password: '' })
      load()
    } catch (e) {
      // Fallback: insert directly into profiles (requires service role in real app)
      try {
        await supabase.from('profiles').insert({
          id: crypto.randomUUID(), name: form.name, phone: form.phone,
          role: 'reseller', balance: 0, profit: 0, status: 'active'
        })
        toast.success('Reseller profile created (use Supabase Auth to set email/password)')
        setShowCreate(false)
        load()
      } catch (e2) { toast.error(e.message) }
    } finally { setCreating(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn onClick={() => setShowCreate(true)} size="sm">+ Create Reseller</Btn>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : resellers.length === 0 ? (
          <Empty icon="🏪" title="No resellers yet" description="Create resellers to get started" />
        ) : (
          <Table headers={['Name', 'Phone', 'Balance', 'Profit', 'Store', 'Status', 'Joined']}>
            {resellers.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td className="font-semibold">{r.name}</Td>
                <Td>{r.phone}</Td>
                <Td className="font-bold text-indigo-600">{formatCurrency(r.balance)}</Td>
                <Td className="font-semibold text-emerald-600">{formatCurrency(r.profit || 0)}</Td>
                <Td>
                  {r.store ? (
                    <span className="text-xs text-emerald-600 font-semibold">✓ {r.store.name}</span>
                  ) : (
                    <span className="text-xs text-gray-400">Not created</span>
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
        <Modal title="Create Reseller" onClose={() => setShowCreate(false)} size="sm">
          <div className="space-y-4">
            <Input label="Full Name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kwame Mensah" icon="👤" />
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="reseller@email.com" icon="✉️" />
            <Input label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0XX XXX XXXX" icon="📞" />
            <Input label="Password" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" icon="🔒" />
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              ⚠️ This requires Supabase service role key to create auth users directly. Alternatively, share the storefront link so resellers can self-register.
            </div>
            <Btn onClick={handleCreate} loading={creating} className="w-full" size="lg">Create Reseller</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
