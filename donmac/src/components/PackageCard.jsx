import { useState } from 'react'
import { formatCurrency, cls } from '../lib/utils'
import { Btn } from './ui'

export default function PackageCard({ groupKey, group, pkgConfig, resellerPrices, onBuy }) {
  const [expanded, setExpanded] = useState(false)

  const groupCfg = pkgConfig.find(c => c.package_key === '__group__' && c.package_group === groupKey) || {}
  if (groupCfg.group_visible === false) return null

  const isOnline = groupCfg.group_online !== false

  const getPrice = (item) => {
    if (resellerPrices?.[item.id]) return resellerPrices[item.id]
    return item.price
  }

  const networkIcon = { mtn: '🟡', telecel: '🔴', airtel: '🔵' }[group.networkKey] || '⚪'

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <button
        onClick={() => setExpanded(p => !p)}
        className="w-full flex items-center justify-between p-5 text-left hover:opacity-95 transition"
        style={{ background: `linear-gradient(135deg, ${group.gradientFrom}15, ${group.gradientTo}08)` }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shadow-sm"
            style={{ background: `linear-gradient(135deg, ${group.gradientFrom}, ${group.gradientTo})` }}>
            {networkIcon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-bold text-gray-900 text-sm sm:text-base">{group.label}</p>
              <span className={cls(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              )}>
                {isOnline ? '● ONLINE' : '● OFFLINE'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{group.items.length} plans · Validity: {group.validity}</p>
          </div>
        </div>
        <span className={cls('text-gray-400 text-lg transition-transform duration-300', expanded && 'rotate-180')}>
          ▾
        </span>
      </button>

      {/* Items grid */}
      {expanded && (
        <div className="p-4 bg-white border-t" style={{ borderColor: group.borderColor }}>
          {!isOnline ? (
            <div className="py-8 text-center">
              <p className="text-4xl mb-2">⛔</p>
              <p className="text-gray-500 font-medium text-sm">This package is currently offline</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {group.items.map(item => {
                const itemCfg = pkgConfig.find(c => c.package_group === groupKey && c.package_key === item.id) || {}
                if (itemCfg.visible === false) return null
                const itemOnline = itemCfg.online !== false
                const price = getPrice(item)

                return (
                  <div key={item.id}
                    className={cls(
                      'rounded-xl p-3.5 border transition-all duration-200 group',
                      itemOnline ? 'hover:scale-105 hover:shadow-md cursor-pointer' : 'opacity-50 cursor-not-allowed',
                    )}
                    style={{ background: group.bgColor, borderColor: group.borderColor }}
                    onClick={() => itemOnline && onBuy(groupKey, item, price)}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={cls('text-[10px] font-bold px-1.5 py-0.5 rounded', itemOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500')}>
                        {itemOnline ? '●' : '✕'}
                      </span>
                    </div>
                    <p className="font-bold text-gray-900 text-base">{item.data}</p>
                    <p className="text-xs text-gray-500 mt-0.5 mb-2">{group.validity}</p>
                    <p className="font-extrabold text-lg" style={{ color: group.networkKey === 'mtn' ? '#B38F00' : group.networkKey === 'telecel' ? '#C01020' : '#1d4ed8' }}>
                      {formatCurrency(price)}
                    </p>
                    {itemOnline && (
                      <div className="mt-2 w-full py-1.5 rounded-lg text-xs font-bold text-center text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                        style={{ background: `linear-gradient(135deg, ${group.gradientFrom}, ${group.gradientTo})` }}>
                        Buy Now
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
