import { STATUS_CONFIG, cls } from '../lib/utils'

// ── Badge ────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={cls('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', cfg.bg, cfg.text)}>
      <span className={cls('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

export function NetworkBadge({ network }) {
  const map = {
    mtn:    { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'MTN' },
    MTN:    { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'MTN' },
    telecel:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Telecel' },
    Telecel:  { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Telecel' },
    airtel:   { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'AirtelTigo' },
    AirtelTigo: { bg: 'bg-blue-100', text: 'text-blue-700',   label: 'AirtelTigo' },
  }
  const cfg = map[network] || { bg: 'bg-gray-100', text: 'text-gray-600', label: network }
  return (
    <span className={cls('px-2.5 py-1 rounded-full text-xs font-bold', cfg.bg, cfg.text)}>
      {cfg.label}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, className = '', type = 'button', loading }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm', lg: 'px-6 py-3 text-base' }
  const variants = {
    primary:   'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-sm',
    secondary: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 focus:ring-gray-300 shadow-sm',
    danger:    'bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 shadow-sm',
    success:   'bg-emerald-500 hover:bg-emerald-600 text-white focus:ring-emerald-500 shadow-sm',
    ghost:     'hover:bg-gray-100 text-gray-600 focus:ring-gray-300',
    warning:   'bg-amber-400 hover:bg-amber-500 text-amber-900 focus:ring-amber-400 shadow-sm',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      className={cls(base, sizes[size], variants[variant], className)}>
      {loading ? <Spinner size="sm" /> : children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', icon, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</span>}
        <input
          className={cls(
            'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            icon && 'pl-10',
            error && 'border-red-300 focus:ring-red-400',
          )}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className = '', error, ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <select className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <textarea className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" rows={3} {...props} />
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', glass }) {
  return (
    <div className={cls(
      'rounded-2xl border border-white/20 shadow-sm',
      glass ? 'bg-white/80 backdrop-blur-sm' : 'bg-white',
      className
    )}>
      {children}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ title, onClose, children, size = 'md' }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={cls('relative bg-white rounded-2xl shadow-2xl w-full animate-slide-up max-h-[90vh] flex flex-col', sizes[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}

// ── Spinner ───────────────────────────────────────────────────
export function Spinner({ size = 'md' }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-3', lg: 'w-12 h-12 border-4' }
  return (
    <div className={cls('rounded-full border-indigo-200 border-t-indigo-600 animate-spin', sizes[size])} />
  )
}

// ── Toggle ────────────────────────────────────────────────────
export function Toggle({ checked, onChange, label, size = 'md' }) {
  const sizes = { sm: 'w-8 h-4', md: 'w-11 h-6' }
  const thumbSizes = { sm: 'w-3 h-3', md: 'w-5 h-5' }
  const translateOn = { sm: 'translate-x-4', md: 'translate-x-5' }
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={cls('relative inline-flex items-center rounded-full transition-colors duration-200 cursor-pointer', sizes[size], checked ? 'bg-indigo-600' : 'bg-gray-200')}
      >
        <span className={cls('absolute left-0.5 inline-block rounded-full bg-white shadow transition-transform duration-200', thumbSizes[size], checked ? translateOn[size] : 'translate-x-0.5')} />
      </div>
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
    </label>
  )
}

// ── Table ─────────────────────────────────────────────────────
export function Table({ headers, children, empty = 'No data found' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {headers.map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {children}
        </tbody>
      </table>
    </div>
  )
}

export function Td({ children, className = '' }) {
  return <td className={cls('px-4 py-3 text-sm text-gray-700 whitespace-nowrap', className)}>{children}</td>
}

// ── Empty State ───────────────────────────────────────────────
export function Empty({ icon = '📭', title, description }) {
  return (
    <div className="py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <p className="font-semibold text-gray-700 text-lg">{title}</p>
      {description && <p className="text-sm text-gray-400 mt-1">{description}</p>}
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────
export function StatCard({ icon, label, value, sub, color = 'indigo', trend }) {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-400 to-amber-500',
    red: 'from-red-500 to-red-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  }
  return (
    <Card className="p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className={cls('w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-sm', colors[color])}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className={cls('text-xs font-semibold px-2 py-1 rounded-full', trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500')}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  )
}

// ── Date Filter Row ───────────────────────────────────────────
export function DateFilters({ from, to, onFrom, onTo }) {
  const today = new Date().toISOString().split('T')[0]
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-gray-500 font-medium">Filter:</span>
      <input type="date" value={from} max={today} onChange={e => onFrom(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      <span className="text-gray-400 text-sm">to</span>
      <input type="date" value={to} max={today} onChange={e => onTo(e.target.value)}
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      {(from || to) && (
        <button onClick={() => { onFrom(''); onTo('') }} className="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
      )}
    </div>
  )
}
