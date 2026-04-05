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

export default function AdminBackupPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

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
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 4000)

    return () => clearTimeout(timer)
  }, [message])

  const selectedCompetition = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetitionId) || null
  }, [competitions, selectedCompetitionId])

  async function handleBackup() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    try {
      setWorking(true)
      setMessage('')

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/competition-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'backup',
          competitionId: selectedCompetitionId,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result?.error || result?.details || 'Eroare la backup.')
        return
      }

      const blob = new Blob([JSON.stringify(result.backup, null, 2)], {
        type: 'application/json',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const safeTitle = (selectedCompetition?.title || 'concurs')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')

      a.href = url
      a.download = `backup_${safeTitle}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setMessage('Backup generat cu succes.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'A aparut o eroare.')
    } finally {
      setWorking(false)
    }
  }

  async function handleRestore() {
    if (!restoreFile) {
      setMessage('Selecteaza fisierul de backup.')
      return
    }

    const confirmed = window.confirm(
      'Restore-ul va crea un concurs nou pe baza fisierului de backup. Continui?'
    )

    if (!confirmed) return

    try {
      setWorking(true)
      setMessage('')

      const text = await restoreFile.text()
      const backup = JSON.parse(text)

      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (!accessToken) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/admin/competition-backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'restore',
          backup,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setMessage(result?.error || result?.details || 'Eroare la restore.')
        return
      }

      await loadCompetitions()
      setMessage(`Restore reusit: ${result.restoredCompetitionTitle}`)
      setRestoreFile(null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Fisier de backup invalid.')
    } finally {
      setWorking(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca backup / restore...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Backup / Restore concurs</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Backup</h2>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
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
                    {competition.title} ({competition.status})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleBackup}
              disabled={working || !selectedCompetitionId}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {working ? 'Se genereaza...' : 'Descarca backup JSON'}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Restore</h2>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="mb-1 block text-sm font-medium">Fisier backup JSON</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border p-3"
              />
            </div>

            <button
              type="button"
              onClick={handleRestore}
              disabled={working || !restoreFile}
              className="rounded-lg bg-green-600 px-5 py-3 text-white disabled:opacity-50"
            >
              {working ? 'Se restaureaza...' : 'Restore concurs nou'}
            </button>
          </div>

          <p className="mt-4 text-sm text-gray-600">
            Restore-ul nu suprascrie concursul vechi. Creeaza un concurs nou.
          </p>
        </div>

        {message && (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <p className="text-sm text-gray-700">{message}</p>
          </div>
        )}
      </div>
    </main>
  )
}