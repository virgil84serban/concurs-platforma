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
}

type PerformanceRow = {
  id: string
  title: string | null
  competition_id: string
  running_order: number | null
  status: string | null
  admin_status: string | null
  choreographer_name: string | null
  declared_participants_count: number | null
  participant_names: string | null
  group_name: string | null
  start_type: string | null
  duration_seconds: number | null
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

type ScorePerformanceRow = {
  id: string
  title: string | null
  competition_id: string | null
  status: string | null
  admin_status: string | null
  running_order: number | null
  choreographer_name: string | null
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
  criterion_id: string
  performances: ScorePerformanceRow[] | null
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
  group_title: string
  judged: boolean
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

function formatStartType(value: string | null) {
  if (!value) return '-'

  switch (value) {
    case 'music':
      return 'Pe muzica'
    case 'pose':
      return 'Din poza'
    default:
      return value
  }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
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

export default function AdminExportsPage() {
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

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
      .select('id, title')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    setCompetitions((data as Competition[]) || [])
  }

  useEffect(() => {
    async function init() {
      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      await loadCompetitions()
      setLoading(false)
    }

    void init()
  }, [router])

  const selectedCompetitionTitle = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetition)?.title || ''
  }, [competitions, selectedCompetition])

  async function exportEntries() {
    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    setExporting(true)
    setMessage('')

    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        competition_id,
        running_order,
        status,
        admin_status,
        choreographer_name,
        declared_participants_count,
        participant_names,
        group_name,
        start_type,
        duration_seconds,
        music_file_name,
        clubs (
          name
        ),
        categories (
          dance_style,
          age_group,
          formation_type,
          level
        )
      `)
      .eq('competition_id', selectedCompetition)
      .order('running_order', { ascending: true, nullsFirst: false })

    if (error) {
      setMessage('Eroare la export inscrieri: ' + error.message)
      setExporting(false)
      return
    }

    const rows = ((data as unknown as PerformanceRow[]) || []).map((item) => ({
      Id: item.running_order ?? '',
      Club: item.clubs?.[0]?.name || '-',
      Disciplina: item.categories?.[0]?.dance_style || '-',
      Varsta: item.categories?.[0]?.age_group || '-',
      Sectiune: formatFormationType(item.categories?.[0]?.formation_type || null),
      Nivel: item.categories?.[0]?.level || '-',
      Dansatori: item.group_name || item.participant_names || '-',
      'Nr. participanti': item.declared_participants_count ?? '',
      Coregrafie: item.title || '-',
      Coregraf: item.choreographer_name || '-',
      'Tip Start': formatStartType(item.start_type),
      Timp: formatDuration(item.duration_seconds),
      Status: item.status || '-',
    }))

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(rows)

    ws['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 30 },
      { wch: 16 },
      { wch: 28 },
      { wch: 22 },
      { wch: 14 },
      { wch: 10 },
      { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Inscrieri')
    XLSX.writeFileXLSX(wb, `inscrieri_${selectedCompetitionTitle || 'concurs'}.xlsx`)

    setMessage('Export inscrieri generat.')
    setExporting(false)
  }

  async function exportResults() {
    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    setExporting(true)
    setMessage('')

    const { data: performancesData, error: performancesError } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        competition_id,
        running_order,
        status,
        admin_status,
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
      `)
      .eq('competition_id', selectedCompetition)
      .order('running_order', { ascending: true, nullsFirst: false })

    if (performancesError) {
      setMessage('Eroare la citirea momentelor: ' + performancesError.message)
      setExporting(false)
      return
    }

    const { data: scoresData, error: scoresError } = await supabase
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

    if (scoresError) {
      setMessage('Eroare la export rezultate: ' + scoresError.message)
      setExporting(false)
      return
    }

    const allPerformances = (performancesData as unknown as PerformanceRow[]) || []
    const allScores = (scoresData as unknown as ScoreRow[]) || []

    const filteredScores = allScores.filter((score) => {
      return score.performances?.[0]?.competition_id === selectedCompetition
    })

    const performanceMap = new Map<string, Omit<ResultRow, 'place' | 'group_title'>>()

    allPerformances.forEach((performance) => {
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
        total: 0,
        judged: false,
      })
    })

    filteredScores.forEach((score) => {
      const performance = score.performances?.[0]
      if (!performance) return

      const existing = performanceMap.get(performance.id)
      if (!existing) return

      existing.total += Number(score.value)
      existing.judged = true
    })

    const rows = Array.from(performanceMap.values())
    const groupsMap = new Map<string, Omit<ResultRow, 'place' | 'group_title'>[]>()

    rows.forEach((row) => {
      const key = `${row.discipline}||${row.age}||${row.level}||${row.type}`
      const existing = groupsMap.get(key) || []
      existing.push(row)
      groupsMap.set(key, existing)
    })

    let finalRows: ResultRow[] = []

    Array.from(groupsMap.entries()).forEach(([key, groupRows]) => {
      const judgedRows = groupRows.filter((row) => row.judged)
      const unjudgedRows = groupRows.filter((row) => !row.judged)

      const sortedJudged = [...judgedRows].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const aOrder = a.running_order ?? 999999
        const bOrder = b.running_order ?? 999999
        return aOrder - bOrder
      })

      const judgedWithPlaces = sortedJudged.map((row, index) => ({
        ...row,
        place: `Locul ${index + 1}`,
        group_title: key.replaceAll('||', ' | '),
      }))

      const unjudgedWithPlaces = unjudgedRows.map((row) => ({
        ...row,
        place: 'Nejurizat',
        group_title: key.replaceAll('||', ' | '),
      }))

      finalRows = finalRows.concat(judgedWithPlaces, unjudgedWithPlaces)
    })

    finalRows.sort((a, b) => {
      const disciplineCompare = a.discipline.localeCompare(b.discipline, 'ro')
      if (disciplineCompare !== 0) return disciplineCompare

      const ageCompare = ageOrder(a.age) - ageOrder(b.age)
      if (ageCompare !== 0) return ageCompare

      const levelCompare = levelOrder(a.level) - levelOrder(b.level)
      if (levelCompare !== 0) return levelCompare

      const typeCompare = typeOrder(a.type) - typeOrder(b.type)
      if (typeCompare !== 0) return typeCompare

      const aJudged = a.judged ? 0 : 1
      const bJudged = b.judged ? 0 : 1
      if (aJudged !== bJudged) return aJudged - bJudged

      if (a.place !== b.place) return a.place.localeCompare(b.place, 'ro')

      return (a.running_order ?? 999999) - (b.running_order ?? 999999)
    })

    const exportRows = finalRows.map((row) => ({
      Grupa: row.group_title,
      Loc: row.place,
      Jurizat: row.judged ? 'Da' : 'Nu',
      Moment: row.title,
      Club: row.club,
      Coregraf: row.choreographer,
      'Running Order': row.running_order ?? '',
      'Scor total': row.total,
      Disciplina: row.discipline,
      Varsta: row.age,
      Nivel: row.level,
      Categorie: row.type,
    }))

    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(exportRows)

    ws['!cols'] = [
      { wch: 36 },
      { wch: 12 },
      { wch: 10 },
      { wch: 28 },
      { wch: 22 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 24 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Rezultate')
    XLSX.writeFileXLSX(wb, `rezultate_${selectedCompetitionTitle || 'concurs'}.xlsx`)

    setMessage('Export rezultate generat.')
    setExporting(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-4xl rounded-xl bg-white p-5 shadow md:p-6">
          <p>Se incarca exporturile...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Export XLSX</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="space-y-4">
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={exportEntries}
                disabled={exporting}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                Export inscrieri XLSX
              </button>

              <button
                type="button"
                onClick={exportResults}
                disabled={exporting}
                className="rounded-lg bg-green-600 px-5 py-3 text-white disabled:opacity-50"
              >
                Export rezultate XLSX
              </button>
            </div>

            {message && (
              <p className="text-sm text-gray-700">{message}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}