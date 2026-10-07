import { useEffect, useState } from 'react'
import { TERMS_VERSION, saveActiveProfile, saveSettings, toggleSample, type Settings } from '../db'
import { canPromptInstall, isStandalone, onInstallChange, platform, promptInstall } from '../lib/install'
import { SUBSTANCES } from '../lib/substances'
import { fieldCls, labelCls } from './LogForms'

const REPO = import.meta.env.VITE_SOURCE_URL ?? 'https://github.com/alexvaldes64-maker/dose-curve'

/** Step-by-step "Add to Home Screen" help for this device. */
export function InstallSteps() {
  const [, force] = useState(0)
  useEffect(() => {
    const off = onInstallChange(() => force((n) => n + 1))
    return () => {
      off()
    }
  }, [])
  if (isStandalone()) return <p className="text-[15px] leading-snug">Installed. Dose Curve runs from your Home Screen and works offline.</p>
  if (canPromptInstall())
    return (
      <button type="button" onClick={() => promptInstall()} className="w-full rounded-full bg-text py-3.5 text-[16px] font-semibold text-card">
        Install Dose Curve
      </button>
    )
  const os = platform()
  const steps =
    os === 'ios'
      ? ['Open this page in Safari.', 'Tap the Share button.', 'Choose Add to Home Screen, then Add.', 'Open Dose Curve from its new icon.']
      : os === 'android'
        ? ['Open this page in Chrome.', 'Tap the menu (three dots).', 'Choose Install app or Add to Home screen.', 'Open Dose Curve from its new icon.']
        : ['In Chrome or Edge, use the install icon in the address bar.', 'In Safari on a Mac, choose File, then Add to Dock.']
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-3 text-[15px] leading-snug">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-fill text-[13px] font-semibold">{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  )
}

function Dots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-5 bg-text' : 'w-1.5 bg-line'}`} />
      ))}
    </div>
  )
}

/**
 * First run. Four short screens; only the acknowledgement is required.
 * `termsOnly` re-asks just the acknowledgement after the terms change.
 */
export function Onboarding({ settings, termsOnly, onDone }: { settings: Settings; termsOnly: boolean; onDone: () => void }) {
  const [step, setStep] = useState(termsOnly ? 1 : 0)
  const [agreed, setAgreed] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [wake, setWake] = useState(settings.wakeTime)
  const [sleep, setSleep] = useState(settings.bedtime)
  const total = 4

  async function acknowledge() {
    await saveSettings({ termsAccepted: TERMS_VERSION })
    if (termsOnly) onDone()
    else setStep(2)
  }

  async function saveSetup() {
    await saveActiveProfile({ wakeTime: wake, sleepTime: sleep, ...(picked.length ? { favorites: picked } : {}) })
    setStep(3)
  }

  async function finish(sample: boolean) {
    if (sample) await toggleSample(new Date())
    await saveSettings({ onboardedAt: new Date().toISOString() })
    onDone()
  }

  const body = 'text-[17px] leading-snug'
  const primary = 'w-full rounded-full bg-text py-4 text-[17px] font-semibold text-card disabled:opacity-30'
  const secondary = 'w-full rounded-full py-3 text-[16px] font-medium text-muted'

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-bg" role="dialog" aria-modal aria-label="Welcome to Dose Curve">
      <div className="scroll-y flex h-full w-full max-w-[430px] flex-col px-6" style={{ paddingTop: 'calc(var(--safe-top) + 28px)', paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}>
        {!termsOnly && <Dots step={step} total={total} />}

        {step === 0 && (
          <>
            <div className="flex flex-1 flex-col justify-center">
              <svg viewBox="0 0 120 64" className="mb-8 h-20 w-36" aria-hidden>
                <defs>
                  <linearGradient id="ob" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="var(--onset)" />
                    <stop offset="0.35" stopColor="var(--peak)" />
                    <stop offset="0.7" stopColor="var(--taper)" />
                    <stop offset="1" stopColor="var(--comedown)" />
                  </linearGradient>
                </defs>
                <path d="M4 60 C 22 60, 26 8, 48 8 C 70 8, 80 52, 116 60" fill="none" stroke="url(#ob)" strokeWidth="6" strokeLinecap="round" />
                <line x1="4" x2="116" y1="61" y2="61" stroke="var(--line)" strokeWidth="2" />
              </svg>
              <h1 className="text-[34px] font-bold leading-tight tracking-tight">See your day's curve</h1>
              <p className={`mt-3 ${body} text-muted`}>When your medication or coffee kicks in, peaks and wears off, at a glance.</p>
              <ul className="mt-8 space-y-4">
                {[
                  ['Log a dose in two taps', 'Adderall, Vyvanse, Ritalin, Concerta style, and caffeine.'],
                  ['Spot your patterns', 'Rate focus and mood, and mark when it wears off.'],
                  ['Private by design', 'No account. Everything stays on this phone.'],
                ].map(([t, d]) => (
                  <li key={t}>
                    <p className="text-[17px] font-semibold">{t}</p>
                    <p className="text-[15px] text-muted">{d}</p>
                  </li>
                ))}
              </ul>
            </div>
            <button type="button" className={primary} onClick={() => setStep(1)}>
              Get started
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex-1 pt-8">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">{termsOnly ? 'Our terms changed' : 'Before you start'}</h1>
              <ul className={`mt-5 space-y-3 ${body}`}>
                <li>The curves are estimates from general averages. They do not measure anything in your body.</li>
                <li>Dose Curve never tells you how much to take or when. That is between you and your prescriber.</li>
                <li>It is not a medical device and not medical advice.</li>
              </ul>
              <div className="mt-6 rounded-[18px] bg-card p-4 text-[15px] leading-snug shadow-[var(--shadow-card)]">
                <p className="font-semibold">In an emergency</p>
                <p className="mt-1 text-muted">
                  US: call <a href="tel:911" className="whitespace-nowrap font-semibold text-text">911</a>. Poison Control:{' '}
                  <a href="tel:18002221222" className="whitespace-nowrap font-semibold text-text">1-800-222-1222</a>. Crisis: call or text{' '}
                  <a href="tel:988" className="whitespace-nowrap font-semibold text-text">988</a>. These are US numbers; elsewhere, use your local emergency number.
                </p>
              </div>
              <label className="mt-6 flex items-start gap-3">
                <input
                  type="checkbox"
                  aria-label="I understand and agree to the terms and privacy policy"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--text)]"
                />
                <span className="text-[15px] leading-snug">
                  I understand. I am 18 or older, or a parent or guardian keeping a log for my child. I agree to the{' '}
                  <a href={`${REPO}/blob/main/TERMS.md`} target="_blank" rel="noopener noreferrer" className="text-[var(--onset)] underline underline-offset-2">
                    terms
                  </a>{' '}
                  and{' '}
                  <a href={`${REPO}/blob/main/PRIVACY.md`} target="_blank" rel="noopener noreferrer" className="text-[var(--onset)] underline underline-offset-2">
                    privacy policy
                  </a>
                  .
                </span>
              </label>
            </div>
            <button type="button" className={primary} disabled={!agreed} onClick={acknowledge}>
              {termsOnly ? 'Continue' : 'Agree and continue'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex-1 pt-8">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">What do you take?</h1>
              <p className={`mt-2 ${body} text-muted`}>Pick any. You can log others anytime.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {SUBSTANCES.map((x) => {
                  const on = picked.includes(x.id)
                  return (
                    <button
                      key={x.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((cur) => (cur.includes(x.id) ? cur.filter((p) => p !== x.id) : [...cur, x.id]))}
                      className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-[16px] font-medium ${on ? 'bg-text text-card' : 'bg-card shadow-[var(--shadow-card)]'}`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.color }} />
                      {x.name}
                    </button>
                  )
                })}
              </div>
              <p className={`mt-8 ${body} font-semibold`}>Your usual day</p>
              <p className="text-[15px] text-muted">The chart runs from wake to sleep. Shift workers can change any single day later.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Wake</span>
                  <input type="time" className={fieldCls} value={wake} onChange={(e) => e.target.value && setWake(e.target.value)} />
                </label>
                <label className="block">
                  <span className={labelCls}>Sleep</span>
                  <input type="time" className={fieldCls} value={sleep} onChange={(e) => e.target.value && setSleep(e.target.value)} />
                </label>
              </div>
            </div>
            <button type="button" className={primary} onClick={saveSetup}>
              Continue
            </button>
            <button type="button" className={secondary} onClick={() => setStep(3)}>
              Skip
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="flex-1 pt-8">
              <h1 className="text-[28px] font-bold leading-tight tracking-tight">Keep it on your phone</h1>
              <p className={`mt-2 ${body} text-muted`}>Add it to your Home Screen so it opens like an app, works offline, and your data is kept safe from cleanup.</p>
              <div className="mt-6 rounded-[18px] bg-card p-4 shadow-[var(--shadow-card)]">
                <InstallSteps />
              </div>
              <p className="mt-6 text-[15px] leading-snug text-muted">
                Your data lives only on this device. To keep a copy, use Learn, then Export backup, now and then.
              </p>
            </div>
            <button type="button" className={primary} onClick={() => finish(false)}>
              Start logging
            </button>
            <button type="button" className={secondary} onClick={() => finish(true)}>
              Show me a sample day first
            </button>
          </>
        )}
      </div>
    </div>
  )
}
