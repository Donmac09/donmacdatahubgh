import { create } from 'zustand'
import { supabase, getProfile, signIn, signUp, signOut } from '../lib/supabase'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  storefront: null, // { store, reseller } when browsing as storefront customer

  setStorefront: (sf) => set({ storefront: sf }),

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      try {
        const profile = await getProfile(session.user.id)
        set({ user: session.user, profile, loading: false })
      } catch {
        set({ loading: false })
      }
    } else {
      set({ loading: false })
    }
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const profile = await getProfile(session.user.id)
          set({ user: session.user, profile })
        } catch {}
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, storefront: null })
      }
    })
  },

  login: async (email, password) => {
    const data = await signIn(email, password)
    const profile = await getProfile(data.user.id)
    set({ user: data.user, profile })
    return profile
  },

  register: async (email, password, meta) => {
    const data = await signUp(email, password, meta)
    if (data.user) {
      // Wait a moment for trigger to create profile
      await new Promise(r => setTimeout(r, 800))
      try {
        const profile = await getProfile(data.user.id)
        set({ user: data.user, profile })
        return profile
      } catch {
        set({ user: data.user })
      }
    }
    return data
  },

  logout: async () => {
    await signOut()
    set({ user: null, profile: null, storefront: null })
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const profile = await getProfile(user.id)
    set({ profile })
    return profile
  },

  updateProfileLocal: (updates) => {
    set(s => ({ profile: { ...s.profile, ...updates } }))
  },

  isAdmin: () => get().profile?.email === 'donmacdatahub@gmail.com' || get().profile?.role === 'admin',
  isReseller: () => ['reseller', 'admin'].includes(get().profile?.role),
  
  // NEW: Check if user is a customer
  isCustomer: () => {
    const profile = get().profile
    return profile?.role === 'customer' || (!profile?.role && !profile?.is_reseller)
  },
  
  // NEW: Check if user can access admin/reseller dashboard
  canAccessDashboard: () => {
    const profile = get().profile
    return ['admin', 'reseller'].includes(profile?.role)
  }
}))

export default useAuthStore
