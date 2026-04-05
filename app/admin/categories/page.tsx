'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Competition = {
  id: string
  title: string
}

type Category = {
  id: string
  name: string
  dance_style: string | null
  age_group: string | null
  level: string | null
  formation_type: string | null
  competition_id: string
}

export default function CategoriesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState('')
  const [categories, setCategories] = useState<Category[]>([])

  const [formationType, setFormationType] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [age, setAge] = useState('')
  const [level, setLevel] = useState('')

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

  useEffect(() => {
    loadCompetitions()
  }, [])

  useEffect(() => {
    if (selectedCompetition) {
      loadCategories(selectedCompetition)
    } else {
      setCategories([])
    }
  }, [selectedCompetition])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedCompetition) {
      setMessage('Selecteaza un concurs')
      return
    }

    if (!formationType) {
      setMessage('Selecteaza categoria')
      return
    }

    if (!discipline) {
      setMessage('Selecteaza disciplina')
      return
    }

    if (!age) {
      setMessage('Selecteaza varsta')
      return
    }

    if (!level) {
      setMessage('Selecteaza nivelul')
      return
    }

    const generatedName = [formationType, discipline, age, level].join(' | ')

    const { error } = await supabase.from('categories').insert([
      {
        competition_id: selectedCompetition,
        name: generatedName,
        dance_style: discipline,
        age_group: age,
        level: level,
        formation_type: formationType,
      },
    ])

    if (error) {
      setMessage('Eroare: ' + error.message)
      return
    }

    setMessage('Categorie salvata')
    setFormationType('')
    setDiscipline('')
    setAge('')
    setLevel('')
    loadCategories(selectedCompetition)
  }

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="mb-4 text-2xl font-bold">Categorii</h1>

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
            <select
              value={formationType}
              onChange={(e) => setFormationType(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza categoria</option>
              <option value="solo">Solo</option>
              <option value="duo">Duo</option>
              <option value="trio">Trio</option>
              <option value="quartet">Quartet</option>
              <option value="group">Group</option>
              <option value="formation">Formation</option>
            </select>

            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza disciplina</option>
              <option value="Musical/Disco/Rock">Musical/Disco/Rock</option>
              <option value="Fantezie Coregrafica">Fantezie Coregrafica</option>
              <option value="Dans Tematic">Dans Tematic</option>
              <option value="Open">Open</option>
              <option value="Skate Dance">Skate Dance - (Dans pe patine cu rotile)</option>
              <option value="Dans sportiv">Dans sportiv (Standard, Latino)</option>
              <option value="Latino">Latino (Salsa, Bachata)</option>
              <option value="Majorete">Majorete</option>
              <option value="Dans Oriental">Dans Oriental</option>
              <option value="Dans Modern">Dans Modern</option>
              <option value="Dans Clasic/Balet">Dans Clasic/Balet</option>
              <option value="Dans Neoclasic">Dans Neoclasic</option>
              <option value="Dans Contemporan">Dans Contemporan</option>
              <option value="Lyrical">Lyrical</option>
              <option value="Jazz/Cabaret">Jazz/Cabaret</option>
              <option value="Folclor National">Folclor National</option>
              <option value="Folclor International">Folclor International</option>
              <option value="Etno Stilizat">Etno Stilizat</option>
              <option value="Dans de Caracter">Dans de Caracter</option>
              <option value="Showdance">Showdance</option>
              <option value="MTV Comercial">MTV Comercial</option>
              <option value="Street Dance">Street Dance</option>
              <option value="K-Pop">K-Pop</option>
              <option value="Gimnastica">Gimnastica (ritmica, aerobica)</option>
              <option value="Acro Dance">Acro Dance</option>
            </select>

            <select
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza varsta</option>
              <option value="4-6 ani">4-6 ani</option>
              <option value="7-9 ani">7-9 ani</option>
              <option value="10-12 ani">10-12 ani</option>
              <option value="13-15 ani">13-15 ani</option>
              <option value="16-18 ani">16-18 ani</option>
              <option value="19+ ani">19+ ani</option>
            </select>

            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            >
              <option value="">Selecteaza nivelul</option>
              <option value="First Steps">First Steps</option>
              <option value="Beginner">Beginner</option>
              <option value="Advanced">Advanced</option>
              <option value="Pro">Pro</option>
            </select>

            <button className="rounded-lg bg-black px-4 py-3 text-white">
              Salveaza categorie
            </button>
          </form>

          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold">Lista categorii</h2>

          {categories.length === 0 ? (
            <p>Nu exista categorii</p>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-lg border p-4">
                  <p className="font-semibold">
                    {category.formation_type || '-'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {category.dance_style || '-'} | {category.age_group || '-'} | {category.level || '-'}
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