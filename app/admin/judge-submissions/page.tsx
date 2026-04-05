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

type JudgeAssignment = {
  id: string
  user_id: string
  competition_id: string
  profiles: {
    full_name: string | null
    email: string | null
  }[] | null
}

type Performance = {
  id: string
  running_order: number | null
  title: string | null
}

type SubmissionRow = {
  id: string
  performance_id: string
  judge_id: string
  is_submitted: boolean
  submitted_at: string | null
}

type ScoreRow = {
  id: string
  performance_id: string
  judge_id: string
  criterion_id: string
  value: number
}

type AdminRow = {
  judgeAssignmentId: string
  judgeEmail: string
  judgeName: string
  performanceId: string
  runningOrder: number | null
  title: string | null
  isSubmitted: boolean
  submittedAt: string | null
  scoreCount: number
}

export default function AdminJudgeSubmissionsPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [pageMessage, setPageMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [judgeFilter, setJudgeFilter] = useState('')
  const [momentFilter, setMomentFilter] = useState('')

  const [judgeAssignments, setJudgeAssignments] = useState<JudgeAssignment[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])

  const [workingKey, setWorkingKey] = useState<string | null>(null)

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
      setPageMessage('Eroare la incarcarea concursurilor: ' + error.message)
      return
    }

    setCompetitions((data as Competition[]) || [])
  }

  async function loadCompetitionData(competitionId: string) {
    if (!competitionId) {
      setJudgeAssignments([])
      setPerformances([])
      setSubmissions([])
      setScores([])
      return
    }

    setPageMessage('')

    const { data: judgesData, error: judgesError } = await supabase
      .from('judges')
      .select(`
        id,
        user_id,
        competition_id,
        profiles (
          full_name,
          email
        )
      `)
      .eq('competition_id', competitionId)

    if (judgesError) {
      setPageMessage('Eroare la incarcarea juratilor: ' + judgesError.message)
      return
    }

    const { data: performancesData, error: performancesError } = await supabase
      .from('performances')
      .select('id, running_order, title')
      .eq('competition_id', competitionId)
      .eq('admin_status', 'approved')
      .order('running_order', { ascending: true })

    if (performancesError) {
      setPageMessage('Eroare la incarcarea momentelor: ' + performancesError.message)
      return
    }

    const judgeAssignmentsData = (judgesData as unknown as JudgeAssignment[]) || []
    const approvedPerformances = (performancesData as Performance[]) || []

    setJudgeAssignments(judgeAssignmentsData)
    setPerformances(approvedPerformances)

    const judgeIds = judgeAssignmentsData.map((item) => item.id)
    const performanceIds = approvedPerformances.map((item) => item.id)

    if (judgeIds.length === 0 || performanceIds.length === 0) {
      setSubmissions([])
      setScores([])
      return
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from('judge_score_submissions')
      .select('id, performance_id, judge_id, is_submitted, submitted_at')
      .eq('competition_id', competitionId)
      .in('judge_id', judgeIds)
      .in('performance_id', performanceIds)

    if (submissionsError) {
      setPageMessage('Eroare la incarcarea submit-urilor finale: ' + submissionsError.message)
      return
    }

    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select('id, performance_id, judge_id, criterion_id, value')
      .in('judge_id', judgeIds)
      .in('performance_id', performanceIds)

    if (scoresError) {
      setPageMessage('Eroare la incarcarea scorurilor: ' + scoresError.message)
      return
    }

    setSubmissions((submissionsData as SubmissionRow[]) || [])
    setScores((scoresData as ScoreRow[]) || [])
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
    if (!selectedCompetitionId) {
      setJudgeAssignments([])
      setPerformances([])
      setSubmissions([])
      setScores([])
      return
    }

    loadCompetitionData(selectedCompetitionId)
  }, [selectedCompetitionId])

  const rows = useMemo<AdminRow[]>(() => {
    const submissionMap = new Map<string, SubmissionRow>()
    const scoreCountMap = new Map<string, number>()

    submissions.forEach((item) => {
      submissionMap.set(`${item.judge_id}__${item.performance_id}`, item)
    })

    scores.forEach((item) => {
      const key = `${item.judge_id}__${item.performance_id}`
      scoreCountMap.set(key, (scoreCountMap.get(key) || 0) + 1)
    })

    const builtRows: AdminRow[] = []

    judgeAssignments.forEach((judge) => {
      performances.forEach((performance) => {
        const key = `${judge.id}__${performance.id}`
        const submission = submissionMap.get(key)

        builtRows.push({
          judgeAssignmentId: judge.id,
          judgeEmail: judge.profiles?.email || '-',
          judgeName: judge.profiles?.full_name || '-',
          performanceId: performance.id,
          runningOrder: performance.running_order,
          title: performance.title,
          isSubmitted: submission?.is_submitted || false,
          submittedAt: submission?.submitted_at || null,
          scoreCount: scoreCountMap.get(key) || 0,
        })
      })
    })

    return builtRows
  }, [judgeAssignments, performances, submissions, scores])

  const filteredRows = useMemo(() => {
    const judgeTerm = judgeFilter.trim().toLowerCase()
    const momentTerm = momentFilter.trim()

    return rows.filter((row) => {
      const judgeMatches =
        !judgeTerm ||
        row.judgeEmail.toLowerCase().includes(judgeTerm) ||
        row.judgeName.toLowerCase().includes(judgeTerm)

      const momentMatches =
        !momentTerm ||
        String(row.runningOrder || '').includes(momentTerm)

      return judgeMatches && momentMatches
    })
  }, [rows, judgeFilter, momentFilter])

  async function handleUndoFinal(row: AdminRow) {
    setPageMessage('')

    const confirmUndo = window.confirm(
      `Sigur vrei sa anulezi submit final pentru juratul ${row.judgeEmail} la momentul #${row.runningOrder || '-'}?`
    )

    if (!confirmUndo) {
      return
    }

    try {
      setWorkingKey(`undo-${row.judgeAssignmentId}-${row.performanceId}`)

      const { error } = await supabase
        .from('judge_score_submissions')
        .delete()
        .eq('judge_id', row.judgeAssignmentId)
        .eq('performance_id', row.performanceId)

      if (error) {
        setPageMessage('Eroare la anularea submit final: ' + error.message)
        return
      }

      setPageMessage(
        `Submit final anulat pentru ${row.judgeEmail}, moment #${row.runningOrder || '-'}.`
      )

      await loadCompetitionData(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setWorkingKey(null)
    }
  }

  async function handleDeleteScores(row: AdminRow) {
    setPageMessage('')

    const confirmDelete = window.confirm(
      `Sigur vrei sa stergi scorurile pentru juratul ${row.judgeEmail} la momentul #${row.runningOrder || '-'}? Aceasta actiune va sterge si statusul final, daca exista.`
    )

    if (!confirmDelete) {
      return
    }

    try {
      setWorkingKey(`delete-${row.judgeAssignmentId}-${row.performanceId}`)

      const { error: scoresError } = await supabase
        .from('scores')
        .delete()
        .eq('judge_id', row.judgeAssignmentId)
        .eq('performance_id', row.performanceId)

      if (scoresError) {
        setPageMessage('Eroare la stergerea scorurilor: ' + scoresError.message)
        return
      }

      const { error: submissionError } = await supabase
        .from('judge_score_submissions')
        .delete()
        .eq('judge_id', row.judgeAssignmentId)
        .eq('performance_id', row.performanceId)

      if (submissionError) {
        setPageMessage('Scorurile au fost sterse, dar submit final nu a putut fi sters: ' + submissionError.message)
        return
      }

      setPageMessage(
        `Scorurile au fost sterse pentru ${row.judgeEmail}, moment #${row.runningOrder || '-'}.`
      )

      await loadCompetitionData(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setWorkingKey(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca administrarea submit-urilor...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="text-2xl font-bold md:text-3xl">Administrare submit-uri jurizare</h1>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => {
                  setSelectedCompetitionId(e.target.value)
                  setJudgeFilter('')
                  setMomentFilter('')
                  setPageMessage('')
                }}
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

            <div>
              <label className="mb-1 block text-sm font-medium">Filtru jurat</label>
              <input
                type="text"
                value={judgeFilter}
                onChange={(e) => setJudgeFilter(e.target.value)}
                placeholder="Cauta dupa nume sau email"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Filtru nr. moment</label>
              <input
                type="text"
                inputMode="numeric"
                value={momentFilter}
                onChange={(e) => setMomentFilter(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ex: 25"
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          {pageMessage && (
            <p className="mt-4 text-sm text-gray-700">{pageMessage}</p>
          )}
        </div>

        {!selectedCompetitionId ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-gray-600">Selecteaza un concurs.</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-gray-600">Nu exista rezultate pentru filtrul curent.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Nr. Moment</th>
                    <th className="p-3 text-sm font-semibold">Moment</th>
                    <th className="p-3 text-sm font-semibold">Jurat</th>
                    <th className="p-3 text-sm font-semibold">Scoruri</th>
                    <th className="p-3 text-sm font-semibold">Status</th>
                    <th className="p-3 text-sm font-semibold">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const undoKey = `undo-${row.judgeAssignmentId}-${row.performanceId}`
                    const deleteKey = `delete-${row.judgeAssignmentId}-${row.performanceId}`
                    const isUndoing = workingKey === undoKey
                    const isDeleting = workingKey === deleteKey

                    return (
                      <tr key={`${row.judgeAssignmentId}-${row.performanceId}`} className="border-b">
                        <td className="p-3 text-sm font-semibold">{row.runningOrder ?? '-'}</td>
                        <td className="p-3 text-sm">{row.title || '-'}</td>
                        <td className="p-3 text-sm">
                          <div>{row.judgeName || '-'}</div>
                          <div className="text-gray-500">{row.judgeEmail}</div>
                        </td>
                        <td className="p-3 text-sm">{row.scoreCount}</td>
                        <td className="p-3 text-sm font-semibold">
                          {row.isSubmitted ? 'Final' : 'Draft'}
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleUndoFinal(row)}
                              disabled={!row.isSubmitted || isUndoing || isDeleting}
                              className="rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50"
                            >
                              {isUndoing ? 'Se anuleaza...' : 'Anuleaza submit final'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteScores(row)}
                              disabled={(row.scoreCount === 0 && !row.isSubmitted) || isUndoing || isDeleting}
                              className="rounded-lg bg-red-600 px-3 py-2 text-white disabled:opacity-50"
                            >
                              {isDeleting ? 'Se sterg...' : 'Sterge scoruri'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}