import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import CartDrawer from '../components/CartDrawer'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import Dashboard from './Dashboard'
import TopUps from './TopUps'
import Orders from './Orders'
import Transactions from './Transactions'
import MyStore from './MyStore'
import Profile from './Profile'
import AdminPanel from './admin/AdminPanel'

export default function AppLayout() {
  const navigate = useNavigate()
  const [page, setPage] = useState('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const { open: cartOpen } = useCartStore()
  const { isAdmin, loading, canAccessDashboard, profile } = useAuthStore()

  // Check access - redirect customers away from dashboard
  useEffect(() => {
    if (!loading) {
      if (!canAccessDashboard()) {
        // Customer - redirect to storefront or access denied
        if (profile?.reseller_id) {
          // If they belong to a reseller, redirect to that store
          navigate('/store/access-denied')
        } else {
          navigate('/store/access-denied')
        }
      }
    }
  }, [loading, profile, navigate])

  // Responsive: collapse sidebar on mobile by default
  useEffect(() => {
    const check = () => setCollapsed(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Show loading while checking access
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // If customer, don't render (will be redirected by useEffect)
  if (!canAccessDashboard()) {
    return null
  }

  const leftPad = collapsed ? 'ml-16' : 'ml-60'

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className={`${leftPad} transition-all duration-300 min-h-screen`}>
        <Topbar page={page} setPage={setPage} collapsed={collapsed} />

        {/* Page Content — offset for topbar (64px) + announcement banner (42px if shown) */}
        <main className="pt-16 px-4 sm:px-6 pb-8 min-h-screen">
          <div className="max-w-7xl mx-auto pt-5">
            {page === 'dashboard'    && <Dashboard setPage={setPage} />}
            {page === 'topups'       && <TopUps />}
            {page === 'orders'       && <Orders />}
            {page === 'transactions' && <Transactions />}
            {page === 'mystore'      && <MyStore />}
            {page === 'profile'      && <Profile />}
            {page === 'admin'        && isAdmin() && <AdminPanel />}
          </div>
        </main>
      </div>

      {/* Cart Drawer */}
      {cartOpen && <CartDrawer />}

      {/* Floating WhatsApp */}
      <a href="https://wa.me/2330549358359" target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 left-5 z-40 w-14 h-14 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center shadow-xl shadow-green-500/40 transition-all hover:scale-110">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* Floating Cart Button when drawer closed */}
      {!cartOpen && (
        <button onClick={() => useCartStore.getState().setOpen(true)}
          className="fixed bottom-6 right-5 z-40 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 rounded-full flex items-center justify-center shadow-xl shadow-indigo-500/40 transition-all hover:scale-110">
          <span className="text-2xl">🛒</span>
        </button>
      )}
    </div>
  )
}
