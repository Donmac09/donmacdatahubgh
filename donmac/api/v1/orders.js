// Vercel Serverless Function: /api/orders
// External API for users with API tokens to place orders from their websites

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function generateRef() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let r = ''
  for (let i = 0; i < 6; i++) r += c[Math.floor(Math.random() * c.length)]
  return r
}

async function auth(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '').trim()
  if (!t) throw new Error('API token required')
  
  const { data: p } = await supabase
    .from('profiles')
    .select('*')
    .eq('api_token', t)
    .single()
  if (!p) throw new Error('Invalid API token')
  if (p.status === 'blocked') throw new Error('Account blocked')
  return p
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  
  try {
    const user = await auth(req)
    
    // ============================================================
    // GET: Fetch orders
    // ============================================================
    if (req.method === 'GET') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return res.status(200).json({ 
        success: true, 
        count: orders?.length || 0,
        orders 
      })
    }
    
    // ============================================================
    // POST: Place order
    // ============================================================
    if (req.method === 'POST') {
      const { 
        network, 
        package: pkg, 
        phone, 
        package_key,
        amount,
      } = req.body
      
      // Validate required fields
      if (!network || !pkg || !phone) {
        return res.status(400).json({ 
          success: false,
          error: 'network, package, and phone are required' 
        })
      }
      
      // Validate amount
      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ 
          success: false,
          error: 'amount is required and must be greater than 0' 
        })
      }
      
      // Check wallet balance
      if (parseFloat(user.balance) < parseFloat(amount)) {
        return res.status(400).json({ 
          success: false,
          error: 'Insufficient wallet balance' 
        })
      }
      
      const ref = generateRef()
      const numericAmount = parseFloat(amount)
      
      // Debit wallet
      const newBalance = parseFloat(user.balance) - numericAmount
      await supabase
        .from('profiles')
        .update({ balance: newBalance })
        .eq('id', user.id)
      
      // Create order
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          ref,
          user_id: user.id,
          network,
          package: pkg,
          package_key: package_key || pkg,
          phone,
          amount: numericAmount,
          status: 'pending',
        })
        .select()
        .single()
      
      if (error) throw error
      
      // Record transaction
      await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          type: 'debit',
          description: `API Order: ${network} ${pkg} (Ref: ${ref})`,
          amount: numericAmount,
          status: 'success'
        })
      
      return res.status(201).json({ 
        success: true, 
        order,
        remaining_balance: newBalance
      })
    }
    
    return res.status(405).json({ error: 'Method not allowed' })
    
  } catch (e) {
    return res.status(401).json({ 
      success: false,
      error: e.message 
    })
  }
}
