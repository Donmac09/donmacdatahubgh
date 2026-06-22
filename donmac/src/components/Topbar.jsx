import { useState, useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { getNotifications, markNotifRead, subscribeNotifications } from '../lib/supabase'
import { formatCurrency, timeAgo } from '../lib/utils'
import { sounds } from '../lib/sounds'

export default function Topbar({ page, setPage, collapsed }) {
  const { profile } = useAuthStore()
  const { items: cartItems, setOpen: setCartOpen } = useCartStore()
  const [notifs, setNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    if (!profile?.id) return
    loadNotifs()

    const sub = subscribeNotifications(profile.id, (payload) => {
      const n = payload.new
      setNotifs(prev => [n, ...prev])
      sounds.notification()
      setShowNotifs(true)
    })

    return () => {
      supabase?.removeChannel?.(sub)
    }
  }, [profile?.id])

  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifs() {
    try {
      const data = await getNotifications(profile.id)
      setNotifs(data)
    } catch {}
  }

  const unread = notifs.filter(n => !n.read).length
  const leftPad = collapsed ? 'left-16' : 'left-60'

  return (
    <div>
      {/* Topbar */}
      <header className={`fixed ${leftPad} right-0 z-20 transition-all duration-300 top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 h-16 flex items-center justify-between px-6 shadow-sm`}>
        {/* Page Title */}
        <div>
          <h1 className="text-lg font-bold text-gray-900 capitalize">{page === 'admin' ? '⚙️ Admin Panel' : page === 'mystore' ? '🏪 My Store' : page === 'dashboard' ? '🏠 Dashboard' : page === 'topups' ? '💳 Top Ups' : page === 'orders' ? '📦 Orders' : page === 'transactions' ? '💰 Transactions' : page === 'profile' ? '👤 Profile' : page}</h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Balance */}
          <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-2 rounded-xl">
            <span className="text-emerald-600 font-bold text-sm">{formatCurrency(profile?.balance || 0)}</span>
          </div>

          {/* Cart */}
          <button onClick={() => setCartOpen(true)} className="relative p-2.5 hover:bg-gray-100 rounded-xl transition">
            <span className="text-xl">🛒</span>
            {cartItems.length > 0 && (
              <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse-glow">
                {cartItems.length}
              </span>
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifs(p => !p)} className="relative p-2.5 hover:bg-gray-100 rounded-xl transition">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-96 flex flex-col overflow-hidden animate-slide-in-right">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-900">Notifications</p>
                  {unread > 0 && <button onClick={() => notifs.forEach(n => !n.read && markNotifRead(n.id))} className="text-xs text-indigo-600 hover:underline">Mark all read</button>}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifs.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">No notifications yet</p>
                  ) : notifs.map(n => (
                    <div key={n.id} onClick={() => markNotifRead(n.id)}
                      className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${!n.read ? 'bg-indigo-50/50' : ''}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-sm">{n.type === 'order' ? '📦' : n.type === 'topup' ? '💳' : '💰'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.read && <span className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-1" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Avatar */}
          <button onClick={() => setPage('profile')} className="flex items-center gap-2 hover:opacity-80 transition">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </button>
        </div>
      </header>
    </div>
  )
}
