// Vercel Serverless: POST /api/admin/create-user
// Server-side only — uses SUPABASE_SERVICE_ROLE_KEY to create auth users safely
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    // 1. Verify caller JWT and admin role
    const jwt = (req.headers.authorization || '').replace('Bearer ', '').trim()
    if (!jwt) return res.status(401).json({ error: 'Missing Authorization header' })

    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(jwt)
    if (authErr || !caller) return res.status(401).json({ error: 'Invalid session token' })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', caller.id).single()

    if (callerProfile?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }

    // 2. Validate input
    const { name, email, phone, password, role = 'reseller' } = req.body || {}
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'name, email, phone and password are all required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // 3. Create auth user with service role (bypasses email confirmation)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone, role },
    })

    if (createErr) {
      if (createErr.message?.toLowerCase().includes('already')) {
        return res.status(400).json({ error: 'A user with this email already exists.' })
      }
      return res.status(400).json({ error: createErr.message })
    }

    // 4. Upsert profile (trigger may have already created it, we ensure role is correct)
    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({
      id: created.user.id,
      name, phone, role,
      balance: 0, profit: 0, status: 'active',
    }, { onConflict: 'id' })

    if (profileErr) console.warn('Profile upsert warning:', profileErr.message)

    return res.status(201).json({
      success: true,
      message: `${role} "${name}" created! They can now log in with their email and password.`,
      user: { id: created.user.id, email, name, phone, role },
    })

  } catch (err) {
    console.error('create-user error:', err)
    return res.status(500).json({ error: err.message || 'Server error' })
  }
}
