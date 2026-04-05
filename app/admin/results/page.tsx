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
  performances: {
    id: string
    title: string | null
    competition_id: string
    status: string | null
    admin_status: string | null
    running_order: number | null
    choreographer_name: string | null
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
  const order = ['4-6 ani', '7-9 ani', '10-12 ani', '13-15 ani', '16-18 ani', '19+ ani']
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

    const filtered = ((data as unknown as ScoreRow[]) || []).filter((score) => {
      return (
        score.performances?.[0]?.competition_id === competitionId &&
        score.performances?.[0]?.status === 'submitted' &&
        score.performances?.[0]?.admin_status === 'approved'
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

  const selectedCompetitionTitle = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetition)?.title || ''
  }, [competitions, selectedCompetition])

  const groupedResults = useMemo(() => {
    const performanceMap = new Map<string, Omit<ResultRow, 'place'>>()

    scores.forEach((score) => {
      const performance = score.performances?.[0]
      if (!performance) return

      const existing = performanceMap.get(performance.id)

      if (existing) {
        existing.total += Number(score.value)
      } else {
        performanceMap.set(performance.id, {
          performance_id: performance.id,
          title: performance.title || '-',
          club: performance.clubs?.[0]?.name || '-',
          discipline: performance.categories?.[0]?.dance_style || '-',
          age: performance.categories?.[0]?.age_group || '-',
          level: performance.categories?.[0]?.level || '-',
          type: formatFormationType(performance.categories?.[0]?.formation_type || '-'),
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

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-4 text-2xl font-bold md:text-3xl">Rezultate admin</h1>

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

          {selectedCompetitionTitle && (
            <p className="mt-4 font-semibold">{selectedCompetitionTitle}</p>
          )}
        </div>

        {groupedResults.map((group, index) => (
          <div key={index} className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 font-bold">{group.title}</h2>

            {group.rows.map((row) => (
              <div key={row.performance_id} className="border-b py-2">
                {row.place} — {row.title} — {row.club} — {row.total}
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}