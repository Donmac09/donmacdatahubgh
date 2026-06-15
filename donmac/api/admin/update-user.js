import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Log the request
  console.log('Update user endpoint called:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  })
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, userId } = req.body
    const adminToken = (req.headers.authorization || '').replace('Bearer ', '').trim()
    
    console.log('Processing:', { action, userId, adminToken: adminToken.substring(0, 20) + '...' })
    
    // Verify admin
    const { data: admin, error: adminError } = await supabase
      .from('profiles')
      .select('role')
      .eq('api_token', adminToken)
      .single()
    
    console.log('Admin check result:', { admin, adminError })
    
    if (adminError || !admin || admin.role !== 'admin') {
      console.log('Admin verification failed')
      return res.status(403).json({ error: 'Admin access required' })
    }
    
    if (action === 'block' || action === 'unblock') {
      const newStatus = action === 'block' ? 'blocked' : 'active'
      console.log(`Updating user ${userId} status to ${newStatus}`)
      
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', userId)
        .select()
      
      console.log('Update result:', { data, updateError })
      
      if (updateError) throw updateError
      
      return res.status(200).json({ 
        success: true, 
        message: `User ${action}ed successfully`,
        status: newStatus,
        user: data
      })
    }
    
    if (action === 'delete') {
      console.log(`Deleting user ${userId}`)
      
      // First delete from profiles
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId)
      
      if (profileDeleteError) {
        console.log('Profile delete error:', profileDeleteError)
      }
      
      // Then delete from auth
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId)
      
      if (authDeleteError) {
        console.log('Auth delete error:', authDeleteError)
        throw authDeleteError
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'User deleted successfully' 
      })
    }
    
    return res.status(400).json({ error: 'Invalid action' })
    
  } catch (error) {
    console.error('Detailed error in update-user:', error)
    return res.status(500).json({ 
      error: error.message,
      details: error.toString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
}
