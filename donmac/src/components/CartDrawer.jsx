import { useState } from 'react'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import { formatCurrency } from '../lib/utils'
import { Btn } from './ui'
import { supabase } from '../lib/supabase'
import { PACKAGES } from '../lib/packages'
import { sounds } from '../lib/sounds'
import toast from 'react-hot-toast'

export default function CartDrawer({ onOrderPlaced }) {
  const { items, removeItem, clear, setOpen, total } = useCartStore()
  const { profile, refreshProfile } = useAuthStore()
  const [loading, setLoading] = useState(false)

  const totalAmount = items.reduce((s, i) => s + (i.price || 0), 0)

  async function handleCheckout() {
    if (!profile) return
    if (profile.balance < totalAmount) {
      toast.error('Insufficient wallet balance. Please top up.')
      sounds.error()
      return
    }
    setLoading(true)
    try {
      // Get current session token to authenticate the server-side order placement
      const { data: { session }, error: sessErr } = await supabase.auth.getSession()
      if (sessErr || !session?.access_token) {
        throw new Error('Your session expired. Please log in again.')
      }

      // Build payload — server resolves manual vs auto-delivery and dispatches
      // to GHData only for MTN, Telecel, AirtelTigo Premium & Big Time.
      // MTN Mashup Data / MTN Mashup Minutes+Data are never sent to GHData.
      const payload = {
        items: items.map(item => {
          const group = PACKAGES[item.groupKey]
          return {
            groupKey: item.groupKey,
            itemId: item.id,
            dataLabel: item.data,
            network: group?.network || item.network,
            phone: item.phone,
            price: item.price,
            costPrice: item.costPrice || item.price,
          }
        }),
      }

      const res = await fetch('/api/orders/place', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Failed to place order')
      }

      await refreshProfile()
      sounds.order()
      toast.success(`${result.orders.length} order(s) placed successfully!`)
      clear()
      setOpen(false)
      onOrderPlaced?.()
    } catch (err) {
      toast.error(err.message || 'Failed to place order')
      sounds.error()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-sm bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <h2 className="font-bold text-gray-900">Cart</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-500 text-xl">&times;</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <span className="text-5xl mb-4">🛒</span>
              <p className="font-semibold text-gray-700">Your cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">Add a data package to get started</p>
            </div>
          ) : items.map(item => {
            const group = PACKAGES[item.groupKey]
            return (
              <div key={item.cartId} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{item.data}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{group?.label}</p>
                    <p className="text-xs text-gray-500">📞 {item.phone}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Validity: {group?.validity}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-indigo-600">{formatCurrency(item.price)}</p>
                    <button onClick={() => removeItem(item.cartId)}
                      className="text-xs text-red-400 hover:text-red-600 mt-2 transition">Remove</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-5 border-t border-gray-100 bg-gray-50/50">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-gray-500">Wallet Balance</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(profile?.balance || 0)}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-extrabold text-xl text-indigo-600">{formatCurrency(totalAmount)}</span>
            </div>
            {totalAmount > (profile?.balance || 0) && (
              <p className="text-xs text-red-500 font-medium mb-3 text-center">⚠️ Insufficient balance. Top up your wallet.</p>
            )}
            <Btn onClick={handleCheckout} loading={loading} className="w-full" size="lg">
              ✓ Proceed to Pay
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}
