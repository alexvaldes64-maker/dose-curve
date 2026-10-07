import { useEffect, useState } from 'react'
import { db } from '../db'

const SOURCE_URL: string | undefined = import.meta.env.VITE_SOURCE_URL

/** Every request this page has made, from the browser's own Performance API. */
function useRequests() {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const read = () => setUrls(performance.getEntriesByType('resource').map((e) => e.name))
    read()
    const obs = new PerformanceObserver(read)
    try {
      obs.observe({ type: 'resource', buffered: true })
    } catch {
      // Older browsers: the initial read is enough.
    }
    return () => obs.disconnect()
  }, [])
  return urls
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line py-2.5 first:border-0 first:pt-0">
      <span className="text-[15px]">{label}</span>
      <span className={`text-right text-[15px] ${ok === false ? 'font-semibold text-danger' : ok ? 'font-medium text-good' : 'text-muted'}`}>{value}</span>
    </div>
  )
}

/** Shows, from the browser itself, that nothing leaves the device. */
export function PrivacyCheck() {
  const urls = useRequests()
  const offsite = [...new Set(urls.map((u) => new URL(u, location.href)).filter((u) => u.origin !== location.origin).map((u) => u.host))]
  const cspOn = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string>('')
  const [confirm, setConfirm] = useState('')

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null))
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(e.usage !== undefined ? `${Math.max(1, Math.round(e.usage / 1024))} KB` : ''))
      .catch(() => {})
  }, [])

  async function wipe() {
    db.close()
    await db.delete()
    location.reload()
  }

  return (
    <div>
      <Row label="Requests this session" value={`${urls.length}, ${offsite.length ? 'some to other sites' : 'all to this site'}`} ok={!offsite.length} />
      {offsite.length > 0 && <p className="pb-2 text-[13px] text-danger">Other sites contacted: {offsite.join(', ')}</p>}
      <Row
        label="Outside connections"
        value={cspOn ? 'Blocked by your browser' : 'Not enforced in dev mode'}
        ok={cspOn ? true : undefined}
      />
      <Row label="Where your data lives" value={`This browser, this device${usage ? `, ${usage}` : ''}`} />
      <Row label="Protected from cleanup" value={persisted === null ? 'Unknown' : persisted ? 'Yes' : 'Not granted'} ok={persisted ? true : undefined} />
      <Row label="Accounts, analytics, ads" value="None" ok />
      <Row label="Version" value={`${__APP_VERSION__} (${__BUILD_ID__})`} />
      {SOURCE_URL && (
        <p className="pt-1 text-[14px]">
          <a href={SOURCE_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--onset)] underline underline-offset-2">
            Read the source code
          </a>
          <span className="text-muted"> and match the version above.</span>
        </p>
      )}
      <p className="mt-3 text-[13px] leading-snug text-muted">
        The host (Vercel) sees your IP address when the app loads, like any website. After that, the app runs from this device. The browser
        blocks it from contacting any other server.
      </p>

      <div className="mt-5 border-t border-line pt-4">
        <p className="text-[15px] font-semibold">Delete all data</p>
        <p className="mt-1 text-[13px] leading-snug text-muted">Removes every profile, dose, check-in and setting from this device. This cannot be undone. Type DELETE to confirm.</p>
        <div className="mt-3 flex gap-2">
          <input
            aria-label="Type DELETE to confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="min-w-0 flex-1 rounded-xl bg-fill px-3 py-2.5 text-[16px] outline-none"
            placeholder="DELETE"
            autoCapitalize="characters"
          />
          <button
            type="button"
            disabled={confirm !== 'DELETE'}
            onClick={wipe}
            className="rounded-full bg-danger px-4 text-[15px] font-semibold text-white disabled:opacity-30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
