'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
  club_id: string | null
}

type Club = {
  id: string
  name: string | null
  city: string | null
  country: string | null
}

type Performance = {
  id: string
  title: string
  running_order: number | null
  status: string | null
  admin_status: string | null
  created_at: string | null
}

export default function ClubPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [club, setClub] = useState<Club | null>(null)
  const [performances, setPerformances] = useState<Performance[]>([])

  async function loadSessionAndProfile() {
    const { data: sessionData } = await supabase.auth.getSession()

    if (!sessionData.session) {
      router.push('/login')
      return null
    }

    const user = sessionData.session.user

    const { data: profileData, error } = await supabase
      .from('profiles')
      .select('id, role, email, club_id')
      .eq('id', user.id)
      .single()

    if (error || !profileData) {
      router.push('/login')
      return null
    }

    if (profileData.role !== 'club') {
      router.push('/login')
      return null
    }

    setProfile(profileData as Profile)
    return profileData as Profile
  }

  async function loadClub(clubId: string) {
    const { data, error } = await supabase
      .from('clubs')
      .select('id, name, city, country')
      .eq('id', clubId)
      .single()

    if (error) {
      setMessage('Nu am putut citi clubul: ' + error.message)
      return
    }

    setClub((data as Club) || null)
  }

  async function loadPerformances(clubId: string) {
    const { data, error } = await supabase
      .from('performances')
      .select('id, title, running_order, status, admin_status, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Nu am putut citi momentele: ' + error.message)
      return
    }

    setPerformances((data as Performance[]) || [])
  }

  useEffect(() => {
    async function init() {
      const profileData = await loadSessionAndProfile()

      if (!profileData) {
        setLoading(false)
        return
      }

      if (!profileData.club_id) {
        setMessage('Contul de club nu are club asociat.')
        setLoading(false)
        return
      }

      await loadClub(profileData.club_id)
      await loadPerformances(profileData.club_id)

      setLoading(false)
    }

    init()
  }, [router])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 3500)

    return () => clearTimeout(timer)
  }, [message])

  const submittedCount = useMemo(() => {
    return performances.filter((item) => item.status === 'submitted').length
  }, [performances])

  const approvedCount = useMemo(() => {
    return performances.filter((item) => item.admin_status === 'approved').length
  }, [performances])

  const pendingCount = useMemo(() => {
    return performances.filter((item) => item.admin_status !== 'approved').length
  }, [performances])

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-6xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca pagina clubului...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Dashboard club</h1>
          <p className="text-sm text-gray-600 md:text-base">
            Cont logat: {profile?.email || '-'}
          </p>
          <p className="mt-2 text-sm text-gray-700">
            Club: <span className="font-semibold">{club?.name || '-'}</span>
          </p>

          {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Total momente</p>
            <p className="mt-2 text-3xl font-bold">{performances.length}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Trimise</p>
            <p className="mt-2 text-3xl font-bold">{submittedCount}</p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <p className="text-sm text-gray-500">Aprobate</p>
            <p className="mt-2 text-3xl font-bold">{approvedCount}</p>
            <p className="mt-2 text-sm text-gray-600">In asteptare: {pendingCount}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold md:text-2xl">Actiuni rapide</h2>
              <p className="mt-1 text-sm text-gray-600">
                Adauga sau gestioneaza momentele clubului.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/club/performances"
                className="rounded-lg bg-black px-4 py-2 text-white"
              >
                Vezi momentele
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Ultimele momente</h2>

          {performances.length === 0 ? (
            <p className="text-sm text-gray-600">Nu exista momente pentru acest club.</p>
          ) : (
            <div className="space-y-3">
              {performances.slice(0, 5).map((performance) => (
                <div
                  key={performance.id}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  <p className="font-semibold">
                    #{performance.running_order || '-'} {performance.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Status: {performance.status || '-'} | Admin: {performance.admin_status || '-'}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Creat la:{' '}
                    {performance.created_at
                      ? new Date(performance.created_at).toLocaleString('ro-RO')
                      : '-'}
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