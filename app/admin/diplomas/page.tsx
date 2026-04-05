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

type DiplomaMode = 'print' | 'final'

export default function AdminDiplomasPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [mode, setMode] = useState<DiplomaMode>('print')

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

    const rows = (data as Competition[]) || []
    setCompetitions(rows)

    if (rows.length > 0) {
      setSelectedCompetitionId((prev) => prev || rows[0].id)
    }
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

  const selectedCompetition = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetitionId) || null
  }, [competitions, selectedCompetitionId])

  function handleOpenPreview() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    const url = `/admin/diplomas/print?competitionId=${encodeURIComponent(
      selectedCompetitionId
    )}&mode=${encodeURIComponent(mode)}`

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca modulul de diplome...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="text-2xl font-bold md:text-3xl">Diplome automate</h1>
          <p className="mt-2 text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Concurs
              </label>

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

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Mod diploma
              </label>

              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as DiplomaMode)}
                className="w-full rounded-lg border p-3"
              >
                <option value="print">Print - Scor gol / Loc gol</option>
                <option value="final">Final - Scor completat / Loc top 3</option>
              </select>
            </div>
          </div>

          {selectedCompetition && (
            <div className="mt-5 rounded-lg border bg-gray-50 p-4 text-sm text-gray-700">
              <p>
                <b>Concurs:</b> {selectedCompetition.title}
              </p>
              <p className="mt-2">
                <b>Regula:</b>{' '}
                {mode === 'print'
                  ? 'Se afiseaza Scor si Loc goale pentru completare manuala.'
                  : 'Scorul se completeaza automat pentru toti. Locul se completeaza doar pentru top 3. Restul raman goale la Loc.'}
              </p>
            </div>
          )}

          {message && <p className="mt-4 text-sm text-red-600">{message}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleOpenPreview}
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              Deschide diplomele pentru print / PDF
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}