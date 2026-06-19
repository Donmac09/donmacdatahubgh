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
  const { data: p } = await supabase
    .from('profiles')
    .select('*')
    .eq('api_token', t)
    .single()
  if (!p) throw new Error('Invalid API token')
  return p
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
  
  if (req.method === 'OPTIONS') return res.status(200).end()
  
  try {
    const user = await auth(req)
    
    if (req.method === 'GET') {
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return res.status(200).json({ orders })
    }
    
    if (req.method === 'POST') {
      const { 
        network, 
        package: pkg, 
        phone, 
        package_key,
        ghdata_type,
        is_manual,
        amount,
        cost_price,
        profit,
        item_data
      } = req.body
      
      if (!network || !pkg || !phone) {
        return res.status(400).json({ error: 'network, package, phone required' })
      }
      
      const ref = generateRef()
      
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          ref,
          user_id: user.id,
          network,
          package: pkg,
          package_key: package_key || pkg,
          phone,
          amount: amount || 0,
          cost_price: cost_price || 0,
          profit: profit || 0,
          status: 'pending',
          ghdata_type: ghdata_type || null,
          is_manual: is_manual || false,
          item_data: item_data || null,
        })
        .select()
        .single()
      
      if (error) throw error
      return res.status(201).json({ success: true, order })
    }
    
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (e) {
    return res.status(401).json({ error: e.message })
  }
}
