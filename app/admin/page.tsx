'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  status: string
}

type Club = {
  id: string
  name: string
}

type Category = {
  id: string
  competition_id: string
  name: string | null
  formation_type: string | null
  dance_style: string | null
  age_group: string | null
  level: string | null
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  competition_id: string | null
  category_id: string | null
  club_id: string | null
  status: string | null
  admin_status: string | null
  participant_names: string | null
  group_name: string | null
  choreographer_name: string | null
  declared_participants_count: number | null
  start_type: string | null
  duration_seconds: number | null
  categories?: {
    id?: string
    name?: string | null
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[] | null
  clubs?: {
    id?: string
    name: string | null
  }[] | null
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

type JudgeAssignment = {
  id: string
  user_id: string
  competition_id: string
  profiles?: {
    email: string | null
    full_name: string | null
    name?: string | null
  }[] | null
}

type JudgeProfile = {
  id: string
  email: string | null
  full_name?: string | null
  name?: string | null
  role: string
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

const DEFAULT_CRITERIA_SET_A = [
  { name: 'TEHNICA', weight: 1, min_score: 1, max_score: 10, sort_order: 1, is_active: true },
  { name: 'ASEZARE IN SCENA', weight: 1, min_score: 1, max_score: 10, sort_order: 2, is_active: true },
  { name: 'SINCRON', weight: 1, min_score: 1, max_score: 10, sort_order: 3, is_active: true },
  { name: 'MUZICALITATE', weight: 1, min_score: 1, max_score: 10, sort_order: 4, is_active: true },
  { name: 'IMPRESIE GENERALA', weight: 1, min_score: 1, max_score: 10, sort_order: 5, is_active: true },
]

const DEFAULT_CRITERIA_SET_B = [
  { name: 'TEHNICA', weight: 1, min_score: 1, max_score: 10, sort_order: 1, is_active: true },
  { name: 'COMPOZITIE', weight: 1, min_score: 1, max_score: 10, sort_order: 2, is_active: true },
  { name: 'PERFORMANTA', weight: 1, min_score: 1, max_score: 10, sort_order: 3, is_active: true },
  { name: 'IMPRESIE DE ANSAMBLU', weight: 1, min_score: 1, max_score: 10, sort_order: 4, is_active: true },
]

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')

  const [clubs, setClubs] = useState<Club[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [criteria, setCriteria] = useState<ScoreCriterion[]>([])
  const [judgeProfiles, setJudgeProfiles] = useState<JudgeProfile[]>([])
  const [judges, setJudges] = useState<JudgeAssignment[]>([])

  const [competitionTitle, setCompetitionTitle] = useState('')
  const [competitionStatus, setCompetitionStatus] = useState<'open' | 'finished'>('open')
  const [editingCompetitionId, setEditingCompetitionId] = useState<string | null>(null)

  const [clubName, setClubName] = useState('')
  const [editingClubId, setEditingClubId] = useState<string | null>(null)

  const [categoryName, setCategoryName] = useState('')
  const [categoryFormationType, setCategoryFormationType] = useState('')
  const [categoryDanceStyle, setCategoryDanceStyle] = useState('')
  const [categoryAgeGroup, setCategoryAgeGroup] = useState('')
  const [categoryLevel, setCategoryLevel] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  const [performanceTitle, setPerformanceTitle] = useState('')
  const [performanceRunningOrder, setPerformanceRunningOrder] = useState('')
  const [performanceCategoryId, setPerformanceCategoryId] = useState('')
  const [performanceClubId, setPerformanceClubId] = useState('')
  const [performanceParticipantLabel, setPerformanceParticipantLabel] = useState('')
  const [performanceChoreographerName, setPerformanceChoreographerName] = useState('')
  const [performanceDeclaredParticipantsCount, setPerformanceDeclaredParticipantsCount] = useState('')
  const [performanceStartType, setPerformanceStartType] = useState<'music' | 'pose' | ''>('')
  const [performanceDurationSeconds, setPerformanceDurationSeconds] = useState('')
  const [editingPerformanceId, setEditingPerformanceId] = useState<string | null>(null)

  const [criterionName, setCriterionName] = useState('')
  const [criterionWeight, setCriterionWeight] = useState('1')
  const [criterionMinScore, setCriterionMinScore] = useState('1')
  const [criterionMaxScore, setCriterionMaxScore] = useState('10')
  const [criterionSortOrder, setCriterionSortOrder] = useState('1')
  const [criterionIsActive, setCriterionIsActive] = useState(true)
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null)

  const [judgeUserId, setJudgeUserId] = useState('')

  const selectedCompetition =
    competitions.find((competition) => competition.id === selectedCompetitionId) || null

  const selectedCompetitionPerformances = useMemo(() => {
    return [...performances].sort((a, b) => {
      const aOrder = a.running_order ?? 999999
      const bOrder = b.running_order ?? 999999
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.title || '').localeCompare(b.title || '', 'ro')
    })
  }, [performances])

  async function loadSessionAndProfile() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    setMessage('Eroare sesiune: ' + sessionError.message)
    return null
  }

  if (!sessionData.session) {
    router.push('/login')
    return null
  }

  const user = sessionData.session.user

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, email, full_name, name')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    setMessage('Nu am putut citi profilul utilizatorului: ' + profileError.message)
    return null
  }

  if (!profileData) {
    setMessage('Nu exista profil pentru acest utilizator in tabela profiles.')
    return null
  }

  if (profileData.role !== 'admin') {
    setMessage(`Acces interzis. Rolul curent este: ${profileData.role || 'gol'}`)
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

    const rows = (data as Competition[]) || []
    setCompetitions(rows)

    if (rows.length > 0) {
      setSelectedCompetitionId((prev) => prev || rows[0].id)
    }
  }

  async function loadClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      setMessage('Eroare la cluburi: ' + error.message)
      return
    }

    setClubs((data as Club[]) || [])
  }

  async function loadJudgeProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, name, role')
      .eq('role', 'judge')
      .order('email', { ascending: true })

    if (error) {
      setMessage('Eroare la lista de jurati: ' + error.message)
      return
    }

    setJudgeProfiles((data as JudgeProfile[]) || [])
  }

  async function loadCompetitionData(competitionId: string) {
    if (!competitionId) {
      setCategories([])
      setPerformances([])
      setCriteria([])
      setJudges([])
      return
    }

    const [
      categoriesRes,
      performancesRes,
      criteriaRes,
      judgesRes,
    ] = await Promise.all([
      supabase
        .from('categories')
        .select('id, competition_id, name, formation_type, dance_style, age_group, level')
        .eq('competition_id', competitionId)
        .order('dance_style', { ascending: true }),
      supabase
        .from('performances')
        .select(`
          id,
          title,
          running_order,
          competition_id,
          category_id,
          club_id,
          status,
          admin_status,
          participant_names,
          group_name,
          choreographer_name,
          declared_participants_count,
          start_type,
          duration_seconds,
          clubs ( id, name ),
          categories (
            id,
            name,
            formation_type,
            dance_style,
            age_group,
            level
          )
        `)
        .eq('competition_id', competitionId),
      supabase
        .from('score_criteria')
        .select('id, competition_id, name, weight, min_score, max_score, sort_order, is_active')
        .eq('competition_id', competitionId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('judges')
        .select(`
          id,
          user_id,
          competition_id,
          profiles (
            email,
            full_name,
            name
          )
        `)
        .eq('competition_id', competitionId),
    ])

    if (categoriesRes.error) {
      setMessage('Eroare la categorii: ' + categoriesRes.error.message)
    } else {
      setCategories((categoriesRes.data as Category[]) || [])
    }

    if (performancesRes.error) {
      setMessage('Eroare la momente: ' + performancesRes.error.message)
    } else {
      setPerformances((performancesRes.data as unknown as Performance[]) || [])
    }

    if (criteriaRes.error) {
      setMessage('Eroare la criterii: ' + criteriaRes.error.message)
    } else {
      setCriteria((criteriaRes.data as ScoreCriterion[]) || [])
    }

    if (judgesRes.error) {
      setMessage('Eroare la jurati: ' + judgesRes.error.message)
    } else {
      setJudges((judgesRes.data as unknown as JudgeAssignment[]) || [])
    }
  }

  async function refreshAll() {
    await loadCompetitions()
    await loadClubs()
    await loadJudgeProfiles()
    if (selectedCompetitionId) {
      await loadCompetitionData(selectedCompetitionId)
    }
  }

  function resetCompetitionForm() {
    setCompetitionTitle('')
    setCompetitionStatus('open')
    setEditingCompetitionId(null)
  }

  function resetClubForm() {
    setClubName('')
    setEditingClubId(null)
  }

  function resetCategoryForm() {
    setCategoryName('')
    setCategoryFormationType('')
    setCategoryDanceStyle('')
    setCategoryAgeGroup('')
    setCategoryLevel('')
    setEditingCategoryId(null)
  }

  function resetPerformanceForm() {
    setPerformanceTitle('')
    setPerformanceRunningOrder('')
    setPerformanceCategoryId('')
    setPerformanceClubId('')
    setPerformanceParticipantLabel('')
    setPerformanceChoreographerName('')
    setPerformanceDeclaredParticipantsCount('')
    setPerformanceStartType('')
    setPerformanceDurationSeconds('')
    setEditingPerformanceId(null)
  }

  function resetCriterionForm() {
    setCriterionName('')
    setCriterionWeight('1')
    setCriterionMinScore('1')
    setCriterionMaxScore('10')
    setCriterionSortOrder('1')
    setCriterionIsActive(true)
    setEditingCriterionId(null)
  }

  function startEditCompetition(item: Competition) {
    setCompetitionTitle(item.title || '')
    setCompetitionStatus((item.status as 'open' | 'finished') || 'open')
    setEditingCompetitionId(item.id)
  }

  function startEditClub(item: Club) {
    setClubName(item.name || '')
    setEditingClubId(item.id)
  }

  function startEditCategory(item: Category) {
    setCategoryName(item.name || '')
    setCategoryFormationType(item.formation_type || '')
    setCategoryDanceStyle(item.dance_style || '')
    setCategoryAgeGroup(item.age_group || '')
    setCategoryLevel(item.level || '')
    setEditingCategoryId(item.id)
  }

  function startEditPerformance(item: Performance) {
    const formationType = item.categories?.[0]?.formation_type || null
    const isIndividual =
      formationType === 'solo' ||
      formationType === 'duo' ||
      formationType === 'trio' ||
      formationType === 'quartet'

    setPerformanceTitle(item.title || '')
    setPerformanceRunningOrder(item.running_order ? String(item.running_order) : '')
    setPerformanceCategoryId(item.category_id || '')
    setPerformanceClubId(item.club_id || '')
    setPerformanceParticipantLabel(
      isIndividual ? item.participant_names || '' : item.group_name || ''
    )
    setPerformanceChoreographerName(item.choreographer_name || '')
    setPerformanceDeclaredParticipantsCount(
      item.declared_participants_count ? String(item.declared_participants_count) : ''
    )
    setPerformanceStartType((item.start_type as 'music' | 'pose' | '') || '')
    setPerformanceDurationSeconds(item.duration_seconds ? String(item.duration_seconds) : '')
    setEditingPerformanceId(item.id)
  }

  function startEditCriterion(item: ScoreCriterion) {
    setCriterionName(item.name || '')
    setCriterionWeight(String(item.weight ?? 1))
    setCriterionMinScore(String(item.min_score ?? 1))
    setCriterionMaxScore(String(item.max_score ?? 10))
    setCriterionSortOrder(String(item.sort_order ?? 1))
    setCriterionIsActive(!!item.is_active)
    setEditingCriterionId(item.id)
  }

  async function saveCompetition() {
    if (!competitionTitle.trim()) {
      setMessage('Titlul concursului este obligatoriu.')
      return
    }

    setSaving(true)
    setMessage('')

    if (editingCompetitionId) {
      const { error } = await supabase
        .from('competitions')
        .update({
          title: competitionTitle.trim(),
          status: competitionStatus,
        })
        .eq('id', editingCompetitionId)

      if (error) {
        setMessage('Eroare la actualizarea concursului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Concurs actualizat.')
    } else {
      const { error } = await supabase
        .from('competitions')
        .insert({
          title: competitionTitle.trim(),
          status: competitionStatus,
        })

      if (error) {
        setMessage('Eroare la crearea concursului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Concurs creat.')
    }

    resetCompetitionForm()
    await loadCompetitions()
    setSaving(false)
  }

  async function saveClub() {
    if (!clubName.trim()) {
      setMessage('Numele clubului este obligatoriu.')
      return
    }

    setSaving(true)
    setMessage('')

    if (editingClubId) {
      const { error } = await supabase
        .from('clubs')
        .update({ name: clubName.trim() })
        .eq('id', editingClubId)

      if (error) {
        setMessage('Eroare la actualizarea clubului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Club actualizat.')
    } else {
      const { error } = await supabase
        .from('clubs')
        .insert({ name: clubName.trim() })

      if (error) {
        setMessage('Eroare la crearea clubului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Club creat.')
    }

    resetClubForm()
    await loadClubs()
    setSaving(false)
  }

  async function saveCategory() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!categoryFormationType || !categoryDanceStyle || !categoryAgeGroup || !categoryLevel) {
      setMessage('Completeaza toate campurile categoriei.')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = {
      competition_id: selectedCompetitionId,
      name: categoryName.trim() || null,
      formation_type: categoryFormationType,
      dance_style: categoryDanceStyle,
      age_group: categoryAgeGroup,
      level: categoryLevel,
    }

    if (editingCategoryId) {
      const { error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', editingCategoryId)

      if (error) {
        setMessage('Eroare la actualizarea categoriei: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Categorie actualizata.')
    } else {
      const { error } = await supabase
        .from('categories')
        .insert(payload)

      if (error) {
        setMessage('Eroare la crearea categoriei: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Categorie creata.')
    }

    resetCategoryForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function savePerformance() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!performanceTitle.trim()) {
      setMessage('Titlul momentului este obligatoriu.')
      return
    }

    if (!performanceCategoryId) {
      setMessage('Categoria este obligatorie.')
      return
    }

    if (!performanceClubId) {
      setMessage('Clubul este obligatoriu.')
      return
    }

    if (!performanceStartType) {
      setMessage('Tipul de start este obligatoriu.')
      return
    }

    const selectedCategory = categories.find((item) => item.id === performanceCategoryId)
    const isIndividual =
      selectedCategory?.formation_type === 'solo' ||
      selectedCategory?.formation_type === 'duo' ||
      selectedCategory?.formation_type === 'trio' ||
      selectedCategory?.formation_type === 'quartet'

    const runningOrderNumber = performanceRunningOrder ? Number(performanceRunningOrder) : null
    const declaredParticipantsCountNumber = performanceDeclaredParticipantsCount
      ? Number(performanceDeclaredParticipantsCount)
      : null
    const durationSecondsNumber = performanceDurationSeconds
      ? Number(performanceDurationSeconds)
      : null

    if (runningOrderNumber !== null && (!Number.isInteger(runningOrderNumber) || runningOrderNumber < 1)) {
      setMessage('Running order invalid.')
      return
    }

    if (
      declaredParticipantsCountNumber !== null &&
      (!Number.isInteger(declaredParticipantsCountNumber) || declaredParticipantsCountNumber < 1)
    ) {
      setMessage('Numarul de participanti este invalid.')
      return
    }

    if (
      durationSecondsNumber !== null &&
      (!Number.isInteger(durationSecondsNumber) || durationSecondsNumber < 1)
    ) {
      setMessage('Durata este invalida.')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = {
      competition_id: selectedCompetitionId,
      category_id: performanceCategoryId,
      club_id: performanceClubId,
      title: performanceTitle.trim(),
      running_order: runningOrderNumber,
      choreographer_name: performanceChoreographerName.trim() || null,
      declared_participants_count: declaredParticipantsCountNumber,
      start_type: performanceStartType,
      duration_seconds: durationSecondsNumber,
      participant_names: isIndividual ? performanceParticipantLabel.trim() || null : null,
      group_name: isIndividual ? null : performanceParticipantLabel.trim() || null,
      status: 'submitted',
      admin_status: 'approved',
    }

    if (editingPerformanceId) {
      const { error } = await supabase
        .from('performances')
        .update(payload)
        .eq('id', editingPerformanceId)

      if (error) {
        setMessage('Eroare la actualizarea momentului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Moment actualizat.')
    } else {
      const { error } = await supabase
        .from('performances')
        .insert(payload)

      if (error) {
        setMessage('Eroare la crearea momentului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Moment creat.')
    }

    resetPerformanceForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function saveCriterion() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!criterionName.trim()) {
      setMessage('Numele criteriului este obligatoriu.')
      return
    }

    const weightNumber = Number(criterionWeight)
    const minScoreNumber = Number(criterionMinScore)
    const maxScoreNumber = Number(criterionMaxScore)
    const sortOrderNumber = Number(criterionSortOrder)

    if (Number.isNaN(weightNumber) || Number.isNaN(minScoreNumber) || Number.isNaN(maxScoreNumber) || Number.isNaN(sortOrderNumber)) {
      setMessage('Valorile criteriului sunt invalide.')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = {
      competition_id: selectedCompetitionId,
      name: criterionName.trim(),
      weight: weightNumber,
      min_score: minScoreNumber,
      max_score: maxScoreNumber,
      sort_order: sortOrderNumber,
      is_active: criterionIsActive,
    }

    if (editingCriterionId) {
      const { error } = await supabase
        .from('score_criteria')
        .update(payload)
        .eq('id', editingCriterionId)

      if (error) {
        setMessage('Eroare la actualizarea criteriului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Criteriu actualizat.')
    } else {
      const { error } = await supabase
        .from('score_criteria')
        .insert(payload)

      if (error) {
        setMessage('Eroare la crearea criteriului: ' + error.message)
        setSaving(false)
        return
      }

      setMessage('Criteriu creat.')
    }

    resetCriterionForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function addDefaultCriteria(setName: 'A' | 'B') {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    const rows = setName === 'A' ? DEFAULT_CRITERIA_SET_A : DEFAULT_CRITERIA_SET_B

    setSaving(true)
    setMessage('')

    const payload = rows.map((item) => ({
      competition_id: selectedCompetitionId,
      ...item,
    }))

    const { error } = await supabase
      .from('score_criteria')
      .insert(payload)

    if (error) {
      setMessage('Eroare la adaugarea setului de criterii: ' + error.message)
      setSaving(false)
      return
    }

    setMessage(`Setul ${setName} a fost adaugat.`)
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function assignJudge() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!judgeUserId) {
      setMessage('Selecteaza juratul.')
      return
    }

    setSaving(true)
    setMessage('')

    const alreadyAssigned = judges.some((item) => item.user_id === judgeUserId)
    if (alreadyAssigned) {
      setMessage('Acest jurat este deja asignat.')
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from('judges')
      .insert({
        user_id: judgeUserId,
        competition_id: selectedCompetitionId,
      })

    if (error) {
      setMessage('Eroare la asignarea juratului: ' + error.message)
      setSaving(false)
      return
    }

    setJudgeUserId('')
    setMessage('Jurat asignat.')
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function deleteCompetition(id: string) {
    const confirmed = window.confirm('Sigur vrei sa stergi concursul?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('competitions')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la stergerea concursului: ' + error.message)
      setSaving(false)
      return
    }

    if (selectedCompetitionId === id) {
      setSelectedCompetitionId('')
      setCategories([])
      setPerformances([])
      setCriteria([])
      setJudges([])
    }

    setMessage('Concurs sters.')
    resetCompetitionForm()
    await loadCompetitions()
    setSaving(false)
  }

  async function deleteClub(id: string) {
    const confirmed = window.confirm('Sigur vrei sa stergi clubul?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la stergerea clubului: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Club sters.')
    resetClubForm()
    await loadClubs()
    if (selectedCompetitionId) await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function deleteCategory(id: string) {
    const confirmed = window.confirm('Sigur vrei sa stergi categoria?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la stergerea categoriei: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Categorie stearsa.')
    resetCategoryForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function deletePerformance(id: string) {
    const confirmed = window.confirm('Sigur vrei sa stergi momentul?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('performances')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la stergerea momentului: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Moment sters.')
    resetPerformanceForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function deleteCriterion(id: string) {
    const confirmed = window.confirm('Sigur vrei sa stergi criteriul?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('score_criteria')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la stergerea criteriului: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Criteriu sters.')
    resetCriterionForm()
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  async function removeJudgeAssignment(id: string) {
    const confirmed = window.confirm('Sigur vrei sa elimini juratul din concurs?')
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('judges')
      .delete()
      .eq('id', id)

    if (error) {
      setMessage('Eroare la eliminarea juratului: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Jurat eliminat.')
    await loadCompetitionData(selectedCompetitionId)
    setSaving(false)
  }

  useEffect(() => {
  async function init() {
    const p = await loadSessionAndProfile()

    if (!p) {
      setLoading(false)
      return
    }

    await loadCompetitions()
    await loadClubs()
    await loadJudgeProfiles()
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
    }, 3500)

    return () => clearTimeout(timer)
  }, [message])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca administrarea...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Admin panel</h1>
              <p className="mt-2 text-sm text-gray-600">
                Cont logat: {profile?.email || '-'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedCompetitionId && (
                <Link
                  href={`/judge/scores/${selectedCompetitionId}`}
                  className="rounded-lg bg-black px-4 py-2 text-white"
                >
                  Intra pe jurizare
                </Link>
              )}

              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
                className="rounded-lg border px-4 py-2"
              >
                Logout
              </button>
            </div>
          </div>

          {message && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
              {message}
            </div>
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-bold">Concursuri</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Titlu concurs</label>
                <input
                  value={competitionTitle}
                  onChange={(e) => setCompetitionTitle(e.target.value)}
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <select
                  value={competitionStatus}
                  onChange={(e) => setCompetitionStatus(e.target.value as 'open' | 'finished')}
                  className="w-full rounded-lg border p-3"
                >
                  <option value="open">open</option>
                  <option value="finished">finished</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveCompetition}
                disabled={saving}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {editingCompetitionId ? 'Salveaza concurs' : 'Creeaza concurs'}
              </button>

              <button
                type="button"
                onClick={resetCompetitionForm}
                className="rounded-lg border px-5 py-3"
              >
                Reset
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Titlu</th>
                    <th className="p-3 text-sm font-semibold">Status</th>
                    <th className="p-3 text-sm font-semibold">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b ${selectedCompetitionId === item.id ? 'bg-gray-50' : ''}`}
                    >
                      <td className="p-3 text-sm font-medium">{item.title}</td>
                      <td className="p-3 text-sm">{item.status}</td>
                      <td className="p-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCompetitionId(item.id)}
                            className="rounded-lg border px-3 py-2"
                          >
                            Selecteaza
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditCompetition(item)}
                            className="rounded-lg border px-3 py-2"
                          >
                            Editeaza
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCompetition(item.id)}
                            className="rounded-lg border px-3 py-2 text-red-600"
                          >
                            Sterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {competitions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-sm text-gray-500">
                        Nu exista concursuri.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-4 text-xl font-bold">Cluburi</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Nume club</label>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveClub}
                disabled={saving}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {editingClubId ? 'Salveaza club' : 'Creeaza club'}
              </button>

              <button
                type="button"
                onClick={resetClubForm}
                className="rounded-lg border px-5 py-3"
              >
                Reset
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Club</th>
                    <th className="p-3 text-sm font-semibold">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3 text-sm font-medium">{item.name}</td>
                      <td className="p-3 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditClub(item)}
                            className="rounded-lg border px-3 py-2"
                          >
                            Editeaza
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClub(item.id)}
                            className="rounded-lg border px-3 py-2 text-red-600"
                          >
                            Sterge
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {clubs.length === 0 && (
                    <tr>
                      <td colSpan={2} className="p-4 text-sm text-gray-500">
                        Nu exista cluburi.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="text-xl font-bold">Concurs selectat</h2>
          <p className="mt-2 text-sm text-gray-600">
            {selectedCompetition ? selectedCompetition.title : 'Niciun concurs selectat'}
          </p>
        </div>

        {selectedCompetitionId && (
          <>
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-4 text-xl font-bold">Categorii</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Nume categorie</label>
                    <input
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Formation type</label>
                    <select
                      value={categoryFormationType}
                      onChange={(e) => setCategoryFormationType(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    >
                      <option value="">Selecteaza</option>
                      <option value="solo">solo</option>
                      <option value="duo">duo</option>
                      <option value="trio">trio</option>
                      <option value="quartet">quartet</option>
                      <option value="group">group</option>
                      <option value="formation">formation</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Dance style</label>
                    <input
                      value={categoryDanceStyle}
                      onChange={(e) => setCategoryDanceStyle(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Age group</label>
                    <input
                      value={categoryAgeGroup}
                      onChange={(e) => setCategoryAgeGroup(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Level</label>
                    <input
                      value={categoryLevel}
                      onChange={(e) => setCategoryLevel(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveCategory}
                    disabled={saving}
                    className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                  >
                    {editingCategoryId ? 'Salveaza categoria' : 'Creeaza categoria'}
                  </button>

                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="rounded-lg border px-5 py-3"
                  >
                    Reset
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-3 text-sm font-semibold">Categorie</th>
                        <th className="p-3 text-sm font-semibold">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3 text-sm">
                            {(item.dance_style || '-') + ' | ' + (item.age_group || '-') + ' | ' + (item.level || '-') + ' | ' + formatFormationType(item.formation_type)}
                          </td>
                          <td className="p-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditCategory(item)}
                                className="rounded-lg border px-3 py-2"
                              >
                                Editeaza
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCategory(item.id)}
                                className="rounded-lg border px-3 py-2 text-red-600"
                              >
                                Sterge
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {categories.length === 0 && (
                        <tr>
                          <td colSpan={2} className="p-4 text-sm text-gray-500">
                            Nu exista categorii.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-4 text-xl font-bold">Criterii jurizare</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Nume criteriu</label>
                    <input
                                           value={criterionName}
                      onChange={(e) => setCriterionName(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Greutate</label>
                    <input
                      type="number"
                      value={criterionWeight}
                      onChange={(e) => setCriterionWeight(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Min score</label>
                    <input
                      type="number"
                      value={criterionMinScore}
                      onChange={(e) => setCriterionMinScore(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Max score</label>
                    <input
                      type="number"
                      value={criterionMaxScore}
                      onChange={(e) => setCriterionMaxScore(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Sort order</label>
                    <input
                      type="number"
                      value={criterionSortOrder}
                      onChange={(e) => setCriterionSortOrder(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-8">
                    <input
                      id="criterion-active"
                      type="checkbox"
                      checked={criterionIsActive}
                      onChange={(e) => setCriterionIsActive(e.target.checked)}
                    />
                    <label htmlFor="criterion-active" className="text-sm font-medium">
                      Activ
                    </label>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={saveCriterion}
                    disabled={saving}
                    className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                  >
                    {editingCriterionId ? 'Salveaza criteriul' : 'Creeaza criteriul'}
                  </button>

                  <button
                    type="button"
                    onClick={resetCriterionForm}
                    className="rounded-lg border px-5 py-3"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={() => addDefaultCriteria('A')}
                    disabled={saving}
                    className="rounded-lg border px-5 py-3"
                  >
                    Adauga set A
                  </button>

                  <button
                    type="button"
                    onClick={() => addDefaultCriteria('B')}
                    disabled={saving}
                    className="rounded-lg border px-5 py-3"
                  >
                    Adauga set B
                  </button>
                </div>

                <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p>Set A: TEHNICA / ASEZARE IN SCENA / SINCRON / MUZICALITATE / IMPRESIE GENERALA</p>
                  <p className="mt-1">Set B: TEHNICA / COMPOZITIE / PERFORMANTA / IMPRESIE DE ANSAMBLU</p>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-3 text-sm font-semibold">Criteriu</th>
                        <th className="p-3 text-sm font-semibold">Weight</th>
                        <th className="p-3 text-sm font-semibold">Range</th>
                        <th className="p-3 text-sm font-semibold">Sort</th>
                        <th className="p-3 text-sm font-semibold">Activ</th>
                        <th className="p-3 text-sm font-semibold">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="p-3 text-sm font-medium">{item.name}</td>
                          <td className="p-3 text-sm">{item.weight}</td>
                          <td className="p-3 text-sm">
                            {item.min_score} - {item.max_score}
                          </td>
                          <td className="p-3 text-sm">{item.sort_order}</td>
                          <td className="p-3 text-sm">{item.is_active ? 'Da' : 'Nu'}</td>
                          <td className="p-3 text-sm">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEditCriterion(item)}
                                className="rounded-lg border px-3 py-2"
                              >
                                Editeaza
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteCriterion(item.id)}
                                className="rounded-lg border px-3 py-2 text-red-600"
                              >
                                Sterge
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {criteria.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-4 text-sm text-gray-500">
                            Nu exista criterii.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-xl bg-white p-5 shadow">
                <h2 className="mb-4 text-xl font-bold">Jurati</h2>

                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Selecteaza jurat</label>
                    <select
                      value={judgeUserId}
                      onChange={(e) => setJudgeUserId(e.target.value)}
                      className="w-full rounded-lg border p-3"
                    >
                      <option value="">Selecteaza juratul</option>
                      {judgeProfiles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {(item.full_name || item.name || item.email || item.id) +
                            (item.email ? ` (${item.email})` : '')}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={assignJudge}
                    disabled={saving}
                    className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                  >
                    Asigneaza jurat
                  </button>
                </div>

                <div className="mt-6 overflow-x-auto">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left">
                        <th className="p-3 text-sm font-semibold">Nume</th>
                        <th className="p-3 text-sm font-semibold">Email</th>
                        <th className="p-3 text-sm font-semibold">Actiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {judges.map((item) => {
                        const judgeProfile = item.profiles?.[0]

                        return (
                          <tr key={item.id} className="border-b">
                            <td className="p-3 text-sm font-medium">
                              {judgeProfile?.full_name || judgeProfile?.name || '-'}
                            </td>
                            <td className="p-3 text-sm">{judgeProfile?.email || '-'}</td>
                            <td className="p-3 text-sm">
                              <div className="flex flex-wrap gap-2">
                                <Link
                                  href={`/judge/scores/${selectedCompetitionId}`}
                                  className="rounded-lg border px-3 py-2"
                                >
                                  Deschide jurizare
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => removeJudgeAssignment(item.id)}
                                  className="rounded-lg border px-3 py-2 text-red-600"
                                >
                                  Elimina
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      {judges.length === 0 && (
                        <tr>
                          <td colSpan={3} className="p-4 text-sm text-gray-500">
                            Nu exista jurati asignati.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
                        <section className="rounded-xl bg-white p-5 shadow md:p-6">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Momente</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Creeaza, editeaza si controleaza rapid momentele concursului selectat.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/judge/scores/${selectedCompetitionId}`}
                    className="rounded-lg bg-black px-4 py-2 text-white"
                  >
                    Intra pe jurizare
                  </Link>

                  <Link
                    href="/results"
                    className="rounded-lg border px-4 py-2"
                  >
                    Vezi rezultate
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Titlu moment</label>
                  <input
                    value={performanceTitle}
                    onChange={(e) => setPerformanceTitle(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Running order</label>
                  <input
                    type="number"
                    min={1}
                    value={performanceRunningOrder}
                    onChange={(e) => setPerformanceRunningOrder(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Categorie</label>
                  <select
                    value={performanceCategoryId}
                    onChange={(e) => setPerformanceCategoryId(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  >
                    <option value="">Selecteaza categoria</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {(item.dance_style || '-') +
                          ' | ' +
                          (item.age_group || '-') +
                          ' | ' +
                          (item.level || '-') +
                          ' | ' +
                          formatFormationType(item.formation_type)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Club</label>
                  <select
                    value={performanceClubId}
                    onChange={(e) => setPerformanceClubId(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  >
                    <option value="">Selecteaza clubul</option>
                    {clubs.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Participanti / Grup</label>
                  <input
                    value={performanceParticipantLabel}
                    onChange={(e) => setPerformanceParticipantLabel(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Coregraf</label>
                  <input
                    value={performanceChoreographerName}
                    onChange={(e) => setPerformanceChoreographerName(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Nr participanti</label>
                  <input
                    type="number"
                    min={1}
                    value={performanceDeclaredParticipantsCount}
                    onChange={(e) => setPerformanceDeclaredParticipantsCount(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Tip start</label>
                  <select
                    value={performanceStartType}
                    onChange={(e) =>
                      setPerformanceStartType(e.target.value as 'music' | 'pose' | '')
                    }
                    className="w-full rounded-lg border p-3"
                  >
                    <option value="">Selecteaza tipul de start</option>
                    <option value="music">Pe muzica</option>
                    <option value="pose">Din poza</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Durata (secunde)</label>
                  <input
                    type="number"
                    min={1}
                    value={performanceDurationSeconds}
                    onChange={(e) => setPerformanceDurationSeconds(e.target.value)}
                    className="w-full rounded-lg border p-3"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={savePerformance}
                  disabled={saving}
                  className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
                >
                  {editingPerformanceId ? 'Salveaza momentul' : 'Creeaza momentul'}
                </button>

                <button
                  type="button"
                  onClick={resetPerformanceForm}
                  className="rounded-lg border px-5 py-3"
                >
                  Reset
                </button>
              </div>

              <div className="mt-6 space-y-4">
                {selectedCompetitionPerformances.map((item) => {
                  const club = item.clubs?.[0]
                  const categoryLabel = buildCategoryLabel(item)
                  const participantLabel = buildParticipantLabel(item)

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
                              #{item.running_order || '-'}
                            </span>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                              {item.status || '-'}
                            </span>

                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                              {item.admin_status || '-'}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-bold text-gray-900">
                            {item.title || '-'}
                          </h3>

                          <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2 xl:grid-cols-3">
                            <p>
                              <span className="font-medium text-gray-800">Club:</span>{' '}
                              {club?.name || '-'}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Categorie:</span>{' '}
                              {categoryLabel}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Participanti / Grup:</span>{' '}
                              {participantLabel}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Coregraf:</span>{' '}
                              {item.choreographer_name || '-'}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Nr participanti:</span>{' '}
                              {item.declared_participants_count || '-'}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Tip start:</span>{' '}
                              {formatStartType(item.start_type)}
                            </p>
                            <p>
                              <span className="font-medium text-gray-800">Durata:</span>{' '}
                              {formatDuration(item.duration_seconds)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditPerformance(item)}
                            className="rounded-lg border px-3 py-2"
                          >
                            Editeaza
                          </button>

                          <button
                            type="button"
                            onClick={() => deletePerformance(item.id)}
                            className="rounded-lg border px-3 py-2 text-red-600"
                          >
                            Sterge
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {selectedCompetitionPerformances.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                    Nu exista momente in acest concurs.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}