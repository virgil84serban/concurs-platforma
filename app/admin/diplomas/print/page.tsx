'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
}

type CompetitionRow = Record<string, unknown>

type PerformanceRow = {
  id: string
  title: string
  competition_id: string
  status: string | null
  admin_status: string | null
  running_order: number | null
  participant_names: string | null
  group_name: string | null
  choreographer_name: string | null
  clubs?: Array<{
    name: string | null
  }> | null
  categories?: Array<{
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }> | null
}

type ScoreRow = {
  value: number
  performance_id: string
  criterion_id: string
}

type DiplomaMode = 'print' | 'final'

type RankedRow = {
  performance_id: string
  title: string
  club: string
  discipline: string
  age: string
  level: string
  type: string
  running_order: number | null
  participant_label: string
  total: number
}

type DiplomaRow = {
  performanceId: string
  title: string
  runningOrder: number | null
  participantLabel: string
  club: string
  categoryLabel: string
  scoreText: string
  placeText: string
  competitionTitle: string
  competitionDate: string
  competitionLocation: string
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

function buildParticipantLabel(performance: PerformanceRow) {
  return performance.group_name || performance.participant_names || performance.title || '-'
}

function getCompetitionTitle(row: CompetitionRow | null) {
  if (!row) return '-'
  for (const key of ['title', 'name']) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return '-'
}

function getCompetitionLocation(row: CompetitionRow | null) {
  if (!row) return '-'
  for (const key of ['location', 'venue', 'city']) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return '-'
}

function formatDateValue(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ro-RO')
}

function getCompetitionDate(row: CompetitionRow | null) {
  if (!row) return '-'
  for (const key of ['date', 'event_date', 'competition_date', 'start_date', 'created_at']) {
    const value = row[key]
    if (value) return formatDateValue(value)
  }
  return '-'
}

function getQueryParams() {
  if (typeof window === 'undefined') {
    return {
      competitionId: '',
      mode: 'print' as DiplomaMode,
    }
  }

  const params = new URLSearchParams(window.location.search)

  const modeParam = params.get('mode')
  const mode: DiplomaMode = modeParam === 'final' ? 'final' : 'print'

  return {
    competitionId: params.get('competitionId') || '',
    mode,
  }
}

function OrnamentBorder() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 210 297"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }}
    >
      <rect x="8" y="8" width="194" height="281" rx="6" fill="none" stroke="#8d5a97" strokeWidth="1.8" />
      <rect x="12" y="12" width="186" height="273" rx="5" fill="none" stroke="#e0b24f" strokeWidth="0.9" />
      <path d="M20 30 C30 18, 48 18, 58 30" fill="none" stroke="#e0b24f" strokeWidth="1.2" />
      <path d="M152 30 C162 18, 180 18, 190 30" fill="none" stroke="#e0b24f" strokeWidth="1.2" />
      <path d="M20 267 C30 279, 48 279, 58 267" fill="none" stroke="#e0b24f" strokeWidth="1.2" />
      <path d="M152 267 C162 279, 180 279, 190 267" fill="none" stroke="#e0b24f" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="4" fill="#fff8e8" stroke="#8d5a97" strokeWidth="1.2" />
      <circle cx="192" cy="18" r="4" fill="#fff8e8" stroke="#8d5a97" strokeWidth="1.2" />
      <circle cx="18" cy="279" r="4" fill="#fff8e8" stroke="#8d5a97" strokeWidth="1.2" />
      <circle cx="192" cy="279" r="4" fill="#fff8e8" stroke="#8d5a97" strokeWidth="1.2" />
      <text x="30" y="24" fontSize="6" fill="#e0b24f">✦</text>
      <text x="176" y="24" fontSize="6" fill="#e0b24f">✦</text>
      <text x="30" y="275" fontSize="6" fill="#e0b24f">✦</text>
      <text x="176" y="275" fontSize="6" fill="#e0b24f">✦</text>
    </svg>
  )
}

export default function AdminDiplomasPrintPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competition, setCompetition] = useState<CompetitionRow | null>(null)
  const [competitionId, setCompetitionId] = useState('')
  const [mode, setMode] = useState<DiplomaMode>('print')
  const [performances, setPerformances] = useState<PerformanceRow[]>([])
  const [scores, setScores] = useState<ScoreRow[]>([])

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

  async function loadCompetition(currentCompetitionId: string) {
    if (!currentCompetitionId) {
      setCompetition(null)
      return
    }

    const { data, error } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', currentCompetitionId)
      .maybeSingle()

    if (error) {
      setMessage('Eroare la concurs: ' + error.message)
      return
    }

    setCompetition((data as CompetitionRow) || null)
  }

  useEffect(() => {
    async function init() {
      const params = getQueryParams()
      setCompetitionId(params.competitionId)
      setMode(params.mode)

      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      if (!params.competitionId) {
        setMessage('Lipseste competitionId din URL.')
        setLoading(false)
        return
      }

      await loadCompetition(params.competitionId)

      const { data, error } = await supabase
        .from('performances')
        .select(`
          id,
          title,
          competition_id,
          status,
          admin_status,
          running_order,
          participant_names,
          group_name,
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
        .eq('competition_id', params.competitionId)
        .eq('status', 'submitted')
        .eq('admin_status', 'approved')
        .order('running_order', { ascending: true })

      if (error) {
        setMessage('Eroare la momente: ' + error.message)
        setPerformances([])
        setLoading(false)
        return
      }

      const loadedPerformances = (data as unknown as PerformanceRow[]) || []
      setPerformances(loadedPerformances)

      if (loadedPerformances.length > 0) {
        const { data: scoreData, error: scoreError } = await supabase
          .from('scores')
          .select('value, performance_id, criterion_id')

        if (scoreError) {
          setMessage('Eroare la scoruri: ' + scoreError.message)
          setScores([])
          setLoading(false)
          return
        }

        const allowedPerformanceIds = new Set(loadedPerformances.map((item) => item.id))

        const filteredScores = ((scoreData as ScoreRow[]) || []).filter((score) =>
          allowedPerformanceIds.has(score.performance_id)
        )

        setScores(filteredScores)
      } else {
        setScores([])
      }

      setLoading(false)
    }

    void init()
  }, [router])

  const diplomaRows = useMemo(() => {
    const scoreTotals = new Map<string, number>()

    scores.forEach((score) => {
      const existing = scoreTotals.get(score.performance_id) || 0
      scoreTotals.set(score.performance_id, existing + Number(score.value))
    })

    const rankedRows: RankedRow[] = performances.map((performance) => ({
      performance_id: performance.id,
      title: performance.title,
      club: performance.clubs?.[0]?.name || '-',
      discipline: performance.categories?.[0]?.dance_style || '-',
      age: performance.categories?.[0]?.age_group || '-',
      level: performance.categories?.[0]?.level || '-',
      type: formatFormationType(performance.categories?.[0]?.formation_type || null),
      running_order: performance.running_order ?? null,
      participant_label: buildParticipantLabel(performance),
      total: scoreTotals.get(performance.id) || 0,
    }))

    const groupsMap = new Map<string, RankedRow[]>()

    rankedRows.forEach((row) => {
      const key = `${row.discipline}||${row.age}||${row.level}||${row.type}`
      const existing = groupsMap.get(key) || []
      existing.push(row)
      groupsMap.set(key, existing)
    })

    const top3Map = new Map<string, string>()

    Array.from(groupsMap.values()).forEach((groupRows) => {
      const sorted = [...groupRows].sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        const aOrder = a.running_order ?? 999999
        const bOrder = b.running_order ?? 999999
        return aOrder - bOrder
      })

      sorted.slice(0, 3).forEach((row, index) => {
        top3Map.set(row.performance_id, `Locul ${index + 1}`)
      })
    })

    const competitionTitle = getCompetitionTitle(competition)
    const competitionDate = getCompetitionDate(competition)
    const competitionLocation = getCompetitionLocation(competition)

    return rankedRows
      .sort((a, b) => {
        const aOrder = a.running_order ?? 999999
        const bOrder = b.running_order ?? 999999
        return aOrder - bOrder
      })
      .map((row): DiplomaRow => ({
        performanceId: row.performance_id,
        title: row.title,
        runningOrder: row.running_order,
        participantLabel: row.participant_label,
        club: row.club,
        categoryLabel: `${row.discipline} | ${row.age} | ${row.level} | ${row.type}`,
        scoreText: mode === 'final' ? String(row.total) : '',
        placeText: mode === 'final' ? top3Map.get(row.performance_id) || '' : '',
        competitionTitle,
        competitionDate,
        competitionLocation,
      }))
  }, [competition, mode, performances, scores])

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-200 p-6">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca diplomele...</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        html, body {
          margin: 0;
          padding: 0;
        }

        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        @media print {
          html, body {
            width: 210mm;
            height: auto;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-root,
          #print-root * {
            visibility: visible !important;
          }

          #print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .print-toolbar {
            display: none !important;
          }

          .print-stage {
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
            gap: 0 !important;
          }

          .diploma-page {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            break-after: page !important;
            page-break-after: always !important;
            overflow: hidden !important;
          }

          .diploma-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#f6efe7' }}>
        <div className="print-toolbar sticky top-0 z-20 border-b bg-white shadow-sm">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm text-gray-500">
                Admin: {profile?.email || '-'}
              </p>
              <p className="text-sm text-gray-700">
                Mod: <b>{mode}</b> | Concurs: <b>{competitionId || '-'}</b> | Diplome:{' '}
                <b>{diplomaRows.length}</b>
              </p>
              {message && <p className="mt-1 text-sm text-red-600">{message}</p>}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg bg-black px-4 py-2 text-sm text-white"
              >
                Print / Save as PDF
              </button>
            </div>
          </div>
        </div>

        {diplomaRows.length === 0 ? (
          <div className="mx-auto max-w-5xl p-6">
            <div className="rounded-xl bg-white p-6 shadow">
              <p>Nu exista diplome de generat pentru acest concurs.</p>
            </div>
          </div>
        ) : (
          <div id="print-root" className="print-stage mx-auto flex max-w-7xl flex-col items-center gap-6 p-6">
            {diplomaRows.map((row) => (
              <section
                key={row.performanceId}
                className="diploma-page"
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '210mm',
                  height: '297mm',
                  overflow: 'hidden',
                  background: '#fffaf5',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
                }}
              >
                <OrnamentBorder />

                <div
                  style={{
                    position: 'absolute',
                    inset: '12mm',
                    background: '#fffdf8',
                    borderRadius: '14px',
                    border: '1px solid rgba(141,90,151,0.20)',
                    padding: '10mm',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: '32mm',
                        height: '22mm',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px dashed #e0b24f',
                        borderRadius: '12px',
                        background: '#fff8ef',
                        color: '#8d5a97',
                        fontSize: '10px',
                        fontWeight: 700,
                      }}
                    >
                      LOGO
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Festival de dans
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 700, color: '#7c5b33' }}>
                        editie festiva
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: '#e0b24f', fontSize: '18px' }}>✦</span>
                      <span style={{ fontSize: '11px', letterSpacing: '0.60em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Diploma
                      </span>
                      <span style={{ color: '#e0b24f', fontSize: '18px' }}>✦</span>
                    </div>

                    <h1
                      style={{
                        marginTop: '10px',
                        fontSize: '40px',
                        lineHeight: 1,
                        fontWeight: 800,
                        color: '#4b2e61',
                      }}
                    >
                      Diploma de participare
                    </h1>

                    <p
                      style={{
                        margin: '18px auto 0',
                        maxWidth: '150mm',
                        fontSize: '17px',
                        lineHeight: 1.7,
                        color: '#5f5f5f',
                      }}
                    >
                      Se acorda pentru participarea in cadrul concursului
                    </p>

                    <p
                      style={{
                        margin: '10px auto 0',
                        maxWidth: '155mm',
                        fontSize: '28px',
                        lineHeight: 1.15,
                        fontWeight: 800,
                        color: '#d28a1f',
                      }}
                    >
                      {row.competitionTitle}
                    </p>
                  </div>

                  <div
                    style={{
                      marginTop: '18px',
                      borderRadius: '22px',
                      border: '2px solid #f1d28f',
                      background: '#fff7ec',
                      padding: '16px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '11px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#8d5a97' }}>
                      Participant / Grup
                    </div>
                    <div
                      style={{
                        marginTop: '10px',
                        fontSize: '30px',
                        lineHeight: 1.15,
                        fontWeight: 800,
                        color: '#3d2a52',
                      }}
                    >
                      {row.participantLabel}
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Moment
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '18px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                        {row.title}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Club
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '18px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                        {row.club}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                      Categorie
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '17px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                      {row.categoryLabel}
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Data
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '17px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                        {row.competitionDate}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Locatie
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '17px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                        {row.competitionLocation}
                      </div>
                    </div>

                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Running Order
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '17px', lineHeight: 1.35, fontWeight: 700, color: '#222' }}>
                        #{row.runningOrder ?? '-'}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Scor
                      </div>
                      <div style={{ marginTop: '16px', minHeight: '18mm', borderBottom: '2px solid #8d5a97' }}>
                        <div style={{ fontSize: '26px', lineHeight: 1.1, fontWeight: 800, color: '#3d2a52' }}>
                          {row.scoreText || '\u00A0'}
                        </div>
                      </div>
                    </div>

                    <div style={{ border: '1px solid #edd8ab', borderRadius: '18px', background: '#ffffff', padding: '14px 16px' }}>
                      <div style={{ fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#8d5a97' }}>
                        Loc
                      </div>
                      <div style={{ marginTop: '16px', minHeight: '18mm', borderBottom: '2px solid #8d5a97' }}>
                        <div style={{ fontSize: '26px', lineHeight: 1.1, fontWeight: 800, color: '#3d2a52' }}>
                          {row.placeText || '\u00A0'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', height: '16mm' }}>
                          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderBottom: '2px solid #8d5a97' }} />
                          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', fontSize: '18px', color: '#e0b24f' }}>
                            ✦
                          </div>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: '#6b5b7b' }}>
                          Organizator
                        </div>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', height: '16mm' }}>
                          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderBottom: '2px solid #8d5a97' }} />
                          <div style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', fontSize: '18px', color: '#e0b24f' }}>
                            ✦
                          </div>
                        </div>
                        <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 600, color: '#6b5b7b' }}>
                          Semnatura
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '18px',
                        textAlign: 'center',
                        fontSize: '10px',
                        letterSpacing: '0.35em',
                        textTransform: 'uppercase',
                        color: '#d28a1f',
                      }}
                    >
                      Dance • Joy • Passion • Celebration
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  )
}