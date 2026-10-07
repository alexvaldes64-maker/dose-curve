export type Tab = 'today' | 'log' | 'history' | 'learn'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M3 17c3 0 4-9 9-9s6 9 9 9' },
  { id: 'log', label: 'Log', icon: 'M12 5v14M5 12h14' },
  { id: 'history', label: 'History', icon: 'M4 5h16M4 12h16M4 19h16' },
  { id: 'learn', label: 'Learn', icon: 'M12 8v.01M12 11v5M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-line bg-card/90 backdrop-blur-xl" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      <div className="grid grid-cols-4" style={{ height: 'var(--tabbar-h)' }}>
        {tabs.map(({ id, label, icon }) => {
          const on = id === tab
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={on ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 text-[12px] ${on ? 'font-semibold text-text' : 'font-medium text-muted'}`}
            >
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={icon} />
              </svg>
              {label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
