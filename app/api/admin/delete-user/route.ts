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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.replace('Bearer ', '').trim()

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    const {
      data: { user: requester },
      error: requesterError,
    } = await supabaseAuth.auth.getUser(accessToken)

    if (requesterError || !requester) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (requesterProfileError || !requesterProfile || requesterProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : ''

    if (!userId) {
      return NextResponse.json({ error: 'Lipseste userId' }, { status: 400 })
    }

    if (userId === requester.id) {
      return NextResponse.json(
        { error: 'Nu iti poti sterge propriul cont din acest ecran.' },
        { status: 400 }
      )
    }

    const { error: judgesDeleteError } = await supabaseAdmin
      .from('judges')
      .delete()
      .eq('user_id', userId)

    if (judgesDeleteError) {
      return NextResponse.json(
        { error: 'Nu am putut sterge inregistrarile din judges: ' + judgesDeleteError.message },
        { status: 500 }
      )
    }

    const { error: profilesDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profilesDeleteError) {
      return NextResponse.json(
        { error: 'Nu am putut sterge profilul: ' + profilesDeleteError.message },
        { status: 500 }
      )
    }

    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      return NextResponse.json(
        { error: 'Userul din auth nu a putut fi sters: ' + deleteAuthError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'A aparut o eroare necunoscuta',
      },
      { status: 500 }
    )
  }
}