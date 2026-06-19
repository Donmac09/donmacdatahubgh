import { create } from 'zustand'
import { supabase, getProfile, signIn, signUp, signOut } from '../lib/supabase'

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  storefront: null,

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
        // After state is cleared, redirect to login
        window.location.href = '/login'
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
    // Use setTimeout to ensure state is cleared before redirect
    setTimeout(() => {
      window.location.href = '/login'
    }, 100)
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
  isCustomer: () => {
    const profile = get().profile
    return profile?.role === 'customer' || (!profile?.role && !profile?.is_reseller)
  },
  canAccessDashboard: () => {
    const profile = get().profile
    return ['admin', 'reseller'].includes(profile?.role)
  }
}))

export default useAuthStore
