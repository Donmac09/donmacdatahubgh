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
        
        // Check if user is blocked
        if (profile?.status === 'blocked') {
          await signOut()
          set({ user: null, profile: null, loading: false })
          window.location.href = '/login?blocked=true'
          return
        }
        
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
          
          // Check if user is blocked
          if (profile?.status === 'blocked') {
            await signOut()
            set({ user: null, profile: null, storefront: null })
            window.location.href = '/login?blocked=true'
            return
          }
          
          set({ user: session.user, profile })
        } catch {}
      } else if (event === 'SIGNED_OUT') {
        set({ user: null, profile: null, storefront: null })
        window.location.href = '/login'
      }
    })
  },

  login: async (email, password) => {
    const data = await signIn(email, password)
    const profile = await getProfile(data.user.id)
    
    // Check if user is blocked
    if (profile?.status === 'blocked') {
      await signOut()
      throw new Error('Your account has been blocked. Please contact support.')
    }
    
    set({ user: data.user, profile })
    return profile
  },

  register: async (email, password, meta) => {
    // ... your existing register code ...
  },

  logout: async () => {
    await signOut()
    set({ user: null, profile: null, storefront: null })
    setTimeout(() => {
      window.location.href = '/login'
    }, 100)
  },

  refreshProfile: async () => {
    const { user } = get()
    if (!user) return
    const profile = await getProfile(user.id)
    
    // Check if user is blocked
    if (profile?.status === 'blocked') {
      await signOut()
      set({ user: null, profile: null })
      window.location.href = '/login?blocked=true'
      return null
    }
    
    set({ profile })
    return profile
  },

  updateProfileLocal: (updates) => {
    const safeUpdates = { ...updates }
    delete safeUpdates.role
    delete safeUpdates.is_admin
    delete safeUpdates.is_reseller
    set(s => ({ profile: { ...s.profile, ...safeUpdates } }))
  },

  isAdmin: () => get().profile?.role === 'admin',
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
