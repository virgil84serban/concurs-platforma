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

type CreatedJudge = {
  index: number
  email: string
  password: string
  user_id: string
}

type AssignedJudge = {
  id: string
  user_id: string
  competition_id: string
  profiles: {
    id: string
    full_name: string | null
    email: string | null
    role: string | null
  }[] | null
}

export default function AdminJudgesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [pageMessage, setPageMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)

  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')

  const [generating, setGenerating] = useState(false)
  const [createdJudges, setCreatedJudges] = useState<CreatedJudge[]>([])
  const [skippedJudges, setSkippedJudges] = useState<string[]>([])
  const [assignedJudges, setAssignedJudges] = useState<AssignedJudge[]>([])

  const [deletingJudgeId, setDeletingJudgeId] = useState<string | null>(null)
  const [movingJudgeId, setMovingJudgeId] = useState<string | null>(null)
  const [moveTargetCompetitionId, setMoveTargetCompetitionId] = useState('')

  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({})
  const [updatingPasswordId, setUpdatingPasswordId] = useState<string | null>(null)

  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([])
  const [bulkMoving, setBulkMoving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

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

  async function loadAssignedJudges(competitionId: string) {
    if (!competitionId) {
      setAssignedJudges([])
      return
    }

    const { data, error } = await supabase
      .from('judges')
      .select(`
        id,
        user_id,
        competition_id,
        profiles (
          id,
          full_name,
          email,
          role
        )
      `)
      .eq('competition_id', competitionId)
      .order('id', { ascending: true })

    if (error) {
      setPageMessage('Eroare la incarcarea juratilor: ' + error.message)
      setAssignedJudges([])
      return
    }

    const judges = ((data as unknown as AssignedJudge[]) || []).sort((a, b) => {
      const emailA = a.profiles?.[0]?.email || ''
      const emailB = b.profiles?.[0]?.email || ''
      return emailA.localeCompare(emailB, 'ro')
    })

    setAssignedJudges(judges)
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
      setAssignedJudges([])
      setSelectedJudgeIds([])
      return
    }

    setSelectedJudgeIds([])
    setSearchTerm('')
    loadAssignedJudges(selectedCompetitionId)
  }, [selectedCompetitionId])

  const availableMoveCompetitions = useMemo(() => {
    return competitions.filter((competition) => competition.id !== selectedCompetitionId)
  }, [competitions, selectedCompetitionId])

  const filteredAssignedJudges = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) {
      return assignedJudges
    }

    return assignedJudges.filter((judge) => {
      const fullName = (judge.profiles?.[0]?.full_name || '').toLowerCase()
      const email = (judge.profiles?.[0]?.email || '').toLowerCase()
      const userId = (judge.user_id || '').toLowerCase()

      return (
        fullName.includes(term) ||
        email.includes(term) ||
        userId.includes(term)
      )
    })
  }, [assignedJudges, searchTerm])

  const allVisibleJudgeIds = useMemo(() => {
    return filteredAssignedJudges.map((judge) => judge.id)
  }, [filteredAssignedJudges])

  const areAllVisibleSelected =
    allVisibleJudgeIds.length > 0 &&
    allVisibleJudgeIds.every((id) => selectedJudgeIds.includes(id))

  function generatePassword() {
    return 'Jurat' + Math.floor(1000 + Math.random() * 9000) + '!'
  }

  function toggleJudgeSelection(judgeId: string) {
    setSelectedJudgeIds((prev) =>
      prev.includes(judgeId)
        ? prev.filter((id) => id !== judgeId)
        : [...prev, judgeId]
    )
  }

  function toggleSelectAllVisible() {
    if (areAllVisibleSelected) {
      setSelectedJudgeIds((prev) =>
        prev.filter((id) => !allVisibleJudgeIds.includes(id))
      )
      return
    }

    setSelectedJudgeIds((prev) => {
      const next = new Set(prev)
      allVisibleJudgeIds.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }

  async function handleGenerateJudges() {
    setPageMessage('')
    setCreatedJudges([])
    setSkippedJudges([])

    if (!selectedCompetitionId) {
      setPageMessage('Selecteaza un concurs.')
      return
    }

    const confirmGenerate = window.confirm(
      'Vrei sa generezi automat juratii pentru concursul selectat?'
    )

    if (!confirmGenerate) {
      return
    }

    try {
      setGenerating(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/generate-judges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          competitionId: selectedCompetitionId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setPageMessage(
          result?.error || result?.details || 'A aparut o eroare la generarea juratilor.'
        )
        return
      }

      setCreatedJudges((result?.created as CreatedJudge[]) || [])
      setSkippedJudges((result?.skipped as string[]) || [])

      if ((result?.created?.length || 0) > 0) {
        setPageMessage('Juratii au fost generati cu succes.')
      } else {
        setPageMessage('Nu au fost creati jurati noi. Juratii existenti au fost pastrati.')
      }

      await loadAssignedJudges(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setGenerating(false)
    }
  }

  async function handleDeleteJudge(judge: AssignedJudge) {
    setPageMessage('')

    if (!selectedCompetitionId) {
      setPageMessage('Selecteaza un concurs.')
      return
    }

    const label = judge.profiles?.[0].full_name || judge.profiles?.email || `user ${judge.user_id}`

    const confirmDelete = window.confirm(
      `Sigur vrei sa stergi juratul ${label} din concursul selectat?`
    )

    if (!confirmDelete) {
      return
    }

    try {
      setDeletingJudgeId(judge.id)

      const { error } = await supabase.from('judges').delete().eq('id', judge.id)

      if (error) {
        setPageMessage('Eroare la stergerea juratului: ' + error.message)
        return
      }

      setPageMessage('Juratul a fost sters din concurs.')

      setPasswordInputs((prev) => {
        const next = { ...prev }
        delete next[judge.user_id]
        return next
      })

      setSelectedJudgeIds((prev) => prev.filter((id) => id !== judge.id))

      await loadAssignedJudges(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setDeletingJudgeId(null)
    }
  }

  async function handleMoveJudge(judge: AssignedJudge) {
    setPageMessage('')

    if (!selectedCompetitionId) {
      setPageMessage('Selecteaza un concurs.')
      return
    }

    if (!moveTargetCompetitionId) {
      setPageMessage('Selecteaza concursul destinatie.')
      return
    }

    if (moveTargetCompetitionId === selectedCompetitionId) {
      setPageMessage('Juratul este deja asociat acestui concurs.')
      return
    }

    const targetCompetition = competitions.find(
      (competition) => competition.id === moveTargetCompetitionId
    )

    const label = judge.profiles?.[0]?.full_name || judge.profiles?.[0]?.email || `user ${judge.user_id}`

    const confirmMove = window.confirm(
      `Sigur vrei sa muti juratul ${label} in concursul "${targetCompetition?.title || '-'}"?`
    )

    if (!confirmMove) {
      return
    }

    try {
      setMovingJudgeId(judge.id)

      const { data: existingAssignment, error: existingAssignmentError } = await supabase
        .from('judges')
        .select('id')
        .eq('user_id', judge.user_id)
        .eq('competition_id', moveTargetCompetitionId)
        .maybeSingle()

      if (existingAssignmentError) {
        setPageMessage(
          'Eroare la verificarea asignarii existente: ' + existingAssignmentError.message
        )
        return
      }

      if (existingAssignment) {
        setPageMessage('Acest jurat este deja asociat concursului selectat ca destinatie.')
        return
      }

      const { error } = await supabase
        .from('judges')
        .update({
          competition_id: moveTargetCompetitionId,
        })
        .eq('id', judge.id)

      if (error) {
        setPageMessage('Eroare la mutarea juratului: ' + error.message)
        return
      }

      setPageMessage('Juratul a fost mutat cu succes.')
      setMoveTargetCompetitionId('')
      setSelectedJudgeIds((prev) => prev.filter((id) => id !== judge.id))
      await loadAssignedJudges(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setMovingJudgeId(null)
    }
  }

  async function handleBulkMoveJudges() {
    setPageMessage('')

    if (!selectedCompetitionId) {
      setPageMessage('Selecteaza un concurs.')
      return
    }

    if (!moveTargetCompetitionId) {
      setPageMessage('Selecteaza concursul destinatie.')
      return
    }

    if (moveTargetCompetitionId === selectedCompetitionId) {
      setPageMessage('Concursul destinatie trebuie sa fie diferit.')
      return
    }

    if (selectedJudgeIds.length === 0) {
      setPageMessage('Selecteaza cel putin un jurat.')
      return
    }

    const selectedJudges = assignedJudges.filter((judge) =>
      selectedJudgeIds.includes(judge.id)
    )

    const targetCompetition = competitions.find(
      (competition) => competition.id === moveTargetCompetitionId
    )

    const confirmMove = window.confirm(
      `Sigur vrei sa muti ${selectedJudges.length} jurati in concursul "${targetCompetition?.title || '-'}"?`
    )

    if (!confirmMove) {
      return
    }

    try {
      setBulkMoving(true)

      const userIds = selectedJudges.map((judge) => judge.user_id)

      const { data: existingAssignments, error: existingAssignmentsError } = await supabase
        .from('judges')
        .select('id, user_id')
        .eq('competition_id', moveTargetCompetitionId)
        .in('user_id', userIds)

      if (existingAssignmentsError) {
        setPageMessage(
          'Eroare la verificarea asignarilor existente: ' + existingAssignmentsError.message
        )
        return
      }

      const existingUserIds = new Set(
        ((existingAssignments as Array<{ id: string; user_id: string }>) || []).map(
          (item) => item.user_id
        )
      )

      const judgesToMove = selectedJudges.filter(
        (judge) => !existingUserIds.has(judge.user_id)
      )

      if (judgesToMove.length === 0) {
        setPageMessage('Niciun jurat selectat nu poate fi mutat. Toti exista deja in concursul destinatie.')
        return
      }

      const idsToMove = judgesToMove.map((judge) => judge.id)

      const { error: updateError } = await supabase
        .from('judges')
        .update({
          competition_id: moveTargetCompetitionId,
        })
        .in('id', idsToMove)

      if (updateError) {
        setPageMessage('Eroare la mutarea juratilor: ' + updateError.message)
        return
      }

      const skippedCount = selectedJudges.length - judgesToMove.length

      if (skippedCount > 0) {
        setPageMessage(
          `${judgesToMove.length} jurati au fost mutati. ${skippedCount} au fost sariti deoarece existau deja in concursul destinatie.`
        )
      } else {
        setPageMessage(`${judgesToMove.length} jurati au fost mutati cu succes.`)
      }

      setSelectedJudgeIds([])
      setMoveTargetCompetitionId('')
      await loadAssignedJudges(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setBulkMoving(false)
    }
  }

  async function handleBulkDeleteJudges() {
    setPageMessage('')

    if (!selectedCompetitionId) {
      setPageMessage('Selecteaza un concurs.')
      return
    }

    if (selectedJudgeIds.length === 0) {
      setPageMessage('Selecteaza cel putin un jurat.')
      return
    }

    const selectedJudges = assignedJudges.filter((judge) =>
      selectedJudgeIds.includes(judge.id)
    )

    const confirmDelete = window.confirm(
      `Sigur vrei sa stergi ${selectedJudges.length} jurati din acest concurs?`
    )

    if (!confirmDelete) {
      return
    }

    try {
      setBulkMoving(true)

      const idsToDelete = selectedJudges.map((judge) => judge.id)

      const { error } = await supabase
        .from('judges')
        .delete()
        .in('id', idsToDelete)

      if (error) {
        setPageMessage('Eroare la stergerea juratilor: ' + error.message)
        return
      }

      setPageMessage(`${idsToDelete.length} jurati au fost stersi.`)

      setSelectedJudgeIds([])
      await loadAssignedJudges(selectedCompetitionId)
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setBulkMoving(false)
    }
  }

  async function handleUpdatePassword(judge: AssignedJudge) {
    setPageMessage('')

    const password = (passwordInputs[judge.user_id] || '').trim()

    if (!password) {
      setPageMessage('Introdu o parola noua pentru acest jurat.')
      return
    }

    try {
      setUpdatingPasswordId(judge.id)

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/update-judge-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: judge.user_id,
          password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setPageMessage(result?.error || result?.details || 'Eroare la schimbarea parolei.')
        return
      }

      setPageMessage(
        `Parola a fost actualizata pentru ${judge.profiles?.email || judge.user_id}.`
      )

      setPasswordInputs((prev) => ({
        ...prev,
        [judge.user_id]: '',
      }))
    } catch (error) {
      setPageMessage(
        error instanceof Error ? error.message : 'A aparut o eroare necunoscuta.'
      )
    } finally {
      setUpdatingPasswordId(null)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-7xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca pagina juratilor...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="text-2xl font-bold md:text-3xl">Administrare jurati</h1>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
          <p className="mt-1 text-sm text-gray-600 md:text-base">
            User ID: {profile?.id || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Generare automata jurati</h2>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => {
                  setSelectedCompetitionId(e.target.value)
                  setMoveTargetCompetitionId('')
                  setPageMessage('')
                }}
                className="w-full rounded-lg border p-3 text-sm md:text-base"
              >
                <option value="">Selecteaza un concurs</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateJudges}
              disabled={generating || !selectedCompetitionId}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {generating ? 'Se genereaza...' : 'Genereaza jurati'}
            </button>
          </div>

          {pageMessage && <p className="mt-4 text-sm text-gray-700">{pageMessage}</p>}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Jurati creati acum</h2>

          {createdJudges.length === 0 ? (
            <p className="text-sm text-gray-600">Nu exista jurati creati in aceasta sesiune.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">#</th>
                    <th className="p-3 text-sm font-semibold">Email</th>
                    <th className="p-3 text-sm font-semibold">Parola</th>
                    <th className="p-3 text-sm font-semibold">User ID</th>
                  </tr>
                </thead>
                <tbody>
                  {createdJudges.map((judge) => (
                    <tr key={judge.user_id} className="border-b">
                      <td className="p-3 text-sm">{judge.index}</td>
                      <td className="p-3 text-sm">{judge.email}</td>
                      <td className="p-3 text-sm">{judge.password}</td>
                      <td className="p-3 text-sm">{judge.user_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {skippedJudges.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-lg font-semibold">Jurati existenti deja</h3>
              <div className="flex flex-wrap gap-2">
                {skippedJudges.map((email) => (
                  <span
                    key={email}
                    className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="mb-4 flex flex-col gap-4">
            <div>
              <h2 className="text-xl font-bold md:text-2xl">
                Jurati asociati concursului selectat
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Poti selecta mai multi jurati, ii poti cauta live si ii poti muta sau sterge rapid.
              </p>
            </div>

            {selectedCompetitionId && assignedJudges.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Cauta jurat
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cauta dupa nume, email sau user id"
                    className="w-full rounded-lg border p-3 text-sm md:text-base"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Concurs destinatie pentru mutare multipla
                  </label>
                  <select
                    value={moveTargetCompetitionId}
                    onChange={(e) => setMoveTargetCompetitionId(e.target.value)}
                    className="w-full rounded-lg border p-3 text-sm md:text-base"
                  >
                    <option value="">Selecteaza concursul destinatie</option>
                    {availableMoveCompetitions.map((competition) => (
                      <option key={competition.id} value={competition.id}>
                        {competition.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {selectedCompetitionId && assignedJudges.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={areAllVisibleSelected}
                    onChange={toggleSelectAllVisible}
                  />
                  <span>Selecteaza tot ce este filtrat</span>
                </label>

                <span>Selectati: {selectedJudgeIds.length}</span>
                <span>Afisati dupa search: {filteredAssignedJudges.length}</span>
                <span>Total jurati concurs: {assignedJudges.length}</span>

                <button
                  type="button"
                  onClick={handleBulkMoveJudges}
                  disabled={
                    bulkMoving ||
                    selectedJudgeIds.length === 0 ||
                    !moveTargetCompetitionId
                  }
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  {bulkMoving
                    ? 'Se muta juratii...'
                    : `Muta juratii selectati (${selectedJudgeIds.length})`}
                </button>

                <button
                  type="button"
                  onClick={handleBulkDeleteJudges}
                  disabled={bulkMoving || selectedJudgeIds.length === 0}
                  className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50"
                >
                  Sterge juratii selectati ({selectedJudgeIds.length})
                </button>
              </div>
            )}
          </div>

          {!selectedCompetitionId ? (
            <p className="text-sm text-gray-600">Selecteaza un concurs.</p>
          ) : filteredAssignedJudges.length === 0 ? (
            <p className="text-sm text-gray-600">
              {searchTerm.trim()
                ? 'Nu exista jurati care corespund cautarii.'
                : 'Nu exista jurati asociati acestui concurs.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Select</th>
                    <th className="p-3 text-sm font-semibold">Nume</th>
                    <th className="p-3 text-sm font-semibold">Email</th>
                    <th className="p-3 text-sm font-semibold">Rol</th>
                    <th className="p-3 text-sm font-semibold">User ID</th>
                    <th className="p-3 text-sm font-semibold">Parola noua</th>
                    <th className="p-3 text-sm font-semibold">Actiuni</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssignedJudges.map((judge) => {
                    const isDeleting = deletingJudgeId === judge.id
                    const isMoving = movingJudgeId === judge.id
                    const isUpdatingPassword = updatingPasswordId === judge.id
                    const isSelected = selectedJudgeIds.includes(judge.id)

                    return (
                      <tr key={judge.id} className="border-b align-top">
                        <td className="p-3 text-sm">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleJudgeSelection(judge.id)}
                            disabled={isDeleting || isMoving || bulkMoving}
                          />
                        </td>
                        <td className="p-3 text-sm">{judge.profiles?.full_name || '-'}</td>
                        <td className="p-3 text-sm">{judge.profiles?.email || '-'}</td>
                        <td className="p-3 text-sm">{judge.profiles?.role || '-'}</td>
                        <td className="p-3 text-sm">{judge.user_id}</td>
                        <td className="p-3 text-sm">
                          <div className="flex min-w-[220px] flex-col gap-2 md:flex-row">
                            <input
                              type="text"
                              value={passwordInputs[judge.user_id] || ''}
                              onChange={(e) =>
                                setPasswordInputs((prev) => ({
                                  ...prev,
                                  [judge.user_id]: e.target.value,
                                }))
                              }
                              placeholder="Introdu parola noua"
                              className="w-full rounded-lg border p-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setPasswordInputs((prev) => ({
                                  ...prev,
                                  [judge.user_id]: generatePassword(),
                                }))
                              }
                              disabled={isDeleting || isMoving || isUpdatingPassword}
                              className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-800 disabled:opacity-50"
                            >
                              Genereaza
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdatePassword(judge)}
                              disabled={isUpdatingPassword || isDeleting || isMoving}
                              className="rounded-lg bg-green-600 px-3 py-2 text-white disabled:opacity-50"
                            >
                              {isUpdatingPassword ? 'Se salveaza...' : 'Schimba parola'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveJudge(judge)}
                              disabled={
                                isMoving ||
                                isDeleting ||
                                isUpdatingPassword ||
                                !moveTargetCompetitionId ||
                                bulkMoving
                              }
                              className="rounded-lg bg-blue-600 px-3 py-2 text-white disabled:opacity-50"
                            >
                              {isMoving ? 'Se muta...' : 'Muta'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteJudge(judge)}
                              disabled={isDeleting || isMoving || isUpdatingPassword || bulkMoving}
                              className="rounded-lg bg-red-600 px-3 py-2 text-white disabled:opacity-50"
                            >
                              {isDeleting ? 'Se sterge...' : 'Sterge'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}