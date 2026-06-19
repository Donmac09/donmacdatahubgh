import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AccessDenied() {
  const navigate = useNavigate()
  
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login')
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-600 mb-6">
          You don't have permission to access this page.
        </p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-700">
            💡 If you're a customer, please contact your reseller for access.
          </p>
        </div>
        <button 
          onClick={() => navigate('/login')}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Go to Login
        </button>
        <p className="text-xs text-gray-400 mt-4">
          Redirecting to login in 5 seconds...
        </p>
      </div>
    </div>
  )
}
