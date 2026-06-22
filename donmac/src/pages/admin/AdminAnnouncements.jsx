// src/pages/admin/AdminAnnouncements.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/utils'
import { Card, Btn, Input, Textarea, Toggle, Table, Td, Modal, Empty } from '../../components/ui'
import toast from 'react-hot-toast'

// ✅ Correct path if needed
// import useAuthStore from '../../store/authStore'

const TYPE_STYLES = {
  info:    'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
}

export default function AdminAnnouncements() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ 
    title: '', 
    message: '', 
    type: 'info', 
    active: false 
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { 
    load() 
  }, [])

  async function load() {
    try {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
      setItems(data || [])
    } catch (error) {
      console.error('Error loading announcements:', error)
    } finally { 
      setLoading(false) 
    }
  }

  async function handleCreate() {
    if (!form.title || !form.message) { 
      toast.error('Fill all fields')
      return 
    }
    setSaving(true)
    try {
      await supabase.from('announcements').insert(form)
      toast.success('Announcement created!')
      setShowCreate(false)
      setForm({ title: '', message: '', type: 'info', active: false })
      load()
    } catch (error) { 
      toast.error(error.message) 
    } finally { 
      setSaving(false) 
    }
  }

  async function toggleActive(id, val) {
    try {
      await supabase
        .from('announcements')
        .update({ active: val })
        .eq('id', id)
      setItems(prev => prev.map(a => 
        a.id === id ? { ...a, active: val } : a
      ))
      toast.success(val ? 'Announcement activated' : 'Announcement deactivated')
    } catch (error) {
      toast.error(error.message)
    }
  }

  async function handleDelete(id) {
    try {
      await supabase.from('announcements').delete().eq('id', id)
      toast.success('Deleted')
      load()
    } catch (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn onClick={() => setShowCreate(true)} size="sm">
          + New Announcement
        </Btn>
      </div>

      {/* Preview of active announcements */}
      {items.filter(a => a.active).map(a => (
        <div key={a.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${TYPE_STYLES[a.type] || TYPE_STYLES.info}`}>
          <span>📢</span>
          <div className="flex-1">
            <span className="font-bold mr-2">{a.title}:</span>
            <span>{a.message}</span>
          </div>
          <span className="text-xs opacity-60">Live now</span>
        </div>
      ))}

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Empty icon="📢" title="No announcements yet" description="Create one to notify all users" />
        ) : (
          <Table headers={['Title', 'Message', 'Type', 'Active', 'Date', 'Actions']}>
            {items.map(a => (
              <tr key={a.id} className="hover:bg-gray-50">
                <Td className="font-semibold">{a.title}</Td>
                <Td className="max-w-xs truncate text-gray-600 text-xs">{a.message}</Td>
                <Td>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_STYLES[a.type]}`}>
                    {a.type}
                  </span>
                </Td>
                <Td>
                  <Toggle 
                    checked={a.active} 
                    onChange={v => toggleActive(a.id, v)} 
                    size="sm" 
                  />
                </Td>
                <Td className="text-xs text-gray-400">{formatDate(a.created_at)}</Td>
                <Td>
                  <button 
                    onClick={() => handleDelete(a.id)}
                    className="px-2 py-1 bg-red-50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-100 transition"
                  >
                    Delete
                  </button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {showCreate && (
        <Modal title="📢 New Announcement" onClose={() => setShowCreate(false)} size="sm">
          <div className="space-y-4">
            <Input 
              label="Title" 
              value={form.title} 
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} 
              placeholder="e.g. System Maintenance" 
            />
            <Textarea 
              label="Message" 
              value={form.message} 
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))} 
              placeholder="Enter announcement text..." 
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
              <select 
                value={form.type} 
                onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="info">ℹ️ Info (Blue)</option>
                <option value="warning">⚠️ Warning (Amber)</option>
                <option value="success">✅ Success (Green)</option>
                <option value="error">🚨 Alert (Red)</option>
              </select>
            </div>
            <Toggle 
              checked={form.active} 
              onChange={v => setForm(p => ({ ...p, active: v }))} 
              label="Show immediately to all users" 
            />
            <Btn onClick={handleCreate} loading={saving} className="w-full" size="lg">
              Create Announcement
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
