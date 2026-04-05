'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'register'>('login')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clubName, setClubName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function redirectByRole() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setMessage('Nu exista sesiune activa dupa login.')
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      setMessage('Nu am putut citi profilul utilizatorului: ' + profileError.message)
      return
    }

    if (!profile?.role) {
      setMessage('Profilul utilizatorului nu exista sau nu are rol setat.')
      return
    }

    router.refresh()

    if (profile.role === 'club') {
      router.replace('/club')
      return
    }

    if (profile.role === 'judge') {
      router.replace('/judge/scores')
      return
    }

    if (profile.role === 'admin') {
      router.replace('/admin')
      return
    }

    setMessage('Rol necunoscut: ' + profile.role)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const cleanEmail = email.trim()

    if (!cleanEmail) {
      setMessage('Email lipsa')
      setLoading(false)
      return
    }

    if (!password) {
      setMessage('Parola lipsa')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    await redirectByRole()
    setLoading(false)
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const cleanEmail = email.trim()
    const cleanClubName = clubName.trim()

    if (!cleanClubName) {
      setMessage('Completeaza numele clubului')
      setLoading(false)
      return
    }

    if (!cleanEmail) {
      setMessage('Completeaza emailul clubului')
      setLoading(false)
      return
    }

    if (!password) {
      setMessage('Completeaza parola')
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setMessage('Parolele nu coincid')
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage('Parola trebuie sa aiba minim 6 caractere')
      setLoading(false)
      return
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    })

    if (signUpError) {
      setMessage(signUpError.message)
      setLoading(false)
      return
    }

    const userId = signUpData.user?.id

    if (!userId) {
      setMessage('Contul a fost creat, dar nu am putut prelua utilizatorul.')
      setLoading(false)
      return
    }

    const { data: existingClub } = await supabase
      .from('clubs')
      .select('id')
      .eq('name', cleanClubName)
      .maybeSingle()

    let clubId = existingClub?.id || null

    if (!clubId) {
      const { data: insertedClub, error: clubError } = await supabase
        .from('clubs')
        .insert([
          {
            name: cleanClubName,
          },
        ])
        .select('id')
        .single()

      if (clubError) {
        setMessage('Cont creat, dar clubul nu a putut fi salvat: ' + clubError.message)
        setLoading(false)
        return
      }

      clubId = insertedClub.id
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert([
        {
          id: userId,
          role: 'club',
        },
      ])

    if (profileError) {
      setMessage('Cont creat, dar profilul nu a putut fi salvat: ' + profileError.message)
      setLoading(false)
      return
    }

    setMessage('Contul clubului a fost creat cu succes. Te poti loga acum.')
    setMode('login')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setClubName('')
    setShowRegisterPassword(false)
    setShowConfirmPassword(false)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
      <div className="w-full max-w-md space-y-5 rounded-2xl bg-white p-6 shadow">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold">Maverick Solutions</h1>
          <p className="text-sm text-gray-500">
            Inscrieri, jurizare si rezultate
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login')
              setMessage('')
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              mode === 'login'
                ? 'bg-black text-white'
                : 'bg-transparent text-gray-700'
            }`}
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register')
              setMessage('')
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              mode === 'register'
                ? 'bg-black text-white'
                : 'bg-transparent text-gray-700'
            }`}
          >
            Inregistrare club
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border p-3"
              required
            />

            <div className="flex items-center gap-2">
              <input
                type={showLoginPassword ? 'text' : 'password'}
                placeholder="Parola"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border p-3"
                required
              />
              <button
                type="button"
                onClick={() => setShowLoginPassword((prev) => !prev)}
                className="rounded-lg border px-3 py-3 text-sm text-gray-700"
              >
                {showLoginPassword ? 'Ascunde' : 'Arata'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black py-3 text-white disabled:opacity-50"
            >
              {loading ? 'Se proceseaza...' : 'Login'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-3">
            <input
              type="text"
              placeholder="Nume club"
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              className="w-full rounded-lg border p-3"
              required
            />

            <input
              type="email"
              placeholder="Email club"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-lg border p-3"
              required
            />

            <div className="flex items-center gap-2">
              <input
                type={showRegisterPassword ? 'text' : 'password'}
                placeholder="Parola"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border p-3"
                required
              />
              <button
                type="button"
                onClick={() => setShowRegisterPassword((prev) => !prev)}
                className="rounded-lg border px-3 py-3 text-sm text-gray-700"
              >
                {showRegisterPassword ? 'Ascunde' : 'Arata'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirma parola"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border p-3"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="rounded-lg border px-3 py-3 text-sm text-gray-700"
              >
                {showConfirmPassword ? 'Ascunde' : 'Arata'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-black py-3 text-white disabled:opacity-50"
            >
              {loading ? 'Se proceseaza...' : 'Creeaza cont club'}
            </button>
          </form>
        )}

        {message && (
          <p className="text-center text-sm text-red-600">
            {message}
          </p>
        )}
      </div>
    </main>
  )
}