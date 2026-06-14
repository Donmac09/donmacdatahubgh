import { create } from 'zustand'

const useCartStore = create((set, get) => ({
  items: [],
  open: false,

  addItem: (item) => {
    set(s => ({ items: [...s.items, { ...item, cartId: Date.now() + Math.random() }] }))
  },

  removeItem: (cartId) => {
    set(s => ({ items: s.items.filter(i => i.cartId !== cartId) }))
  },

  clear: () => set({ items: [] }),

  setOpen: (open) => set({ open }),

  get total() {
    return get().items.reduce((s, i) => s + (i.price || 0), 0)
  },

  get count() {
    return get().items.length
  }
}))

export default useCartStore
