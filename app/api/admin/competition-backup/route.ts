import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type BackupPayload = {
  version: 1
  exported_at: string
  warnings: string[]
  competition: Record<string, unknown>
  categories: Record<string, unknown>[]
  criteria: Record<string, unknown>[]
  performances: Record<string, unknown>[]
  judges: Record<string, unknown>[]
  scores: Record<string, unknown>[]
}

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

async function getAdminRequester(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Unauthorized - lipseste Bearer token' },
        { status: 401 }
      ),
    }
  }

  const accessToken = authHeader.replace('Bearer ', '').trim()

  if (!accessToken) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Unauthorized - token gol' },
        { status: 401 }
      ),
    }
  }

  const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseEnv()

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

  const {
    data: { user: requester },
    error: requesterError,
  } = await supabaseAuth.auth.getUser(accessToken)

  if (requesterError || !requester) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Unauthorized - token invalid',
          details: requesterError?.message || null,
        },
        { status: 401 }
      ),
    }
  }

  const { data: requesterProfile, error: requesterProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .eq('id', requester.id)
    .maybeSingle()

  if (requesterProfileError) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: 'Forbidden - profilul admin nu a putut fi citit',
          details: requesterProfileError.message,
        },
        { status: 403 }
      ),
    }
  }

  if (!requesterProfile || requesterProfile.role !== 'admin') {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: 'Forbidden - userul nu este admin' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true as const,
    supabaseAdmin,
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAdminRequester(req)
    if (!auth.ok) {
      return auth.response
    }

    const { supabaseAdmin } = auth
    const body = await req.json()
    const action = typeof body?.action === 'string' ? body.action.trim() : ''

    if (action === 'backup') {
      const competitionId =
        typeof body?.competitionId === 'string' ? body.competitionId.trim() : ''

      if (!competitionId) {
        return NextResponse.json({ error: 'Lipseste competitionId' }, { status: 400 })
      }

      const warnings: string[] = []

      const { data: competition, error: competitionError } = await supabaseAdmin
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()

      if (competitionError || !competition) {
        return NextResponse.json(
          {
            error: 'Nu am putut citi concursul',
            details: competitionError?.message || null,
          },
          { status: 500 }
        )
      }

      const { data: categories, error: categoriesError } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('competition_id', competitionId)

      if (categoriesError) {
        return NextResponse.json(
          {
            error: 'Nu am putut citi categoriile',
            details: categoriesError.message,
          },
          { status: 500 }
        )
      }

      let criteria: Record<string, unknown>[] = []
      const { data: criteriaData, error: criteriaError } = await supabaseAdmin
        .from('criteria')
        .select('*')
        .eq('competition_id', competitionId)

      if (criteriaError) {
        warnings.push(`Tabela criteria nu a putut fi citita: ${criteriaError.message}`)
      } else {
        criteria = (criteriaData as Record<string, unknown>[]) || []
      }

      const { data: performances, error: performancesError } = await supabaseAdmin
        .from('performances')
        .select('*')
        .eq('competition_id', competitionId)

      if (performancesError) {
        return NextResponse.json(
          {
            error: 'Nu am putut citi momentele',
            details: performancesError.message,
          },
          { status: 500 }
        )
      }

      const { data: judges, error: judgesError } = await supabaseAdmin
        .from('judges')
        .select('*')
        .eq('competition_id', competitionId)

      if (judgesError) {
        return NextResponse.json(
          {
            error: 'Nu am putut citi juratii',
            details: judgesError.message,
          },
          { status: 500 }
        )
      }

      const performanceIds = ((performances as Record<string, unknown>[]) || [])
        .map((item) => item.id)
        .filter(Boolean) as string[]

      let scores: Record<string, unknown>[] = []

      if (performanceIds.length > 0) {
        const { data: scoresData, error: scoresError } = await supabaseAdmin
          .from('scores')
          .select('*')
          .in('performance_id', performanceIds)

        if (scoresError) {
          warnings.push(`Tabela scores nu a putut fi citita: ${scoresError.message}`)
        } else {
          scores = (scoresData as Record<string, unknown>[]) || []
        }
      }

      const payload: BackupPayload = {
        version: 1,
        exported_at: new Date().toISOString(),
        warnings,
        competition: competition as Record<string, unknown>,
        categories: (categories as Record<string, unknown>[]) || [],
        criteria,
        performances: (performances as Record<string, unknown>[]) || [],
        judges: (judges as Record<string, unknown>[]) || [],
        scores,
      }

      return NextResponse.json({
        success: true,
        backup: payload,
      })
    }

    if (action === 'restore') {
      const backup = body?.backup as BackupPayload | undefined

      if (!backup || !backup.competition) {
        return NextResponse.json(
          { error: 'Lipseste payload-ul de backup' },
          { status: 400 }
        )
      }

      const sourceCompetition = backup.competition
      const sourceCategories = Array.isArray(backup.categories) ? backup.categories : []
      const sourceCriteria = Array.isArray(backup.criteria) ? backup.criteria : []
      const sourcePerformances = Array.isArray(backup.performances) ? backup.performances : []
      const sourceJudges = Array.isArray(backup.judges) ? backup.judges : []
      const sourceScores = Array.isArray(backup.scores) ? backup.scores : []

      const originalTitle =
        typeof sourceCompetition.title === 'string' ? sourceCompetition.title : 'Concurs restaurat'

      const restoredTitle = `${originalTitle} (Restore ${new Date()
        .toISOString()
        .slice(0, 16)
        .replace('T', ' ')})`

      const competitionInsert: Record<string, unknown> = {
        ...sourceCompetition,
        id: undefined,
        title: restoredTitle,
        status: 'open',
        created_at: undefined,
        updated_at: undefined,
      }

      delete competitionInsert.id
      delete competitionInsert.created_at
      delete competitionInsert.updated_at

      const { data: insertedCompetition, error: insertCompetitionError } = await supabaseAdmin
        .from('competitions')
        .insert([competitionInsert])
        .select('*')
        .single()

      if (insertCompetitionError || !insertedCompetition?.id) {
        return NextResponse.json(
          {
            error: 'Nu am putut crea concursul restaurat',
            details: insertCompetitionError?.message || null,
          },
          { status: 500 }
        )
      }

      const newCompetitionId = insertedCompetition.id as string

      const categoryIdMap = new Map<string, string>()
      const criterionIdMap = new Map<string, string>()
      const performanceIdMap = new Map<string, string>()
      const judgeIdMap = new Map<string, string>()

      for (const category of sourceCategories) {
        const oldId = typeof category.id === 'string' ? category.id : null
        const insertRow: Record<string, unknown> = {
          ...category,
          id: undefined,
          competition_id: newCompetitionId,
          created_at: undefined,
          updated_at: undefined,
        }

        delete insertRow.id
        delete insertRow.created_at
        delete insertRow.updated_at

        const { data: insertedCategory, error: insertCategoryError } = await supabaseAdmin
          .from('categories')
          .insert([insertRow])
          .select('id')
          .single()

        if (insertCategoryError || !insertedCategory?.id) {
          return NextResponse.json(
            {
              error: 'Nu am putut restaura o categorie',
              details: insertCategoryError?.message || null,
            },
            { status: 500 }
          )
        }

        if (oldId) {
          categoryIdMap.set(oldId, insertedCategory.id as string)
        }
      }

      for (const criterion of sourceCriteria) {
        const oldId = typeof criterion.id === 'string' ? criterion.id : null
        const insertRow: Record<string, unknown> = {
          ...criterion,
          id: undefined,
          competition_id: newCompetitionId,
          created_at: undefined,
          updated_at: undefined,
        }

        delete insertRow.id
        delete insertRow.created_at
        delete insertRow.updated_at

        const { data: insertedCriterion, error: insertCriterionError } = await supabaseAdmin
          .from('criteria')
          .insert([insertRow])
          .select('id')
          .single()

        if (insertCriterionError || !insertedCriterion?.id) {
          return NextResponse.json(
            {
              error: 'Nu am putut restaura un criteriu',
              details: insertCriterionError?.message || null,
            },
            { status: 500 }
          )
        }

        if (oldId) {
          criterionIdMap.set(oldId, insertedCriterion.id as string)
        }
      }

      for (const performance of sourcePerformances) {
        const oldId = typeof performance.id === 'string' ? performance.id : null
        const oldCategoryId =
          typeof performance.category_id === 'string' ? performance.category_id : null

        const insertRow: Record<string, unknown> = {
          ...performance,
          id: undefined,
          competition_id: newCompetitionId,
          category_id: oldCategoryId ? categoryIdMap.get(oldCategoryId) || null : null,
          created_at: undefined,
          updated_at: undefined,
        }

        delete insertRow.id
        delete insertRow.created_at
        delete insertRow.updated_at

        const { data: insertedPerformance, error: insertPerformanceError } = await supabaseAdmin
          .from('performances')
          .insert([insertRow])
          .select('id')
          .single()

        if (insertPerformanceError || !insertedPerformance?.id) {
          return NextResponse.json(
            {
              error: 'Nu am putut restaura un moment',
              details: insertPerformanceError?.message || null,
            },
            { status: 500 }
          )
        }

        if (oldId) {
          performanceIdMap.set(oldId, insertedPerformance.id as string)
        }
      }

      for (const judge of sourceJudges) {
        const oldId = typeof judge.id === 'string' ? judge.id : null
        const userId = typeof judge.user_id === 'string' ? judge.user_id : null

        if (!userId) {
          continue
        }

        const insertRow: Record<string, unknown> = {
          ...judge,
          id: undefined,
          competition_id: newCompetitionId,
          created_at: undefined,
          updated_at: undefined,
        }

        delete insertRow.id
        delete insertRow.created_at
        delete insertRow.updated_at

        const { data: insertedJudge, error: insertJudgeError } = await supabaseAdmin
          .from('judges')
          .insert([insertRow])
          .select('id')
          .single()

        if (insertJudgeError || !insertedJudge?.id) {
          return NextResponse.json(
            {
              error: 'Nu am putut restaura un jurat',
              details: insertJudgeError?.message || null,
            },
            { status: 500 }
          )
        }

        if (oldId) {
          judgeIdMap.set(oldId, insertedJudge.id as string)
        }
      }

      for (const score of sourceScores) {
        const oldPerformanceId =
          typeof score.performance_id === 'string' ? score.performance_id : null
        const oldJudgeId = typeof score.judge_id === 'string' ? score.judge_id : null
        const oldCriterionId = typeof score.criterion_id === 'string' ? score.criterion_id : null

        const newPerformanceId = oldPerformanceId ? performanceIdMap.get(oldPerformanceId) : null
        const newJudgeId = oldJudgeId ? judgeIdMap.get(oldJudgeId) : null
        const newCriterionId = oldCriterionId ? criterionIdMap.get(oldCriterionId) : null

        if (!newPerformanceId || !newJudgeId || !newCriterionId) {
          continue
        }

        const insertRow: Record<string, unknown> = {
          ...score,
          id: undefined,
          performance_id: newPerformanceId,
          judge_id: newJudgeId,
          criterion_id: newCriterionId,
          created_at: undefined,
          updated_at: undefined,
        }

        delete insertRow.id
        delete insertRow.created_at
        delete insertRow.updated_at

        const { error: insertScoreError } = await supabaseAdmin
          .from('scores')
          .insert([insertRow])

        if (insertScoreError) {
          return NextResponse.json(
            {
              error: 'Nu am putut restaura un scor',
              details: insertScoreError.message,
            },
            { status: 500 }
          )
        }
      }

      return NextResponse.json({
        success: true,
        restoredCompetitionId: newCompetitionId,
        restoredCompetitionTitle: restoredTitle,
      })
    }

    return NextResponse.json({ error: 'Actiune invalida' }, { status: 400 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'A aparut o eroare necunoscuta',
      },
      { status: 500 }
    )
  }
}