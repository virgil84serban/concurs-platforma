'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Performance = {
  id: string
  title: string
  competition_id: string
  running_order: number | null
  duration_seconds: number | null
  choreographer_name: string | null
  clubs?: {
    name: string
  } | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
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

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export default function PublicRunningOrderPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [performances, setPerformances] = useState<Performance[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    setCompetitions((data as Competition[]) || [])
  }

  async function loadPerformances(competitionId: string) {
    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        competition_id,
        running_order,
        duration_seconds,
        choreographer_name,
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
      .eq('status', 'submitted')
      .eq('admin_status', 'approved')
      .order('running_order', { ascending: true, nullsFirst: false })

    if (error) {
      setMessage('Eroare la running order: ' + error.message)
      setLoading(false)
      return
    }

    setPerformances((data as Performance[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    loadCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      loadPerformances(selectedCompetition)
    } else {
      setPerformances([])
    }
  }, [selectedCompetition])

  const selectedCompetitionTitle = useMemo(() => {
    return competitions.find((competition) => competition.id === selectedCompetition)?.title || ''
  }, [competitions, selectedCompetition])

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-3xl font-bold">Running Order</h1>

          <div className="max-w-xl space-y-2">
            <label className="block text-sm font-medium text-gray-600">
              Alege concursul
            </label>

            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-300 bg-white p-4 text-lg font-semibold text-black shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500"
            >
              <option value="">Selecteaza concurs</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.title}
                </option>
              ))}
            </select>
          </div>

          {selectedCompetitionTitle && (
            <h2 className="mt-6 text-2xl font-bold text-gray-900">
              {selectedCompetitionTitle}
            </h2>
          )}

          {message && (
            <p className="mt-4 text-sm text-red-600">{message}</p>
          )}
        </div>

        {!selectedCompetition ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-gray-600">Selecteaza un concurs.</p>
          </div>
        ) : loading ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-gray-600">Se incarca...</p>
          </div>
        ) : performances.length === 0 ? (
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-gray-600">Nu exista momente aprobate pentru acest concurs.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-4 text-sm font-semibold text-gray-600">Ordine</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Moment</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Club</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Categorie</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Durata</th>
                  <th className="p-4 text-sm font-semibold text-gray-600">Coregraf</th>
                </tr>
              </thead>

              <tbody>
                {performances.map((performance) => (
                  <tr key={performance.id} className="border-b last:border-b-0">
                    <td className="p-4 text-sm font-semibold text-gray-900">
                      {performance.running_order ?? '-'}
                    </td>

                    <td className="p-4 text-sm font-medium text-gray-900">
                      {performance.title}
                    </td>

                    <td className="p-4 text-sm text-gray-700">
                      {performance.clubs?.name || '-'}
                    </td>

                    <td className="p-4 text-sm text-gray-700">
                      {performance.categories?.dance_style || '-'} |{' '}
                      {performance.categories?.age_group || '-'} |{' '}
                      {performance.categories?.level || '-'} |{' '}
                      {formatFormationType(performance.categories?.formation_type || null)}
                    </td>

                    <td className="p-4 text-sm text-gray-700">
                      {formatDuration(performance.duration_seconds)}
                    </td>

                    <td className="p-4 text-sm text-gray-700">
                      {performance.choreographer_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}