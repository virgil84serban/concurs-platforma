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
  }[]
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[]
}

function formatFormationType(value: string | null) {
  if (!value) return '-'

  switch (value) {
    case 'solo': return 'Solo'
    case 'duo': return 'Duo'
    case 'trio': return 'Trio'
    case 'quartet': return 'Quartet'
    case 'group': return 'Group'
    case 'formation': return 'Formation'
    default: return value
  }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function RunningOrderPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [performances, setPerformances] = useState<Performance[]>([])
  const [loading, setLoading] = useState(false)

  async function loadCompetitions() {
    const { data } = await supabase
      .from('competitions')
      .select('id, title')
      .order('created_at', { ascending: false })

    setCompetitions((data as Competition[]) || [])
  }

  async function loadPerformances(competitionId: string) {
    setLoading(true)

    const { data } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        competition_id,
        running_order,
        duration_seconds,
        choreographer_name,
        clubs ( name ),
        categories (
          formation_type,
          dance_style,
          age_group,
          level
        )
      `)
      .eq('competition_id', competitionId)
      .order('running_order', { ascending: true })

    setPerformances((data as unknown as Performance[]) || [])
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
    return competitions.find(c => c.id === selectedCompetition)?.title || ''
  }, [competitions, selectedCompetition])

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* HEADER */}
        <div className="bg-white p-5 rounded-xl shadow">
          <h1 className="text-2xl md:text-3xl font-bold mb-4">
            Running Order
          </h1>

          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="w-full rounded-xl border p-3 text-sm md:text-base"
          >
            <option value="">Selecteaza concurs</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>

          {selectedCompetitionTitle && (
            <h2 className="mt-4 text-xl font-semibold text-gray-700">
              {selectedCompetitionTitle}
            </h2>
          )}
        </div>

        {/* LOADING */}
        {loading && (
          <div className="bg-white p-6 rounded-xl shadow text-center">
            Se incarca...
          </div>
        )}

        {/* LISTA */}
        <div className="space-y-3">

          {performances.map(p => {
            const club = p.clubs?.[0]
            const cat = p.categories?.[0]

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow p-4 flex gap-4 items-center"
              >
                {/* NUMAR */}
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-lg">
                  {p.running_order ?? '-'}
                </div>

                {/* INFO */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base md:text-lg truncate">
                    {p.title || '-'}
                  </div>

                  <div className="text-sm text-gray-600 mt-1">
                    {club?.name || '-'}
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    {cat?.dance_style || '-'} • {cat?.age_group || '-'} • {cat?.level || '-'} • {formatFormationType(cat?.formation_type || null)}
                  </div>
                </div>

                {/* EXTRA */}
                <div className="text-right text-xs text-gray-500">
                  <div>{formatDuration(p.duration_seconds)}</div>
                </div>
              </div>
            )
          })}

          {!loading && performances.length === 0 && (
            <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
              Nu exista momente
            </div>
          )}
        </div>
      </div>
    </main>
  )
}