import { useState, useEffect } from 'react'
import { getPackagesConfig, upsertPackageConfig } from '../../lib/supabase'
import { PACKAGES } from '../../lib/packages'
import { Card, Toggle } from '../../components/ui'
import { formatCurrency as fmt } from '../../lib/utils'
import toast from 'react-hot-toast'

export default function AdminPackages() {
  const [cfg, setCfg] = useState({}) // { 'group__KEY': { group_visible, group_online }, 'group_itemid': { visible, online, selling_price, cost_price } }
  const [loading, setLoading] = useState(true)
  const [editingPrices, setEditingPrices] = useState({}) // local draft values while typing, keyed by rowKey
  const [savingPrice, setSavingPrice] = useState({}) // rowKey -> bool

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const rows = await getPackagesConfig()
      const map = {}
      rows.forEach(r => { map[r.package_group + '__' + r.package_key] = r })
      setCfg(map)
    } catch {} finally { setLoading(false) }
  }

  async function toggleGroup(groupKey, field, val) {
    const rowKey = groupKey + '____group__'
    const existing = cfg[groupKey + '____group__'] || {}
    const updated = { ...existing, package_group: groupKey, package_key: '__group__', [field]: val }
    setCfg(p => ({ ...p, [rowKey]: updated }))
    try {
      await upsertPackageConfig(updated)
      toast.success('Updated!')
    } catch (e) { toast.error(e.message) }
  }

  async function toggleItem(groupKey, itemId, field, val) {
    const rowKey = groupKey + '__' + itemId
    const existing = cfg[rowKey] || {}
    const updated = { ...existing, package_group: groupKey, package_key: itemId, [field]: val }
    setCfg(p => ({ ...p, [rowKey]: updated }))
    try {
      await upsertPackageConfig(updated)
      toast.success('Updated!')
    } catch (e) { toast.error(e.message) }
  }

  async function savePriceField(groupKey, itemId, field, value) {
    const rowKey = groupKey + '__' + itemId
    const num = value === '' ? null : parseFloat(value)
    if (value !== '' && (isNaN(num) || num < 0)) {
      toast.error('Enter a valid positive number')
      return
    }
    setSavingPrice(p => ({ ...p, [rowKey + '_' + field]: true }))
    try {
      const existing = cfg[rowKey] || {}
      const updated = { ...existing, package_group: groupKey, package_key: itemId, [field]: num }
      await upsertPackageConfig(updated)
      setCfg(p => ({ ...p, [rowKey]: updated }))
      toast.success(field === 'selling_price' ? 'Selling price updated!' : 'Cost price updated!')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setSavingPrice(p => ({ ...p, [rowKey + '_' + field]: false }))
    }
  }

  function getGroupCfg(groupKey) {
    return cfg[groupKey + '____group__'] || { group_visible: true, group_online: true }
  }

  function getItemCfg(groupKey, itemId) {
    return cfg[groupKey + '__' + itemId] || { visible: true, online: true, selling_price: null, cost_price: null }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
        💡 <strong>Selling Price</strong> is what customers pay. <strong>Cost Price</strong> is your wholesale cost —
        used to calculate your admin profit (Selling − Cost) when an order is delivered. Leave blank to use the
        default hardcoded price.
      </div>

      {Object.entries(PACKAGES).map(([key, group]) => {
        const gCfg = getGroupCfg(key)
        const networkColor = group.networkKey === 'mtn' ? 'border-yellow-200 bg-yellow-50/30' : group.networkKey === 'telecel' ? 'border-red-200 bg-red-50/30' : 'border-blue-200 bg-blue-50/30'

        return (
          <Card key={key} className={`p-0 overflow-hidden border-2 ${networkColor}`}>
            {/* Group Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${group.gradientFrom}, ${group.gradientTo})` }}>
                  {group.networkKey === 'mtn' ? '🟡' : group.networkKey === 'telecel' ? '🔴' : '🔵'}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{group.label}</p>
                  <p className="text-xs text-gray-400">{group.items.length} packages · {group.validity}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <Toggle
                  checked={gCfg.group_visible !== false}
                  onChange={v => toggleGroup(key, 'group_visible', v)}
                  label={<span className="text-xs font-semibold text-gray-600">Visible</span>}
                  size="sm"
                />
                <Toggle
                  checked={gCfg.group_online !== false}
                  onChange={v => toggleGroup(key, 'group_online', v)}
                  label={<span className={`text-xs font-semibold ${gCfg.group_online !== false ? 'text-green-600' : 'text-gray-400'}`}>{gCfg.group_online !== false ? 'Online' : 'Offline'}</span>}
                  size="sm"
                />
              </div>
            </div>

            {/* Items */}
            <div className="px-5 py-4 bg-white/60">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {group.items.map(item => {
                  const iCfg = getItemCfg(key, item.id)
                  const rowKey = key + '__' + item.id
                  const sellingDraft = editingPrices[rowKey + '_selling_price']
                  const costDraft = editingPrices[rowKey + '_cost_price']
                  const effectiveSelling = iCfg.selling_price ?? item.price
                  const effectiveCost = iCfg.cost_price ?? iCfg.selling_price ?? item.price
                  const profit = effectiveSelling - effectiveCost

                  return (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-xl px-3 py-3 shadow-sm space-y-2.5">
                      {/* Top row: name + toggles */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{item.data}</p>
                          <p className="text-[10px] text-gray-400">
                            Default: ₵{item.price.toFixed(2)}
                            {profit !== 0 && (
                              <span className={profit > 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                                {' '}· Profit: {fmt(profit)}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Toggle checked={iCfg.visible !== false} onChange={v => toggleItem(key, item.id, 'visible', v)} size="sm" />
                          <Toggle checked={iCfg.online !== false} onChange={v => toggleItem(key, item.id, 'online', v)} size="sm" />
                        </div>
                      </div>

                      {/* Price inputs */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Selling Price (₵)</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={item.price.toFixed(2)}
                              value={sellingDraft !== undefined ? sellingDraft : (iCfg.selling_price ?? '')}
                              onChange={e => setEditingPrices(p => ({ ...p, [rowKey + '_selling_price']: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
                            />
                            <button
                              onClick={() => savePriceField(key, item.id, 'selling_price', sellingDraft !== undefined ? sellingDraft : (iCfg.selling_price ?? ''))}
                              disabled={savingPrice[rowKey + '_selling_price']}
                              className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition whitespace-nowrap"
                            >
                              {savingPrice[rowKey + '_selling_price'] ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block mb-1">Cost Price (₵)</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder={item.price.toFixed(2)}
                              value={costDraft !== undefined ? costDraft : (iCfg.cost_price ?? '')}
                              onChange={e => setEditingPrices(p => ({ ...p, [rowKey + '_cost_price']: e.target.value }))}
                              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button
                              onClick={() => savePriceField(key, item.id, 'cost_price', costDraft !== undefined ? costDraft : (iCfg.cost_price ?? ''))}
                              disabled={savingPrice[rowKey + '_cost_price']}
                              className="px-2 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition whitespace-nowrap"
                            >
                              {savingPrice[rowKey + '_cost_price'] ? '...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">Toggles: left = Visible/Hidden · right = Online/Offline. Type a price and click Save to update it instantly in the database.</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
