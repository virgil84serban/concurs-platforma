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
  status: string | null
}

type FeeRule = {
  id: string
  competition_id: string
  fee_group: 'solo' | 'small_team' | 'large_team'
  amount_per_participant: number
  currency: string
}

type FeeFormState = {
  solo: string
  small_team: string
  large_team: string
  currency: string
}

const defaultFeeForm: FeeFormState = {
  solo: '',
  small_team: '',
  large_team: '',
  currency: 'RON',
}

function getFeeGroupLabel(value: string) {
  switch (value) {
    case 'solo':
      return 'Solo'
    case 'small_team':
      return 'Duo / Trio / Quartet'
    case 'large_team':
      return 'Group / Formation'
    default:
      return value
  }
}

export default function AdminFeesPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [profile, setProfile] = useState<Profile | null>(null)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetitionId, setSelectedCompetitionId] = useState('')
  const [feeRules, setFeeRules] = useState<FeeRule[]>([])
  const [feeForm, setFeeForm] = useState<FeeFormState>(defaultFeeForm)

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
      .select('id, title, status')
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

  async function loadFeeRules(competitionId: string) {
    if (!competitionId) {
      setFeeRules([])
      setFeeForm(defaultFeeForm)
      return
    }

    const { data, error } = await supabase
      .from('competition_fee_rules')
      .select('id, competition_id, fee_group, amount_per_participant, currency')
      .eq('competition_id', competitionId)

    if (error) {
      setMessage('Eroare la taxele concursului: ' + error.message)
      return
    }

    const rows = (data as FeeRule[]) || []
    setFeeRules(rows)

    const solo = rows.find((item) => item.fee_group === 'solo')
    const smallTeam = rows.find((item) => item.fee_group === 'small_team')
    const largeTeam = rows.find((item) => item.fee_group === 'large_team')

    setFeeForm({
      solo: solo ? String(solo.amount_per_participant) : '',
      small_team: smallTeam ? String(smallTeam.amount_per_participant) : '',
      large_team: largeTeam ? String(largeTeam.amount_per_participant) : '',
      currency: rows[0]?.currency || 'RON',
    })
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

  useEffect(() => {
    if (!selectedCompetitionId) return
    loadFeeRules(selectedCompetitionId)
  }, [selectedCompetitionId])

  useEffect(() => {
    if (!message) return

    const timer = setTimeout(() => {
      setMessage('')
    }, 3000)

    return () => clearTimeout(timer)
  }, [message])

  const selectedCompetition = useMemo(() => {
    return competitions.find((item) => item.id === selectedCompetitionId) || null
  }, [competitions, selectedCompetitionId])

  async function handleSave() {
    if (!selectedCompetitionId) {
      setMessage('Selecteaza concursul.')
      return
    }

    const solo = Number(feeForm.solo || 0)
    const smallTeam = Number(feeForm.small_team || 0)
    const largeTeam = Number(feeForm.large_team || 0)

    if (solo < 0 || smallTeam < 0 || largeTeam < 0) {
      setMessage('Taxele nu pot fi negative.')
      return
    }

    if (!feeForm.currency.trim()) {
      setMessage('Moneda este obligatorie.')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = [
      {
        competition_id: selectedCompetitionId,
        fee_group: 'solo',
        amount_per_participant: solo,
        currency: feeForm.currency.trim(),
      },
      {
        competition_id: selectedCompetitionId,
        fee_group: 'small_team',
        amount_per_participant: smallTeam,
        currency: feeForm.currency.trim(),
      },
      {
        competition_id: selectedCompetitionId,
        fee_group: 'large_team',
        amount_per_participant: largeTeam,
        currency: feeForm.currency.trim(),
      },
    ]

    const { error } = await supabase
      .from('competition_fee_rules')
      .upsert(payload, {
        onConflict: 'competition_id,fee_group',
      })

    if (error) {
      setMessage('Eroare la salvare: ' + error.message)
      setSaving(false)
      return
    }

    await loadFeeRules(selectedCompetitionId)
    setSaving(false)
    setMessage('Taxele au fost salvate.')
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="mx-auto max-w-5xl rounded-xl bg-white p-6 shadow">
          <p>Se incarca taxele...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h1 className="mb-2 text-2xl font-bold md:text-3xl">Taxe participare</h1>
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
                    {competition.title} ({competition.status || 'open'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Moneda</label>
              <input
                value={feeForm.currency}
                onChange={(e) =>
                  setFeeForm((prev) => ({
                    ...prev,
                    currency: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-3"
                placeholder="RON"
              />
            </div>
          </div>

          {selectedCompetition && (
            <p className="mt-4 text-sm text-gray-700">
              Concurs selectat: <span className="font-semibold">{selectedCompetition.title}</span>
            </p>
          )}

          {message && (
            <p className="mt-4 text-sm text-gray-700">{message}</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Configurare taxe</h2>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">Solo</p>
              <p className="mb-3 text-sm text-gray-600">Taxa per dansator</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeForm.solo}
                onChange={(e) =>
                  setFeeForm((prev) => ({
                    ...prev,
                    solo: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-3"
                placeholder="200"
              />
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">Duo / Trio / Quartet</p>
              <p className="mb-3 text-sm text-gray-600">Taxa per dansator</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeForm.small_team}
                onChange={(e) =>
                  setFeeForm((prev) => ({
                    ...prev,
                    small_team: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-3"
                placeholder="150"
              />
            </div>

            <div className="rounded-xl border p-4">
              <p className="mb-2 text-sm font-semibold">Group / Formation</p>
              <p className="mb-3 text-sm text-gray-600">Taxa per dansator</p>
              <input
                type="number"
                min="0"
                step="0.01"
                value={feeForm.large_team}
                onChange={(e) =>
                  setFeeForm((prev) => ({
                    ...prev,
                    large_team: e.target.value,
                  }))
                }
                className="w-full rounded-lg border p-3"
                placeholder="100"
              />
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-black px-5 py-3 text-white disabled:opacity-50"
            >
              {saving ? 'Se salveaza...' : 'Salveaza taxele'}
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow md:p-6">
          <h2 className="mb-4 text-xl font-bold md:text-2xl">Taxe curente</h2>

          {feeRules.length === 0 ? (
            <p className="text-sm text-gray-600">Nu exista taxe configurate pentru concursul selectat.</p>
          ) : (
            <div className="space-y-3">
              {feeRules
                .slice()
                .sort((a, b) => a.fee_group.localeCompare(b.fee_group))
                .map((rule) => (
                  <div key={rule.id} className="rounded-lg border p-4">
                    <p className="font-semibold">{getFeeGroupLabel(rule.fee_group)}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {rule.amount_per_participant} {rule.currency} / dansator
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