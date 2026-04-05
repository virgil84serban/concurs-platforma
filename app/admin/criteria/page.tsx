'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Criterion = {
  id: string
  name: string
  weight: number
  min_score: number
  max_score: number
  sort_order: number
  competition_id: string
}

export default function CriteriaPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [criteria, setCriteria] = useState<Criterion[]>([])

  const [name, setName] = useState('')
  const [weight, setWeight] = useState('1')
  const [minScore, setMinScore] = useState('1')
  const [maxScore, setMaxScore] = useState('10')
  const [sortOrder, setSortOrder] = useState('1')
  const [message, setMessage] = useState('')

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

  async function loadCriteria(competitionId: string) {
    const { data, error } = await supabase
      .from('score_criteria')
      .select('*')
      .eq('competition_id', competitionId)
      .order('sort_order', { ascending: true })

    if (error) {
      setMessage('Eroare la criterii: ' + error.message)
      return
    }

    setCriteria(data || [])
  }

  useEffect(() => {
    loadCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      loadCriteria(selectedCompetition)
    } else {
      setCriteria([])
    }
  }, [selectedCompetition])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    const { error } = await supabase.from('score_criteria').insert([
      {
        competition_id: selectedCompetition,
        name,
        weight: Number(weight),
        min_score: Number(minScore),
        max_score: Number(maxScore),
        sort_order: Number(sortOrder),
      },
    ])

    if (error) {
      setMessage('Eroare: ' + error.message)
      return
    }

    setMessage('Criteriu salvat cu succes')
    setName('')
    setWeight('1')
    setMinScore('1')
    setMaxScore('10')
    setSortOrder('1')
    loadCriteria(selectedCompetition)
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Criterii jurizare</h1>

          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="mb-4 w-full rounded-lg border p-3"
          >
            <option value="">Selecteaza concurs</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.title}
              </option>
            ))}
          </select>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Nume criteriu"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="number"
              step="0.1"
              placeholder="Pondere"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="number"
              step="0.1"
              placeholder="Scor minim"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="number"
              step="0.1"
              placeholder="Scor maxim"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="number"
              placeholder="Ordine afisare"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <button className="rounded-lg bg-black px-4 py-3 text-white">
              Salveaza criteriu
            </button>
          </form>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista criterii</h2>

          {criteria.length === 0 ? (
            <p>Nu exista criterii.</p>
          ) : (
            <div className="space-y-3">
              {criteria.map((criterion) => (
                <div key={criterion.id} className="rounded-lg border p-4">
                  <p className="font-semibold">{criterion.name}</p>
                  <p className="text-sm text-gray-600">
                    Pondere: {criterion.weight} | Min: {criterion.min_score} | Max: {criterion.max_score} | Ordine: {criterion.sort_order}
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