'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Judge = {
  id: string
  user_id: string
  competition_id: string
}

type GeneratedJudge = {
  index: number
  email: string
  password: string
  user_id: string
}

export default function JudgesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [userId, setUserId] = useState('11111111-1111-1111-1111-111111111111')
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [generatedJudges, setGeneratedJudges] = useState<GeneratedJudge[]>([])
  const [loadingGenerate, setLoadingGenerate] = useState(false)

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    setCompetitions(data || [])
  }

  async function loadJudges() {
    const { data, error } = await supabase
      .from('judges')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Eroare la jurati: ' + error.message)
      return
    }

    setJudges(data || [])
  }

  useEffect(() => {
    loadCompetitions()
    loadJudges()
  }, [])

  function resetForm() {
    setEditingId(null)
    setSelectedCompetition('')
    setUserId('11111111-1111-1111-1111-111111111111')
  }

  function startEdit(judge: Judge) {
    setEditingId(judge.id)
    setSelectedCompetition(judge.competition_id || '')
    setUserId(judge.user_id || '')
    setMessage('Editezi juratul selectat')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    if (!userId) {
      setMessage('Introdu user id')
      return
    }

    if (editingId) {
      const { error } = await supabase
        .from('judges')
        .update({
          competition_id: selectedCompetition,
          user_id: userId,
        })
        .eq('id', editingId)

      if (error) {
        setMessage('Eroare: ' + error.message)
        return
      }

      setMessage('Jurat actualizat cu succes')
    } else {
      const { error } = await supabase.from('judges').insert([
        {
          competition_id: selectedCompetition,
          user_id: userId,
        },
      ])

      if (error) {
        setMessage('Eroare: ' + error.message)
        return
      }

      setMessage('Jurat salvat cu succes')
    }

    resetForm()
    loadJudges()
  }

  async function handleDelete(judgeId: string) {
    const confirmDelete = window.confirm('Sigur vrei sa stergi acest jurat?')
    if (!confirmDelete) return

    const { error } = await supabase
      .from('judges')
      .delete()
      .eq('id', judgeId)

    if (error) {
      setMessage('Eroare la stergere: ' + error.message)
      return
    }

    if (editingId === judgeId) {
      resetForm()
    }

    setMessage('Jurat sters cu succes')
    loadJudges()
  }

  async function handleGenerateJudges() {
    if (!selectedCompetition) {
      setMessage('Selecteaza concursul pentru generarea juratilor')
      return
    }

    setLoadingGenerate(true)
    setGeneratedJudges([])
    setMessage('')

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token) {
      setMessage('Nu esti autentificat.')
      setLoadingGenerate(false)
      return
    }

    const response = await fetch('/api/admin/generate-judges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        competitionId: selectedCompetition,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      setMessage(result.error || 'Eroare la generarea juratilor')
      setLoadingGenerate(false)
      return
    }

    setGeneratedJudges(result.created || [])
    setMessage('Juratii au fost generati.')
    loadJudges()
    setLoadingGenerate(false)
  }

  function getCompetitionTitle(competitionId: string) {
    return competitions.find((competition) => competition.id === competitionId)?.title || competitionId
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">
              {editingId ? 'Editeaza jurat' : 'Jurati'}
            </h1>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border px-4 py-2 text-sm"
              >
                Renunta la editare
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza concurs</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.title}
                </option>
              ))}
            </select>

            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-lg border p-3"
              placeholder="User ID jurat"
              required
            />

            <div className="flex flex-col gap-3 sm:flex-row">
              <button className="rounded-lg bg-black px-4 py-3 text-white">
                {editingId ? 'Actualizeaza jurat' : 'Salveaza jurat'}
              </button>

              <button
                type="button"
                onClick={handleGenerateJudges}
                disabled={loadingGenerate}
                className="rounded-lg bg-green-600 px-4 py-3 text-white disabled:opacity-50"
              >
                {loadingGenerate ? 'Se genereaza...' : 'Genereaza 20 jurati'}
              </button>
            </div>
          </form>

          <p className="mt-3 text-sm text-gray-600">
            Pentru MVP poti genera automat juratii Jurat 1 - Jurat 20.
          </p>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        {generatedJudges.length > 0 && (
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-bold">Conturi generate</h2>

            <div className="space-y-3">
              {generatedJudges.map((judge) => (
                <div key={judge.user_id} className="rounded-lg border p-4">
                  <p className="font-semibold">Jurat {judge.index}</p>
                  <p className="text-sm text-gray-600">Email: {judge.email}</p>
                  <p className="text-sm text-gray-600">Parola: {judge.password}</p>
                  <p className="text-sm text-gray-600">User ID: {judge.user_id}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista jurati</h2>

          {judges.length === 0 ? (
            <p>Nu exista jurati.</p>
          ) : (
            <div className="space-y-3">
              {judges.map((judge) => (
                <div
                  key={judge.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">User ID: {judge.user_id}</p>
                    <p className="text-sm text-gray-600">
                      Concurs: {getCompetitionTitle(judge.competition_id)}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(judge)}
                      className="rounded-lg border px-4 py-2 text-sm"
                    >
                      Editeaza
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(judge.id)}
                      className="rounded-lg border px-4 py-2 text-sm text-red-600"
                    >
                      Sterge
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}