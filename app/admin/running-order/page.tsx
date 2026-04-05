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
  running_order: number | null
  status: string | null
  admin_status: string | null
  clubs?: {
    name: string
  }[] | null
  categories?: {
    dance_style: string | null
    age_group: string | null
    formation_type: string | null
    level: string | null
  }[] | null
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

export default function AdminRunningOrderPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [performances, setPerformances] = useState<Performance[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

    const { data, error } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        status,
        admin_status,
        clubs (
          name
        ),
        categories (
          dance_style,
          age_group,
          formation_type,
          level
        )
      `)
      .eq('competition_id', competitionId)
      .eq('status', 'submitted')
      .eq('admin_status', 'approved')
      .order('running_order', { ascending: true, nullsFirst: false })

    if (error) {
      setMessage('Eroare la momente: ' + error.message)
      setLoading(false)
      return
    }

    setPerformances((data as unknown as Performance[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      void loadPerformances(selectedCompetition)
    } else {
      setPerformances([])
    }
  }, [selectedCompetition])

  async function generateAutomaticOrder() {
    if (!selectedCompetition) {
      setMessage('Selecteaza concursul')
      return
    }

    if (performances.length === 0) {
      setMessage('Nu exista momente aprobate pentru acest concurs')
      return
    }

    const sorted = [...performances].sort((a, b) => {
      const disciplineCompare = (a.categories?.[0]?.dance_style || '').localeCompare(
        b.categories?.[0]?.dance_style || '',
        'ro'
      )
      if (disciplineCompare !== 0) return disciplineCompare

      const ageCompare = (a.categories?.[0]?.age_group || '').localeCompare(
        b.categories?.[0]?.age_group || '',
        'ro'
      )
      if (ageCompare !== 0) return ageCompare

      const levelCompare = (a.categories?.[0]?.level || '').localeCompare(
        b.categories?.[0]?.level || '',
        'ro'
      )
      if (levelCompare !== 0) return levelCompare

      const formationCompare = (a.categories?.[0]?.formation_type || '').localeCompare(
        b.categories?.[0]?.formation_type || '',
        'ro'
      )
      if (formationCompare !== 0) return formationCompare

      return (a.title || '').localeCompare(b.title || '', 'ro')
    })

    for (let i = 0; i < sorted.length; i++) {
      const performance = sorted[i]

      const { error } = await supabase
        .from('performances')
        .update({ running_order: i + 1 })
        .eq('id', performance.id)

      if (error) {
        setMessage('Eroare la generare ordine: ' + error.message)
        return
      }
    }

    setMessage('Running Order generat automat')
    void loadPerformances(selectedCompetition)
  }

  async function updateRunningOrder(performanceId: string, value: string) {
    const numericValue = value ? Number(value) : null

    const { error } = await supabase
      .from('performances')
      .update({ running_order: numericValue })
      .eq('id', performanceId)

    if (error) {
      setMessage('Eroare la salvarea ordinii: ' + error.message)
      return
    }

    setMessage('Ordinea a fost actualizata')
    void loadPerformances(selectedCompetition)
  }

  const sortedRows = useMemo(() => {
    return [...performances].sort((a, b) => {
      const aOrder = a.running_order ?? 999999
      const bOrder = b.running_order ?? 999999
      return aOrder - bOrder
    })
  }, [performances])

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Running Order automat</h1>

          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className="w-full rounded-lg border p-3"
            >
              <option value="">Selecteaza concursul</option>
              {competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.title}
                </option>
              ))}
            </select>

            <button
              onClick={generateAutomaticOrder}
              className="rounded-lg bg-black px-5 py-3 text-white"
            >
              Genereaza automat
            </button>
          </div>

          {message && (
            <p className="mt-4 text-sm text-gray-700">{message}</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Momente aprobate</h2>

          {!selectedCompetition ? (
            <p>Selecteaza un concurs.</p>
          ) : loading ? (
            <p>Se incarca...</p>
          ) : sortedRows.length === 0 ? (
            <p>Nu exista momente aprobate.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Ordine</th>
                    <th className="p-3 text-sm font-semibold">Moment</th>
                    <th className="p-3 text-sm font-semibold">Club</th>
                    <th className="p-3 text-sm font-semibold">Disciplina</th>
                    <th className="p-3 text-sm font-semibold">Varsta</th>
                    <th className="p-3 text-sm font-semibold">Categorie</th>
                    <th className="p-3 text-sm font-semibold">Nivel</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedRows.map((performance) => (
                    <tr key={performance.id} className="border-b">
                      <td className="p-3 text-sm">
                        <input
                          type="number"
                          defaultValue={performance.running_order || ''}
                          onBlur={(e) => updateRunningOrder(performance.id, e.target.value)}
                          className="w-24 rounded-lg border p-2"
                        />
                      </td>
                      <td className="p-3 text-sm font-medium">
                        {performance.title}
                      </td>
                      <td className="p-3 text-sm">
                        {performance.clubs?.[0]?.name || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {performance.categories?.[0]?.dance_style || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {performance.categories?.[0]?.age_group || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {formatFormationType(performance.categories?.[0]?.formation_type || null)}
                      </td>
                      <td className="p-3 text-sm">
                        {performance.categories?.[0]?.level || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}