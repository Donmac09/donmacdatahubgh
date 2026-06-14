import { useState, useEffect, useRef } from 'react'
import { getOrders, updateOrderStatus, getSettings, setSetting } from '../../lib/supabase'
import { formatCurrency, formatDate } from '../../lib/utils'
import { Card, Table, Td, StatusBadge, NetworkBadge, DateFilters, Toggle, Btn, Empty } from '../../components/ui'
import toast from 'react-hot-toast'

const STATUS_OPTS = ['failed','waiting','pending','processing','delivered']
const AUTO_TIMES = [5,10,15,20,30,45,60]

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ search: '', status: '', network: '', dateFrom: '', dateTo: '' })
  const [autoDeliver, setAutoDeliver] = useState({ enabled: false, minutes: 15 })
  const timerRef = useRef(null)

  useEffect(() => { load(); loadSettings() }, [])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoDeliver.enabled) {
      timerRef.current = setInterval(() => {
        autoDeliverOrders()
      }, autoDeliver.minutes * 60 * 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [autoDeliver])

  async function load() {
    try { setOrders(await getOrders({})) } catch {} finally { setLoading(false) }
  }

  async function loadSettings() {
    try {
      const s = await getSettings()
      if (s.auto_deliver) setAutoDeliver(s.auto_deliver)
    } catch {}
  }

  async function autoDeliverOrders() {
    const pending = orders.filter(o => o.status === 'processing' || o.status === 'pending')
    for (const o of pending) await updateOrderStatus(o.id, 'delivered')
    if (pending.length > 0) { toast.success(`Auto-delivered ${pending.length} orders`); load() }
  }

  async function handleStatusChange(orderId, status) {
    try {
      await updateOrderStatus(orderId, status)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
      toast.success('Status updated')
    } catch (e) { toast.error(e.message) }
  }

  async function handleAutoDeliverToggle(val) {
    const updated = { ...autoDeliver, enabled: val }
    setAutoDeliver(updated)
    await setSetting('auto_deliver', updated)
    toast.success(val ? 'Auto-delivery enabled' : 'Auto-delivery disabled')
  }

  async function handleTimeChange(e) {
    const updated = { ...autoDeliver, minutes: parseInt(e.target.value) }
    setAutoDeliver(updated)
    await setSetting('auto_deliver', updated)
  }

  const filtered = orders.filter(o => {
    if (filters.search && !o.phone?.includes(filters.search)) return false
    if (filters.status && o.status !== filters.status) return false
    if (filters.network && !o.network?.toLowerCase().includes(filters.network.toLowerCase())) return false
    if (filters.dateFrom && new Date(o.created_at) < new Date(filters.dateFrom)) return false
    if (filters.dateTo && new Date(o.created_at) > new Date(filters.dateTo + 'T23:59:59Z')) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Auto-delivery controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <Toggle checked={autoDeliver.enabled} onChange={handleAutoDeliverToggle} label="Auto-Deliver Orders" />
          {autoDeliver.enabled && (
            <select value={autoDeliver.minutes} onChange={handleTimeChange}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
              {AUTO_TIMES.map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : '1 hour'}</option>)}
            </select>
          )}
          <span className="text-xs text-gray-400">
            {autoDeliver.enabled ? `Orders auto-delivered every ${autoDeliver.minutes < 60 ? autoDeliver.minutes + ' min' : '1 hour'}` : 'Auto-delivery is off'}
          </span>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} placeholder="Search phone..." className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40" />
        <select value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Status</option>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={filters.network} onChange={e => setFilters(p => ({ ...p, network: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="">All Networks</option>
          <option value="MTN">MTN</option>
          <option value="Telecel">Telecel</option>
          <option value="AirtelTigo">AirtelTigo</option>
        </select>
        <DateFilters from={filters.dateFrom} to={filters.dateTo} onFrom={v => setFilters(p => ({ ...p, dateFrom: v }))} onTo={v => setFilters(p => ({ ...p, dateTo: v }))} />
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Empty icon="📦" title="No orders found" />
        ) : (
          <Table headers={['Ref', 'Customer', 'Network', 'Package', 'Phone', 'Amount', 'Status', 'Date', 'Action']}>
            {filtered.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <Td><code className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{o.ref}</code></Td>
                <Td className="text-xs">{o.user?.name || '—'}</Td>
                <Td><NetworkBadge network={o.network} /></Td>
                <Td className="font-semibold">{o.package}</Td>
                <Td>{o.phone}</Td>
                <Td className="font-bold">{formatCurrency(o.amount)}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td className="text-xs text-gray-400">{formatDate(o.created_at)}</Td>
                <Td>
                  <select value={o.status} onChange={e => handleStatusChange(o.id, e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-32">
                    {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  )
}
