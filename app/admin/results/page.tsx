'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type ScoreRow = {
  value: number
  performance_id: string
  criterion_id: string
  performances?: {
    id: string
    title: string
    competition_id: string
    status: string | null
    admin_status: string | null
    running_order: number | null
    choreographer_name: string | null
    clubs?: {
      name: string
    } | null
    categories?: {
      formation_type: string | null
      dance_style: string | null
      age_group: string | null
      level: string | null
    } | null
  } | null
}

type ResultRow = {
  performance_id: string
  title: string
  club: string
  discipline: string
  age: string
  level: string
  type: string
  running_order: number | null
  choreographer: string
  total: number
  place: string
}

type ResultGroup = {
  title: string
  discipline: string
  age: string
  level: string
  type: string
  rows: ResultRow[]
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

function ageOrder(age: string) {
  const order = [
    '4-6 ani',
    '7-9 ani',
    '10-12 ani',
    '13-15 ani',
    '16-18 ani',
    '19+ ani',
  ]

  const index = order.indexOf(age)
  return index === -1 ? 999 : index
}

function levelOrder(level: string) {
  const order = ['First Steps', 'Beginner', 'Advanced', 'Pro']
  const index = order.indexOf(level)
  return index === -1 ? 999 : index
}

function typeOrder(type: string) {
  const order = ['Solo', 'Duo', 'Trio', 'Quartet', 'Group', 'Formation']
  const index = order.indexOf(type)
  return index === -1 ? 999 : index
}

export default function AdminResultsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    setCompetitions((data as Competition[]) || [])
  }

  async function loadScores(competitionId: string) {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('scores')
      .select(`
        value,
        performance_id,
        criterion_id,
        performances (
          id,
          title,
          competition_id,
          status,
          admin_status,
          running_order,
          choreographer_name,
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

    if (error) {
      setMessage('Eroare la scoruri: ' + error.message)
      setLoading(false)
      return
    }

    const filtered = ((data as ScoreRow[]) || []).filter((score) => {
      return (
        score.performances?.competition_id === competitionId &&
        score.performances?.status === 'submitted' &&
        score.performances?.admin_status === 'approved'
      )
    })

    setScores(filtered)
    setLoading(false)
  }

  useEffect(() => {
    loadCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      loadScores(selectedCompetition)
    } else {
      setScores([])
    }
  }, [selectedCompetition])

  useEffect(() => {
    if (!selectedCompetition) return

    const channel = supabase
      .channel('admin-live-results-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
        },
        () => {
          loadScores(selectedCompetition)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedCompetition])

  const selectedCompetitionTitle = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetition)?.title || ''
  }, [competitions, selectedCompetition])

  const groupedResults = useMemo(() => {
    const performanceMap = new Map<string, Omit<ResultRow, 'place'>>()

    scores.forEach((score) => {
      const performance = score.performances
      if (!performance) return

      const existing = performanceMap.get(performance.id)

      if (existing) {
        existing.total += Number(score.value)
      } else {
        performanceMap.set(performance.id, {
          performance_id: performance.id,
          title: performance.title,
          club: performance.clubs?.name || '-',
          discipline: performance.categories?.dance_style || '-',
          age: performance.categories?.age_group || '-',
          level: performance.categories?.level || '-',
          type: formatFormationType(performance.categories?.formation_type || '-'),
          running_order: performance.running_order ?? null,
          choreographer: performance.choreographer_name || '-',
          total: Number(score.value),
        })
      }
    })

    const rows = Array.from(performanceMap.values())
    const groupsMap = new Map<string, Omit<ResultRow, 'place'>[]>()

    rows.forEach((row) => {
      const key = `${row.discipline}||${row.age}||${row.level}||${row.type}`
      const existing = groupsMap.get(key) || []
      existing.push(row)
      groupsMap.set(key, existing)
    })

    const groups: ResultGroup[] = Array.from(groupsMap.entries()).map(([key, groupRows]) => {
      const sorted = [...groupRows].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const aOrder = a.running_order ?? 999999
        const bOrder = b.running_order ?? 999999
        return aOrder - bOrder
      })

      const finalRows = sorted.slice(0, 3).map((row, index) => ({
        ...row,
        place: `Locul ${index + 1}`,
      }))

      const [discipline, age, level, type] = key.split('||')

      return {
        title: `${discipline} | ${age} | ${level} | ${type}`,
        discipline,
        age,
        level,
        type,
        rows: finalRows,
      }
    })

    groups.sort((a, b) => {
      const disciplineCompare = a.discipline.localeCompare(b.discipline, 'ro')
      if (disciplineCompare !== 0) return disciplineCompare

      const ageCompare = ageOrder(a.age) - ageOrder(b.age)
      if (ageCompare !== 0) return ageCompare

      const levelCompare = levelOrder(a.level) - levelOrder(b.level)
      if (levelCompare !== 0) return levelCompare

      return typeOrder(a.type) - typeOrder(b.type)
    })

    return groups
  }, [scores])

  const summary = useMemo(() => {
    const totalGroups = groupedResults.length
    const totalClassified = groupedResults.reduce((sum, group) => sum + group.rows.length, 0)
    return { totalGroups, totalClassified }
  }, [groupedResults])

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-4 text-2xl font-bold md:text-3xl">Rezultate admin</h1>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-600">
                Alege concursul
              </label>

              <select
                value={selectedCompetition}
                onChange={(e) => setSelectedCompetition(e.target.value)}
                className="w-full rounded-lg border p-3"
              >
                <option value="">Selecteaza concursul</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Grupe: {summary.totalGroups} | Clasate: {summary.totalClassified}
            </div>
          </div>

          {selectedCompetitionTitle && (
            <p className="mt-4 text-lg font-semibold text-gray-900">
              {selectedCompetitionTitle}
            </p>
          )}

          {message && (
            <p className="mt-3 text-sm text-red-600">{message}</p>
          )}
        </div>

        {!selectedCompetition ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-gray-600">Selecteaza un concurs.</p>
          </div>
        ) : loading ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-gray-600">Se incarca...</p>
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-gray-600">Nu exista rezultate disponibile.</p>
          </div>
        ) : (
          groupedResults.map((group, index) => (
            <div key={index} className="rounded-xl bg-white p-5 shadow md:p-6">
              <div className="mb-4 flex flex-col gap-2 border-b pb-3 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-bold md:text-xl">
                  {group.title}
                </h2>
                <span className="text-sm text-gray-500">
                  Top {group.rows.length}
                </span>
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="p-3 text-sm font-semibold">Loc</th>
                      <th className="p-3 text-sm font-semibold">Moment</th>
                      <th className="p-3 text-sm font-semibold">Club</th>
                      <th className="p-3 text-sm font-semibold">Coregraf</th>
                      <th className="p-3 text-sm font-semibold">Running Order</th>
                      <th className="p-3 text-sm font-semibold">Scor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.performance_id} className="border-b last:border-b-0">
                        <td className="p-3 text-sm font-semibold">{row.place}</td>
                        <td className="p-3 text-sm font-medium">{row.title}</td>
                        <td className="p-3 text-sm">{row.club}</td>
                        <td className="p-3 text-sm">{row.choreographer}</td>
                        <td className="p-3 text-sm">{row.running_order ?? '-'}</td>
                        <td className="p-3 text-sm font-semibold">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 md:hidden">
                {group.rows.map((row) => (
                  <div key={row.performance_id} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="font-semibold">{row.place}</p>
                      <p className="font-semibold">{row.total}</p>
                    </div>

                    <p className="text-base font-medium">{row.title}</p>
                    <p className="mt-1 text-sm text-gray-600">Club: {row.club}</p>
                    <p className="text-sm text-gray-600">Coregraf: {row.choreographer}</p>
                    <p className="text-sm text-gray-600">
                      Running Order: {row.running_order ?? '-'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}