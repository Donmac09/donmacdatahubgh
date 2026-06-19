import { supabase } from '../../lib/supabase'
import { getGHDataWalletBalance, GHDATA_TOKEN } from '../../lib/packages'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  
  try {
    // Verify admin using API token
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim()
    
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('role')
      .eq('api_token', token)
      .single()
    
    if (adminError || !admin || admin.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    
    // Get GHData wallet balance
    const balanceData = await getGHDataWalletBalance(GHDATA_TOKEN)
    
    return res.status(200).json({
      success: true,
      balance: balanceData
    })
  } catch (err) {
    console.error('Error fetching GHData balance:', err)
    return res.status(500).json({ error: err.message })
  }
}
