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
  status: string
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  competition_id: string | null
  status: string | null
  admin_status: string | null
  participant_names: string | null
  group_name: string | null
  choreographer_name: string | null
  declared_participants_count: number | null
  start_type: string | null
  duration_seconds: number | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  } | null
  clubs?: {
    name: string | null
  } | null
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
  const danceStyle = performance.categories?.[0]?.dance_style || '-'
  const ageGroup = performance.categories?.[0]?.age_group || '-'
  const level = performance.categories?.[0]?.level || '-'
  const formationType = formatFormationType(performance.categories?.[0]?.formation_type || null)

  return `${danceStyle} | ${ageGroup} | ${level} | ${formationType}`
}

function buildParticipantLabel(performance: Performance) {
  return performance.group_name || performance.participant_names || '-'
}

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [performances, setPerformances] = useState<Performance[]>([])
  const [orderInputs, setOrderInputs] = useState<Record<string, string>>({})

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editChoreographerName, setEditChoreographerName] = useState('')
  const [editParticipantLabel, setEditParticipantLabel] = useState('')
  const [editDeclaredParticipantsCount, setEditDeclaredParticipantsCount] = useState('')
  const [editStartType, setEditStartType] = useState('')
  const [editDurationSeconds, setEditDurationSeconds] = useState('')

  const selectedCompetition =
    competitions.find((competition) => competition.id === selectedCompetitionId) || null

  const isFinished = selectedCompetition?.status === 'finished'

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

  async function loadPerformances(competitionId: string) {
    if (!competitionId) {
      setPerformances([])
      setOrderInputs({})
      return
    }

    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        competition_id,
        status,
        admin_status,
        participant_names,
        group_name,
        choreographer_name,
        declared_participants_count,
        start_type,
        duration_seconds,
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
      .eq('competition_id', competitionId)
      .order('running_order', { ascending: true, nullsFirst: false })

    if (error) {
      setMessage('Eroare la momente: ' + error.message)
      setPerformances([])
      setOrderInputs({})
      return
    }

    const rows = (data as unknown as Performance[]) || []
    setPerformances(rows)

    const nextInputs: Record<string, string> = {}
    rows.forEach((item) => {
      nextInputs[item.id] = item.running_order ? String(item.running_order) : ''
    })
    setOrderInputs(nextInputs)
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
    loadPerformances(selectedCompetitionId)
  }, [selectedCompetitionId])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 3500)

    return () => clearTimeout(timer)
  }, [message])

  const sortedPerformances = useMemo(() => {
    return [...performances].sort((a, b) => {
      const aOrder = a.running_order ?? 999999
      const bOrder = b.running_order ?? 999999
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.title.localeCompare(b.title, 'ro')
    })
  }, [performances])

  function updateOrderInput(performanceId: string, value: string) {
    setOrderInputs((prev) => ({
      ...prev,
      [performanceId]: value,
    }))
  }

  function startEdit(performance: Performance) {
    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti edita momente.')
      return
    }

    setEditingId(performance.id)
    setEditTitle(performance.title || '')
    setEditChoreographerName(performance.choreographer_name || '')
    setEditParticipantLabel(buildParticipantLabel(performance))
    setEditDeclaredParticipantsCount(
      performance.declared_participants_count
        ? String(performance.declared_participants_count)
        : ''
    )
    setEditStartType(performance.start_type || '')
    setEditDurationSeconds(
      performance.duration_seconds ? String(performance.duration_seconds) : ''
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditChoreographerName('')
    setEditParticipantLabel('')
    setEditDeclaredParticipantsCount('')
    setEditStartType('')
    setEditDurationSeconds('')
  }

  async function saveEditedPerformance() {
    if (!editingId) return

    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti edita momente.')
      return
    }

    if (!editTitle.trim()) {
      setMessage('Titlul momentului este obligatoriu.')
      return
    }

    if (!editChoreographerName.trim()) {
      setMessage('Coregraful este obligatoriu.')
      return
    }

    if (!editParticipantLabel.trim()) {
      setMessage('Participanti / Grup este obligatoriu.')
      return
    }

    const declaredParticipantsCount = Number(editDeclaredParticipantsCount)
    const durationSeconds = Number(editDurationSeconds)

    if (!declaredParticipantsCount || declaredParticipantsCount < 1) {
      setMessage('Nr participanti invalid.')
      return
    }

    if (!durationSeconds || durationSeconds < 1) {
      setMessage('Durata invalida.')
      return
    }

    if (!editStartType) {
      setMessage('Tipul de start este obligatoriu.')
      return
    }

    const current = performances.find((item) => item.id === editingId)
    if (!current) {
      setMessage('Momentul nu a fost gasit.')
      return
    }

    const isIndividual =
      current.categories?.formation_type === 'solo' ||
      current.categories?.formation_type === 'duo' ||
      current.categories?.formation_type === 'trio' ||
      current.categories?.formation_type === 'quartet'

    setSaving(true)
    setMessage('')

    const payload = {
      title: editTitle.trim(),
      choreographer_name: editChoreographerName.trim(),
      declared_participants_count: declaredParticipantsCount,
      participant_names: isIndividual ? editParticipantLabel.trim() : null,
      group_name: isIndividual ? null : editParticipantLabel.trim(),
      start_type: editStartType,
      duration_seconds: durationSeconds,
    }

    const { error } = await supabase
      .from('performances')
      .update(payload)
      .eq('id', editingId)

    if (error) {
      setMessage('Eroare la editare: ' + error.message)
      setSaving(false)
      return
    }

    setMessage('Moment actualizat.')
    cancelEdit()
    await loadPerformances(selectedCompetitionId)
    setSaving(false)
  }

  async function deletePerformance(performanceId: string) {
    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti sterge momente.')
      return
    }

    const performance = performances.find((item) => item.id === performanceId)
    if (!performance) return

    const confirmDelete = window.confirm(
      `Sigur vrei sa stergi momentul ${performance.title}?`
    )

    if (!confirmDelete) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('performances')
      .delete()
      .eq('id', performanceId)

    if (error) {
      setMessage('Eroare la stergere: ' + error.message)
      setSaving(false)
      return
    }

    if (editingId === performanceId) {
      cancelEdit()
    }

    setMessage('Moment sters.')
    await loadPerformances(selectedCompetitionId)
    setSaving(false)
  }

  async function saveManualOrder(performanceId: string) {
    if (!selectedCompetitionId) return

    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti modifica running order.')
      return
    }

    const rawValue = orderInputs[performanceId]?.trim() || ''
    const nextOrder = Number(rawValue)

    if (!rawValue || !Number.isInteger(nextOrder) || nextOrder < 1) {
      setMessage('Ordinea trebuie sa fie un numar intreg mai mare decat 0.')
      return
    }

    const currentPerformance = performances.find((item) => item.id === performanceId)
    if (!currentPerformance) {
      setMessage('Momentul nu a fost gasit.')
      return
    }

    const currentOrder = currentPerformance.running_order ?? null
    const conflictingPerformance = performances.find(
      (item) => item.id !== performanceId && item.running_order === nextOrder
    )

    setSaving(true)
    setMessage('')

    if (currentOrder === nextOrder) {
      setMessage('Ordinea este deja salvata.')
      setSaving(false)
      return
    }

    if (conflictingPerformance) {
      const { error: swapError1 } = await supabase
        .from('performances')
        .update({ running_order: -1 })
        .eq('id', conflictingPerformance.id)

      if (swapError1) {
        setMessage('Eroare la swap: ' + swapError1.message)
        setSaving(false)
        return
      }

      const { error: updateCurrentError } = await supabase
        .from('performances')
        .update({ running_order: nextOrder })
        .eq('id', performanceId)

      if (updateCurrentError) {
        setMessage('Eroare la salvare: ' + updateCurrentError.message)
        setSaving(false)
        return
      }

      const { error: updateConflictingError } = await supabase
        .from('performances')
        .update({ running_order: currentOrder })
        .eq('id', conflictingPerformance.id)

      if (updateConflictingError) {
        setMessage('Eroare la swap final: ' + updateConflictingError.message)
        setSaving(false)
        return
      }

      setMessage(`Ordinea a fost schimbata intre ${currentOrder ?? '-'} si ${nextOrder}.`)
    } else {
      const { error } = await supabase
        .from('performances')
        .update({ running_order: nextOrder })
        .eq('id', performanceId)

      if (error) {
        setMessage('Eroare la salvare: ' + error.message)
        setSaving(false)
        return
      }

      setMessage(`Ordinea a fost salvata: ${nextOrder}.`)
    }

    await loadPerformances(selectedCompetitionId)
    setSaving(false)
  }

  async function movePerformance(performanceId: string, direction: 'up' | 'down') {
    if (!selectedCompetitionId) return

    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti modifica running order.')
      return
    }

    const currentIndex = sortedPerformances.findIndex((item) => item.id === performanceId)
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= sortedPerformances.length) return

    const currentItem = sortedPerformances[currentIndex]
    const targetItem = sortedPerformances[targetIndex]

    const currentOrder = currentItem.running_order
    const targetOrder = targetItem.running_order

    if (currentOrder == null || targetOrder == null) {
      setMessage('Momentul nu are running order valid.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error: step1Error } = await supabase
      .from('performances')
      .update({ running_order: -1 })
      .eq('id', targetItem.id)

    if (step1Error) {
      setMessage('Eroare la mutare: ' + step1Error.message)
      setSaving(false)
      return
    }

    const { error: step2Error } = await supabase
      .from('performances')
      .update({ running_order: targetOrder })
      .eq('id', currentItem.id)

    if (step2Error) {
      setMessage('Eroare la mutare: ' + step2Error.message)
      setSaving(false)
      return
    }

    const { error: step3Error } = await supabase
      .from('performances')
      .update({ running_order: currentOrder })
      .eq('id', targetItem.id)

    if (step3Error) {
      setMessage('Eroare la mutare: ' + step3Error.message)
      setSaving(false)
      return
    }

    setMessage('Ordinea a fost actualizata.')
    await loadPerformances(selectedCompetitionId)
    setSaving(false)
  }

  async function normalizeRunningOrder() {
    if (!selectedCompetitionId) return
    if (sortedPerformances.length === 0) {
      setMessage('Nu exista momente de renumerotat.')
      return
    }

    if (isFinished) {
      setMessage('Concursul este finalizat. Nu mai poti modifica running order.')
      return
    }

    const confirmNormalize = window.confirm(
      'Vrei sa renumerotezi toate momentele 1, 2, 3, 4 in ordinea actuala?'
    )

    if (!confirmNormalize) return

    setSaving(true)
    setMessage('')

    for (let i = 0; i < sortedPerformances.length; i++) {
      const performance = sortedPerformances[i]
      const nextOrder = i + 1

      const { error } = await supabase
        .from('performances')
        .update({ running_order: nextOrder })
        .eq('id', performance.id)

      if (error) {
        setMessage('Eroare la renumerotare: ' + error.message)
        setSaving(false)
        return
      }
    }

    setMessage('Ordinea a fost renumerotata.')
    await loadPerformances(selectedCompetitionId)
    setSaving(false)
  }

  async function updateCompetitionStatus(nextStatus: 'open' | 'finished') {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    const confirmText =
      nextStatus === 'finished'
        ? 'Sigur vrei sa finalizezi concursul? Dupa asta se blocheaza jurizarea, importul si editarile.'
        : 'Sigur vrei sa redeschizi concursul?'

    const confirmed = window.confirm(confirmText)
    if (!confirmed) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('competitions')
      .update({ status: nextStatus })
      .eq('id', selectedCompetitionId)

    if (error) {
      setMessage('Eroare la actualizarea statusului concursului: ' + error.message)
      setSaving(false)
      return
    }

    await loadCompetitions()
    setMessage(
      nextStatus === 'finished'
        ? 'Concursul a fost finalizat.'
        : 'Concursul a fost redeschis.'
    )
    setSaving(false)
  }

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
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Administrare momente</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        {editingId && (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold md:text-2xl">Editeaza moment</h2>
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Renunta
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Titlu moment</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Coregraf</label>
                <input
                  type="text"
                  value={editChoreographerName}
                  onChange={(e) => setEditChoreographerName(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Participanti / Grup</label>
                <input
                  type="text"
                  value={editParticipantLabel}
                  onChange={(e) => setEditParticipantLabel(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Nr participanti</label>
                <input
                  type="number"
                  min={1}
                  value={editDeclaredParticipantsCount}
                  onChange={(e) => setEditDeclaredParticipantsCount(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Tip start</label>
                <select
                  value={editStartType}
                  onChange={(e) => setEditStartType(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
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
                  value={editDurationSeconds}
                  onChange={(e) => setEditDurationSeconds(e.target.value)}
                  className="w-full rounded-lg border p-3"
                  disabled={isFinished}
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={saveEditedPerformance}
                disabled={saving || isFinished}
                className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
              >
                Salveaza modificarile
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
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

            <button
              type="button"
              onClick={normalizeRunningOrder}
              disabled={saving || !selectedCompetitionId || sortedPerformances.length === 0 || isFinished}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              Renumeroteaza 1..N
            </button>

            {selectedCompetition && (
              <button
                type="button"
                onClick={() =>
                  updateCompetitionStatus(isFinished ? 'open' : 'finished')
                }
                disabled={saving}
                className={`rounded-lg px-5 py-3 text-white disabled:opacity-50 ${
                  isFinished ? 'bg-blue-600' : 'bg-red-600'
                }`}
              >
                {isFinished ? 'Redeschide concursul' : 'Finalizeaza concursul'}
              </button>
            )}
          </div>

          {selectedCompetition && (
            <p className="mt-4 text-sm text-gray-700">
              Status concurs:{' '}
              <span className={isFinished ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
                {isFinished ? 'Finalizat' : 'Deschis'}
              </span>
            </p>
          )}

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>

        {!selectedCompetitionId ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p>Selecteaza un concurs.</p>
          </div>
        ) : sortedPerformances.length === 0 ? (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p>Nu exista momente pentru acest concurs.</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <h2 className="mb-4 text-xl font-bold md:text-2xl">Momente concurs</h2>

            <div className="overflow-x-auto">
              <table className="min-w-[1600px] border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Order</th>
                    <th className="p-3 text-sm font-semibold">Mutare</th>
                    <th className="p-3 text-sm font-semibold">Actiuni</th>
                    <th className="p-3 text-sm font-semibold">Titlu moment</th>
                    <th className="p-3 text-sm font-semibold">Club</th>
                    <th className="p-3 text-sm font-semibold">Categorie</th>
                    <th className="p-3 text-sm font-semibold">Participanti / Grup</th>
                    <th className="p-3 text-sm font-semibold">Nr participanti</th>
                    <th className="p-3 text-sm font-semibold">Coregraf</th>
                    <th className="p-3 text-sm font-semibold">Tip start</th>
                    <th className="p-3 text-sm font-semibold">Durata</th>
                    <th className="p-3 text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPerformances.map((performance, index) => (
                    <tr key={performance.id} className="border-b align-top">
                      <td className="p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={orderInputs[performance.id] || ''}
                            onChange={(e) => updateOrderInput(performance.id, e.target.value)}
                            className="w-24 rounded-lg border p-2"
                            disabled={isFinished}
                          />
                          <button
                            type="button"
                            onClick={() => saveManualOrder(performance.id)}
                            disabled={saving || isFinished}
                            className="rounded-lg border px-3 py-2 disabled:opacity-50"
                          >
                            Salveaza
                          </button>
                        </div>
                      </td>

                      <td className="p-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => movePerformance(performance.id, 'up')}
                            disabled={saving || index === 0 || isFinished}
                            className="rounded-lg border px-3 py-2 disabled:opacity-50"
                          >
                            Sus
                          </button>
                          <button
                            type="button"
                            onClick={() => movePerformance(performance.id, 'down')}
                            disabled={saving || index === sortedPerformances.length - 1 || isFinished}
                            className="rounded-lg border px-3 py-2 disabled:opacity-50"
                          >
                            Jos
                          </button>
                        </div>
                      </td>

                      <td className="p-3 text-sm">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(performance)}
                            disabled={saving || isFinished}
                            className="rounded-lg border px-3 py-2 disabled:opacity-50"
                          >
                            Editeaza
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePerformance(performance.id)}
                            disabled={saving || isFinished}
                            className="rounded-lg border px-3 py-2 text-red-600 disabled:opacity-50"
                          >
                            Sterge
                          </button>
                        </div>
                      </td>

                      <td className="p-3 text-sm font-medium">{performance.title}</td>
                      <td className="p-3 text-sm">{performance.clubs?.name || '-'}</td>
                      <td className="p-3 text-sm">{buildCategoryLabel(performance)}</td>
                      <td className="p-3 text-sm">{buildParticipantLabel(performance)}</td>
                      <td className="p-3 text-sm">{performance.declared_participants_count || '-'}</td>
                      <td className="p-3 text-sm">{performance.choreographer_name || '-'}</td>
                      <td className="p-3 text-sm">{formatStartType(performance.start_type)}</td>
                      <td className="p-3 text-sm">{formatDuration(performance.duration_seconds)}</td>
                      <td className="p-3 text-sm">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                          {performance.status || '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}