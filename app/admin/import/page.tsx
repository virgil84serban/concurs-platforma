'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
}

type Competition = {
  id: string
  title: string
}

type ParsedRow = {
  club: string
  disciplina: string
  varsta: string
  sectiune: string
  nivel: string
  dansatori: string
  nrParticipanti: number | string
  coregrafie: string
  coregraf: string
  tipStart: string
  timp: string | number
}

type RawRow = Record<string, unknown>

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function getCell(row: RawRow, possibleHeaders: string[]) {
  const entries = Object.entries(row)

  for (const [key, value] of entries) {
    const normalizedKey = normalizeHeader(key)

    if (possibleHeaders.some((header) => normalizeHeader(header) === normalizedKey)) {
      return value
    }
  }

  return ''
}

function mapRawRow(row: RawRow): ParsedRow {
  return {
    club: String(getCell(row, ['Club'])).trim(),
    disciplina: String(getCell(row, ['Disciplina', 'Disciplină'])).trim(),
    varsta: String(getCell(row, ['Varsta', 'Vârstă'])).trim(),
    sectiune: String(getCell(row, ['Sectiune', 'Secțiune'])).trim(),
    nivel: String(getCell(row, ['Nivel'])).trim(),
    dansatori: String(getCell(row, ['Dansatori'])).trim(),
    nrParticipanti: String(
  getCell(row, ['Nr. participanti', 'Nr participanti', 'Nr.D', 'Nr D']) ?? ''
).trim(),
    coregrafie: String(getCell(row, ['Coregrafie'])).trim(),
    coregraf: String(getCell(row, ['Coregraf'])).trim(),
    tipStart: String(getCell(row, ['Tip Start'])).trim(),
    timp: String(getCell(row, ['Timp'])).trim(),
  }
}

function normalizeFormationType(value: string) {
  const v = value.trim().toLowerCase()

  if (v === 'solo') return 'solo'
  if (v === 'duo') return 'duo'
  if (v === 'trio') return 'trio'
  if (v === 'quartet') return 'quartet'
  if (v === 'group') return 'group'
  if (v === 'formation') return 'formation'
  if (v === 'formatie') return 'formation'
  if (v === 'formație') return 'formation'

  return ''
}

function normalizeStartType(value: string) {
  const v = value.trim().toLowerCase()

  if (v === 'pe muzica' || v === 'pe muzică' || v === 'music') return 'music'
  if (v === 'din poza' || v === 'din poză' || v === 'pose') return 'pose'

  return ''
}

function parseDurationToSeconds(value: string | number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0 && value < 1) {
      return Math.round(value * 24 * 60 * 60)
    }

    return Math.round(value)
  }

  const text = String(value || '').trim()

  if (!text) return 0

  if (/^\d+$/.test(text)) {
    return Number(text)
  }

  const parts = text.split(':').map((item) => item.trim())

  if (parts.length === 2) {
    const minutes = Number(parts[0])
    const seconds = Number(parts[1])

    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds
    }
  }

  if (parts.length === 3) {
    const hours = Number(parts[0])
    const minutes = Number(parts[1])
    const seconds = Number(parts[2])

    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return hours * 3600 + minutes * 60 + seconds
    }
  }

  return 0
}

function buildCategoryName(
  discipline: string,
  ageGroup: string,
  formationType: string,
  level: string
) {
  return `${discipline} | ${ageGroup} | ${formationType} | ${level}`
}

function isIndividualFormation(formationType: string) {
  return ['solo', 'duo', 'trio', 'quartet'].includes(formationType)
}

export default function AdminImportPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  async function downloadTemplate() {
    const XLSX = await import('xlsx')

    const templateData = [
      {
        Club: 'Silver Dance Academy',
        Disciplina: 'Latino(Salsa, Bachata)',
        Varsta: '7-9 ani',
        Sectiune: 'Formation',
        Nivel: 'Advanced',
        Dansatori: 'Silver Stars',
        'Nr. participanti': 11,
        Coregrafie: 'Bailar',
        Coregraf: 'Calomfirescu Timeea',
        'Tip Start': 'Din poza',
        Timp: '04:00',
      },
      {
        Club: 'Dancing Stars Studio',
        Disciplina: 'Dans sportiv(Standard, Latino)',
        Varsta: '10-12 ani',
        Sectiune: 'Group',
        Nivel: 'Beginner',
        Dansatori: 'Dancing Stars Kids',
        'Nr. participanti': 8,
        Coregrafie: 'Latino Mix',
        Coregraf: 'Madalina Stanca',
        'Tip Start': 'Pe muzica',
        Timp: '03:30',
      },
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)

    ws['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 30 },
      { wch: 18 },
      { wch: 25 },
      { wch: 25 },
      { wch: 15 },
      { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFileXLSX(wb, 'template_import_momente.xlsx')
  }

  async function loadSessionAndProfile() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login')
      return null
    }

    const user = sessionData.session.user

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', user.id)
      .single()

    if (error || !profileData) {
      router.push('/login')
      return null
    }

    if (profileData.role !== 'admin') {
      router.push('/login')
      return null
    }

    setProfile(profileData as Profile)
    return profileData as Profile
  }

  async function loadCompetitions() {
    const { data, error } = await supabase
      .from('competitions')
      .select('id, title')
      .order('title', { ascending: true })

    if (error) {
      setMessage('Eroare la concursuri: ' + error.message)
      return
    }

    const rows = (data as Competition[]) || []
    setCompetitions(rows)

    if (rows.length > 0) {
      setSelectedCompetitionId((prev) => prev || rows[0].id)
    }
  }

  useEffect(() => {
    async function init() {
      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      await loadCompetitions()
      setLoading(false)
    }

    init()
  }, [router])

  const canImport = useMemo(() => {
    return !!selectedCompetitionId && !!file && previewRows.length > 0 && !importing
  }, [selectedCompetitionId, file, previewRows.length, importing])

  async function handleReadFile(selectedFile: File | null) {
    setFile(selectedFile)
    setPreviewRows([])
    setImportedCount(0)
    setErrors([])
    setMessage('')

    if (!selectedFile) return

    try {
      const XLSX = await import('xlsx')
      const buffer = await selectedFile.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]

      if (!sheetName) {
        setMessage('Fisierul nu contine niciun sheet.')
        return
      }

      const worksheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
        defval: '',
      })

      if (!rawRows || rawRows.length === 0) {
        setMessage('Fisierul nu contine randuri.')
        return
      }

      const mappedRows = rawRows.map(mapRawRow)

      setPreviewRows(mappedRows)
      setMessage(`Fisier incarcat. Randuri detectate: ${mappedRows.length}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nu am putut citi fisierul.')
    }
  }

  async function getOrCreateClub(clubName: string) {
    const cleanName = clubName.trim()

    const { data: existingClub, error: selectError } = await supabase
      .from('clubs')
      .select('id')
      .eq('name', cleanName)
      .maybeSingle()

    if (selectError) {
      throw new Error('Eroare la club: ' + selectError.message)
    }

    if (existingClub?.id) {
      return existingClub.id
    }

    const { data: insertedClub, error: insertError } = await supabase
      .from('clubs')
      .insert([{ name: cleanName }])
      .select('id')
      .single()

    if (insertError || !insertedClub?.id) {
      throw new Error('Nu am putut crea clubul: ' + cleanName)
    }

    return insertedClub.id
  }

  async function getOrCreateCategory(
    competitionId: string,
    discipline: string,
    ageGroup: string,
    formationType: string,
    level: string
  ) {
    const { data: existingCategory, error: selectError } = await supabase
      .from('categories')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('dance_style', discipline)
      .eq('age_group', ageGroup)
      .eq('formation_type', formationType)
      .eq('level', level)
      .maybeSingle()

    if (selectError) {
      throw new Error('Eroare la categorie: ' + selectError.message)
    }

    if (existingCategory?.id) {
      return existingCategory.id
    }

    const categoryName = buildCategoryName(discipline, ageGroup, formationType, level)

    const { data: insertedCategory, error: insertError } = await supabase
      .from('categories')
      .insert([
        {
          name: categoryName,
          competition_id: competitionId,
          dance_style: discipline,
          age_group: ageGroup,
          formation_type: formationType,
          level,
        },
      ])
      .select('id')
      .single()

    if (insertError || !insertedCategory?.id) {
      throw new Error('Nu am putut crea categoria: ' + categoryName)
    }

    return insertedCategory.id
  }

  async function performanceAlreadyExists(
    competitionId: string,
    clubId: string,
    title: string,
    choreographerName: string
  ) {
    const { data, error } = await supabase
      .from('performances')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('club_id', clubId)
      .eq('title', title)
      .eq('choreographer_name', choreographerName)
      .limit(1)
      .maybeSingle()

    if (error) {
      throw new Error('Eroare la verificarea duplicatelor: ' + error.message)
    }

    return !!data?.id
  }

  async function handleImport() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    if (!file || previewRows.length === 0) {
      setMessage('Incarca mai intai un fisier.')
      return
    }

    const confirmImport = window.confirm(
      `Vrei sa importi ${previewRows.length} momente in concursul selectat?`
    )

    if (!confirmImport) return

    setImporting(true)
    setMessage('')
    setImportedCount(0)
    setErrors([])

    const localErrors: string[] = []

    const { data: runningRows, error: runningError } = await supabase
      .from('performances')
      .select('running_order')
      .eq('competition_id', selectedCompetitionId)
      .not('running_order', 'is', null)
      .order('running_order', { ascending: false })
      .limit(1)

    if (runningError) {
      setMessage('Eroare la citirea running order: ' + runningError.message)
      setImporting(false)
      return
    }

    let nextRunningOrder =
      runningRows && runningRows.length > 0 ? Number(runningRows[0].running_order || 0) + 1 : 1

    let successCount = 0

    for (let index = 0; index < previewRows.length; index++) {
      const row = previewRows[index]

      try {
        const clubName = row.club.trim()
        const discipline = row.disciplina.trim()
        const ageGroup = row.varsta.trim()
        const formationType = normalizeFormationType(row.sectiune)
        const level = row.nivel.trim()
        const dancers = row.dansatori.trim()
        const participantsCount = Number(row.nrParticipanti || 0)
        const choreographyTitle = row.coregrafie.trim()
        const choreographer = row.coregraf.trim()
        const startType = normalizeStartType(row.tipStart)
        const durationSeconds = parseDurationToSeconds(row.timp)

        if (!clubName) throw new Error('Lipseste Club')
        if (!discipline) throw new Error('Lipseste Disciplina')
        if (!ageGroup) throw new Error('Lipseste Varsta')
        if (!formationType) throw new Error('Sectiune invalida')
        if (!level) throw new Error('Lipseste Nivel')
        if (!choreographyTitle) throw new Error('Lipseste Coregrafie')
        if (!choreographer) throw new Error('Lipseste Coregraf')
        if (!startType) throw new Error('Tip Start invalid')
        if (!durationSeconds || durationSeconds < 1) throw new Error('Timp invalid')
        if (!participantsCount || participantsCount < 1) throw new Error('Nr. participanti invalid')
        if (!dancers) throw new Error('Lipseste campul Dansatori')

        const clubId = await getOrCreateClub(clubName)
        const categoryId = await getOrCreateCategory(
          selectedCompetitionId,
          discipline,
          ageGroup,
          formationType,
          level
        )

        const duplicateExists = await performanceAlreadyExists(
          selectedCompetitionId,
          clubId,
          choreographyTitle,
          choreographer
        )

        if (duplicateExists) {
          throw new Error('Moment duplicat - exista deja in acest concurs pentru acelasi club si acelasi coregraf')
        }

        const participantNames = isIndividualFormation(formationType) ? dancers : null
        const groupName = isIndividualFormation(formationType) ? null : dancers

        const { error: insertError } = await supabase.from('performances').insert([
          {
            competition_id: selectedCompetitionId,
            club_id: clubId,
            category_id: categoryId,
            title: choreographyTitle,
            choreographer_name: choreographer,
            declared_participants_count: participantsCount,
            participant_names: participantNames,
            group_name: groupName,
            start_type: startType,
            duration_seconds: durationSeconds,
            music_file_name: null,
            music_file_path: null,
            status: 'submitted',
            admin_status: 'approved',
            running_order: nextRunningOrder,
          },
        ])

        if (insertError) {
          throw new Error(insertError.message)
        }

        nextRunningOrder += 1
        successCount += 1
      } catch (error) {
        localErrors.push(
          `Rand ${index + 2}: ${error instanceof Error ? error.message : 'Eroare necunoscuta'}`
        )
      }
    }

    setImportedCount(successCount)
    setErrors(localErrors)

    if (localErrors.length === 0) {
      setMessage(`Import finalizat. Momente importate: ${successCount}`)
    } else {
      setMessage(
        `Import finalizat partial. Importate: ${successCount}. Erori: ${localErrors.length}`
      )
    }

    setImporting(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca importul...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Import momente</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Concurs</label>
              <select
                value={selectedCompetitionId}
                onChange={(e) => setSelectedCompetitionId(e.target.value)}
                className="w-full rounded-lg border p-3"
              >
                <option value="">Selecteaza concursul</option>
                {competitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Fisier XLSX / CSV</label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleReadFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border p-3"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border bg-gray-50 p-4 text-sm">
            <p className="font-semibold">Coloane acceptate:</p>
            <p className="mt-2">
              Club, Disciplina / Disciplină, Varsta / Vârstă, Sectiune / Secțiune,
              Nivel, Dansatori, Nr. participanti / Nr.D, Coregrafie, Coregraf,
              Tip Start, Timp
            </p>
          </div>

          <div className="mt-4 rounded-lg border bg-yellow-50 p-4 text-sm">
            <p className="font-semibold">Protectie duplicate:</p>
            <p className="mt-2">
              Nu se importa daca exista deja un moment cu acelasi concurs, acelasi club,
              aceeasi coregrafie si acelasi coregraf.
            </p>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="rounded-lg border px-5 py-3 text-sm"
            >
              Descarca template Excel
            </button>

            <button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {importing ? 'Se importa...' : 'Importa momente'}
            </button>
          </div>

          {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        </div>

        {previewRows.length > 0 && (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <h2 className="mb-4 text-xl font-bold md:text-2xl">
              Preview import ({previewRows.length} randuri)
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-[1200px] border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Club</th>
                    <th className="p-3 text-sm font-semibold">Disciplina</th>
                    <th className="p-3 text-sm font-semibold">Varsta</th>
                    <th className="p-3 text-sm font-semibold">Sectiune</th>
                    <th className="p-3 text-sm font-semibold">Nivel</th>
                    <th className="p-3 text-sm font-semibold">Dansatori</th>
                    <th className="p-3 text-sm font-semibold">Nr. participanti</th>
                    <th className="p-3 text-sm font-semibold">Coregrafie</th>
                    <th className="p-3 text-sm font-semibold">Coregraf</th>
                    <th className="p-3 text-sm font-semibold">Tip Start</th>
                    <th className="p-3 text-sm font-semibold">Timp</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-3 text-sm">{row.club}</td>
                      <td className="p-3 text-sm">{row.disciplina}</td>
                      <td className="p-3 text-sm">{row.varsta}</td>
                      <td className="p-3 text-sm">{row.sectiune}</td>
                      <td className="p-3 text-sm">{row.nivel}</td>
                      <td className="p-3 text-sm">{row.dansatori}</td>
                      <td className="p-3 text-sm">{row.nrParticipanti}</td>
                      <td className="p-3 text-sm">{row.coregrafie}</td>
                      <td className="p-3 text-sm">{row.coregraf}</td>
                      <td className="p-3 text-sm">{row.tipStart}</td>
                      <td className="p-3 text-sm">{row.timp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(importedCount > 0 || errors.length > 0) && (
          <div className="rounded-xl bg-white p-5 shadow md:p-6">
            <h2 className="mb-4 text-xl font-bold md:text-2xl">Rezultat import</h2>

            <p className="text-sm text-gray-700">Importate cu succes: {importedCount}</p>

            {errors.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold text-red-600">
                  Randuri cu probleme: {errors.length}
                </p>
                <div className="max-h-80 overflow-auto rounded-lg border bg-red-50 p-3">
                  {errors.map((error, index) => (
                    <p key={index} className="text-sm text-red-700">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}