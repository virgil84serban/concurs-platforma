'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Judge = {
  id: string
  user_id: string
  competition_id: string
}

type Performance = {
  id: string
  title: string
  competition_id: string
  clubs?: { name: string } | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  } | null
}

type Criterion = {
  id: string
  name: string
  competition_id: string
}

type ExistingScore = {
  performance_id: string
  criterion_id: string
  value: number
}

function getRegistrationId(id: string) {
  return id.slice(0, 8).toUpperCase()
}

export default function ScoresPage() {
  const [judges, setJudges] = useState<Judge[]>([])
  const [performances, setPerformances] = useState<Performance[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [scores, setScores] = useState<ExistingScore[]>([])

  const [selectedJudge, setSelectedJudge] = useState('')
  const [message, setMessage] = useState('')
  const [scoreValues, setScoreValues] = useState<Record<string, string>>({})

  async function loadJudges() {
    const { data } = await supabase.from('judges').select('*')
    setJudges(data || [])
  }

  async function loadPerformances() {
    const { data } = await supabase
      .from('performances')
      .select(`
        id, title, competition_id,
        clubs(name),
        categories(formation_type, dance_style, age_group, level)
      `)

    setPerformances(data || [])
  }

  async function loadCriteria(judgeId: string) {
    const judge = judges.find(j => j.id === judgeId)
    if (!judge) return

    const { data } = await supabase
      .from('score_criteria')
      .select('id, name')
      .eq('competition_id', judge.competition_id)

    setCriteria(data || [])
  }

  async function loadScores(judgeId: string) {
    const { data } = await supabase
      .from('scores')
      .select('performance_id, criterion_id, value')
      .eq('judge_id', judgeId)

    const rows = data || []
    setScores(rows)

    const initial: Record<string, string> = {}
    rows.forEach(r => {
      initial[`${r.performance_id}__${r.criterion_id}`] = String(r.value)
    })

    setScoreValues(initial)
  }

  useEffect(() => {
    loadJudges()
    loadPerformances()
  }, [])

  useEffect(() => {
    if (selectedJudge) {
      loadCriteria(selectedJudge)
      loadScores(selectedJudge)
    }
  }, [selectedJudge])

  const judge = useMemo(
    () => judges.find(j => j.id === selectedJudge),
    [judges, selectedJudge]
  )

  const filteredPerformances = useMemo(() => {
    if (!judge) return []
    return performances.filter(p => p.competition_id === judge.competition_id)
  }, [performances, judge])

  function getCriteriaForPerformance(performance: Performance) {
    const type = performance.categories?.formation_type?.toLowerCase()

    if (type === 'solo') {
      return criteria.filter(c => !c.name.toLowerCase().includes('sincron'))
    }

    return criteria
  }

  function key(p: string, c: string) {
    return `${p}__${c}`
  }

  function isRowSaved(performance: Performance) {
    const rowCriteria = getCriteriaForPerformance(performance)

    return rowCriteria.every(c =>
      scores.some(
        s =>
          s.performance_id === performance.id &&
          s.criterion_id === c.id
      )
    )
  }

  function isRowStarted(performance: Performance) {
    const rowCriteria = getCriteriaForPerformance(performance)

    return rowCriteria.some(c => scoreValues[key(performance.id, c.id)])
  }

  function getActiveRow() {
    return filteredPerformances.find(p => isRowStarted(p) && !isRowSaved(p))
  }

  function handleChange(pId: string, cId: string, value: string) {
    setScoreValues(prev => ({
      ...prev,
      [key(pId, cId)]: value,
    }))
  }

  async function saveRow(performance: Performance) {
    const rowCriteria = getCriteriaForPerformance(performance)

    for (const c of rowCriteria) {
      if (!scoreValues[key(performance.id, c.id)]) {
        setMessage('Completeaza toate notele')
        return
      }
    }

    const rows = rowCriteria.map(c => ({
      judge_id: selectedJudge,
      performance_id: performance.id,
      criterion_id: c.id,
      value: Number(scoreValues[key(performance.id, c.id)]),
    }))

    await supabase.from('scores').insert(rows)

    setMessage('Salvat ✔')
    loadScores(selectedJudge)
  }

  const activeRow = getActiveRow()

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">

        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Fisa de jurizare</h1>

          <select
            value={selectedJudge}
            onChange={e => setSelectedJudge(e.target.value)}
            className="w-full rounded-lg border p-3"
          >
            <option value="">Selecteaza jurat</option>
            {judges.map(j => (
              <option key={j.id} value={j.id}>{j.user_id}</option>
            ))}
          </select>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          {!judge ? (
            <p>Selecteaza un jurat.</p>
          ) : (
            <div className="overflow-x-auto">

              <table className="min-w-full border-separate border-spacing-y-2">

  <thead className="sticky top-0 z-10 bg-gray-100 shadow-sm">
    <tr className="text-left text-sm text-gray-600">
      <th className="px-3 py-3">Nr</th>
      <th className="px-3 py-3">ID</th>
      <th className="px-3 py-3">Moment</th>
      <th className="px-3 py-3">Club</th>
      {criteria.map(c => (
        <th key={c.id} className="px-3 py-3 whitespace-nowrap">
          {c.name}
        </th>
      ))}
      <th className="px-3 py-3">Actiune</th>
    </tr>
  </thead>

  <tbody>
    {filteredPerformances.map((p, i) => {
      const rowCriteria = getCriteriaForPerformance(p)
      const saved = isRowSaved(p)
      const active = activeRow?.id === p.id

      const locked =
        saved ||
        (activeRow && !active)

      return (
        <tr
          key={p.id}
          className={`
            transition-all duration-200
            ${active ? 'bg-blue-50 ring-2 ring-blue-300 scale-[1.01]' : 'bg-white'}
            ${saved ? 'opacity-80' : ''}
            hover:shadow-md
          `}
        >
          <td className="px-3 py-4 text-sm font-medium">
            {i + 1}
          </td>

          <td className="px-3 py-4 text-sm font-semibold text-gray-700">
            {getRegistrationId(p.id)}
          </td>

          <td className="px-3 py-4 text-sm font-semibold">
            {p.title}
          </td>

          <td className="px-3 py-4 text-sm text-gray-600">
            {p.clubs?.name || '-'}
          </td>

          {criteria.map(c => {
            const visible = rowCriteria.some(rc => rc.id === c.id)

            if (!visible) {
              return (
                <td key={c.id} className="px-3 py-4 text-gray-300 text-center">
                  —
                </td>
              )
            }

            const k = key(p.id, c.id)

            return (
              <td key={c.id} className="px-3 py-4">
                <select
                  disabled={locked}
                  value={scoreValues[k] || ''}
                  onChange={e => handleChange(p.id, c.id, e.target.value)}
                  className={`
                    w-20 rounded-lg border px-2 py-1 text-sm transition
                    ${locked
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-white hover:border-black focus:border-black'
                    }
                  `}
                >
                  <option value="">-</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </td>
            )
          })}

          <td className="px-3 py-4">
            {!saved ? (
              <button
                disabled={locked}
                onClick={() => saveRow(p)}
                className={`
                  rounded-lg px-3 py-1 text-sm font-medium transition
                  ${locked
                    ? 'bg-gray-300 text-gray-500'
                    : 'bg-black text-white hover:bg-gray-800'
                  }
                `}
              >
                Salveaza
              </button>
            ) : (
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700 font-medium">
                ✔ Salvat
              </span>
            )}
          </td>
        </tr>
      )
    })}
  </tbody>

</table>

            </div>
          )}
        </div>

      </div>
    </main>
  )
}