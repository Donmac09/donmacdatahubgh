import { useState } from 'react'
import useCartStore from '../store/cartStore'
import useAuthStore from '../store/authStore'
import { formatCurrency } from '../lib/utils'
import { Btn } from './ui'
import { supabase } from '../lib/supabase'
import { PACKAGES, placeGHDataOrder } from '../lib/packages'
import { generateRef } from '../lib/utils'
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
      for (const item of items) {
        const ref = generateRef()
        const group = PACKAGES[item.groupKey]
        
        // Determine if this is a manual package (MTN Mashup)
        const isManual = item.ghdata_type === 'mtn-ishare' || 
                        item.id?.startsWith('mm') || 
                        item.id?.startsWith('mmm')

        // Insert order with all fields
        const { data: order, error: orderErr } = await supabase.from('orders').insert({
          ref,
          user_id: profile.id,
          reseller_id: profile.reseller_id || null,
          network: group?.network || item.network,
          package: item.data,
          package_key: item.id,
          phone: item.phone,
          amount: item.price,
          cost_price: item.costPrice || item.price,
          profit: (item.price - (item.costPrice || item.price)),
          status: 'pending',
          ghdata_type: group?.ghdata_type || null, // ADD THIS
          is_manual: isManual, // ADD THIS - flags MTN Mashup for manual delivery
          item_data: {
            data: item.data,
            groupKey: item.groupKey,
            network: group?.network
          }
        }).select().single()
        if (orderErr) throw orderErr

        // Debit wallet
        await supabase.rpc('credit_user', {
          p_user_id: profile.id,
          p_amount: -item.price,
          p_desc: `Purchase ${group?.network} ${item.data} (Ref: ${ref})`
        })

        // Record transaction
        await supabase.from('transactions').insert({
          user_id: profile.id,
          type: 'debit',
          description: `Purchase ${group?.network || ''} ${item.data} — ${item.phone}`,
          amount: item.price,
          status: 'success',
        })

        // Notify
        await supabase.from('notifications').insert({
          user_id: profile.id,
          title: 'Order Placed!',
          message: `Your order for ${group?.network} ${item.data} (Ref: ${ref}) has been placed.`,
          type: 'order',
        })

        // ONLY send to GHData if NOT a manual package
        if (!isManual && group?.ghdata_type && group.ghdata_type !== 'mtn-ishare') {
          try {
            await placeGHDataOrder({ 
              network: group.ghdata_type, 
              phone: item.phone, 
              dataAmount: item.data 
            })
          } catch (ghError) {
            console.error('GHData delivery failed:', ghError)
            // Don't throw - order is already created
            // Admin will need to process manually
          }
        } else {
          // Log that this is a manual order
          console.log(`📝 Manual order created: ${ref} - ${group?.network} ${item.data}`)
        }
      }

      await refreshProfile()
      sounds.order()
      toast.success(`${items.length} order(s) placed successfully!`)
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
            const isManual = item.ghdata_type === 'mtn-ishare' || 
                            item.id?.startsWith('mm') || 
                            item.id?.startsWith('mmm')
            return (
              <div key={item.cartId} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{item.data}</p>
                      {isManual && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Manual
                        </span>
                      )}
                    </div>
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
