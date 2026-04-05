'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
  full_name?: string | null
  name?: string | null
}

type Competition = {
  id: string
  title: string
  status: string | null
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
  competition_id: string
  running_order: number | null
  title: string | null
  status: string | null
  admin_status: string | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  } | null
}

type ScoreCriterion = {
  id: string
  competition_id: string
  name: string
  weight: number
  min_score: number
  max_score: number
  sort_order: number
  is_active: boolean
}

type ExistingScore = {
  performance_id: string
  judge_id: string
  criterion_id: string
  value: number
}

type SubmissionRow = {
  performance_id: string
  judge_id: string
  is_submitted: boolean
  submitted_at: string | null
}

type TableRow = {
  performanceId: string
  runningOrder: number
  formationType: string | null
  discipline: string
  age: string
  level: string
  section: string
  values: Record<string, string>
  total: number
  rankLabel: string
  isSubmitted: boolean
  isComplete: boolean
  hasAnyValue: boolean
  autoSaveSignature: string
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function normalizeText(value: string) {
  return value.trim().toLowerCase()
}

function isSoloFormation(formationType: string | null | undefined) {
  return normalizeText(formationType || '') === 'solo'
}

function isSyncCriterionName(name: string) {
  return normalizeText(name) === 'sincronizare'
}

function buildScoreKey(performanceId: string, criterionId: string) {
  return `${performanceId}__${criterionId}`
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

function buildRankingGroupKey(
  discipline: string,
  age: string,
  level: string,
  section: string
) {
  return `${discipline}||${age}||${level}||${section}`
}

function sanitizeIntegerInput(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, '')
  if (!digitsOnly) return ''

  const parsed = Number(digitsOnly)
  if (Number.isNaN(parsed)) return ''

  if (parsed < 1) return '1'
  if (parsed > 10) return '10'

  return String(parsed)
}

const ROWS_PER_PAGE = 50
const AUTO_SAVE_DELAY_MS = 800

type JudgeScoreRowProps = {
  row: TableRow
  criteria: ScoreCriterion[]
  savingRowId: string | null
  submittingRowId: string | null
  saveState: SaveState
  onScoreChange: (performanceId: string, criterionId: string, value: string) => void
  onAutoSaveRow: (performanceId: string) => Promise<void>
  onSubmitFinal: (performanceId: string) => void
}

const JudgeScoreRow = memo(function JudgeScoreRow({
  row,
  criteria,
  savingRowId,
  submittingRowId,
  saveState,
  onScoreChange,
  onAutoSaveRow,
  onSubmitFinal,
}: JudgeScoreRowProps) {
  const isSavingThisRow = savingRowId === row.performanceId
  const isSubmittingThisRow = submittingRowId === row.performanceId
  const didMountRef = useRef(false)

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    if (row.isSubmitted) return
    if (!row.hasAnyValue) return
    if (!row.isComplete) return

    const timeout = window.setTimeout(() => {
      void onAutoSaveRow(row.performanceId)
    }, AUTO_SAVE_DELAY_MS)

    return () => window.clearTimeout(timeout)
  }, [
    row.autoSaveSignature,
    row.isSubmitted,
    row.hasAnyValue,
    row.isComplete,
    row.performanceId,
    onAutoSaveRow,
  ])

  function renderStatus() {
    if (row.isSubmitted) return 'Final'
    if (isSubmittingThisRow) return 'Se trimite...'
    if (isSavingThisRow || saveState === 'saving') return 'Se salveaza...'
    if (saveState === 'saved') return 'Salvat'
    if (saveState === 'error') return 'Eroare'
    return 'Draft'
  }

  return (
    <tr className="border-b align-middle">
      <td className="p-3 text-sm font-semibold">{row.runningOrder}</td>

      {criteria.map((criterion) => {
        const disabledForSolo =
          isSoloFormation(row.formationType) &&
          isSyncCriterionName(criterion.name)

        return (
          <td key={criterion.id} className="p-3 text-sm">
            {disabledForSolo ? (
              <span className="text-gray-400">-</span>
            ) : (
              <input
                type="number"
                min={1}
                max={10}
                step={1}
                inputMode="numeric"
                value={row.values[criterion.id] || ''}
                onChange={(e) =>
                  onScoreChange(row.performanceId, criterion.id, e.target.value)
                }
                disabled={row.isSubmitted}
                className="w-20 rounded-lg border p-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              />
            )}
          </td>
        )
      })}

      <td className="p-3 text-sm font-semibold">{row.total.toFixed(0)}</td>
      <td className="p-3 text-sm font-semibold">{row.rankLabel}</td>
      <td className="p-3 text-sm font-semibold">{renderStatus()}</td>
      <td className="p-3 text-sm">
        <button
          type="button"
          onClick={() => onSubmitFinal(row.performanceId)}
          disabled={isSubmittingThisRow || row.isSubmitted}
          className="rounded-lg bg-gray-200 px-3 py-2 text-gray-900 disabled:opacity-50"
        >
          {isSubmittingThisRow ? 'Se trimite...' : 'Submit final'}
        </button>
      </td>
    </tr>
  )
})

export default function JudgeCompetitionPage() {
  const router = useRouter()
  const params = useParams()

  const competitionId =
    typeof params?.competitionId === 'string' ? params.competitionId : ''

  const [loading, setLoading] = useState(true)
  const [pageMessage, setPageMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [assignment, setAssignment] = useState<JudgeAssignment | null>(null)
  const [performances, setPerformances] = useState<Performance[]>([])
  const [criteria, setCriteria] = useState<ScoreCriterion[]>([])
  const [scoreValues, setScoreValues] = useState<Record<string, string>>({})
  const [savingRowId, setSavingRowId] = useState<string | null>(null)
  const [submittingRowId, setSubmittingRowId] = useState<string | null>(null)
  const [submittedMap, setSubmittedMap] = useState<Record<string, boolean>>({})
  const [saveStateMap, setSaveStateMap] = useState<Record<string, SaveState>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [searchRunningOrder, setSearchRunningOrder] = useState('')
  const [jumpRunningOrder, setJumpRunningOrder] = useState('')

  useEffect(() => {
    async function init() {
      if (!competitionId) {
        router.push('/judge/scores')
        return
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession()

      if (sessionError || !sessionData.session) {
        router.push('/login')
        return
      }

      const user = sessionData.session.user

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setPageMessage('Eroare profil: ' + profileError.message)
        setLoading(false)
        return
      }

      if (!profileData) {
        setPageMessage('Profilul utilizatorului nu exista.')
        setLoading(false)
        return
      }

      if (profileData.role !== 'judge') {
        router.push('/login')
        return
      }

      setProfile(profileData as Profile)

      const { data: assignmentData, error: assignmentError } = await supabase
        .from('judges')
        .select('id, user_id, competition_id')
        .eq('user_id', user.id)
        .eq('competition_id', competitionId)
        .maybeSingle()

      if (assignmentError) {
        setPageMessage('Eroare la verificarea asignarii juratului: ' + assignmentError.message)
        setLoading(false)
        return
      }

      if (!assignmentData) {
        setPageMessage('Nu esti asociat acestui concurs.')
        setLoading(false)
        return
      }

      setAssignment(assignmentData as JudgeAssignment)

      const { data: competitionData, error: competitionError } = await supabase
        .from('competitions')
        .select('id, title, status')
        .eq('id', competitionId)
        .maybeSingle()

      if (competitionError) {
        setPageMessage('Eroare la incarcarea concursului: ' + competitionError.message)
        setLoading(false)
        return
      }

      if (!competitionData) {
        setPageMessage('Concursul nu exista.')
        setLoading(false)
        return
      }

      setCompetition(competitionData as Competition)

      const { data: performancesData, error: performancesError } = await supabase
        .from('performances')
        .select(`
          id,
          competition_id,
          running_order,
          title,
          status,
          admin_status,
          categories (
            formation_type,
            dance_style,
            age_group,
            level
          )
        `)
        .eq('competition_id', competitionId)
        .eq('admin_status', 'approved')
        .order('running_order', { ascending: true })

      if (performancesError) {
        setPageMessage('Eroare la incarcarea momentelor: ' + performancesError.message)
        setLoading(false)
        return
      }

      const { data: criteriaData, error: criteriaError } = await supabase
        .from('score_criteria')
        .select(`
          id,
          competition_id,
          name,
          weight,
          min_score,
          max_score,
          sort_order,
          is_active
        `)
        .eq('competition_id', competitionId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })

      if (criteriaError) {
        setPageMessage('Eroare la incarcarea criteriilor: ' + criteriaError.message)
        setLoading(false)
        return
      }

      const performanceList = ((performancesData as Performance[]) || []).filter(
        (item) => typeof item.running_order === 'number'
      )

      const criteriaList = (criteriaData as ScoreCriterion[]) || []

      setPerformances(performanceList)
      setCriteria(criteriaList)
      setCurrentPage(1)

      if (performanceList.length > 0) {
        const performanceIds = performanceList.map((item) => item.id)

        const { data: existingScores, error: existingScoresError } = await supabase
          .from('scores')
          .select('performance_id, judge_id, criterion_id, value')
          .eq('judge_id', assignmentData.id)
          .in('performance_id', performanceIds)

        if (existingScoresError) {
          setPageMessage('Eroare la incarcarea scorurilor existente: ' + existingScoresError.message)
          setLoading(false)
          return
        }

        const nextScoreValues: Record<string, string> = {}

        ;((existingScores as ExistingScore[]) || []).forEach((score) => {
          nextScoreValues[buildScoreKey(score.performance_id, score.criterion_id)] =
            String(score.value)
        })

        setScoreValues(nextScoreValues)

        const { data: submissionRows, error: submissionError } = await supabase
          .from('judge_score_submissions')
          .select('performance_id, judge_id, is_submitted, submitted_at')
          .eq('judge_id', assignmentData.id)
          .eq('competition_id', competitionId)
          .in('performance_id', performanceIds)

        if (submissionError) {
          setPageMessage('Eroare la incarcarea submit-urilor finale: ' + submissionError.message)
          setLoading(false)
          return
        }

        const nextSubmittedMap: Record<string, boolean> = {}

        ;((submissionRows as SubmissionRow[]) || []).forEach((row) => {
          nextSubmittedMap[row.performance_id] = !!row.is_submitted
        })

        setSubmittedMap(nextSubmittedMap)
      }

      setLoading(false)
    }

    init()
  }, [competitionId, router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleScoreChange = useCallback(
    (performanceId: string, criterionId: string, value: string) => {
      if (submittedMap[performanceId]) return

      const key = buildScoreKey(performanceId, criterionId)

      setScoreValues((prev) => ({
        ...prev,
        [key]: sanitizeIntegerInput(value),
      }))

      setSaveStateMap((prev) => ({
        ...prev,
        [performanceId]: 'idle',
      }))
    },
    [submittedMap]
  )

  const tableRows = useMemo<TableRow[]>(() => {
    const baseRows = performances.map((performance) => {
      const formationType = performance.categories?.formation_type || null
      const discipline = performance.categories?.dance_style || '-'
      const age = performance.categories?.age_group || '-'
      const level = performance.categories?.level || '-'
      const section = formatFormationType(formationType)

      let total = 0
      let isComplete = true
      let hasAnyValue = false
      const values: Record<string, string> = {}
      const signatureParts: string[] = []

      criteria.forEach((criterion) => {
        const key = buildScoreKey(performance.id, criterion.id)
        const currentValue = scoreValues[key] || ''
        values[criterion.id] = currentValue

        if (isSoloFormation(formationType) && isSyncCriterionName(criterion.name)) {
          signatureParts.push(`${criterion.id}:skip`)
          return
        }

        signatureParts.push(`${criterion.id}:${currentValue}`)

        if (currentValue && currentValue.trim() !== '') {
          hasAnyValue = true
        } else {
          isComplete = false
        }

        const numericValue = Number(currentValue)
        if (!currentValue || Number.isNaN(numericValue)) return

        total += numericValue * Number(criterion.weight || 1)
      })

      return {
        performanceId: performance.id,
        runningOrder: performance.running_order ?? 0,
        formationType,
        discipline,
        age,
        level,
        section,
        values,
        total,
        rankLabel: '-',
        isSubmitted: !!submittedMap[performance.id],
        isComplete,
        hasAnyValue,
        autoSaveSignature: signatureParts.join('|'),
      }
    })

    const grouped = new Map<string, TableRow[]>()

    baseRows.forEach((row) => {
      const key = buildRankingGroupKey(
        row.discipline,
        row.age,
        row.level,
        row.section
      )
      const existing = grouped.get(key) || []
      existing.push(row)
      grouped.set(key, existing)
    })

    const rankLabelMap = new Map<string, string>()

    grouped.forEach((rows) => {
      const sorted = [...rows].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        return a.runningOrder - b.runningOrder
      })

      if (sorted.length === 1) {
        rankLabelMap.set(sorted[0].performanceId, 'Locul 1')
        return
      }

      if (sorted.length === 2) {
        rankLabelMap.set(sorted[0].performanceId, 'Locul 1')
        rankLabelMap.set(sorted[1].performanceId, 'Locul 2')
        return
      }

      if (sorted.length === 3) {
        rankLabelMap.set(sorted[0].performanceId, 'Locul 1')
        rankLabelMap.set(sorted[1].performanceId, 'Locul 2')
        rankLabelMap.set(sorted[2].performanceId, 'Locul 3')
        return
      }

      rankLabelMap.set(sorted[0].performanceId, 'Locul 1')
      rankLabelMap.set(sorted[1].performanceId, 'Locul 2')

      for (let index = 2; index < sorted.length; index += 1) {
        rankLabelMap.set(sorted[index].performanceId, 'Locul 3')
      }
    })

    return baseRows.map((row) => ({
      ...row,
      rankLabel: rankLabelMap.get(row.performanceId) || '-',
    }))
  }, [performances, criteria, scoreValues, submittedMap])

  const filteredRows = useMemo(() => {
    const searchValue = searchRunningOrder.trim()
    if (!searchValue) return tableRows
    return tableRows.filter((row) =>
      String(row.runningOrder).includes(searchValue)
    )
  }, [tableRows, searchRunningOrder])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE))
  }, [filteredRows.length])

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE
    const endIndex = startIndex + ROWS_PER_PAGE
    return filteredRows.slice(startIndex, endIndex)
  }, [filteredRows, currentPage])

  const visibleFrom =
    filteredRows.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1
  const visibleTo = Math.min(currentPage * ROWS_PER_PAGE, filteredRows.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchRunningOrder])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  function handleJumpToMoment() {
    setPageMessage('')

    const trimmed = jumpRunningOrder.trim()
    if (!trimmed) {
      setPageMessage('Introdu un numar de moment.')
      return
    }

    const targetNumber = Number(trimmed)

    if (!Number.isInteger(targetNumber) || targetNumber <= 0) {
      setPageMessage('Numarul momentului trebuie sa fie un numar intreg pozitiv.')
      return
    }

    const targetIndex = filteredRows.findIndex(
      (row) => row.runningOrder === targetNumber
    )

    if (targetIndex === -1) {
      setPageMessage(`Momentul #${targetNumber} nu exista in lista curenta.`)
      return
    }

    const targetPage = Math.floor(targetIndex / ROWS_PER_PAGE) + 1
    setCurrentPage(targetPage)
    setPageMessage(`Ai fost mutat la pagina care contine momentul #${targetNumber}.`)
  }

  const handleAutoSaveRow = useCallback(
    async (performanceId: string) => {
      if (!assignment?.id) {
        setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
        return
      }

      if (submittedMap[performanceId]) {
        return
      }

      const performance = performances.find((item) => item.id === performanceId)
      if (!performance) {
        setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
        return
      }

      const formationType = performance.categories?.formation_type || null
      const rowsToInsert: Array<{
        performance_id: string
        judge_id: string
        criterion_id: string
        value: number
      }> = []

      for (const criterion of criteria) {
        if (isSoloFormation(formationType) && isSyncCriterionName(criterion.name)) {
          continue
        }

        const key = buildScoreKey(performance.id, criterion.id)
        const rawValue = scoreValues[key]

        if (!rawValue || rawValue.trim() === '') {
          return
        }

        const numericValue = Number(rawValue)

        if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 10) {
          setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
          return
        }

        rowsToInsert.push({
          performance_id: performance.id,
          judge_id: assignment.id,
          criterion_id: criterion.id,
          value: numericValue,
        })
      }

      try {
        setSavingRowId(performanceId)
        setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'saving' }))

        const { error: deleteError } = await supabase
          .from('scores')
          .delete()
          .eq('judge_id', assignment.id)
          .eq('performance_id', performanceId)

        if (deleteError) {
          setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
          return
        }

        const { error: insertError } = await supabase
          .from('scores')
          .insert(rowsToInsert)

        if (insertError) {
          setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
          return
        }

        setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'saved' }))
      } catch {
        setSaveStateMap((prev) => ({ ...prev, [performanceId]: 'error' }))
      } finally {
        setSavingRowId(null)
      }
    },
    [assignment, submittedMap, performances, criteria, scoreValues]
  )

  const handleSubmitFinal = useCallback(
    async (performanceId: string) => {
      setPageMessage('')

      if (!assignment?.id) {
        setPageMessage('Lipseste asignarea juratului pentru acest concurs.')
        return
      }

      if (submittedMap[performanceId]) {
        setPageMessage('Acest moment este deja trimis final.')
        return
      }

      const performance = performances.find((item) => item.id === performanceId)
      if (!performance) {
        setPageMessage('Momentul nu a fost gasit.')
        return
      }

      const formationType = performance.categories?.formation_type || null

      for (const criterion of criteria) {
        if (isSoloFormation(formationType) && isSyncCriterionName(criterion.name)) {
          continue
        }

        const key = buildScoreKey(performance.id, criterion.id)
        const rawValue = scoreValues[key]

        if (!rawValue || rawValue.trim() === '') {
          setPageMessage(
            `Moment #${performance.running_order || '-'}: completeaza toate criteriile inainte de submit final.`
          )
          return
        }

        const numericValue = Number(rawValue)

        if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 10) {
          setPageMessage(
            `Moment #${performance.running_order || '-'} - ${criterion.name}: nota finala trebuie sa fie numar intreg intre 1 si 10.`
          )
          return
        }
      }

      try {
        setSubmittingRowId(performanceId)

        await handleAutoSaveRow(performanceId)

        const { error: upsertError } = await supabase
          .from('judge_score_submissions')
          .upsert({
            competition_id: competitionId,
            performance_id: performanceId,
            judge_id: assignment.id,
            is_submitted: true,
            submitted_at: new Date().toISOString(),
          })

        if (upsertError) {
          setPageMessage('Eroare la submit final: ' + upsertError.message)
          return
        }

        setSubmittedMap((prev) => ({
          ...prev,
          [performanceId]: true,
        }))

        setPageMessage(`Momentul #${performance.running_order || '-'} a fost trimis final.`)
      } catch (error) {
        setPageMessage(
          error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
        )
      } finally {
        setSubmittingRowId(null)
      }
    },
    [assignment, submittedMap, performances, criteria, scoreValues, competitionId, handleAutoSaveRow]
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca jurizarea...</p>
        </div>
      </main>
    )
  }

  if (pageMessage && !competition && !assignment) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h1 className="text-2xl font-bold">Panou jurat</h1>
            <p className="mt-4 text-sm text-red-600">{pageMessage}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/judge/scores"
                className="rounded-lg bg-black px-4 py-2 text-white"
              >
                Inapoi la concursurile mele
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1900px] space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">
                {competition?.title || 'Concurs'}
              </h1>
              <p className="mt-2 text-sm text-gray-600 md:text-base">
                Jurat: {profile?.full_name || profile?.name || profile?.email || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-600 md:text-base">
                Email: {profile?.email || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-600 md:text-base">
                Status concurs: {competition?.status || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-600 md:text-base">
                Momente aprobate: {performances.length}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/judge/scores"
                className="rounded-lg bg-gray-200 px-4 py-2 text-gray-900"
              >
                Inapoi
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        {pageMessage && (
          <div className="rounded-xl bg-white p-4 shadow">
            <p className="text-sm text-gray-700">{pageMessage}</p>
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Search dupa nr. moment
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={searchRunningOrder}
                onChange={(e) => setSearchRunningOrder(e.target.value.replace(/[^\d]/g, ''))}
                placeholder="Ex: 125"
                className="w-full rounded-lg border p-3 text-sm md:text-base"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Jump direct la moment
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={jumpRunningOrder}
                  onChange={(e) => setJumpRunningOrder(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Ex: 342"
                  className="w-full rounded-lg border p-3 text-sm md:text-base"
                />
                <button
                  type="button"
                  onClick={handleJumpToMoment}
                  className="rounded-lg bg-black px-4 py-3 text-white"
                >
                  Mergi
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">
              Afisate: {visibleFrom}-{visibleTo} din {filteredRows.length} momente
              {searchRunningOrder.trim() ? ` (filtrate din ${tableRows.length})` : ''}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Prima
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Anterioara
              </button>

              <span className="px-2 text-sm text-gray-700">
                Pagina {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Urmatoarea
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Ultima
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1550px] border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-3 text-sm font-semibold">Nr. Moment</th>
                  {criteria.map((criterion) => (
                    <th key={criterion.id} className="p-3 text-sm font-semibold">
                      {criterion.name}
                    </th>
                  ))}
                  <th className="p-3 text-sm font-semibold">Total</th>
                  <th className="p-3 text-sm font-semibold">Rank</th>
                  <th className="p-3 text-sm font-semibold">Status</th>
                  <th className="p-3 text-sm font-semibold">Actiuni</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <JudgeScoreRow
                    key={row.performanceId}
                    row={row}
                    criteria={criteria}
                    savingRowId={savingRowId}
                    submittingRowId={submittingRowId}
                    saveState={saveStateMap[row.performanceId] || 'idle'}
                    onScoreChange={handleScoreChange}
                    onAutoSaveRow={handleAutoSaveRow}
                    onSubmitFinal={handleSubmitFinal}
                  />
                ))}

                {paginatedRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={criteria.length + 5}
                      className="p-6 text-center text-sm text-gray-500"
                    >
                      Nu exista momente pentru filtrul curent.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">50 momente / pagina</div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Prima
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Anterioara
              </button>

              <span className="px-2 text-sm text-gray-700">
                Pagina {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Urmatoarea
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Ultima
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}