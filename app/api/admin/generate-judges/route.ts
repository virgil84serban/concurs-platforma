import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    throw new Error('Lipsesc variabilele de mediu pentru Supabase')
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '').trim()

    const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseEnv()

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user: requester },
    } = await supabaseAuth.auth.getUser(accessToken)

    if (!requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requesterProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (!requesterProfile || requesterProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const competitionId = body?.competitionId

    const created: any[] = []
    const skipped: string[] = []

    for (let i = 1; i <= 20; i++) {
      const email = `jurat${i}@maverick.local`
      const password = `Jurat${i}2026!`
      const name = `Jurat ${i}`

      // 🔥 1. cauta in auth.users
      const { data: existingAuthUser } = await supabaseAdmin.auth.admin.listUsers()

      const existingUser = existingAuthUser.users.find(u => u.email === email)

      let userId = existingUser?.id

      // 🔥 2. daca nu exista → creeaza
      if (!userId) {
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          })

        if (createError || !newUser.user) {
          return NextResponse.json({
            error: `Nu am putut crea ${email}`,
            details: createError?.message,
          })
        }

        userId = newUser.user.id
      }

      // 🔥 3. profile UPSERT (nu doar insert)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          full_name: name,
          email,
          role: 'judge',
        })

      if (profileError) {
        return NextResponse.json({
          error: `Eroare profil ${email}`,
          details: profileError.message,
        })
      }

      // 🔥 4. verifica judges EXISTENT
      const { data: existingJudge } = await supabaseAdmin
        .from('judges')
        .select('id')
        .eq('user_id', userId)
        .eq('competition_id', competitionId)
        .maybeSingle()

      if (!existingJudge) {
        const { error: judgeError } = await supabaseAdmin
          .from('judges')
          .insert({
            user_id: userId,
            competition_id: competitionId,
          })

        if (judgeError) {
          return NextResponse.json({
            error: `Eroare judges ${email}`,
            details: judgeError.message,
          })
        }

        created.push({ email })
      } else {
        skipped.push(email)
      }
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'eroare necunoscuta',
    })
  }
}