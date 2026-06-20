// ============================================================
// ADD THIS FUNCTION - It's missing and causing the build error
// ============================================================
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
    
  if (error) throw error
  return data
}
