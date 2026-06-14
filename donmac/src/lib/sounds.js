// Sound notifications using Web Audio API
const AudioContext = window.AudioContext || window.webkitAudioContext

function createCtx() {
  try { return new AudioContext() } catch { return null }
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  const ctx = createCtx()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.frequency.value = frequency
  oscillator.type = type
  gainNode.gain.setValueAtTime(volume, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + duration)
}

export const sounds = {
  order() {
    playTone(523, 0.1)
    setTimeout(() => playTone(659, 0.1), 120)
    setTimeout(() => playTone(784, 0.2), 240)
  },
  topup() {
    playTone(440, 0.08)
    setTimeout(() => playTone(550, 0.08), 100)
    setTimeout(() => playTone(660, 0.08), 200)
    setTimeout(() => playTone(880, 0.2), 300)
  },
  transaction() {
    playTone(800, 0.05)
    setTimeout(() => playTone(1000, 0.1), 80)
  },
  error() {
    playTone(200, 0.15, 'sawtooth')
    setTimeout(() => playTone(150, 0.2, 'sawtooth'), 180)
  },
  notification() {
    playTone(880, 0.06)
    setTimeout(() => playTone(1100, 0.1), 80)
  }
}
