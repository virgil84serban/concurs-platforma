'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Profile = {
  id: string
  role: string
}

export default function Navbar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    async function loadUserRole() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const userId = session?.user?.id

      if (!userId) {
        setRole(null)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single()

      setRole(data?.role || null)
    }

    loadUserRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUserRole()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (pathname?.startsWith('/display')) {
    return null
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-lg font-bold">
            Maverick Solutions
          </Link>

          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/login" className="hover:underline">
              Login
            </Link>

            {role === 'admin' && (
              <>
                <Link href="/admin/import" className="hover:underline">
                  Import
                </Link>
                <Link href="/admin" className="hover:underline">
                  Admin
                </Link>
                <Link href="/admin/judges" className="hover:underline">
                  Jurati
                </Link>
                <Link href="/admin/display" className="hover:underline">
                  Control Display
                </Link>
                <Link href="/display" className="hover:underline">
                  Display
                </Link>
                <Link href="/results" className="hover:underline">
                  Rezultate
                </Link>
                <Link href="/results/running-order" className="hover:underline">
                  Running order
                </Link>
                <Link href="/admin/fees" className="hover:underline">
  Taxe
</Link>
                <Link href="/admin/exports" className="hover:underline">
                  Exporturi
                </Link>
                <Link href="/admin/backup" className="hover:underline">
                  Backup
                </Link>
              </>
            )}

            {role === 'club' && (
              <>
                <Link href="/club" className="hover:underline">
                  Club
                </Link>
                <Link href="/club/performances" className="hover:underline">
                  Momente
                </Link>
              </>
            )}

            {role === 'judge' && (
              <Link href="/judge/scores" className="hover:underline">
                Scoruri
              </Link>
            )}
          </nav>
        </div>

        {role && (
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Logout
          </button>
        )}
      </div>
    </header>
  )
}