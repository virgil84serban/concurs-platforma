'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Club = {
  id: string
  name: string
  city: string | null
  country: string | null
}

export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('')
  const [message, setMessage] = useState('')

  async function loadClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
      return
    }

    setClubs(data || [])
  }

  useEffect(() => {
    loadClubs()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const { error } = await supabase.from('clubs').insert([
      {
        name,
        city: city || null,
        country: country || null,
      },
    ])

    if (error) {
      setMessage(error.message)
      return
    }

    setName('')
    setCity('')
    setCountry('')
    setMessage('Club adaugat')
    loadClubs()
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl space-y-6">

        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold mb-4">Cluburi</h1>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              placeholder="Nume club"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded p-3"
              required
            />

            <input
              placeholder="Oras"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full border rounded p-3"
            />

            <input
              placeholder="Tara"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full border rounded p-3"
            />

            <button className="bg-black text-white px-4 py-2 rounded">
              Adauga club
            </button>
          </form>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Lista cluburi</h2>

          {clubs.length === 0 ? (
            <p>Nu exista cluburi</p>
          ) : (
            <div className="space-y-2">
              {clubs.map((club) => (
                <div key={club.id} className="border p-3 rounded">
                  <p className="font-semibold">{club.name}</p>
                  <p className="text-sm text-gray-600">
                    {club.city || '-'} | {club.country || '-'}
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