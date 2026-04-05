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
    case 'solo': return 'Solo'
    case 'duo': return 'Duo'
    case 'trio': return 'Trio'
    case 'quartet': return 'Quartet'
    case 'group': return 'Group'
    case 'formation': return 'Formation'
    default: return value
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

    const judgeIds = ((judgesData as any[]) || []).map(j => j.id)

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

  const groupedResults = useMemo(() => {
    const results: ResultRow[] = performances.map((performance) => {
      const cat = performance.categories?.[0]
      const club = performance.clubs?.[0]

      const performanceScores = scores.filter(s => s.performance_id === performance.id)
      const judgeIds = Array.from(new Set(performanceScores.map(s => s.judge_id)))

      const relevantCriteria =
        cat?.formation_type === 'solo'
          ? criteria.filter(c => !isSyncCriterion(c.name))
          : criteria

      const criteriaAverages: Record<string, number> = {}

      for (const c of relevantCriteria) {
        const scoresFor = performanceScores.filter(s => s.criterion_id === c.id)
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
        categoryKey: performance.category_id || 'default',
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

    return Array.from(map.entries()).map(([key, rows]) => ({
      categoryKey: key,
      categoryLabel: rows[0]?.categoryLabel || '-',
      rows: rows.sort((a, b) => b.totalScore - a.totalScore),
    }))
  }, [performances, scores, criteria])

  if (loading) return <p className="p-6">Se incarca...</p>

  return <div>OK</div>
}