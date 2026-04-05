'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Club = {
  id: string
  name: string
}

type Contestant = {
  id: string
  full_name: string
  birth_date: string | null
  club_id: string | null
  clubs: { name: string }[] | null
}

export default function ContestantsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [contestants, setContestants] = useState<Contestant[]>([])
  const [selectedClub, setSelectedClub] = useState('')
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [message, setMessage] = useState('')

  async function loadClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name')
      .order('name', { ascending: true })

    if (error) {
      setMessage('Eroare la cluburi: ' + error.message)
      return
    }

    setClubs(data || [])
  }

  async function loadContestants() {
    const { data, error } = await supabase
      .from('contestants')
      .select(`
        id,
        full_name,
        birth_date,
        club_id,
        clubs (
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Eroare la participanti: ' + error.message)
      return
    }

    setContestants((data as Contestant[]) || [])
  }

  useEffect(() => {
    loadClubs()
    loadContestants()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedClub) {
      setMessage('Selecteaza clubul')
      return
    }

    const { error } = await supabase.from('contestants').insert([
      {
        club_id: selectedClub,
        full_name: fullName,
        birth_date: birthDate || null,
      },
    ])

    if (error) {
      setMessage('Eroare: ' + error.message)
      return
    }

    setMessage('Participant salvat cu succes')
    setSelectedClub('')
    setFullName('')
    setBirthDate('')
    loadContestants()
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Participanti</h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            <select
              value={selectedClub}
              onChange={(e) => setSelectedClub(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza club</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Nume complet participant"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-lg border p-3"
            />

            <button className="rounded-lg bg-black px-4 py-3 text-white">
              Salveaza participant
            </button>
          </form>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista participanti</h2>

          {contestants.length === 0 ? (
            <p>Nu exista participanti.</p>
          ) : (
            <div className="space-y-3">
              {contestants.map((contestant) => (
                <div key={contestant.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{contestant.full_name}</p>
                  <p className="text-sm text-gray-600">
                    Club: {contestant.clubs?.name || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Data nasterii: {contestant.birth_date || '-'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}