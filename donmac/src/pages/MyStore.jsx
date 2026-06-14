import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { createStore, updateStore, getResellerPrices, upsertResellerPrices, getAllWithdrawals } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { PACKAGES } from '../lib/packages'
import { formatCurrency, formatDate } from '../lib/utils'
import { Card, Btn, Input, Textarea, Table, Td, StatusBadge, Empty, Modal } from '../components/ui'
import toast from 'react-hot-toast'

export default function MyStore() {
  const { profile, refreshProfile, updateProfileLocal } = useAuthStore()
  const [storeForm, setStoreForm] = useState({ name: '', slug: '', whatsapp: '', welcome: '' })
  const [prices, setPrices] = useState({})
  const [savedPrices, setSavedPrices] = useState({})
  const [withdrawals, setWithdrawals] = useState([])
  const [wdAmount, setWdAmount] = useState('')
  const [savingStore, setSavingStore] = useState(false)
  const [savingPrices, setSavingPrices] = useState(false)
  const [editPrices, setEditPrices] = useState(false)
  const [showWdModal, setShowWdModal] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  const hasStore = !!profile?.store

  useEffect(() => {
    if (hasStore) {
      setStoreForm({ name: profile.store.name, slug: profile.store.slug, whatsapp: profile.store.whatsapp, welcome: profile.store.welcome || '' })
      loadPrices()
      loadWithdrawals()
    }
  }, [profile])

  async function loadPrices() {
    const data = await getResellerPrices(profile.id)
    const map = {}
    data.forEach(p => { map[p.package_key] = p.price })
    setSavedPrices(map)
    setPrices(map)
  }

  async function loadWithdrawals() {
    const { data } = await supabase.from('withdrawals').select('*').eq('reseller_id', profile.id).order('created_at', { ascending: false })
    setWithdrawals(data || [])
  }

  async function handleCreateStore() {
    if (!storeForm.name || !storeForm.slug || !storeForm.whatsapp) { toast.error('Fill all required fields'); return }
    setSavingStore(true)
    try {
      await createStore({ ...storeForm, reseller_id: profile.id })
      await refreshProfile()
      toast.success('Store created!')
    } catch (e) { toast.error(e.message) } finally { setSavingStore(false) }
  }

  async function handleSavePrices() {
    setSavingPrices(true)
    try {
      await upsertResellerPrices(profile.id, prices)
      setSavedPrices({ ...prices })
      setEditPrices(false)
      toast.success('Prices saved!')
    } catch (e) { toast.error(e.message) } finally { setSavingPrices(false) }
  }

  async function handleWithdraw() {
    const amt = parseFloat(wdAmount)
    if (!amt || amt < 30) { toast.error('Minimum withdrawal is ₵30'); return }
    if (amt > (profile.profit || 0)) { toast.error('Insufficient profit balance'); return }
    try {
      await supabase.from('withdrawals').insert({ reseller_id: profile.id, amount: amt, status: 'pending' })
      toast.success('Withdrawal request submitted!')
      setShowWdModal(false)
      setWdAmount('')
      loadWithdrawals()
    } catch (e) { toast.error(e.message) }
  }

  const shareLink = hasStore ? `${window.location.origin}/store/${profile.store.slug}` : ''

  const tabs = ['overview', 'prices', 'withdrawals']

  if (!hasStore) {
    return (
      <div className="max-w-lg animate-fade-in">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Create Your Store</h2>
        <Card className="p-6">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-3">🏪</div>
            <p className="text-gray-600 text-sm">Set up your reseller storefront to start selling data to customers.</p>
          </div>
          <div className="space-y-4">
            <Input label="Store Name *" value={storeForm.name} onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Kwame Data Hub" icon="🏪" />
            <Input label="Store Slug (URL) *" value={storeForm.slug} onChange={e => setStoreForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} placeholder="e.g. kwame-data" icon="🔗" />
            <Input label="WhatsApp Number *" value={storeForm.whatsapp} onChange={e => setStoreForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="0XX XXX XXXX" icon="📱" />
            <Textarea label="Welcome Message" value={storeForm.welcome} onChange={e => setStoreForm(p => ({ ...p, welcome: e.target.value }))} placeholder="Welcome to my data store! Get the best deals here." />
          </div>
          <Btn onClick={handleCreateStore} loading={savingStore} className="w-full mt-5" size="lg">🏪 Create Store</Btn>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Store Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 to-purple-900 p-6 text-white">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">My Reseller Store</p>
            <h2 className="text-2xl font-bold">{profile.store.name}</h2>
            <p className="text-indigo-300 text-sm mt-1">/{profile.store.slug}</p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="bg-white/10 rounded-xl px-4 py-3 text-center">
              <p className="text-xs text-indigo-200">Profit Balance</p>
              <p className="text-3xl font-black">{formatCurrency(profile.profit || 0)}</p>
            </div>
            <Btn onClick={() => setShowWdModal(true)} variant="warning" size="sm">💸 Withdraw</Btn>
          </div>
        </div>
        {/* Share link */}
        <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
          <span className="text-xs text-indigo-200 flex-1 truncate font-mono">{shareLink}</span>
          <button onClick={() => { navigator.clipboard?.writeText(shareLink); toast.success('Link copied!') }}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition font-semibold">Copy</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition ${activeTab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="p-5 text-center">
            <p className="text-3xl font-black text-indigo-600">{formatCurrency(profile.profit || 0)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Profit</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-black text-emerald-600">{profile.store.whatsapp}</p>
            <p className="text-sm text-gray-500 mt-1">WhatsApp</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-3xl font-black text-amber-600">{withdrawals.filter(w => w.status === 'paid').reduce((s, w) => s + w.amount, 0).toFixed(2)}</p>
            <p className="text-sm text-gray-500 mt-1">Total Withdrawn (₵)</p>
          </Card>
        </div>
      )}

      {/* Prices */}
      {activeTab === 'prices' && (
        <Card className="p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-gray-900">My Package Prices</h3>
            {!editPrices ? (
              <Btn onClick={() => setEditPrices(true)} variant="secondary" size="sm">✏️ Edit Prices</Btn>
            ) : (
              <div className="flex gap-2">
                <Btn onClick={handleSavePrices} loading={savingPrices} size="sm">💾 Save</Btn>
                <Btn onClick={() => { setPrices(savedPrices); setEditPrices(false) }} variant="secondary" size="sm">Cancel</Btn>
              </div>
            )}
          </div>
          {Object.entries(PACKAGES).map(([key, group]) => (
            <div key={key} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: group.color }} />
                <p className="font-semibold text-gray-800 text-sm">{group.label}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.items.map(item => {
                  const cost = item.price
                  const myPrice = prices[item.id] || cost
                  const profit = myPrice - cost
                  return (
                    <div key={item.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <p className="font-semibold text-sm text-gray-800">{item.data}</p>
                      <p className="text-xs text-gray-400">Cost: {formatCurrency(cost)}</p>
                      {editPrices ? (
                        <input type="number" step="0.01" min={cost} value={prices[item.id] || ''}
                          onChange={e => setPrices(p => ({ ...p, [item.id]: parseFloat(e.target.value) }))}
                          placeholder={cost.toFixed(2)}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                      ) : (
                        <div className="mt-1 flex items-center justify-between">
                          <p className="font-bold text-sm text-indigo-600">{formatCurrency(myPrice)}</p>
                          {profit > 0 && <span className="text-[10px] text-green-600 font-semibold">+{formatCurrency(profit)}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Withdrawals */}
      {activeTab === 'withdrawals' && (
        <Card className="p-0 overflow-hidden">
          {withdrawals.length === 0 ? (
            <Empty icon="💸" title="No withdrawals yet" description="Request your first withdrawal" />
          ) : (
            <Table headers={['Date', 'Amount', 'Status']}>
              {withdrawals.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <Td className="text-xs text-gray-400">{formatDate(w.created_at)}</Td>
                  <Td><span className="font-bold text-gray-900">{formatCurrency(w.amount)}</span></Td>
                  <Td><StatusBadge status={w.status} /></Td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {/* Withdraw Modal */}
      {showWdModal && (
        <Modal title="💸 Request Withdrawal" onClose={() => setShowWdModal(false)} size="sm">
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-sm text-emerald-700">Available Profit: <strong>{formatCurrency(profile.profit || 0)}</strong></p>
              <p className="text-xs text-emerald-600 mt-0.5">Minimum withdrawal: ₵30</p>
            </div>
            <Input label="Amount (₵)" type="number" min="30" max={profile.profit || 0} value={wdAmount} onChange={e => setWdAmount(e.target.value)} placeholder="0.00" icon="₵" />
            <Btn onClick={handleWithdraw} className="w-full" size="lg">Submit Request</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
