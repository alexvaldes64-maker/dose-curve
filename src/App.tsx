import { useEffect, useMemo, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { TERMS_VERSION, ensureProfile, requestPersistence, useActiveProfile, useDaySchedules, useSettings, useStoredSettings, type Settings } from './db'
import { Onboarding } from './components/Onboarding'
import { UndoToast } from './components/UndoToast'
import { History } from './screens/History'
import { Learn } from './screens/Learn'
import { Log } from './screens/Log'
import { Today } from './screens/Today'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  // Substance whose timing settings Learn should open on, set by "Adjust timing" links.
  const [learnFocus, setLearnFocus] = useState<string | null>(null)
  const adjust = (id: string) => {
    setLearnFocus(id)
    setTab('learn')
  }
  const changeTab = (t: Tab) => {
    if (t !== 'learn') setLearnFocus(null)
    setTab(t)
  }
  const global = useSettings()
  const stored = useStoredSettings()
  const [replayWelcome, setReplayWelcome] = useState(false)
  // First run, or the terms changed since the user last agreed.
  const needsOnboarding = stored !== undefined && (!stored?.onboardedAt || replayWelcome)
  const needsTerms = stored !== undefined && !!stored?.onboardedAt && stored.termsAccepted !== TERMS_VERSION
  const profile = useActiveProfile()
  const daySchedules = useDaySchedules()
  // Screens read one settings object; the schedule and timing overrides come from the active profile.
  const settings: Settings = useMemo(
    () => ({ ...global, wakeTime: profile.wakeTime, bedtime: profile.sleepTime, overrides: profile.overrides, daySchedules }),
    // daySchedules is a fresh object each render of its query; key it by content.
    [global, profile.wakeTime, profile.sleepTime, profile.overrides, JSON.stringify(daySchedules)],
  )

  useEffect(() => {
    requestPersistence()
    ensureProfile()
  }, [])

  return (
    <div className="mx-auto h-full max-w-[430px] overflow-hidden bg-bg">
      {tab === 'today' && <Today settings={settings} onAdjust={adjust} />}
      {tab === 'log' && <Log />}
      {tab === 'history' && <History settings={settings} onAdjust={adjust} />}
      {tab === 'learn' && <Learn settings={settings} focus={learnFocus} onShowWelcome={() => setReplayWelcome(true)} />}
      <TabBar tab={tab} onChange={changeTab} />
      <UndoToast />
      {(needsOnboarding || needsTerms) && (
        <Onboarding
          settings={settings}
          termsOnly={!needsOnboarding && needsTerms}
          onDone={() => {
            setReplayWelcome(false)
            setTab('today')
          }}
        />
      )}
    </div>
  )
}
