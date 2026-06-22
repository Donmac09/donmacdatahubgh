// components/Topbar.jsx
import { useState, useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'
import useCartStore from '../store/cartStore'
import { supabase, getNotifications, markNotifRead, getAnnouncements, subscribeNotifications, subscribeAnnouncements } from '../lib/supabase'
import { formatCurrency, timeAgo } from '../lib/utils'
import { sounds } from '../lib/sounds'

export default function Topbar({ page, setPage, collapsed, onOpenMobileMenu }) {
  const { profile } = useAuthStore()
  const { items: cartItems, setOpen: setCartOpen } = useCartStore()
  const [notifs, setNotifs] = useState([])
  const [showNotifs, setShowNotifs] = useState(false)
  const [announcement, setAnnouncement] = useState(null)
  const [showAnnouncement, setShowAnnouncement] = useState(true)
  const notifRef = useRef(null)

  // Load announcements (but don't show at top)
  useEffect(() => {
    if (!profile?.id) return
    loadAnnouncement()

    const annSub = subscribeAnnouncements(() => loadAnnouncement())
    return () => {
      supabase?.removeChannel?.(annSub)
    }
  }, [profile?.id])

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

  async function loadAnnouncement() {
    try {
      const anns = await getAnnouncements(true)
      setAnnouncement(anns[0] || null)
    } catch {}
  }

  async function handleMarkRead(id) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    try {
      await markNotifRead(id)
    } catch {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: false } : n))
    }
  }

  async function handleMarkAllRead() {
    const unreadIds = notifs.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) return
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await Promise.all(unreadIds.map(id => markNotifRead(id)))
    } catch {
      loadNotifs()
    }
  }

  const unread = notifs.filter(n => !n.read).length
  const leftPad = collapsed ? 'lg:left-16' : 'lg:left-60'

  const pageTitles = {
    admin: '⚙️ Admin Panel',
    mystore: '🏪 My Store',
    dashboard: '🏠 Dashboard',
    topups: '💳 Top Ups',
    orders: '📦 Orders',
    transactions: '💰 Transactions',
    profile: '👤 Profile',
  }

  return (
    <>
      {/* Announcement Banner - Now shown as an inline notification inside the topbar */}
      {announcement && showAnnouncement && (
        <div className={`fixed ${leftPad} right-0 z-20 transition-all duration-300 top-16`}>
          <div className="mx-4 sm:mx-6 mb-2 flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-800">
            <span className="text-lg">📢</span>
            <span className="flex-1 truncate font-medium">{announcement.message}</span>
            <button 
              onClick={() => setShowAnnouncement(false)} 
              className="p-1 rounded-lg hover:bg-white/50 transition flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Topbar - Clean design without announcement */}
      <header className={`fixed ${leftPad} right-0 z-20 transition-all duration-300 top-0 bg-white/95 backdrop-blur-md border-b border-gray-100 h-16 flex items-center justify-between px-3 sm:px-6 shadow-sm`}>
        {/* Left: Hamburger (mobile/tablet) + Page Title */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger menu — visible on mobile & tablet only */}
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 transition flex-shrink-0"
            aria-label="Open menu"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="#374151" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate capitalize">
            {pageTitles[page] || page}
          </h1>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          {/* Balance */}
          <div className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 px-4 py-2 rounded-xl">
            <span className="text-emerald-600 font-bold text-sm">{formatCurrency(profile?.balance || 0)}</span>
          </div>

          {/* Cart */}
          <button onClick={() => setCartOpen(true)} className="relative p-2 sm:p-2.5 hover:bg-gray-100 rounded-xl transition">
            <span className="text-xl">🛒</span>
            {cartItems.length > 0 && (
              <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse-glow">
                {cartItems.length}
              </span>
            )}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => setShowNotifs(p => !p)} className="relative p-2 sm:p-2.5 hover:bg-gray-100 rounded-xl transition">
              <span className="text-xl">🔔</span>
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-96 flex flex-col overflow-hidden animate-slide-in-right">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-sm text-gray-900">Notifications</p>
                  {unread > 0 && (
                    <button onClick={handleMarkAllRead} className="text-xs text-indigo-600 hover:underline">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifs.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 text-sm">No notifications yet</p>
                  ) : notifs.map(n => (
                    <div key={n.id} onClick={() => handleMarkRead(n.id)}
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
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
          </button>
        </div>
      </header>
    </>
  )
}
