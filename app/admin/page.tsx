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
  status: string
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  competition_id: string | null
  status: string | null
  admin_status: string | null
  participant_names: string | null
  group_name: string | null
  choreographer_name: string | null
  declared_participants_count: number | null
  start_type: string | null
  duration_seconds: number | null
  categories?: {
    formation_type: string | null
    dance_style: string | null
    age_group: string | null
    level: string | null
  }[] | null
  clubs?: {
    name: string | null
  }[] | null
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

function formatStartType(value: string | null) {
  if (!value) return '-'

  switch (value) {
    case 'music': return 'Pe muzica'
    case 'pose': return 'Din poza'
    default: return value
  }
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-'
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function buildCategoryLabel(performance: Performance) {
  const cat = performance.categories?.[0]

  const danceStyle = cat?.dance_style || '-'
  const ageGroup = cat?.age_group || '-'
  const level = cat?.level || '-'
  const formationType = formatFormationType(cat?.formation_type || null)

  return `${danceStyle} | ${ageGroup} | ${level} | ${formationType}`
}

function buildParticipantLabel(performance: Performance) {
  return performance.group_name || performance.participant_names || '-'
}

export default function AdminPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [performances, setPerformances] = useState<Performance[]>([])

  async function loadSessionAndProfile() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login')
      return null
    }

    const user = sessionData.session.user

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role, email')
      .eq('id', user.id)
      .maybeSingle()

    if (!profileData || profileData.role !== 'admin') {
      router.push('/login')
      return null
    }

    setProfile(profileData as Profile)
    return profileData as Profile
  }

  async function loadCompetitions() {
    const { data } = await supabase
      .from('competitions')
      .select('id, title, status')

    setCompetitions((data as Competition[]) || [])

    if (data && data.length > 0) {
      setSelectedCompetitionId(data[0].id)
    }
  }

  async function loadPerformances(competitionId: string) {
    const { data } = await supabase
      .from('performances')
      .select(`
        id,
        title,
        running_order,
        competition_id,
        status,
        admin_status,
        participant_names,
        group_name,
        choreographer_name,
        declared_participants_count,
        start_type,
        duration_seconds,
        clubs ( name ),
        categories (
          formation_type,
          dance_style,
          age_group,
          level
        )
      `)
      .eq('competition_id', competitionId)

    setPerformances((data as unknown as Performance[]) || [])
  }

  useEffect(() => {
    async function init() {
      const p = await loadSessionAndProfile()
      if (!p) return
      await loadCompetitions()
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    if (selectedCompetitionId) {
      loadPerformances(selectedCompetitionId)
    }
  }, [selectedCompetitionId])

  if (loading) return <p className="p-6">Se incarca...</p>

  return (
    <main className="p-6">
      {performances.map((p) => {
        const club = p.clubs?.[0]

        return (
          <div key={p.id}>
            {p.title} | {club?.name || '-'}
          </div>
        )
      })}
    </main>
  )
}