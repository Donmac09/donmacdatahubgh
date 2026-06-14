import { useState, useEffect } from 'react'
import { getPackagesConfig, upsertPackageConfig } from '../../lib/supabase'
import { PACKAGES } from '../../lib/packages'
import { Card, Toggle } from '../../components/ui'
import toast from 'react-hot-toast'

export default function AdminPackages() {
  const [cfg, setCfg] = useState({}) // { 'group__KEY': { group_visible, group_online }, 'group_itemid': { visible, online } }
  const [loading, setLoading] = useState(true)

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

  function getGroupCfg(groupKey) {
    return cfg[groupKey + '____group__'] || { group_visible: true, group_online: true }
  }

  function getItemCfg(groupKey, itemId) {
    return cfg[groupKey + '__' + itemId] || { visible: true, online: true }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {group.items.map(item => {
                  const iCfg = getItemCfg(key, item.id)
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{item.data}</p>
                        <p className="text-xs text-gray-400">₵{item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Toggle
                          checked={iCfg.visible !== false}
                          onChange={v => toggleItem(key, item.id, 'visible', v)}
                          size="sm"
                        />
                        <Toggle
                          checked={iCfg.online !== false}
                          onChange={v => toggleItem(key, item.id, 'online', v)}
                          size="sm"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">Left toggle = Visible/Hidden · Right toggle = Online/Offline</p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
