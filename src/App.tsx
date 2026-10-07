import { useEffect, useMemo, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { ensureProfile, requestPersistence, useActiveProfile, useDaySchedules, useSettings, type Settings } from './db'
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
      {tab === 'learn' && <Learn settings={settings} focus={learnFocus} />}
      <TabBar tab={tab} onChange={changeTab} />
    </div>
  )
}
