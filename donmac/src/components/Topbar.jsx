// components/Layout.jsx
import { useState } from 'react'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { cls } from '../lib/utils'

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState('dashboard')
  const [showAnnouncement, setShowAnnouncement] = useState(true)

  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <Topbar
        page={page}
        setPage={setPage}
        collapsed={collapsed}
        onAnnouncementVisibilityChange={setShowAnnouncement}
      />

      <main className={cls(
        'transition-all duration-300 min-h-screen',
        'lg:pl-60',
        collapsed && 'lg:pl-16',
        'pt-16'
      )}>
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
