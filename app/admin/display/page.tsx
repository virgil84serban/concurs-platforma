'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
}

type Competition = {
  id: string
  title: string
  status: string | null
}

type Performance = {
  id: string
  title: string | null
  running_order: number | null
  competition_id: string
  status: string | null
  admin_status: string | null
  choreographer_name: string | null
  participant_names: string | null
  group_name: string | null
  clubs: {
    name: string | null
  }[] | null
  categories: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[] | null
}

type ScoreRow = {
  value: number
  performance_id: string
  performances:
    | {
        id: string
        title: string | null
        competition_id: string | null
        running_order: number | null
        choreographer_name: string | null
        participant_names: string | null
        group_name: string | null
        clubs: {
          name: string | null
        }[] | null
        categories: {
          formation_type: string | null
          dance_style: string | null
          age_group: string | null
          level: string | null
        }[] | null
      }[]
    | null
}

type DisplayMode = 'running_order' | 'results' | 'pause'

type DisplayState = {
  competitionId: string
  mode: DisplayMode
  currentRunningOrder: number
  selectedGroupKey: string
  pauseMessage: string
  updatedAt: string
}

type ResultRow = {
  performance_id: string
  title: string
  club: string
  choreographer: string
  total: number
  running_order: number | null
  discipline: string
  age: string
  level: string
  type: string
  groupKey: string
  groupLabel: string
}

const DISPLAY_STORAGE_KEY = 'maverick_display_state_v1'
const DISPLAY_CHANNEL_NAME = 'maverick_display_channel'

const defaultDisplayState: DisplayState = {
  competitionId: '',
  mode: 'running_order',
  currentRunningOrder: 1,
  selectedGroupKey: '',
  pauseMessage: 'Pauza / Urmeaza rezultatele',
  updatedAt: new Date().toISOString(),
}

function formatFormationType(value: string | null) {
  if (!value) return '-'

  switch (value) {
    case 'solo':
      return 'Solo'
    case 'duo':
      return 'Duo'
    case 'trio':
      return 'Trio'
    case 'quartet':
      return 'Quartet'
    case 'group':
      return 'Group'
    case 'formation':
      return 'Formation'
    default:
      return value
  }
}

function getParticipantLabel(
  performance: Performance | ScoreRow['performances'][number] | null | undefined
) {
  if (!performance) return '-'
  return performance.group_name || performance.participant_names || '-'
}

function buildGroupData(item: {
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[] | null
}) {
  const firstCategory = item.categories?.[0] || null

  const discipline = firstCategory?.dance_style || '-'
  const age = firstCategory?.age_group || '-'
  const level = firstCategory?.level || '-'
  const type = formatFormationType(firstCategory?.formation_type || null)
  const groupKey = `${discipline}||${age}||${level}||${type}`
  const groupLabel = `${discipline} | ${age} | ${level} | ${type}`

  return {
    discipline,
    age,
    level,
    type,
    groupKey,
    groupLabel,
  }
}

function readDisplayState(): DisplayState {
  if (typeof window === 'undefined') {
    return defaultDisplayState
  }

  const raw = window.localStorage.getItem(DISPLAY_STORAGE_KEY)
  if (!raw) return defaultDisplayState

  try {
    const parsed = JSON.parse(raw) as Partial<DisplayState>

    return {
      competitionId: parsed.competitionId || '',
      mode:
        parsed.mode === 'running_order' || parsed.mode === 'results' || parsed.mode === 'pause'
          ? parsed.mode
          : 'running_order',
      currentRunningOrder:
        typeof parsed.currentRunningOrder === 'number' && parsed.currentRunningOrder > 0
          ? parsed.currentRunningOrder
          : 1,
      selectedGroupKey: parsed.selectedGroupKey || '',
      pauseMessage: parsed.pauseMessage || defaultDisplayState.pauseMessage,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    }
  } catch {
    return defaultDisplayState
  }
}

function writeDisplayState(nextState: DisplayState) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify(nextState))

  try {
    const channel = new BroadcastChannel(DISPLAY_CHANNEL_NAME)
    channel.postMessage(nextState)
    channel.close()
  } catch {}
}

export default function AdminDisplayPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [resultsRows, setResultsRows] = useState<ResultRow[]>([])
  const [displayState, setDisplayState] = useState<DisplayState>(defaultDisplayState)

  async function loadSessionAndProfile() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login')
      return null
    }

    const user = sessionData.session.user

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', user.id)
      .single()

    if (error || !profileData) {
      router.push('/login')
      return null
    }

    if (profileData.role !== 'admin') {
      router.push('/login')
      return null
    }

    setProfile(profileData as Profile)
    return profileData as Profile
  }

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title, status')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    setCompetitions((data as Competition[]) || [])
  }

  async function loadCompetitionData(competitionId: string) {
    if (!competitionId) {
      setPerformances([])
      setResultsRows([])
      return
    }

    const { data: performancesData, error: performancesError } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        competition_id,
        status,
        admin_status,
        choreographer_name,
        participant_names,
        group_name,
        clubs (
          name
        ),
        categories (
          formation_type,
          dance_style,
          age_group,
          level
        )
      `)
      .eq('competition_id', competitionId)
      .eq('status', 'submitted')
      .eq('admin_status', 'approved')
      .order('running_order', { ascending: true, nullsFirst: false })

    if (performancesError) {
      setMessage('Eroare la momente: ' + performancesError.message)
      return
    }

    const performanceRows = (performancesData as unknown as Performance[]) || []
    setPerformances(performanceRows)

    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select(`
        value,
        performance_id,
        performances (
          id,
          title,
          competition_id,
          running_order,
          choreographer_name,
          participant_names,
          group_name,
          clubs (
            name
          ),
          categories (
            formation_type,
            dance_style,
            age_group,
            level
          )
        )
      `)

    if (scoresError) {
      setMessage('Eroare la scoruri: ' + scoresError.message)
      setResultsRows([])
      return
    }

    const scoreRows = ((scoresData as unknown as ScoreRow[]) || []).filter((item) => {
      return item.performances?.[0]?.competition_id === competitionId
    })

    const resultMap = new Map<string, ResultRow>()

    scoreRows.forEach((score) => {
      const performance = score.performances?.[0]
      if (!performance?.id) return

      const group = buildGroupData(performance)

      const existing = resultMap.get(performance.id)
      if (existing) {
        existing.total += Number(score.value)
      } else {
        resultMap.set(performance.id, {
          performance_id: performance.id,
          title: performance.title || '-',
          club: performance.clubs?.[0]?.name || '-',
          choreographer: performance.choreographer_name || '-',
          total: Number(score.value),
          running_order: performance.running_order ?? null,
          discipline: group.discipline,
          age: group.age,
          level: group.level,
          type: group.type,
          groupKey: group.groupKey,
          groupLabel: group.groupLabel,
        })
      }
    })

    setResultsRows(Array.from(resultMap.values()))
  }

  useEffect(() => {
    async function init() {
      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      await loadCompetitions()

      const savedState = readDisplayState()
      setDisplayState(savedState)

      if (savedState.competitionId) {
        await loadCompetitionData(savedState.competitionId)
      }

      setLoading(false)
    }

    void init()
  }, [router])

  useEffect(() => {
    if (!displayState.competitionId) {
      setPerformances([])
      setResultsRows([])
      return
    }

    void loadCompetitionData(displayState.competitionId)
  }, [displayState.competitionId])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 3500)

    return () => clearTimeout(timer)
  }, [message])

  const groups = useMemo(() => {
    const map = new Map<string, string>()

    performances.forEach((performance) => {
      const group = buildGroupData(performance)
      if (!map.has(group.groupKey)) {
        map.set(group.groupKey, group.groupLabel)
      }
    })

    resultsRows.forEach((row) => {
      if (!map.has(row.groupKey)) {
        map.set(row.groupKey, row.groupLabel)
      }
    })

    return Array.from(map.entries())
      .map(([key, label]) => ({
        key,
        label,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ro'))
  }, [performances, resultsRows])

  const selectedCompetition = useMemo(() => {
    return competitions.find((item) => item.id === displayState.competitionId) || null
  }, [competitions, displayState.competitionId])

  const currentPerformance = useMemo(() => {
    return (
      performances.find((item) => item.running_order === displayState.currentRunningOrder) || null
    )
  }, [performances, displayState.currentRunningOrder])

  const nextPerformance = useMemo(() => {
    return (
      performances.find((item) => item.running_order === displayState.currentRunningOrder + 1) ||
      null
    )
  }, [performances, displayState.currentRunningOrder])

  const selectedGroupResults = useMemo(() => {
    const filtered = resultsRows.filter((row) => row.groupKey === displayState.selectedGroupKey)

    return [...filtered].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return (a.running_order ?? 999999) - (b.running_order ?? 999999)
    })
  }, [resultsRows, displayState.selectedGroupKey])

  function updateDisplayState(patch: Partial<DisplayState>) {
    const nextState: DisplayState = {
      ...displayState,
      ...patch,
      updatedAt: new Date().toISOString(),
    }

    setDisplayState(nextState)
    writeDisplayState(nextState)
  }

  function goToPrevious() {
    updateDisplayState({
      currentRunningOrder: Math.max(1, displayState.currentRunningOrder - 1),
    })
  }

  function goToNext() {
    updateDisplayState({
      currentRunningOrder: displayState.currentRunningOrder + 1,
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca control display...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Control display</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={displayState.competitionId}
                onChange={(e) =>
                  updateDisplayState({
                    competitionId: e.target.value,
                    currentRunningOrder: 1,
                    selectedGroupKey: '',
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="">Selecteaza concursul</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.title} ({competition.status || 'open'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Mod display</label>
              <select
                value={displayState.mode}
                onChange={(e) =>
                  updateDisplayState({
                    mode: e.target.value as DisplayMode,
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="running_order">Running order</option>
                <option value="results">Rezultate live</option>
                <option value="pause">Pauza / branding</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Actualizat</label>
              <div className="rounded-lg border bg-gray-50 p-3 text-sm">
                {displayState.updatedAt
                  ? new Date(displayState.updatedAt).toLocaleString('ro-RO')
                  : '-'}
              </div>
            </div>
          </div>

          {selectedCompetition && (
            <p className="mt-4 text-sm text-gray-700">
              Concurs activ: <span className="font-semibold">{selectedCompetition.title}</span>
            </p>
          )}

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Control running order</h2>

          <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-end">
            <button
              type="button"
              onClick={goToPrevious}
              className="rounded-lg border px-5 py-3"
            >
              Anterior
            </button>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Moment curent (running order)
              </label>
              <input
                type="number"
                min={1}
                value={displayState.currentRunningOrder}
                onChange={(e) =>
                  updateDisplayState({
                    currentRunningOrder: Math.max(1, Number(e.target.value || 1)),
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>

            <button
              type="button"
              onClick={goToNext}
              className="rounded-lg border px-5 py-3"
            >
              Urmator
            </button>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-semibold">Moment curent</p>
              {currentPerformance ? (
                <>
                  <p className="font-semibold">{currentPerformance.title}</p>
                  <p className="text-sm text-gray-600">
                    {currentPerformance.clubs?.[0]?.name || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {buildGroupData(currentPerformance).groupLabel}
                  </p>
                  <p className="text-sm text-gray-600">
                    {getParticipantLabel(currentPerformance)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600">Nu exista moment pe aceasta pozitie.</p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <p className="mb-2 text-sm font-semibold">Moment urmator</p>
              {nextPerformance ? (
                <>
                  <p className="font-semibold">{nextPerformance.title}</p>
                  <p className="text-sm text-gray-600">
                    {nextPerformance.clubs?.[0]?.name || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {buildGroupData(nextPerformance).groupLabel}
                  </p>
                  <p className="text-sm text-gray-600">
                    {getParticipantLabel(nextPerformance)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-600">Nu exista moment urmator.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Control rezultate live</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Categoria afisata</label>
              <select
                value={displayState.selectedGroupKey}
                onChange={(e) =>
                  updateDisplayState({
                    selectedGroupKey: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              >
                <option value="">Selecteaza categoria</option>
                {groups.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Mesaj pauza</label>
              <input
                type="text"
                value={displayState.pauseMessage}
                onChange={(e) =>
                  updateDisplayState({
                    pauseMessage: e.target.value,
                  })
                }
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border p-4">
            <p className="mb-2 text-sm font-semibold">
              Preview rezultate pentru categoria selectata
            </p>

            {!displayState.selectedGroupKey ? (
              <p className="text-sm text-gray-600">Nu ai selectat nicio categorie.</p>
            ) : selectedGroupResults.length === 0 ? (
              <p className="text-sm text-gray-600">
                Categoria exista, dar nu are inca rezultate jurizate.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedGroupResults.slice(0, 5).map((row, index) => (
                  <div key={row.performance_id} className="rounded-lg bg-gray-50 p-3">
                    <p className="font-semibold">
                      Locul {index + 1} - {row.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {row.club} | {row.choreographer} | Scor: {row.total}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}