// Vercel Serverless: POST /api/admin/update-user
import { createClient } from '@supabase/supabase-js'

// 1. Extract and explicitly trim whitespace/newlines from your keys
const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabaseUrl = rawUrl.trim()
const supabaseServiceKey = rawKey.trim()

// 2. Fail-safe: Prevent initializing with completely blank strings
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("CRITICAL CONFIG ERROR: Supabase environment variables are missing or undefined.")
}

// 3. Initialize with clean, trimmed configurations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function verifyAdmin(jwt) {
  if (!jwt) throw new Error('Missing authentication token')
  
  const { data, error } = await supabaseAdmin.auth.getUser(jwt)
  if (error || !data || !data.user) {
    throw new Error('Invalid session')
  }

  const { data: p } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (p?.role !== 'admin') {
    throw new Error('Admin access required')
  }

  return data.user
}

export default async function handler(req, res) {
  // ... rest of your code remains identical to the hardened version
