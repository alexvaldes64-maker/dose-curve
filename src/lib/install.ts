// Install-to-home-screen helpers. Chrome and Edge fire `beforeinstallprompt` once, early, so it is
// captured at startup (see main.tsx) and replayed when the user taps Install.

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
const listeners = new Set<() => void>()

export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    listeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    listeners.forEach((l) => l())
  })
}

export const canPromptInstall = () => deferred !== null
export function onInstallChange(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  listeners.forEach((l) => l())
  return outcome === 'accepted'
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}

export function platform(): 'ios' | 'android' | 'other' {
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}
