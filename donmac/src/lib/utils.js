export function generateRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let ref = ''
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

export function generateToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function formatCurrency(n) {
  const num = parseFloat(n) || 0
  return '₵' + num.toFixed(2)
}

export function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GH', { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatDateShort(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeAgo(d) {
  if (!d) return ''
  
  // Math.max fixes device synchronization delay discrepancies
  const diffMs = Date.now() - new Date(d).getTime()
  const seconds = Math.floor(Math.max(0, diffMs) / 1000)
  
  if (seconds < 60) return 'just now'
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function cls(...args) {
  // .flatMap handles arrays or conditional structures cleanly without leaving double whitespace gaps
  return args.flat().filter(Boolean).map(str => String(str).trim()).join(' ')
}

export const STATUS_CONFIG = {
  failed:     { label: 'Failed',     bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  waiting:    { label: 'Waiting',    bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  pending:    { label: 'Pending',    bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  processing: { label: 'Processing', bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  delivered:  { label: 'Delivered',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  claimed:    { label: 'Claimed',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  unclaimed:  { label: 'Unclaimed',  bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  paid:       { label: 'Paid',       bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  rejected:   { label: 'Rejected',   bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  active:     { label: 'Active',     bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  blocked:    { label: 'Blocked',    bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  success:    { label: 'Success',    bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  confirmed:  { label: 'Confirmed',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
}
