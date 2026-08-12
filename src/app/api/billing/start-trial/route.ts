import { NextResponse } from 'next/server'

/**
 * Free standalone trial is retired.
 * Trial is now bundled with plan subscription (7 days, then auto-charge).
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Standalone free trial is no longer available. Choose Monthly or Yearly to start your 7-day trial.',
      code: 'TRIAL_MERGED_WITH_PLAN',
    },
    { status: 410 },
  )
}
