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

type Performance = {
  id: string
  title: string
  running_order: number | null
  competition_id: string | null
  category_id: string | null
  participant_names: string | null
  group_name: string | null
  categories?: {
    id?: string
    name?: string | null
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  } | null
  clubs?: {
    name: string | null
  } | null
}

type ScoreRow = {
  id: string
  judge_id: string
  performance_id: string
  criterion_id: string
  value: number
}

type Criterion = {
  id: string
  name: string
  competition_id: string
}

type ResultRow = {
  performanceId: string
  runningOrder: number | null
  title: string
  clubName: string
  participantLabel: string
  categoryLabel: string
  categoryKey: string
  judgeCount: number
  criteriaAverages: Record<string, number>
  totalScore: number
  finalAverage: number
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

function formatNumber(value: number) {
  return value.toFixed(2)
}

function isSyncCriterion(name: string) {
  const normalized = name.trim().toLowerCase()
  return normalized === 'sincronizare' || normalized === 'sincron'
}

function buildCategoryLabel(performance: Performance) {
  const danceStyle = performance.categories?.dance_style || '-'
  const ageGroup = performance.categories?.age_group || '-'
  const level = performance.categories?.level || '-'
  const formationType = formatFormationType(performance.categories?.formation_type || null)

  return `${danceStyle} | ${ageGroup} | ${level} | ${formationType}`
}

function buildParticipantLabel(performance: Performance) {
  return performance.group_name || performance.participant_names || '-'
}

export default function ResultsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')

  const [performances, setPerformances] = useState<Performance[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])

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

    if (!['admin', 'judge'].includes(profileData.role)) {
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

    const rows = (data as Competition[]) || []
    setCompetitions(rows)

    if (rows.length > 0) {
      setSelectedCompetitionId((prev) => prev || rows[0].id)
    }
  }

  async function loadCriteria(competitionId: string) {
    const { data, error } = await supabase
      .from('criteria')
      .select('id, name, competition_id')
      .eq('competition_id', competitionId)
      .order('name', { ascending: true })

    if (error) {
      setMessage('Eroare la criterii: ' + error.message)
      setCriteria([])
      return
    }

    setCriteria((data as Criterion[]) || [])
  }

  async function loadPerformances(competitionId: string) {
    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        competition_id,
        category_id,
        participant_names,
        group_name,
        clubs (
          name
        ),
        categories (
          id,
          name,
          formation_type,
          dance_style,
          age_group,
          level
        )
      `)
      .eq('competition_id', competitionId)
      .eq('status', 'submitted')
      .eq('admin_status', 'approved')
      .order('running_order', { ascending: true })

    if (error) {
      setMessage('Eroare la momente: ' + error.message)
      setPerformances([])
      return
    }

    setPerformances((data as Performance[]) || [])
  }

  async function loadScoresForCompetition(competitionId: string) {
    const { data: judgesData, error: judgesError } = await supabase
      .from('judges')
      .select('id')
      .eq('competition_id', competitionId)

    if (judgesError) {
      setMessage('Eroare la jurati: ' + judgesError.message)
      setScores([])
      return
    }

    const judgeIds = ((judgesData as Array<{ id: string }>) || []).map((item) => item.id)

    if (judgeIds.length === 0) {
      setScores([])
      return
    }

    const { data, error } = await supabase
      .from('scores')
      .select('id, judge_id, performance_id, criterion_id, value')
      .in('judge_id', judgeIds)

    if (error) {
      setMessage('Eroare la scoruri: ' + error.message)
      setScores([])
      return
    }

    setScores((data as ScoreRow[]) || [])
  }

  async function loadCompetitionData(competitionId: string) {
    setMessage('')
    await Promise.all([
      loadCriteria(competitionId),
      loadPerformances(competitionId),
      loadScoresForCompetition(competitionId),
    ])
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

    init()
  }, [router])

  useEffect(() => {
    if (!selectedCompetitionId) return
    loadCompetitionData(selectedCompetitionId)
  }, [selectedCompetitionId])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 4000)

    return () => clearTimeout(timer)
  }, [message])

  const groupedResults = useMemo(() => {
    const results: ResultRow[] = performances.map((performance) => {
      const performanceScores = scores.filter(
        (score) => score.performance_id === performance.id
      )

      const judgeIds = Array.from(new Set(performanceScores.map((score) => score.judge_id)))

      const categoryLabel = buildCategoryLabel(performance)
      const categoryKey = performance.category_id || categoryLabel
      const participantLabel = buildParticipantLabel(performance)

      const relevantCriteria =
        performance.categories?.formation_type === 'solo'
          ? criteria.filter((criterion) => !isSyncCriterion(criterion.name))
          : criteria

      const criteriaAverages: Record<string, number> = {}

      for (const criterion of relevantCriteria) {
        const criterionScores = performanceScores.filter(
          (score) => score.criterion_id === criterion.id
        )

        const sum = criterionScores.reduce((acc, score) => acc + Number(score.value || 0), 0)
        const avg = criterionScores.length > 0 ? sum / criterionScores.length : 0

        criteriaAverages[criterion.id] = avg
      }

      const totalScore = Object.values(criteriaAverages).reduce((acc, value) => acc + value, 0)

      const finalAverage =
        relevantCriteria.length > 0 ? totalScore / relevantCriteria.length : 0

      return {
        performanceId: performance.id,
        runningOrder: performance.running_order,
        title: performance.title,
        clubName: performance.clubs?.name || '-',
        participantLabel,
        categoryLabel,
        categoryKey,
        judgeCount: judgeIds.length,
        criteriaAverages,
        totalScore,
        finalAverage,
      }
    })

    const groupsMap = new Map<string, ResultRow[]>()

    for (const row of results) {
      if (!groupsMap.has(row.categoryKey)) {
        groupsMap.set(row.categoryKey, [])
      }

      groupsMap.get(row.categoryKey)!.push(row)
    }

    const groups = Array.from(groupsMap.entries()).map(([categoryKey, rows]) => {
      const sortedRows = [...rows].sort((a, b) => {
        if (b.totalScore !== a.totalScore) {
          return b.totalScore - a.totalScore
        }

        if (b.finalAverage !== a.finalAverage) {
          return b.finalAverage - a.finalAverage
        }

        return (a.runningOrder || 999999) - (b.runningOrder || 999999)
      })

      return {
        categoryKey,
        categoryLabel: sortedRows[0]?.categoryLabel || '-',
        rows: sortedRows,
      }
    })

    return groups.sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, 'ro'))
  }, [performances, scores, criteria])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca rezultatele...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Rezultate</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>

          {message && (
            <p className="mt-4 text-sm text-gray-700">{message}</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:max-w-xl">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="w-full rounded-lg border p-3 text-sm md:text-base"
              >
                <option value="">Selecteaza concursul</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {!selectedCompetitionId ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p>Selecteaza un concurs.</p>
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p>Nu exista rezultate pentru concursul selectat.</p>
          </div>
        ) : (
          groupedResults.map((group) => (
            <div
              key={group.categoryKey}
              className="rounded-xl bg-white p-5 shadow md:p-6"
            >
              <h2 className="mb-4 text-xl font-bold md:text-2xl">
                {group.categoryLabel}
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-[1300px] border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="p-3 text-sm font-semibold">Loc</th>
                      <th className="p-3 text-sm font-semibold">Nr</th>
                      <th className="p-3 text-sm font-semibold">Moment</th>
                      <th className="p-3 text-sm font-semibold">Club</th>
                      <th className="p-3 text-sm font-semibold">Participanti / Grup</th>
                      {criteria.map((criterion) => (
                        <th key={criterion.id} className="p-3 text-sm font-semibold">
                          {criterion.name}
                        </th>
                      ))}
                      <th className="p-3 text-sm font-semibold">Total</th>
                      <th className="p-3 text-sm font-semibold">Media finala</th>
                      <th className="p-3 text-sm font-semibold">Nr jurati</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.rows.map((row, index) => {
                      const performance = performances.find(
                        (item) => item.id === row.performanceId
                      )

                      return (
                        <tr key={row.performanceId} className="border-b align-top">
                          <td className="p-3 text-sm font-bold">{index + 1}</td>
                          <td className="p-3 text-sm">{row.runningOrder || '-'}</td>
                          <td className="p-3 text-sm font-medium">{row.title}</td>
                          <td className="p-3 text-sm">{row.clubName}</td>
                          <td className="p-3 text-sm">{row.participantLabel}</td>

                          {criteria.map((criterion) => {
                            const shouldHide =
                              performance?.categories?.formation_type === 'solo' &&
                              isSyncCriterion(criterion.name)

                            if (shouldHide) {
                              return (
                                <td key={criterion.id} className="p-3 text-sm text-gray-400">
                                  -
                                </td>
                              )
                            }

                            return (
                              <td key={criterion.id} className="p-3 text-sm">
                                {formatNumber(row.criteriaAverages[criterion.id] || 0)}
                              </td>
                            )
                          })}

                          <td className="p-3 text-sm font-semibold">
                            {formatNumber(row.totalScore)}
                          </td>

                          <td className="p-3 text-sm font-semibold">
                            {formatNumber(row.finalAverage)}
                          </td>

                          <td className="p-3 text-sm">{row.judgeCount}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  )
}