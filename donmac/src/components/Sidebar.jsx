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
    <aside className={cls(
      'fixed left-0 top-0 h-screen z-30 flex flex-col transition-all duration-300 ease-in-out',
      'bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 border-r border-white/5',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10 min-h-[68px]">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-lg flex-shrink-0 shadow-lg animate-float">
          📡
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-white text-sm leading-tight">Donmac</p>
            <p className="text-xs text-slate-400 leading-tight">Data Hub</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto space-y-1">
        {items.map(item => {
          const active = page === item.id
          return (
            <button key={item.id} onClick={() => setPage(item.id)}
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

      {/* User & Collapse */}
      <div className="border-t border-white/10 p-2 space-y-1">
        {!collapsed && (
          <div className="px-3 py-2 rounded-xl bg-white/5 mb-1">
            <p className="text-xs text-white font-semibold truncate">{profile?.name}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{profile?.role}</p>
          </div>
        )}
        <button onClick={logout}
          className={cls('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition text-sm font-medium', collapsed && 'justify-center')}>
          <span className="text-lg">🚪</span>
          {!collapsed && 'Sign Out'}
        </button>
        <button onClick={() => setCollapsed(p => !p)}
          className={cls('w-full flex items-center gap-3 px-3 py-2 rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-300 transition text-sm', collapsed && 'justify-center')}>
          <span>{collapsed ? '▶' : '◀'}</span>
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
