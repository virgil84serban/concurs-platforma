import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Lipsesc variabilele de mediu pentru Supabase')
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - lipseste Bearer token' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.replace('Bearer ', '').trim()

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - token gol' },
        { status: 401 }
      )
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user: requester },
      error: requesterError,
    } = await supabaseAuth.auth.getUser(accessToken)

    if (requesterError || !requester) {
      return NextResponse.json(
        {
          error: 'Unauthorized - token invalid',
          details: requesterError?.message || null,
        },
        { status: 401 }
      )
    }

    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role')
      .eq('id', requester.id)
      .maybeSingle()

    if (requesterProfileError) {
      return NextResponse.json(
        {
          error: 'Forbidden - profilul admin nu a putut fi citit',
          details: requesterProfileError.message,
          requesterId: requester.id,
          requesterEmail: requester.email || null,
        },
        { status: 403 }
      )
    }

    if (!requesterProfile) {
      return NextResponse.json(
        {
          error: 'Forbidden - profilul userului nu exista in tabela profiles',
          requesterId: requester.id,
          requesterEmail: requester.email || null,
        },
        { status: 403 }
      )
    }

    if (requesterProfile.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Forbidden - userul nu este admin',
          requesterId: requester.id,
          requesterEmail: requester.email || null,
          profileRole: requesterProfile.role,
        },
        { status: 403 }
      )
    }

    const body = await req.json()
    const competitionId =
      typeof body?.competitionId === 'string' ? body.competitionId.trim() : ''

    if (!competitionId) {
      return NextResponse.json({ error: 'Lipseste competitionId' }, { status: 400 })
    }

    const created: Array<{
      index: number
      email: string
      password: string
      user_id: string
    }> = []

    const skipped: string[] = []

    for (let i = 1; i <= 20; i++) {
      const email = `jurat${i}@maverick.local`
      const password = `Jurat${i}2026!`
      const displayName = `Jurat ${i}`

      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle()

      if (existingProfileError) {
        return NextResponse.json(
          {
            error: `Eroare la cautarea profilului existent pentru ${email}`,
            details: existingProfileError.message,
          },
          { status: 500 }
        )
      }

      if (existingProfile?.id) {
        const { data: existingJudge, error: existingJudgeError } = await supabaseAdmin
          .from('judges')
          .select('id')
          .eq('user_id', existingProfile.id)
          .eq('competition_id', competitionId)
          .maybeSingle()

        if (existingJudgeError) {
          return NextResponse.json(
            {
              error: `Eroare la cautarea juratului existent pentru ${email}`,
              details: existingJudgeError.message,
            },
            { status: 500 }
          )
        }

        if (!existingJudge?.id) {
          const { error: insertJudgeError } = await supabaseAdmin.from('judges').insert([
            {
              user_id: existingProfile.id,
              competition_id: competitionId,
            },
          ])

          if (insertJudgeError) {
            return NextResponse.json(
              {
                error: `Nu am putut asocia juratul existent ${email} la concurs`,
                details: insertJudgeError.message,
              },
              { status: 500 }
            )
          }
        }

        skipped.push(email)
        continue
      }

      const { data: createdUser, error: createUserError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name: displayName,
          },
        })

      if (createUserError || !createdUser.user) {
        return NextResponse.json(
          {
            error: `Nu am putut crea ${email}`,
            details: createUserError?.message || 'eroare necunoscuta',
          },
          { status: 500 }
        )
      }

      const { error: profileUpsertError } = await supabaseAdmin.from('profiles').upsert([
        {
          id: createdUser.user.id,
          full_name: displayName,
          email,
          role: 'judge',
          club_id: null,
        },
      ])

      if (profileUpsertError) {
        return NextResponse.json(
          {
            error: `Nu am putut salva profilul pentru ${email}`,
            details: profileUpsertError.message,
          },
          { status: 500 }
        )
      }

      const { error: judgeInsertError } = await supabaseAdmin.from('judges').insert([
        {
          user_id: createdUser.user.id,
          competition_id: competitionId,
        },
      ])

      if (judgeInsertError) {
        return NextResponse.json(
          {
            error: `Nu am putut salva juratul pentru ${email}`,
            details: judgeInsertError.message,
          },
          { status: 500 }
        )
      }

      created.push({
        index: i,
        email,
        password,
        user_id: createdUser.user.id,
      })
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'A aparut o eroare necunoscuta',
      },
      { status: 500 }
    )
  }
}