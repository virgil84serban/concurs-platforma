'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Category = {
  id: string
  name: string
  formation_type: string | null
  dance_style: string | null
  age_group: string | null
  level: string | null
  competition_id: string
}

type Performance = {
  id: string
  title: string
  choreographer_name: string | null
  duration_seconds: number | null
  status: string
  category_id: string
  competition_id: string
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  } | null
  performance_contestants?: {
    id: string
  }[] | null
}

const durationOptions = [
  { label: '1:30', value: 90 },
  { label: '2:00', value: 120 },
  { label: '2:30', value: 150 },
  { label: '3:00', value: 180 },
  { label: '3:30', value: 210 },
  { label: '4:00', value: 240 },
  { label: '4:30', value: 270 },
  { label: '5:00', value: 300 },
]

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0')

  return `${minutes}:${paddedSeconds}`
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

function getValidationStatus(
  formationType: string | null,
  participantCount: number
) {
  const rule = getParticipantRule(formationType)

  if (rule.max !== null) {
    return participantCount >= rule.min && participantCount <= rule.max
  }

  return participantCount >= rule.min
}

export default function PerformancesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])

  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [title, setTitle] = useState('')
  const [choreographerName, setChoreographerName] = useState('')
  const [durationSeconds, setDurationSeconds] = useState('')
  const [message, setMessage] = useState('')

  async function loadCompetitions() {
    const { data } = await supabase
      .from('competitions')
      .select('id, title')
      .order('created_at', { ascending: false })

    setCompetitions(data || [])
  }

  async function loadCategories(competitionId: string) {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('competition_id', competitionId)

    setCategories(data || [])
  }

  async function loadPerformances() {
    const { data } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        choreographer_name,
        duration_seconds,
        status,
        category_id,
        competition_id,
        categories (
          formation_type,
          dance_style,
          age_group,
          level
        ),
        performance_contestants (
          id
        )
      `)
      .order('created_at', { ascending: false })

    setPerformances((data as Performance[]) || [])
  }

  useEffect(() => {
    loadCompetitions()
    loadPerformances()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      loadCategories(selectedCompetition)
      setSelectedCategory('')
    } else {
      setCategories([])
      setSelectedCategory('')
    }
  }, [selectedCompetition])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    if (!selectedCategory) {
      setMessage('Selecteaza categoria')
      return
    }

    if (!durationSeconds) {
      setMessage('Selecteaza durata')
      return
    }

    const { error } = await supabase.from('performances').insert([
      {
        competition_id: selectedCompetition,
        category_id: selectedCategory,
        title,
        choreographer_name: choreographerName || null,
        duration_seconds: Number(durationSeconds),
        status: 'pending',
      },
    ])

    if (error) {
      setMessage('Eroare: ' + error.message)
      return
    }

    setMessage('Moment salvat cu succes')
    setTitle('')
    setChoreographerName('')
    setDurationSeconds('')
    setSelectedCategory('')
    loadPerformances()
  }

  const performanceCards = useMemo(() => {
    return performances.map((performance) => {
      const formationType = performance.categories?.formation_type || null
      const participantCount = performance.performance_contestants?.length || 0
      const rule = getParticipantRule(formationType)
      const isValid = getValidationStatus(formationType, participantCount)

      return {
        ...performance,
        participantCount,
        ruleLabel: rule.label,
        isValid,
      }
    })
  }, [performances])

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Momente</h1>

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

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza categorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.formation_type} | {category.dance_style} | {category.age_group} | {category.level}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Titlu moment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="text"
              placeholder="Nume coregraf"
              value={choreographerName}
              onChange={(e) => setChoreographerName(e.target.value)}
              className="w-full rounded-lg border p-3"
            />

            <select
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza durata</option>
              {durationOptions.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button className="rounded-lg bg-black px-4 py-3 text-white">
              Salveaza moment
            </button>
          </form>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista momente</h2>

          {performanceCards.length === 0 ? (
            <p>Nu exista momente.</p>
          ) : (
            <div className="space-y-3">
              {performanceCards.map((performance) => (
                <div key={performance.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold">{performance.title}</p>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        performance.isValid
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {performance.isValid ? 'Valid' : 'Invalid'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">
                    Coregraf: {performance.choreographer_name || '-'}
                  </p>

                  <p className="text-sm text-gray-600">
                    Durata: {formatDuration(performance.duration_seconds)}
                  </p>

                  <p className="text-sm text-gray-600">
                    Categorie: {performance.categories?.formation_type || '-'} |{' '}
                    {performance.categories?.dance_style || '-'} |{' '}
                    {performance.categories?.age_group || '-'} |{' '}
                    {performance.categories?.level || '-'}
                  </p>

                  <p className="text-sm text-gray-600">
                    Participanti: {performance.participantCount}
                  </p>

                  <p className="text-sm text-gray-600">
                    Regula: {performance.ruleLabel}
                  </p>

                  <p className="text-sm text-gray-600">
                    Status sistem: {performance.isValid ? 'Pregatit' : 'Incomplet'}
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