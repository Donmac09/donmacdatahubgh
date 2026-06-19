import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!form.email || !form.password) { setErr('All fields required'); return }
    setLoading(true); setErr('')
    try {
      const profile = await login(form.email, form.password)
      
      if (profile?.status === 'blocked') {
        toast.error('Account blocked. Contact support.')
        await useAuthStore.getState().logout()
        setLoading(false)
        return
      }

      // Wait for auth state to fully update
      await new Promise(resolve => setTimeout(resolve, 500))

      // Redirect based on role
      if (profile?.role === 'admin' || profile?.role === 'reseller') {
        navigate('/dashboard')
        toast.success(`Welcome back, ${profile.name || 'Admin'}!`)
      } else {
        // Customer - redirect to storefront
        if (profile?.reseller_id) {
          const { data: store, error } = await supabase
            .from('stores')
            .select('slug')
            .eq('reseller_id', profile.reseller_id)
            .single()
          
          if (store?.slug) {
            // Use window.location for hard redirect to ensure page reloads
            window.location.href = `/store/${store.slug}`
          } else {
            toast.error('Store not found for your reseller.')
            navigate('/')
          }
        } else {
          toast.error('No reseller assigned to your account.')
          navigate('/')
        }
      }
    } catch (e) {
      setErr(e.message || 'Invalid email or password')
    } finally { 
      setLoading(false) 
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl shadow-2xl shadow-orange-500/30 animate-float mb-4">
            📡
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Donmac Data Hub</h1>
          <p className="text-slate-400 text-sm mt-1">Your trusted data marketplace</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Welcome back 👋</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@example.com"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
              />
            </div>

            {err && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-red-400 text-sm text-center">{err}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/30 mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Sign In →'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-6">
            Don't have an account? Get an invite link from a reseller.
          </p>
        </div>

        <p className="text-center text-slate-600 text-xs mt-4">
          © 2024 Donmac Data Hub. All rights reserved.
        </p>
      </div>
    </div>
  )
}
