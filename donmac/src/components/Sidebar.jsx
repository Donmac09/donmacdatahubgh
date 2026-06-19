import { cls } from '../lib/utils'
import useAuthStore from '../store/authStore'

const NAV = [
  { id: 'dashboard',    icon: '🏠', label: 'Dashboard' },
  { id: 'topups',       icon: '💳', label: 'Top Ups' },
  { id: 'orders',       icon: '📦', label: 'Orders' },
  { id: 'transactions', icon: '💰', label: 'Transactions' },
]
const RESELLER_NAV = [{ id: 'mystore', icon: '🏪', label: 'My Store' }]
const ADMIN_NAV    = [{ id: 'admin',   icon: '⚙️', label: 'Admin' }]

export default function Sidebar({ page, setPage, collapsed, setCollapsed }) {
  const { profile, logout, isAdmin, isReseller } = useAuthStore()
  const _isAdmin = isAdmin()
  const _isReseller = isReseller()

  const items = [
    ...NAV,
    ...(_isReseller || _isAdmin ? RESELLER_NAV : []),
    { id: 'profile', icon: '👤', label: 'Profile' },
    ...(_isAdmin ? ADMIN_NAV : []),
  ]

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside className={cls(
        'fixed left-0 top-0 h-screen z-30 flex flex-col transition-all duration-300 ease-in-out',
        'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/5',
        // Mobile: slide in/out, Desktop: collapse width
        collapsed 
          ? '-translate-x-full md:translate-x-0 md:w-16' 
          : 'translate-x-0 md:w-60'
      )}>
        {/* Logo with hamburger toggle */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 min-h-[68px]">
          {/* Hamburger button - visible on mobile/tablet */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="md:hidden p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white"
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              // Menu icon (three lines)
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 6h16M4 12h16M4 18h16" 
                />
              </svg>
            ) : (
              // Close/X icon
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M6 18L18 6M6 6l12 12" 
                />
              </svg>
            )}
          </button>

          {/* Logo icon */}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg flex-shrink-0 shadow-lg animate-float">
            📡
          </div>
          
          {/* Logo text - hidden when collapsed on desktop */}
          {!collapsed && (
            <div className="overflow-hidden hidden md:block">
              <p className="font-bold text-white text-sm leading-tight">Donmac</p>
              <p className="text-xs text-slate-400 leading-tight">Data Hub</p>
            </div>
          )}

          {/* Desktop collapse toggle - hidden on mobile */}
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex ml-auto p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <span className="text-sm">{collapsed ? '▶' : '◀'}</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto space-y-1">
          {items.map(item => {
            const active = page === item.id
            return (
              <button key={item.id} onClick={() => {
                setPage(item.id)
                // Close sidebar on mobile after navigation
                if (window.innerWidth < 768) setCollapsed(true)
              }}
                className={cls(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm font-medium group relative',
                  active
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
                    : 'text-slate-400 hover:bg-white/10 hover:text-white',
                  collapsed && 'justify-center'
                )}>
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
                {collapsed && (
                  <span className="absolute left-full ml-2 px-2 py-1 bg-slate-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.label}
                  </span>
                )}
                {active && !collapsed && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                )}
              </button>
            )
          })}
        </nav>

        {/* User & Sign Out */}
        <div className="border-t border-white/10 p-2 space-y-1">
          {!collapsed && (
            <div className="px-3 py-2 rounded-xl bg-white/5 mb-1 hidden md:block">
              <p className="text-xs text-white font-semibold truncate">{profile?.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{profile?.role}</p>
            </div>
          )}
          <button onClick={logout}
            className={cls('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-sm font-medium', collapsed && 'justify-center')}>
            <span className="text-lg">🚪</span>
            {!collapsed && 'Sign Out'}
          </button>
        </div>
      </aside>
    </>
  )
}
