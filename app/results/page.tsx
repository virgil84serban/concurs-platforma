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
  }[]
  clubs?: {
    name: string | null
  }[]
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
  const cat = performance.categories?.[0]

  const danceStyle = cat?.dance_style || '-'
  const ageGroup = cat?.age_group || '-'
  const level = cat?.level || '-'
  const formationType = formatFormationType(cat?.formation_type || null)

  return `${danceStyle} | ${ageGroup} | ${level} | ${formationType}`
}

function buildParticipantLabel(performance: Performance) {
  return performance.group_name || performance.participant_names || '-'
}

function getPlaceBadge(index: number) {
  if (index === 0) return '🥇 Locul 1'
  if (index === 1) return '🥈 Locul 2'
  if (index === 2) return '🥉 Locul 3'
  return `Locul ${index + 1}`
}

function PodiumCard({
  row,
  place,
}: {
  row: ResultRow
  place: 1 | 2 | 3
}) {
  const placeLabel =
    place === 1 ? '🥇 Locul 1' : place === 2 ? '🥈 Locul 2' : '🥉 Locul 3'

  const heightClass =
    place === 1
      ? 'md:min-h-[220px]'
      : place === 2
        ? 'md:min-h-[190px]'
        : 'md:min-h-[170px]'

  const orderClass =
    place === 1 ? 'md:order-2' : place === 2 ? 'md:order-1' : 'md:order-3'

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${heightClass} ${orderClass}`}
    >
      <div className="mb-3 text-sm font-semibold text-gray-500">{placeLabel}</div>

      <div className="mb-2 text-lg font-bold text-gray-900">{row.title}</div>

      <div className="space-y-1 text-sm text-gray-600">
        <p>
          <span className="font-medium text-gray-800">Nr moment:</span>{' '}
          {row.runningOrder || '-'}
        </p>
        <p>
          <span className="font-medium text-gray-800">Club:</span>{' '}
          {row.clubName}
        </p>
        <p>
          <span className="font-medium text-gray-800">Participanti / Grup:</span>{' '}
          {row.participantLabel}
        </p>
        <p>
          <span className="font-medium text-gray-800">Nr jurati:</span>{' '}
          {row.judgeCount}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {formatNumber(row.totalScore)}
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 p-3">
          <div className="text-xs uppercase tracking-wide text-gray-500">Media finala</div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {formatNumber(row.finalAverage)}
          </div>
        </div>
      </div>
    </div>
  )
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

    setCompetitions((data as Competition[]) || [])

    if (data && data.length > 0) {
      setSelectedCompetitionId((prev) => prev || data[0].id)
    }
  }

  async function loadCriteria(competitionId: string) {
    const { data, error } = await supabase
      .from('criteria')
      .select('id, name, competition_id')
      .eq('competition_id', competitionId)
      .order('name')

    if (error) {
      setMessage('Eroare la criterii: ' + error.message)
      setCriteria([])
      return
    }

    setCriteria((data as unknown as Criterion[]) || [])
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
        clubs ( name ),
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
      .order('running_order')

    if (error) {
      setMessage('Eroare la momente: ' + error.message)
      setPerformances([])
      return
    }

    setPerformances((data as unknown as Performance[]) || [])
  }

  async function loadScoresForCompetition(competitionId: string) {
    const { data: judgesData } = await supabase
      .from('judges')
      .select('id')
      .eq('competition_id', competitionId)

    const judgeIds = ((judgesData as any[]) || []).map((j) => j.id)

    if (judgeIds.length === 0) {
      setScores([])
      return
    }

    const { data } = await supabase
      .from('scores')
      .select('id, judge_id, performance_id, criterion_id, value')
      .in('judge_id', judgeIds)

    setScores((data as unknown as ScoreRow[]) || [])
  }

  async function loadCompetitionData(id: string) {
    setMessage('')
    await Promise.all([
      loadCriteria(id),
      loadPerformances(id),
      loadScoresForCompetition(id),
    ])
  }

  useEffect(() => {
    async function init() {
      const p = await loadSessionAndProfile()
      if (!p) return
      await loadCompetitions()
      setLoading(false)
    }

    init()
  }, [router])

  useEffect(() => {
    if (selectedCompetitionId) {
      loadCompetitionData(selectedCompetitionId)
    }
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
      const cat = performance.categories?.[0]
      const club = performance.clubs?.[0]

      const performanceScores = scores.filter((s) => s.performance_id === performance.id)
      const judgeIds = Array.from(new Set(performanceScores.map((s) => s.judge_id)))

      const relevantCriteria =
        cat?.formation_type === 'solo'
          ? criteria.filter((c) => !isSyncCriterion(c.name))
          : criteria

      const criteriaAverages: Record<string, number> = {}

      for (const c of relevantCriteria) {
        const scoresFor = performanceScores.filter((s) => s.criterion_id === c.id)
        const sum = scoresFor.reduce((a, s) => a + Number(s.value || 0), 0)
        criteriaAverages[c.id] = scoresFor.length ? sum / scoresFor.length : 0
      }

      const totalScore = Object.values(criteriaAverages).reduce((a, v) => a + v, 0)
      const finalAverage = relevantCriteria.length ? totalScore / relevantCriteria.length : 0

      return {
        performanceId: performance.id,
        runningOrder: performance.running_order,
        title: performance.title,
        clubName: club?.name || '-',
        participantLabel: buildParticipantLabel(performance),
        categoryLabel: buildCategoryLabel(performance),
        categoryKey: performance.category_id || buildCategoryLabel(performance),
        judgeCount: judgeIds.length,
        criteriaAverages,
        totalScore,
        finalAverage,
      }
    })

    const map = new Map<string, ResultRow[]>()

    for (const r of results) {
      if (!map.has(r.categoryKey)) map.set(r.categoryKey, [])
      map.get(r.categoryKey)!.push(r)
    }

    const groups = Array.from(map.entries()).map(([key, rows]) => {
      const sortedRows = [...rows].sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
        if (b.finalAverage !== a.finalAverage) return b.finalAverage - a.finalAverage
        return (a.runningOrder || 999999) - (b.runningOrder || 999999)
      })

      return {
        categoryKey: key,
        categoryLabel: sortedRows[0]?.categoryLabel || '-',
        rows: sortedRows,
      }
    })

    return groups.sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel, 'ro'))
  }, [performances, scores, criteria])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p>Se incarca rezultatele...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold md:text-4xl">Rezultate</h1>
              <p className="text-sm text-gray-600 md:text-base">
                Cont logat: {profile?.email || '-'}
              </p>
            </div>

            <div className="w-full md:max-w-md">
              <label className="mb-2 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm md:text-base"
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

          {message && (
            <div className="mt-4 rounded-xl bg-gray-50 p-3">
              <p className="text-sm text-gray-700">{message}</p>
            </div>
          )}
        </div>

        {!selectedCompetitionId ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p>Selecteaza un concurs.</p>
          </div>
        ) : groupedResults.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p>Nu exista rezultate pentru concursul selectat.</p>
          </div>
        ) : (
          groupedResults.map((group) => {
            const top3 = group.rows.slice(0, 3)

            return (
              <section
                key={group.categoryKey}
                className="rounded-2xl bg-white p-5 shadow-sm md:p-6"
              >
                <div className="mb-6">
                  <div className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Categorie
                  </div>
                  <h2 className="mt-3 text-xl font-bold md:text-2xl">
                    {group.categoryLabel}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {group.rows.length} momente clasate
                  </p>
                </div>

                {top3.length > 0 && (
                  <div className="mb-8">
                    <h3 className="mb-4 text-lg font-bold text-gray-900">
                      Podium
                    </h3>

                    <div className="grid gap-4 md:grid-cols-3 md:items-end">
                      {top3[1] && <PodiumCard row={top3[1]} place={2} />}
                      {top3[0] && <PodiumCard row={top3[0]} place={1} />}
                      {top3[2] && <PodiumCard row={top3[2]} place={3} />}
                    </div>
                  </div>
                )}

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

                        const highlightClass =
                          index === 0
                            ? 'bg-yellow-50'
                            : index === 1
                              ? 'bg-gray-50'
                              : index === 2
                                ? 'bg-amber-50'
                                : ''

                        return (
                          <tr
                            key={row.performanceId}
                            className={`border-b align-top ${highlightClass}`}
                          >
                            <td className="p-3 text-sm font-bold">
                              {getPlaceBadge(index)}
                            </td>

                            <td className="p-3 text-sm">{row.runningOrder || '-'}</td>

                            <td className="p-3 text-sm font-medium">{row.title}</td>

                            <td className="p-3 text-sm">{row.clubName}</td>

                            <td className="p-3 text-sm">{row.participantLabel}</td>

                            {criteria.map((criterion) => {
                              const shouldHide =
                                performance?.categories?.[0]?.formation_type === 'solo' &&
                                isSyncCriterion(criterion.name)

                              if (shouldHide) {
                                return (
                                  <td
                                    key={criterion.id}
                                    className="p-3 text-sm text-gray-400"
                                  >
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
              </section>
            )
          })
        )}
      </div>
    </main>
  )
}