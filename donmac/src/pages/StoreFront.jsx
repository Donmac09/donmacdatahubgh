import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getStoreBySlug, getResellerPrices } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { PACKAGES } from '../lib/packages'
import { formatCurrency } from '../lib/utils'
import { Btn, Input, Spinner, Modal } from '../components/ui'
import PackageCard from '../components/PackageCard'
import BuyModal from '../components/BuyModal'
import CartDrawer from '../components/CartDrawer'
import toast from 'react-hot-toast'

export default function StoreFront() {
  const { slug } = useParams()
  const { user, profile, login, register, logout, setStorefront } = useAuthStore()
  const { open: cartOpen, setOpen: setCartOpen, items: cartItems } = useCartStore()
  const [store, setStore] = useState(null)
  const [reseller, setReseller] = useState(null)
  const [resellerPrices, setResellerPrices] = useState({})
  const [pkgConfig, setPkgConfig] = useState([])
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState('login') // login | register
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authErr, setAuthErr] = useState('')
  const [buyState, setBuyState] = useState(null)
  const [page, setPage] = useState('home') // home | orders | topups | profile

  useEffect(() => { loadStore() }, [slug])

  async function loadStore() {
    try {
      const storeData = await getStoreBySlug(slug)
      setStore(storeData)
      setReseller(storeData.reseller)
      setStorefront({ storeId: storeData.id, resellerId: storeData.reseller_id })
      // Load prices and config
      const [prices, { data: cfg }] = await Promise.all([
        getResellerPrices(storeData.reseller_id),
        supabase.from('packages_config').select('*'),
      ])
      const priceMap = {}
      prices.forEach(p => { priceMap[p.package_key] = p.price })
      setResellerPrices(priceMap)
      setPkgConfig(cfg || [])
    } catch (e) {
      setStore(null)
    } finally { setLoading(false) }
  }

  async function handleAuth(e) {
    e?.preventDefault()
    setAuthErr(''); setAuthLoading(true)
    try {
      if (authMode === 'login') {
        const p = await login(form.email, form.password)
        // Verify this customer belongs to this reseller
        if (p.role === 'customer' && p.reseller_id !== store?.reseller_id) {
          toast.error('This account is not registered under this store.')
          await logout()
          return
        }
        toast.success('Signed in!')
      } else {
        if (!form.name || !form.email || !form.phone || !form.password) { setAuthErr('All fields required'); return }
        await register(form.email, form.password, {
          name: form.name, phone: form.phone,
          role: 'customer', reseller_id: store?.reseller_id
        })
        toast.success('Account created!')
      }
    } catch (e) { setAuthErr(e.message) } finally { setAuthLoading(false) }
  }

  const whatsappNumber = store?.whatsapp || '0549358359'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <Spinner size="lg" />
    </div>
  )

  if (!store || reseller?.status === 'blocked') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-indigo-900">
      <div className="text-center text-white">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold">Store not found</h1>
        <p className="text-slate-400 mt-2">This store doesn't exist or is unavailable.</p>
      </div>
    </div>
  )

  // Auth screen (not logged in)
  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="relative w-full max-w-md animate-slide-up">
          {/* Store Branding */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-2xl mb-4 animate-float">
              🏪
            </div>
            <h1 className="text-3xl font-black text-white">{store.name}</h1>
            {store.welcome && <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">{store.welcome}</p>}
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            {/* Tab switcher */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6">
              {['login', 'register'].map(m => (
                <button key={m} onClick={() => { setAuthMode(m); setAuthErr('') }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition ${authMode === m ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                  {m === 'login' ? 'Sign In' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                    <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your full name"
                      className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Phone Number</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="0XX XXX XXXX"
                      className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@email.com"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••"
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition" />
              </div>
              {authErr && <p className="text-red-400 text-sm text-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{authErr}</p>}
              <button type="submit" disabled={authLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/30">
                {authLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : authMode === 'login' ? 'Sign In →' : 'Create Account →'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Logged-in storefront dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Storefront Top Bar */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">🏪</div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{store.name}</p>
              <p className="text-xs text-gray-400">Powered by Donmac Data Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl hidden sm:block">{formatCurrency(profile?.balance || 0)}</span>
            <button onClick={() => setCartOpen(true)} className="relative p-2 hover:bg-gray-100 rounded-xl">
              🛒{cartItems.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartItems.length}</span>}
            </button>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500 transition">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white mb-6">
          <h2 className="text-xl font-bold">Welcome, {profile?.name?.split(' ')[0]}! 👋</h2>
          <p className="text-indigo-200 text-sm mt-1">Wallet: <strong>{formatCurrency(profile?.balance || 0)}</strong></p>
        </div>

        {/* Packages */}
        <h3 className="font-bold text-gray-900 text-lg mb-4">Available Packages</h3>
        <div className="space-y-4">
          {Object.entries(PACKAGES).map(([key, group]) => (
            <PackageCard key={key} groupKey={key} group={group} pkgConfig={pkgConfig}
              resellerPrices={resellerPrices}
              onBuy={(gk, item, price) => setBuyState({ groupKey: gk, item, price })} />
          ))}
        </div>
      </main>

      {buyState && <BuyModal {...buyState} onClose={() => setBuyState(null)} />}
      {cartOpen && <CartDrawer />}

      {/* WhatsApp */}
      <a href={`https://wa.me/233${whatsappNumber.replace(/^0/, '')}`} target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 left-5 z-30 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 transition-all hover:scale-110">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </div>
  )
}
