'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  competition_id: string | null
  participant_names: string | null
  group_name: string | null
  clubs?: {
    name: string | null
  }[] | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[] | null
}

type ScoreRow = {
  value: number
  performance_id: string
  performances?: {
    id: string
    title: string
    competition_id: string | null
    running_order: number | null
    choreographer_name: string | null
    participant_names: string | null
    group_name: string | null
    clubs?: {
      name: string | null
    }[] | null
    categories?: {
      formation_type: string | null
      dance_style: string | null
      age_group: string | null
      level: string | null
    }[] | null
  }[] | null
}

type DisplayState = {
  competitionId: string
  mode: 'running_order' | 'results' | 'pause'
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
  performance:
    | Performance
    | (ScoreRow['performances'] extends (infer U)[] ? U : never)
    | null
    | undefined
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
  const firstCategory = item.categories?.[0]

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

function buildGroupLabel(performance: Performance | null) {
  if (!performance) return '-'

  const danceStyle = performance.categories?.[0]?.dance_style || '-'
  const ageGroup = performance.categories?.[0]?.age_group || '-'
  const level = performance.categories?.[0]?.level || '-'
  const formationType = formatFormationType(performance.categories?.[0]?.formation_type || null)

  return `${danceStyle} | ${ageGroup} | ${level} | ${formationType}`
}

function readDisplayState(): DisplayState {
  if (typeof window === 'undefined') return defaultDisplayState

  const raw = window.localStorage.getItem(DISPLAY_STORAGE_KEY)
  if (!raw) return defaultDisplayState

  try {
    const parsed = JSON.parse(raw) as Partial<DisplayState>

    return {
      competitionId: parsed.competitionId || '',
      mode:
        parsed.mode === 'running_order' ||
        parsed.mode === 'results' ||
        parsed.mode === 'pause'
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

export default function DisplayPage() {
  const [loading, setLoading] = useState(true)
  const [displayState, setDisplayState] = useState<DisplayState>(defaultDisplayState)
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [performances, setPerformances] = useState<Performance[]>([])
  const [resultsRows, setResultsRows] = useState<ResultRow[]>([])

  async function loadDisplayData(competitionId: string) {
    if (!competitionId) {
      setCompetition(null)
      setPerformances([])
      setResultsRows([])
      return
    }

    const { data: competitionData } = await supabase
      .from('competitions')
      .select('id, title')
      .eq('id', competitionId)
      .single()

    setCompetition((competitionData as Competition) || null)

    const { data: performancesData } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        competition_id,
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

    setPerformances((performancesData as unknown as Performance[]) || [])

    const { data: scoresData } = await supabase
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
      const state = readDisplayState()
      setDisplayState(state)

      if (state.competitionId) {
        await loadDisplayData(state.competitionId)
      }

      setLoading(false)
    }

    void init()
  }, [])

  useEffect(() => {
    function syncDisplay() {
      const nextState = readDisplayState()
      setDisplayState(nextState)

      if (nextState.competitionId) {
        void loadDisplayData(nextState.competitionId)
      } else {
        setCompetition(null)
        setPerformances([])
        setResultsRows([])
      }
    }

    function handleStorage(event: StorageEvent) {
      if (event.key !== DISPLAY_STORAGE_KEY) return
      syncDisplay()
    }

    window.addEventListener('storage', handleStorage)

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(DISPLAY_CHANNEL_NAME)
      channel.onmessage = () => syncDisplay()
    } catch {}

    const interval = window.setInterval(syncDisplay, 5000)

    return () => {
      window.removeEventListener('storage', handleStorage)
      if (channel) channel.close()
      window.clearInterval(interval)
    }
  }, [])

  const currentPerformance = useMemo(() => {
    return (
      performances.find(
        (item) => item.running_order === displayState.currentRunningOrder
      ) || null
    )
  }, [performances, displayState.currentRunningOrder])

  const nextPerformance = useMemo(() => {
    return (
      performances.find(
        (item) => item.running_order === displayState.currentRunningOrder + 1
      ) || null
    )
  }, [performances, displayState.currentRunningOrder])

  const thirdPerformance = useMemo(() => {
    return (
      performances.find(
        (item) => item.running_order === displayState.currentRunningOrder + 2
      ) || null
    )
  }, [performances, displayState.currentRunningOrder])

  const selectedGroupResults = useMemo(() => {
    const filtered = resultsRows.filter((row) => row.groupKey === displayState.selectedGroupKey)

    return [...filtered].sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return (a.running_order ?? 999999) - (b.running_order ?? 999999)
    })
  }, [resultsRows, displayState.selectedGroupKey])

  if (loading) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-black via-black to-gray-900 text-white">
        <p className="text-4xl font-bold">Se incarca display...</p>
      </main>
    )
  }

  if (!displayState.competitionId || !competition) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-black via-black to-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-6xl font-black">DISPLAY</h1>
          <p className="mt-4 text-2xl text-gray-300">Selecteaza concursul din /admin/display</p>
        </div>
      </main>
    )
  }

  if (displayState.mode === 'pause') {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-black via-black to-gray-900 text-white">
        <div className="text-center">
          <p className="mb-6 text-xl uppercase tracking-[0.4em] text-gray-400">
            {competition.title}
          </p>
          <h1 className="text-7xl font-black">{displayState.pauseMessage || 'Pauza'}</h1>
        </div>
      </main>
    )
  }

  if (displayState.mode === 'results') {
    const currentGroupLabel =
      selectedGroupResults[0]?.groupLabel || 'Rezultate live'

    return (
      <main className="fixed inset-0 overflow-hidden bg-gradient-to-br from-black via-black to-gray-900 text-white">
        <div className="grid h-full w-full grid-rows-[70px_90px_1fr] gap-6 p-6">
          <div className="flex items-center">
            <p className="text-base font-semibold uppercase tracking-[0.35em] text-gray-300">
              {competition.title}
            </p>
          </div>

          <div className="flex items-center justify-center rounded-[28px] border border-white/10 bg-white/5">
            <p className="truncate text-4xl font-black text-white">
              {currentGroupLabel}
            </p>
          </div>

          <div className="min-h-0">
            {selectedGroupResults.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-[32px] border border-white/10 bg-white/5">
                <p className="text-3xl text-gray-300">
                  Nu exista rezultate pentru categoria selectata.
                </p>
              </div>
            ) : (
              <div className="grid h-full grid-rows-5 gap-4">
                {selectedGroupResults.slice(0, 5).map((row, index) => (
                  <div
                    key={row.performance_id}
                    className={`grid grid-cols-[160px_1fr_160px] items-center gap-6 rounded-[28px] border px-6 py-4 ${
                      index === 0
                        ? 'border-amber-300 bg-amber-300/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div
                      className={`text-6xl font-black tracking-[-0.06em] ${
                        index === 0 ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      #{index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-4xl font-black text-white">
                        {row.title}
                      </p>
                      <p className="truncate text-2xl text-gray-300">
                        {row.club} | {row.choreographer}
                      </p>
                    </div>

                    <div
                      className={`text-right text-5xl font-black ${
                        index === 0 ? 'text-amber-300' : 'text-white'
                      }`}
                    >
                      {row.total}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-gradient-to-br from-black via-black to-gray-900 text-white">
      <div className="grid h-full w-full grid-rows-[64px_1fr_240px] gap-5 p-6">
        <div className="flex items-center">
          <p className="text-base font-semibold uppercase tracking-[0.35em] text-gray-300">
            {competition.title}
          </p>
        </div>

        <div className="grid min-h-0 grid-cols-[30%_2px_1fr] gap-6">
          <section className="flex items-center justify-center rounded-[32px] border border-white/10 bg-black/40">
            {currentPerformance ? (
              <span className="select-none text-[15vw] font-black leading-none tracking-[-0.08em] text-amber-300 drop-shadow-[0_0_24px_rgba(252,211,77,0.35)]">
                #{currentPerformance.running_order || '-'}
              </span>
            ) : (
              <span className="text-7xl font-black text-gray-500">-</span>
            )}
          </section>

          <div className="rounded-full bg-white/10" />

          <section className="rounded-[32px] border border-white/10 bg-white/5 p-8">
            {currentPerformance ? (
              <div className="flex h-full flex-col justify-center">
                <p className="mb-3 text-sm uppercase tracking-[0.35em] text-gray-400">
                  Acum pe scena
                </p>

                <h1 className="line-clamp-2 text-5xl font-black leading-[0.92] text-white xl:text-6xl">
                  {currentPerformance.title}
                </h1>

                <p className="mt-5 truncate text-4xl font-black text-white">
                  {currentPerformance.clubs?.[0]?.name || '-'}
                </p>

                <p className="mt-4 line-clamp-2 text-3xl text-gray-300">
                  {buildGroupLabel(currentPerformance)}
                </p>

                <p className="mt-4 line-clamp-2 text-3xl text-gray-400">
                  {getParticipantLabel(currentPerformance)}
                </p>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-4xl text-gray-300">Nu exista moment curent.</p>
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            {nextPerformance ? (
              <div className="flex h-full items-center gap-6">
                <div className="shrink-0 text-[6vw] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.18)]">
                  #{nextPerformance.running_order || '-'}
                </div>

                <div className="min-w-0">
                  <p className="mb-2 text-sm uppercase tracking-[0.3em] text-gray-400">
                    Urmeaza imediat
                  </p>
                  <p className="line-clamp-2 text-4xl font-black leading-tight">
                    {nextPerformance.title}
                  </p>
                  <p className="mt-3 truncate text-2xl text-gray-300">
                    {nextPerformance.clubs?.[0]?.name || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-3xl text-gray-300">Nu exista moment urmator.</p>
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            {thirdPerformance ? (
              <div className="flex h-full items-center gap-6">
                <div className="shrink-0 text-[6vw] font-black leading-none tracking-[-0.08em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.18)]">
                  #{thirdPerformance.running_order || '-'}
                </div>

                <div className="min-w-0">
                  <p className="mb-2 text-sm uppercase tracking-[0.3em] text-gray-400">
                    In curand
                  </p>
                  <p className="line-clamp-2 text-4xl font-black leading-tight">
                    {thirdPerformance.title}
                  </p>
                  <p className="mt-3 truncate text-2xl text-gray-300">
                    {thirdPerformance.clubs?.[0]?.name || '-'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-3xl text-gray-300">Nu exista alt moment.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}