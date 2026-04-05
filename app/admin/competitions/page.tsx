'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
  location: string | null
  created_at: string
}

export default function CompetitionsPage() {
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [message, setMessage] = useState('')
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function loadCompetitions() {
    setLoading(true)

    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Eroare la incarcare: ' + error.message)
      setLoading(false)
      return
    }

    setCompetitions(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadCompetitions()
  }, [])

  function resetForm() {
    setEditingId(null)
    setTitle('')
    setLocation('')
  }

  function startEdit(competition: Competition) {
    setEditingId(competition.id)
    setTitle(competition.title || '')
    setLocation(competition.location || '')
    setMessage('Editezi concursul selectat')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('Se salveaza...')

    if (editingId) {
      const { error } = await supabase
        .from('competitions')
        .update({
          title,
          location: location || null,
        })
        .eq('id', editingId)

      if (error) {
        setMessage('Eroare: ' + error.message)
        return
      }

      setMessage('Concurs actualizat cu succes')
    } else {
      const { error } = await supabase.from('competitions').insert([
        {
          title,
          location: location || null,
        },
      ])

      if (error) {
        setMessage('Eroare: ' + error.message)
        return
      }

      setMessage('Concurs salvat cu succes')
    }

    resetForm()
    loadCompetitions()
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">
              {editingId ? 'Editeaza concurs' : 'Concursuri'}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Nume concurs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="text"
              placeholder="Locatie"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-lg border p-3"
            />

            <button className="rounded-lg bg-black px-4 py-3 text-white">
              {editingId ? 'Actualizeaza concurs' : 'Salveaza'}
            </button>
          </form>

          {message && <p className="mt-4 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista concursuri</h2>

          {loading ? (
            <p>Se incarca...</p>
          ) : competitions.length === 0 ? (
            <p>Nu exista concursuri inca.</p>
          ) : (
            <div className="space-y-3">
              {competitions.map((competition) => (
                <div
                  key={competition.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-semibold">{competition.title}</p>
                    <p className="text-sm text-gray-600">
                      {competition.location || 'Fara locatie'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(competition)}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    Editeaza
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}