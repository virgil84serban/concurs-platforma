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

function buildJudgeEmail(index: number, competitionId: string) {
  const suffix = competitionId.replace(/-/g, '').slice(0, 8).toLowerCase()
  return `jurat${index}.${suffix}@maverick.local`
}

function buildJudgePassword(index: number, competitionId: string) {
  const suffix = competitionId.replace(/-/g, '').slice(0, 4)
  return `Jurat${index}${suffix}!`
}

function buildJudgeName(index: number) {
  return `Jurat ${index}`
}

async function listAllAuthUsers(supabaseAdmin: any) {
  const allUsers: Array<{ id: string; email?: string | null }> = []
  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (error) {
      throw new Error(`Nu am putut lista userii din auth: ${error.message}`)
    }

    const users = data?.users || []
    allUsers.push(...users)

    if (users.length < perPage) {
      break
    }

    page += 1
  }

  return allUsers
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

    const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseEnv()

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
        },
        { status: 403 }
      )
    }

    if (!requesterProfile || requesterProfile.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Forbidden - userul nu este admin',
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

    const { data: competition, error: competitionError } = await supabaseAdmin
      .from('competitions')
      .select('id, title')
      .eq('id', competitionId)
      .maybeSingle()

    if (competitionError) {
      return NextResponse.json(
        {
          error: 'Nu am putut verifica concursul',
          details: competitionError.message,
        },
        { status: 500 }
      )
    }

    if (!competition) {
      return NextResponse.json(
        { error: 'Concursul nu exista' },
        { status: 404 }
      )
    }

    const created: Array<{
      index: number
      email: string
      password: string
      user_id: string
    }> = []

    const skipped: string[] = []
    const repaired: string[] = []

    const allAuthUsers = await listAllAuthUsers(supabaseAdmin)

    for (let i = 1; i <= 20; i++) {
      const email = buildJudgeEmail(i, competitionId)
      const password = buildJudgePassword(i, competitionId)
      const displayName = buildJudgeName(i)

      let userId: string | null = null
      let createdNow = false
      let repairedNow = false

      const existingAuthUser = allAuthUsers.find(
        (user) => (user.email || '').toLowerCase() === email.toLowerCase()
      )

      if (existingAuthUser?.id) {
        userId = existingAuthUser.id
      } else {
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

        userId = createdUser.user.id
        createdNow = true
      }

      if (!userId) {
        return NextResponse.json(
          {
            error: `Nu am putut determina userId pentru ${email}`,
          },
          { status: 500 }
        )
      }

      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, role, full_name')
        .eq('id', userId)
        .maybeSingle()

      if (existingProfileError) {
        return NextResponse.json(
          {
            error: `Eroare la cautarea profilului pentru ${email}`,
            details: existingProfileError.message,
          },
          { status: 500 }
        )
      }

      if (
        !existingProfile ||
        existingProfile.email !== email ||
        existingProfile.role !== 'judge' ||
        existingProfile.full_name !== displayName
      ) {
        const { error: profileUpsertError } = await supabaseAdmin.from('profiles').upsert(
          [
            {
              id: userId,
              full_name: displayName,
              email,
              role: 'judge',
              club_id: null,
            },
          ],
          {
            onConflict: 'id',
          }
        )

        if (profileUpsertError) {
          return NextResponse.json(
            {
              error: `Nu am putut salva profilul pentru ${email}`,
              details: profileUpsertError.message,
            },
            { status: 500 }
          )
        }

        if (!createdNow) {
          repairedNow = true
        }
      }

      const { data: existingJudge, error: existingJudgeError } = await supabaseAdmin
        .from('judges')
        .select('id')
        .eq('user_id', userId)
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
            user_id: userId,
            competition_id: competitionId,
          },
        ])

        if (insertJudgeError) {
          return NextResponse.json(
            {
              error: `Nu am putut salva juratul pentru ${email}`,
              details: insertJudgeError.message,
            },
            { status: 500 }
          )
        }

        if (!createdNow) {
          repairedNow = true
        }
      }

      if (createdNow) {
        created.push({
          index: i,
          email,
          password,
          user_id: userId,
        })
      } else if (repairedNow) {
        repaired.push(email)
      } else {
        skipped.push(email)
      }
    }

    return NextResponse.json({
      success: true,
      competition: {
        id: competition.id,
        title: competition.title,
      },
      created,
      repaired,
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