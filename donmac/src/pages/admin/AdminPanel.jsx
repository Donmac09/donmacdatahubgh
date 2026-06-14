import { useState } from 'react'
import AdminAnalytics from './AdminAnalytics'
import AdminUsers from './AdminUsers'
import AdminOrders from './AdminOrders'
import AdminTopUps from './AdminTopUps'
import AdminPackages from './AdminPackages'
import AdminWithdrawals from './AdminWithdrawals'
import AdminResellers from './AdminResellers'
import AdminAnnouncements from './AdminAnnouncements'

const TABS = [
  { id: 'analytics',     icon: '📊', label: 'Analytics' },
  { id: 'users',         icon: '👥', label: 'Users' },
  { id: 'orders',        icon: '📦', label: 'Orders' },
  { id: 'topups',        icon: '💳', label: 'Top Ups' },
  { id: 'packages',      icon: '⚙️', label: 'Packages' },
  { id: 'withdrawals',   icon: '💸', label: 'Withdrawals' },
  { id: 'resellers',     icon: '🏪', label: 'Resellers' },
  { id: 'announcements', icon: '📢', label: 'Announcements' },
]

export default function AdminPanel() {
  const [tab, setTab] = useState('analytics')

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tab bar - scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 min-w-max sm:min-w-0 sm:flex-wrap">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'analytics' && <AdminAnalytics />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'topups' && <AdminTopUps />}
      {tab === 'packages' && <AdminPackages />}
      {tab === 'withdrawals' && <AdminWithdrawals />}
      {tab === 'resellers' && <AdminResellers />}
      {tab === 'announcements' && <AdminAnnouncements />}
    </div>
  )
}
