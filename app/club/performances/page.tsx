'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
  club_id: string | null
}

type Competition = {
  id: string
  title: string
  status: string | null
}

type Category = {
  id: string
  competition_id: string
  formation_type: string | null
  dance_style: string | null
  age_group: string | null
  level: string | null
}

type FeeRule = {
  id: string
  competition_id: string
  fee_group: 'solo' | 'small_team' | 'large_team'
  amount_per_participant: number
  currency: string
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  status: string | null
  admin_status: string | null
  competition_id: string | null
  choreographer_name: string | null
  duration_seconds: number | null
  declared_participants_count: number | null
  participant_names: string | null
  group_name: string | null
  start_type: string | null
  created_at: string | null
  music_file_name: string | null
  music_file_path: string | null
  music_file_url: string | null
  fee_group: string | null
  fee_per_participant: number | null
  fee_currency: string | null
  total_fee: number | null
  competitions?: {
    id: string
    title: string
    status: string | null
  } | null
  categories?: {
    dance_style: string | null
    age_group: string | null
    level: string | null
    formation_type: string | null
  } | null
}

type ScoreSummary = {
  performance_id: string
}

const MUSIC_BUCKET = 'music'

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

function formatMoney(amount: number | null, currency: string | null) {
  if (amount === null || amount === undefined) return '-'
  return `${amount} ${currency || 'RON'}`
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getAudioDurationSeconds(file: File) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement('audio')
    const objectUrl = URL.createObjectURL(file)

    audio.preload = 'metadata'
    audio.src = objectUrl

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl)
    }

    audio.onloadedmetadata = () => {
      const duration = Math.round(audio.duration || 0)
      cleanup()

      if (!duration || duration < 1) {
        reject(new Error('Nu am putut citi durata fisierului audio.'))
        return
      }

      resolve(duration)
    }

    audio.onerror = () => {
      cleanup()
      reject(new Error('Fisierul audio nu a putut fi citit.'))
    }
  })
}

function getFeeGroupFromFormationType(formationType: string | null) {
  switch (formationType) {
    case 'solo':
      return 'solo'
    case 'duo':
    case 'trio':
    case 'quartet':
      return 'small_team'
    case 'group':
    case 'formation':
      return 'large_team'
    default:
      return null
  }
}

function getFeeGroupLabel(value: string | null) {
  switch (value) {
    case 'solo':
      return 'Solo'
    case 'small_team':
      return 'Duo / Trio / Quartet'
    case 'large_team':
      return 'Group / Formation'
    default:
      return '-'
  }
}

function getParticipantRule(formationType: string | null) {
  switch (formationType) {
    case 'solo':
      return { min: 1, max: 1, label: 'Solo - exact 1 participant' }
    case 'duo':
      return { min: 2, max: 2, label: 'Duo - exact 2 participanti' }
    case 'trio':
      return { min: 3, max: 3, label: 'Trio - exact 3 participanti' }
    case 'quartet':
      return { min: 4, max: 4, label: 'Quartet - exact 4 participanti' }
    case 'group':
      return { min: 5, max: 8, label: 'Group - intre 5 si 8 participanti' }
    case 'formation':
      return { min: 9, max: 24, label: 'Formation - intre 9 si 24 participanti' }
    default:
      return { min: 1, max: null, label: 'Regula necunoscuta' }
  }
}

export default function ClubPerformancesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [feeRules, setFeeRules] = useState<FeeRule[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [scores, setScores] = useState<ScoreSummary[]>([])

  const [editingId, setEditingId] = useState<string | null>(null)

  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [choreographerName, setChoreographerName] = useState('')
  const [declaredParticipantsCount, setDeclaredParticipantsCount] = useState('')
  const [participantNames, setParticipantNames] = useState('')
  const [groupName, setGroupName] = useState('')
  const [startType, setStartType] = useState('music')
  const [musicFile, setMusicFile] = useState<File | null>(null)

  async function loadSessionAndProfile() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login')
      return null
    }

    const user = sessionData.session.user

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, role, email, club_id')
      .eq('id', user.id)
      .single()

    if (error || !profileData) {
      router.push('/login')
      return null
    }

    if (profileData.role !== 'club') {
      router.push('/login')
      return null
    }

    setProfile(profileData as Profile)
    return profileData as Profile
  }

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title, status')
      .eq('status', 'open')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Nu am putut citi concursurile: ' + error.message)
      return
    }

    const rows = (data as Competition[]) || []
    setCompetitions(rows)

    if (rows.length > 0) {
      setSelectedCompetitionId((prev) => prev || rows[0].id)
    }
  }

  async function loadCategories(competitionId: string) {
    if (!competitionId) {
      setCategories([])
      setSelectedCategoryId('')
      return
    }

    const { data, error } = await supabase
      .from('categories')
      .select('id, competition_id, formation_type, dance_style, age_group, level')
      .eq('competition_id', competitionId)
      .order('dance_style', { ascending: true })

    if (error) {
      setMessage('Nu am putut citi categoriile: ' + error.message)
      return
    }

    const rows = (data as Category[]) || []
    setCategories(rows)

    if (rows.length > 0) {
      setSelectedCategoryId((prev) => {
        const stillExists = rows.some((item) => item.id === prev)
        return stillExists ? prev : rows[0].id
      })
    } else {
      setSelectedCategoryId('')
    }
  }

  async function loadFeeRules(competitionIds: string[]) {
    if (competitionIds.length === 0) {
      setFeeRules([])
      return
    }

    const uniqueCompetitionIds = Array.from(new Set(competitionIds))

    const { data, error } = await supabase
      .from('competition_fee_rules')
      .select('id, competition_id, fee_group, amount_per_participant, currency')
      .in('competition_id', uniqueCompetitionIds)

    if (error) {
      setMessage('Nu am putut citi taxele: ' + error.message)
      return
    }

    setFeeRules((data as FeeRule[]) || [])
  }

  async function loadPerformances(clubId: string) {
    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        status,
        admin_status,
        competition_id,
        choreographer_name,
        duration_seconds,
        declared_participants_count,
        participant_names,
        group_name,
        start_type,
        created_at,
        music_file_name,
        music_file_path,
        music_file_url,
        fee_group,
        fee_per_participant,
        fee_currency,
        total_fee,
        competitions (
          id,
          title,
          status
        ),
        categories (
          dance_style,
          age_group,
          level,
          formation_type
        )
      `)
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Nu am putut citi momentele: ' + error.message)
      return
    }

    const rows = (data as unknown as Performance[]) || []
    setPerformances(rows)

    const performanceIds = rows.map((item) => item.id)

    if (performanceIds.length === 0) {
      setScores([])
      return
    }

    const { data: scoresData, error: scoresError } = await supabase
      .from('scores')
      .select('performance_id')
      .in('performance_id', performanceIds)

    if (scoresError) {
      setMessage('Nu am putut citi scorurile: ' + scoresError.message)
      return
    }

    setScores((scoresData as ScoreSummary[]) || [])
  }

  useEffect(() => {
    async function init() {
      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      if (!profileData.club_id) {
        setMessage('Contul de club nu are club asociat.')
        setLoading(false)
        return
      }

      await loadCompetitions()
      await loadPerformances(profileData.club_id)
      setLoading(false)
    }

    init()
  }, [router])

  useEffect(() => {
    if (!selectedCompetitionId) return
    loadCategories(selectedCompetitionId)
    loadFeeRules([selectedCompetitionId])
  }, [selectedCompetitionId])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 3500)

    return () => clearTimeout(timer)
  }, [message])

  const selectedCategory = useMemo(() => {
    return categories.find((item) => item.id === selectedCategoryId) || null
  }, [categories, selectedCategoryId])

  const judgedPerformanceIds = useMemo(() => {
    return new Set(scores.map((item) => item.performance_id))
  }, [scores])

  function findFeeRule(competitionId: string | null, formationType: string | null) {
    if (!competitionId) return null

    const feeGroup = getFeeGroupFromFormationType(formationType)
    if (!feeGroup) return null

    return (
      feeRules.find(
        (rule) =>
          rule.competition_id === competitionId &&
          rule.fee_group === feeGroup
      ) || null
    )
  }

  const liveFeeRule = useMemo(() => {
    return findFeeRule(selectedCompetitionId || null, selectedCategory?.formation_type || null)
  }, [selectedCompetitionId, selectedCategory, feeRules])

  const estimatedTotalFee = useMemo(() => {
    const participantsCount = Number(declaredParticipantsCount || 0)

    if (!liveFeeRule || !participantsCount) return null

    return Number((participantsCount * Number(liveFeeRule.amount_per_participant)).toFixed(2))
  }, [declaredParticipantsCount, liveFeeRule])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setChoreographerName('')
    setDeclaredParticipantsCount('')
    setParticipantNames('')
    setGroupName('')
    setStartType('music')
    setMusicFile(null)
  }

  async function uploadMusicFile(file: File, clubId: string, performanceId: string) {
    const safeName = sanitizeFileName(file.name)
    const filePath = `${clubId}/${performanceId}/${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(MUSIC_BUCKET)
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      throw new Error('Upload muzica esuat: ' + uploadError.message)
    }

    const { data: publicUrlData } = supabase.storage
      .from(MUSIC_BUCKET)
      .getPublicUrl(filePath)

    return {
      music_file_name: file.name,
      music_file_path: filePath,
      music_file_url: publicUrlData.publicUrl,
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()

    if (!profile?.club_id) {
      setMessage('Nu exista club asociat.')
      return
    }

    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!selectedCategoryId) {
      setMessage('Selecteaza categoria.')
      return
    }

    if (!title.trim()) {
      setMessage('Titlul este obligatoriu.')
      return
    }

    if (!choreographerName.trim()) {
      setMessage('Coregraful este obligatoriu.')
      return
    }

    if (!musicFile) {
      setMessage('Fisierul muzical este obligatoriu.')
      return
    }

    const participantsCount = Number(declaredParticipantsCount || 0)
    if (!participantsCount || participantsCount < 1) {
      setMessage('Numarul de participanti este invalid.')
      return
    }

    if (!selectedCategory) {
      setMessage('Categoria nu a putut fi citita.')
      return
    }

    const rule = getParticipantRule(selectedCategory.formation_type)

    if (rule.max !== null) {
      if (participantsCount < rule.min || participantsCount > rule.max) {
        setMessage(rule.label)
        return
      }
    } else if (participantsCount < rule.min) {
      setMessage(rule.label)
      return
    }

    const isFormation =
      selectedCategory.formation_type === 'group' ||
      selectedCategory.formation_type === 'formation'

    if (isFormation && !groupName.trim()) {
      setMessage('Numele grupului este obligatoriu.')
      return
    }

    if (!isFormation && !participantNames.trim()) {
      setMessage('Numele participantilor este obligatoriu.')
      return
    }

    const feeRule = findFeeRule(selectedCompetitionId, selectedCategory.formation_type)
    if (!feeRule) {
      setMessage('Nu exista taxa configurata pentru acest concurs si aceasta sectiune.')
      return
    }

    setSaving(true)
    setMessage('')

    try {
      const durationSeconds = await getAudioDurationSeconds(musicFile)
      const totalFee = Number((participantsCount * Number(feeRule.amount_per_participant)).toFixed(2))

      const { data: insertedPerformance, error: insertError } = await supabase
        .from('performances')
        .insert([
          {
            competition_id: selectedCompetitionId,
            category_id: selectedCategoryId,
            club_id: profile.club_id,
            title: title.trim(),
            choreographer_name: choreographerName.trim(),
            declared_participants_count: participantsCount,
            participant_names: isFormation ? null : participantNames.trim(),
            group_name: isFormation ? groupName.trim() : null,
            start_type: startType,
            duration_seconds: durationSeconds,
            status: 'submitted',
            admin_status: 'approved',
            fee_group: feeRule.fee_group,
            fee_per_participant: feeRule.amount_per_participant,
            fee_currency: feeRule.currency,
            total_fee: totalFee,
          },
        ])
        .select('id')
        .single()

      if (insertError || !insertedPerformance?.id) {
        setMessage('Eroare la salvare: ' + (insertError?.message || 'Insert esuat'))
        setSaving(false)
        return
      }

      const musicPayload = await uploadMusicFile(musicFile, profile.club_id, insertedPerformance.id)

      const { error: musicUpdateError } = await supabase
        .from('performances')
        .update({
          ...musicPayload,
        })
        .eq('id', insertedPerformance.id)

      if (musicUpdateError) {
        setMessage('Moment creat, dar muzica nu a putut fi atasata: ' + musicUpdateError.message)
        setSaving(false)
        await loadPerformances(profile.club_id)
        resetForm()
        return
      }

      await loadPerformances(profile.club_id)
      resetForm()
      setSaving(false)
      setMessage('Moment creat cu succes.')
    } catch (error) {
      setSaving(false)
      setMessage(error instanceof Error ? error.message : 'Eroare necunoscuta.')
    }
  }

  async function handleDelete(performanceId: string) {
    const performance = performances.find((item) => item.id === performanceId)
    const isFinished = performance?.competitions?.status === 'finished'

    if (isFinished) {
      setMessage('Concursul este finalizat. Momentul nu mai poate fi sters.')
      return
    }

    if (judgedPerformanceIds.has(performanceId)) {
      setMessage('Momentul este deja jurizat si nu mai poate fi sters.')
      return
    }

    const confirmDelete = window.confirm('Sigur vrei sa stergi momentul?')

    if (!confirmDelete) return

    const { error } = await supabase
      .from('performances')
      .delete()
      .eq('id', performanceId)

    if (error) {
      setMessage('Eroare la stergere: ' + error.message)
      return
    }

    if (profile?.club_id) {
      await loadPerformances(profile.club_id)
    }

    setMessage('Moment sters.')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca momentele clubului...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-bold md:text-3xl">Momentele clubului</h1>
              <p className="text-sm text-gray-600 md:text-base">
                Cont logat: {profile?.email || '-'}
              </p>
            </div>

            <div className="flex gap-3">
              <Link href="/club" className="rounded-lg border px-4 py-2">
                Dashboard club
              </Link>
            </div>
          </div>

          {message && (
            <p className="mt-4 text-sm text-gray-700">{message}</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Adauga moment</h2>

          <form onSubmit={handleCreate} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="w-full rounded-lg border p-3"
                required
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
              <label className="mb-1 block text-sm font-medium">Categorie</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full rounded-lg border p-3"
                required
              >
                <option value="">Selecteaza categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {formatFormationType(category.formation_type)} | {category.dance_style} | {category.age_group} | {category.level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Titlu moment</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border p-3"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Coregraf</label>
              <input
                value={choreographerName}
                onChange={(e) => setChoreographerName(e.target.value)}
                className="w-full rounded-lg border p-3"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Nr. participanti</label>
              <input
                type="number"
                min={1}
                value={declaredParticipantsCount}
                onChange={(e) => setDeclaredParticipantsCount(e.target.value)}
                className="w-full rounded-lg border p-3"
                required
              />
              {selectedCategory && (
                <p className="mt-1 text-xs text-gray-500">
                  {getParticipantRule(selectedCategory.formation_type).label}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Tip start</label>
              <select
                value={startType}
                onChange={(e) => setStartType(e.target.value)}
                className="w-full rounded-lg border p-3"
              >
                <option value="music">Pe muzica</option>
                <option value="pose">Din poza</option>
              </select>
            </div>

            {selectedCategory &&
            (selectedCategory.formation_type === 'group' ||
              selectedCategory.formation_type === 'formation') ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Nume grup</label>
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium">Dansatori</label>
                <input
                  value={participantNames}
                  onChange={(e) => setParticipantNames(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  required
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Fisier muzical</label>
              <input
                type="file"
                accept=".mp3,.wav,.m4a,.aac,.ogg"
                onChange={(e) => setMusicFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border p-3"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Durata va fi preluata automat din fisierul audio.
              </p>
            </div>

            <div className="rounded-xl border bg-gray-50 p-4 md:col-span-2">
              <p className="text-sm font-semibold">Taxa participare</p>
              <p className="mt-2 text-sm text-gray-700">
                Grupa taxa: {getFeeGroupLabel(getFeeGroupFromFormationType(selectedCategory?.formation_type || null))}
              </p>
              <p className="mt-1 text-sm text-gray-700">
                Taxa / participant: {formatMoney(liveFeeRule?.amount_per_participant ?? null, liveFeeRule?.currency ?? 'RON')}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                Total estimat: {formatMoney(estimatedTotalFee, liveFeeRule?.currency ?? 'RON')}
              </p>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                {saving ? 'Se salveaza...' : 'Adauga moment'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Momente existente</h2>

          {performances.length === 0 ? (
            <p className="text-sm text-gray-600">Nu exista momente pentru acest club.</p>
          ) : (
            <div className="space-y-4">
              {performances.map((performance) => {
                const formationType = performance.categories?.formation_type || null
                const isFormation =
                  formationType === 'group' || formationType === 'formation'
                const isJudged = judgedPerformanceIds.has(performance.id)
                const isFinished = performance.competitions?.status === 'finished'

                return (
                  <div
                    key={performance.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-lg font-bold">
                          #{performance.running_order || '-'} {performance.title}
                        </p>

                        <p className="text-sm text-gray-700">
                          Concurs: {performance.competitions?.title || '-'} | Status concurs: {performance.competitions?.status || '-'}
                        </p>

                        <p className="text-sm text-gray-700">
                          Coregraf: {performance.choreographer_name || '-'}
                        </p>

                        <p className="text-sm text-gray-700">
                          {performance.categories?.dance_style || '-'} |{' '}
                          {performance.categories?.age_group || '-'} |{' '}
                          {performance.categories?.level || '-'} |{' '}
                          {formatFormationType(formationType)}
                        </p>

                        <p className="text-sm text-gray-700">
                          Participanti: {performance.declared_participants_count || '-'}
                        </p>

                        <p className="text-sm text-gray-700">
                          {isFormation
                            ? `Grup: ${performance.group_name || '-'}`
                            : `Dansatori: ${performance.participant_names || '-'}`
                          }
                        </p>

                        <p className="text-sm text-gray-700">
                          Tip start: {formatStartType(performance.start_type)}
                        </p>

                        <p className="text-sm text-gray-700">
                          Durata: {formatDuration(performance.duration_seconds)}
                        </p>

                        <p className="text-sm text-gray-700">
                          Muzica: {performance.music_file_name || 'Nu exista'}
                        </p>

                        <p className="text-sm text-gray-700">
                          Grupa taxa: {getFeeGroupLabel(performance.fee_group)}
                        </p>

                        <p className="text-sm text-gray-700">
                          Taxa / participant: {formatMoney(performance.fee_per_participant, performance.fee_currency)}
                        </p>

                        <p className="text-sm font-semibold text-gray-900">
                          Total taxa: {formatMoney(performance.total_fee, performance.fee_currency)}
                        </p>

                        <p className="text-sm text-gray-500">
                          Status: {performance.status || '-'} | Admin: {performance.admin_status || '-'}
                        </p>

                        {isFinished && (
                          <p className="text-sm font-semibold text-yellow-700">
                            Concursul este finalizat. Editarea si stergerea sunt blocate.
                          </p>
                        )}

                        {isJudged && (
                          <p className="text-sm font-semibold text-red-600">
                            Acest moment este deja jurizat. Editarea si stergerea sunt blocate.
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(performance.id)}
                          disabled={isJudged || isFinished}
                          className="rounded-lg border border-red-300 px-4 py-2 text-red-600 disabled:opacity-50"
                        >
                          Sterge
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}