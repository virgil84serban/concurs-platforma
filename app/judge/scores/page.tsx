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
  }[]
}

export default function JudgeScoresPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<AssignedCompetition[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession()

      if (!sessionData.session) {
        router.push('/login')
        return
      }

      const user = sessionData.session.user

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, role, email, full_name')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) {
        router.push('/login')
        return
      }

      if (profileData.role !== 'judge') {
        router.push('/login')
        return
      }

      setProfile(profileData)

      const { data: assignments, error: assignError } = await supabase
        .from('judges')
        .select(`
          id,
          competition_id,
          competitions (
            id,
            title
          )
        `)
        .eq('user_id', user.id)

      if (assignError) {
        setError(assignError.message)
        setLoading(false)
        return
      }

      setCompetitions((assignments as unknown as AssignedCompetition[]) || [])
      setLoading(false)
    }

    init()
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <p className="p-6">Se incarca...</p>
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-4xl space-y-6">

        <div className="rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold">Panou jurat</h1>
          <p className="text-sm text-gray-600 mt-2">
            {profile?.full_name} ({profile?.email})
          </p>

          <button
            onClick={handleLogout}
            className="mt-4 rounded bg-black px-4 py-2 text-white"
          >
            Logout
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-bold mb-4">Concursurile mele</h2>

          {error && <p className="text-red-600">{error}</p>}

          {competitions.length === 0 ? (
            <p>Nu esti asignat la niciun concurs.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-3 text-left text-sm">Concurs</th>
                  <th className="p-3 text-left text-sm">Actiune</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-3 text-sm">
                      {c.competitions?.[0]?.title || c.competition_id}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          router.push(`/judge/scores/${c.competition_id}`)
                        }
                        className="rounded bg-blue-600 px-4 py-2 text-white"
                      >
                        Intra
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  )
}