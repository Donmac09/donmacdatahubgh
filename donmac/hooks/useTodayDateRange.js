import { useState, useEffect, useRef } from 'react'
import { getTodayDateStr } from '../lib/utils'

// Returns a [from, to, setFrom, setTo] date-range pair that:
//  - Defaults to TODAY on first load (both from and to = today)
//  - If the user has NOT manually changed the range, automatically
//    rolls forward to the new "today" at local midnight (checked every minute,
//    cheap enough and avoids relying on a long-lived setTimeout across sleep/wake)
//  - Once the user picks their own dates, it stops auto-following "today"
//    (their explicit choice is respected) until they clear the filter again
export function useTodayDateRange() {
  const [from, setFromRaw] = useState(getTodayDateStr())
  const [to, setToRaw] = useState(getTodayDateStr())
  const userTouched = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (userTouched.current) return
      const today = getTodayDateStr()
      setFromRaw(prev => (prev !== today ? today : prev))
      setToRaw(prev => (prev !== today ? today : prev))
    }, 60 * 1000) // check once a minute — cheap, catches midnight rollover promptly
    return () => clearInterval(interval)
  }, [])

  function setFrom(val) {
    userTouched.current = true
    setFromRaw(val)
  }

  function setTo(val) {
    userTouched.current = true
    setToRaw(val)
  }

  // "Reset to today" also re-enables auto-follow
  function resetToToday() {
    userTouched.current = false
    const today = getTodayDateStr()
    setFromRaw(today)
    setToRaw(today)
  }

  return { from, to, setFrom, setTo, resetToToday }
}
