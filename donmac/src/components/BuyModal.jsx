import { useState } from 'react'
import { Modal, Btn, Input } from './ui'
import { formatCurrency } from '../lib/utils'
import { PACKAGES } from '../lib/packages'
import useCartStore from '../store/cartStore'
import toast from 'react-hot-toast'

export default function BuyModal({ groupKey, item, price, costPrice, onClose }) {
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState('')
  const { addItem, setOpen: setCartOpen } = useCartStore()

  const group = PACKAGES[groupKey]
  if (!group || !item) return null

  function handleAdd() {
    if (!phone || phone.length < 10) { setErr('Enter a valid phone number (10 digits)'); return }
    setErr('')
    addItem({
      id: item.id,
      data: item.data,
      price,
      costPrice: costPrice ?? item.price,
      phone,
      groupKey,
      network: group.network,
    })
    toast.success('Added to cart!')
    onClose()
    setCartOpen(true)
  }

  const netColor = group.networkKey === 'mtn' ? '#B38F00' : group.networkKey === 'telecel' ? '#C01020' : '#1d4ed8'

  return (
    <Modal title={`Buy ${group.label}`} onClose={onClose} size="sm">
      {/* Package Summary */}
      <div className="rounded-xl p-4 mb-5 border"
        style={{ background: group.bgColor, borderColor: group.borderColor }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-extrabold text-gray-900">{item.data}</p>
            <p className="text-sm text-gray-500 mt-0.5">{group.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">Validity: <span className="font-medium text-gray-600">{group.validity}</span></p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black" style={{ color: netColor }}>{formatCurrency(price)}</p>
          </div>
        </div>
      </div>

      <Input
        label="Recipient Phone Number"
        value={phone}
        onChange={e => { setPhone(e.target.value); setErr('') }}
        placeholder="e.g. 0241234567"
        type="tel"
        error={err}
        className="mb-5"
        icon="📞"
      />

      <div className="flex gap-3">
        <Btn onClick={handleAdd} className="flex-1" size="lg">
          🛒 Add to Cart
        </Btn>
        <Btn onClick={onClose} variant="secondary" size="lg" className="flex-1">
          Cancel
        </Btn>
      </div>
    </Modal>
  )
}
