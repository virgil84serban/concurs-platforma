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
      .order('created_at', { ascending: false })

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

    if (error) {
      setMessage('Eroare la running order: ' + error.message)
      setLoading(false)
      return
    }

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
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-3xl font-bold">Running Order</h1>

          <select
            value={selectedCompetition}
            onChange={(e) => setSelectedCompetition(e.target.value)}
            className="w-full rounded-xl border p-4"
          >
            <option value="">Selecteaza concurs</option>
            {competitions.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>

          {selectedCompetitionTitle && (
            <h2 className="mt-6 text-2xl font-bold">{selectedCompetitionTitle}</h2>
          )}
        </div>

        {performances.map(p => {
          const club = p.clubs?.[0]
          const cat = p.categories?.[0]

          return (
            <div key={p.id} className="bg-white p-4 rounded shadow">
              {p.running_order} - {p.title} | {club?.name || '-'} | {cat?.dance_style}
            </div>
          )
        })}
      </div>
    </main>
  )
}