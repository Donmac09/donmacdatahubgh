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

  // ============================================================
  // FIX: Register - sanitize meta + block suspicious emails
  // ============================================================
  register: async (email, password, meta) => {
    // ============================================================
    // SECURITY: Block suspicious email domains
    // ============================================================
    const blockedDomains = [
      'donmacdatahub.com',
      'donmacdatahubgh.com',
      'donmacdatahubgh.vercel.app',
    ]
    
    const blockedKeywords = [
      'donmacdatahub',
      'donmacdatahubgh',
      'admin',
      'root',
      'test',
    ]
    
    const emailLower = email.toLowerCase()
    
    // Check if email contains blocked domain
    for (const domain of blockedDomains) {
      if (emailLower.includes(domain)) {
        throw new Error(`Registration with email from ${domain} is not allowed`)
      }
    }
    
    // Check if email contains blocked keywords
    for (const keyword of blockedKeywords) {
      if (emailLower.includes(keyword)) {
        throw new Error(`Email contains blocked keyword: ${keyword}`)
      }
    }
    
    // Block your exact email from being used by others
    if (emailLower === 'donmacdatahub@gmail.com') {
      throw new Error('This email is already registered as admin')
    }
    
    // ============================================================
    // SECURITY: Validate phone number on the backend
    // ============================================================
    if (!meta?.phone || meta.phone.trim().length < 10) {
      throw new Error('A valid phone number is required (minimum 10 digits)')
    }
    
    // Sanitize meta - only allow specific fields
    const safeMeta = {
      name: meta?.name || '',
      phone: meta?.phone || '',
      reseller_id: meta?.reseller_id || null,
      // role is NOT sent from frontend - server will set it
    }
    
    const data = await signUp(email, password, safeMeta)
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
    // Sanitize updates - prevent role changes from frontend
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
