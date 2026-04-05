'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
  email: string | null
  full_name?: string | null
}

type AssignedCompetition = {
  id: string
  competition_id: string
  competitions?: {
    id: string
    title: string
    status?: string | null
  } | null
}

export default function JudgeScoresPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<AssignedCompetition[]>([])

  useEffect(() => {
    async function init() {
      setErrorMessage('')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.push('/login')
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, email, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setErrorMessage('Nu am putut citi profilul: ' + profileError.message)
        setLoading(false)
        return
      }

      if (!profileData) {
        setErrorMessage('Profilul utilizatorului nu exista.')
        setLoading(false)
        return
      }

      if (profileData.role !== 'judge') {
        router.push('/login')
        return
      }

      setProfile(profileData as Profile)

      const { data: assignments, error: assignmentsError } = await supabase
        .from('judges')
        .select(`
          id,
          competition_id,
          competitions (
            id,
            title,
            status
          )
        `)
        .eq('user_id', user.id)
        .order('id', { ascending: true })

      if (assignmentsError) {
        setErrorMessage('Nu am putut incarca concursurile alocate: ' + assignmentsError.message)
        setLoading(false)
        return
      }

      setCompetitions((assignments as AssignedCompetition[]) || [])
      setLoading(false)
    }

    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca pagina juratului...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Panou jurat</h1>
              <p className="mt-2 text-sm text-gray-600 md:text-base">
                Nume: {profile?.full_name || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-600 md:text-base">
                Email: {profile?.email || '-'}
              </p>
              <p className="mt-1 text-sm text-gray-600 md:text-base">
                Rol: {profile?.role || '-'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-black px-4 py-2 text-white"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Concursurile mele</h2>

          {errorMessage && (
            <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
          )}

          {competitions.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nu esti asociat momentan niciunui concurs.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="p-3 text-sm font-semibold">Concurs</th>
                    <th className="p-3 text-sm font-semibold">Status</th>
                    <th className="p-3 text-sm font-semibold">Competition ID</th>
                    <th className="p-3 text-sm font-semibold">Actiune</th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3 text-sm">
                        {item.competitions?.title || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        {item.competitions?.status || '-'}
                      </td>
                      <td className="p-3 text-sm">{item.competition_id}</td>
                      <td className="p-3 text-sm">
                        <button
                          type="button"
                          onClick={() => router.push(`/judge/scores/${item.competition_id}`)}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-white"
                        >
                          Intra in jurizare
                        </button>
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