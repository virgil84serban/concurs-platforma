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
        },
        { status: 403 }
      )
    }

    if (!requesterProfile) {
      return NextResponse.json(
        {
          error: 'Forbidden - profilul userului nu exista in tabela profiles',
        },
        { status: 403 }
      )
    }

    if (requesterProfile.role !== 'admin') {
      return NextResponse.json(
        {
          error: 'Forbidden - userul nu este admin',
        },
        { status: 403 }
      )
    }

    const body = await req.json()

    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!userId) {
      return NextResponse.json({ error: 'Lipseste userId' }, { status: 400 })
    }

    if (!password || password.trim().length < 6) {
      return NextResponse.json(
        { error: 'Parola trebuie sa aiba minim 6 caractere' },
        { status: 400 }
      )
    }

    const { data: existingUser, error: existingUserError } =
      await supabaseAdmin.auth.admin.getUserById(userId)

    if (existingUserError || !existingUser.user) {
      return NextResponse.json(
        {
          error: 'Userul nu exista in auth',
          details: existingUserError?.message || null,
        },
        { status: 404 }
      )
    }

    const { data: updatedUser, error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
      })

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Nu am putut actualiza parola',
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      userId,
      email: updatedUser.user?.email || existingUser.user.email || null,
      message: 'Parola a fost actualizata cu succes',
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Eroare necunoscuta',
      },
      { status: 500 }
    )
  }
}