import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { updateProfile } from '../lib/supabase'
import { generateToken } from '../lib/utils'
import { Card, Btn, Input, Modal } from '../components/ui'
import toast from 'react-hot-toast'

export default function Profile() {
  const { profile, refreshProfile, updateProfileLocal } = useAuthStore()
  
  // Initialize with fallback to empty strings
  const [form, setForm] = useState({ name: '', phone: '' })
  const [webhookUrl, setWebhookUrl] = useState('')
  
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [showApiDocs, setShowApiDocs] = useState(false)

  // 🔄 Keep local states perfectly in sync when the profile context fetches
  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        phone: profile.phone || ''
      })
      setWebhookUrl(profile.webhook_url || '')
    }
  }, [profile])

  async function handleUpdateProfile() {
    if (!form.name.trim()) { toast.error('Full name is required'); return }
    setSaving(true)
    try {
      const updated = await updateProfile(profile.id, { name: form.name.trim(), phone: form.phone.trim() })
      updateProfileLocal(updated)
      toast.success('Profile updated!')
    } catch (e) { 
      toast.error(e.message || 'Failed to update profile') 
    } finally { 
      setSaving(false) 
    }
  }

  async function handleGenerateToken() {
    const token = generateToken()
    try {
      await updateProfile(profile.id, { api_token: token })
      updateProfileLocal({ api_token: token })
      toast.success('New API token generated!')
    } catch (e) { toast.error(e.message) }
  }

  async function handleSaveWebhook() {
    try {
      await updateProfile(profile.id, { webhook_url: webhookUrl.trim() })
      updateProfileLocal({ webhook_url: webhookUrl.trim() })
      toast.success('Webhook URL saved!')
    } catch (e) { toast.error(e.message) }
  }

  const apiBase = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app'

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Avatar + Info */}
      <Card className="p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{profile?.name || 'Loading Name...'}</h2>
            <p className="text-gray-500 text-sm">{profile?.email}</p>
            {profile?.role && (
              <span className="inline-block mt-1 px-3 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full capitalize">
                {profile.role}
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input 
            label="Full Name" 
            value={form.name} 
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
            icon="👤" 
          />
          <Input 
            label="Phone Number" 
            value={form.phone} 
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} 
            icon="📞" 
          />
        </div>
        <Btn onClick={handleUpdateProfile} loading={saving} className="mt-4">Save Changes</Btn>
      </Card>

      {/* API Token */}
      <Card className="p-6">
        <h3 className="font-bold text-gray-900 mb-1">🔐 API Token</h3>
        <p className="text-sm text-gray-500 mb-4">Use this token to authenticate API requests to your platform backend.</p>
        <div className="flex gap-2">
          <div className="flex-1 bg-gray-900 rounded-xl px-4 py-3 font-mono text-xs text-green-400 overflow-auto whitespace-nowrap select-all">
            {profile?.api_token || 'No token generated'}
          </div>
          <Btn 
            onClick={() => { 
              if (!profile?.api_token) { toast.error('Generate a token first'); return }
              navigator.clipboard?.writeText(profile.api_token)
              toast.success('Copied!') 
            }} 
            variant="secondary" 
            size="sm"
          >
            Copy
          </Btn>
        </div>
        <div className="flex gap-3 mt-3">
          <Btn onClick={handleGenerateToken} variant="secondary" size="sm">🔄 Regenerate Token</Btn>
          <Btn onClick={() => setShowApiDocs(true)} variant="ghost" size="sm">📖 API Docs</Btn>
        </div>
      </Card>

      {/* Webhook */}
      <Card className="p-6">
        <h3 className="font-bold text-gray-900 mb-1">🔗 Webhook URL</h3>
        <p className="text-sm text-gray-500 mb-4">Set your webhook to receive real-time order and payment notifications.</p>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://your-site.com/webhook"
            icon="🌐"
          />
          <Btn onClick={handleSaveWebhook} variant="success" size="sm">Save</Btn>
        </div>
        <p className="text-xs text-gray-400 mt-2">We'll POST order updates to this URL as JSON.</p>
      </Card>

      {/* API Docs Modal */}
      {showApiDocs && (
        <Modal title="📖 API Documentation" onClose={() => setShowApiDocs(false)} size="lg">
          <div className="space-y-5 text-sm">
            <div className="bg-gray-900 text-green-400 rounded-xl p-4 font-mono text-xs">
              <p className="text-gray-400 mb-2"># Base URL</p>
              <p>{apiBase}/api/v1</p>
              <p className="text-gray-400 mt-3 mb-2"># Authentication (include in all requests)</p>
              <p>Authorization: Bearer {'<YOUR_API_TOKEN>'}</p>
            </div>

            {[
              {
                method: 'POST', path: '/api/v1/orders',
                desc: 'Place a data order',
                body: `{ "network": "mtn", "package": "5GB", "phone": "024XXXXXXX", "package_key": "mtn5" }`,
                response: `{ "success": true, "order": { "id": "...", "ref": "ABC123", "status": "pending" } }`
              },
              {
                method: 'GET', path: '/api/v1/orders',
                desc: 'Get all your orders',
                body: null,
                response: `{ "orders": [...] }`
              },
              {
                method: 'GET', path: '/api/v1/orders/:ref',
                desc: 'Get order status by reference',
                body: null,
                response: `{ "order": { "ref": "ABC123", "status": "delivered" } }`
              },
              {
                method: 'GET', path: '/api/v1/wallet',
                desc: 'Get wallet balance',
                body: null,
                response: `{ "balance": 150.00 }`
              },
            ].map(ep => (
              <div key={ep.path} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${ep.method === 'POST' ? 'bg-green-500' : 'bg-blue-500'}`}>{ep.method}</span>
                  <code className="font-mono text-sm text-gray-800">{ep.path}</code>
                  <span className="text-xs text-gray-400 ml-auto">{ep.desc}</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {ep.body && (
                    <div>
                      <p className="text-xs text-gray-400 font-semibold mb-1">REQUEST BODY</p>
                      <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{ep.body}</pre>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 font-semibold mb-1">RESPONSE</p>
                    <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-xs overflow-auto">{ep.response}</pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
