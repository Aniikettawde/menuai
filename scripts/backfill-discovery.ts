import dotenv from 'dotenv'

dotenv.config({
  path: '.env.local',
})

console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SERVICE KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

import { createClient } from '@supabase/supabase-js'
import { syncRestaurantToDiscovery } from '../src/lib/sync-to-discovery'

console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('SERVICE KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  try {
    const { data, error } = await sb
      .from('restaurants')
      .select('id')
      .eq('is_active', true)

    if (error) {
      console.error('Restaurant query failed:')
      console.error(error)
      return
    }

    for (const r of data ?? []) {
      try {
        console.log('Syncing', r.id)

        const result = await syncRestaurantToDiscovery(r.id)

        console.log('Success', result)
      } catch (err) {
        console.error('FAILED FOR RESTAURANT:', r.id)
        console.dir(err, { depth: null })
      }
    }

    console.log('Done')
  } catch (err) {
    console.dir(err, { depth: null })
  }
}

run()