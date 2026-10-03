import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const dish = clean(params.get('dish'), 80) || 'Something delicious'
  const restaurant = clean(params.get('restaurant'), 90) || 'A Pune restaurant'
  const price = clean(params.get('price'), 30)
  const rating = clean(params.get('rating'), 20)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#070707',
          color: '#fff',
          padding: '64px',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              color: '#000',
              fontSize: '28px',
              fontWeight: 800,
            }}
          >
            D
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '26px', fontWeight: 800 }}>Dinezy</div>
            <div style={{ fontSize: '15px', color: '#9b9b9b' }}>Food AI</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '970px' }}>
          <div style={{ fontSize: '22px', color: '#ffad63', marginBottom: '16px' }}>WHAT SHOULD I EAT?</div>
          <div style={{ fontSize: '64px', lineHeight: 1.02, fontWeight: 800, letterSpacing: '-2px' }}>{dish}</div>
          <div style={{ marginTop: '18px', display: 'flex', alignItems: 'center', gap: '18px', fontSize: '27px', color: '#cfcfcf' }}>
            <span>{restaurant}</span>
            {price ? <span>· {price}</span> : null}
            {rating ? <span>· ★ {rating}</span> : null}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', color: '#7d7d7d' }}>
          <span>Discover menus, dishes & places with Dinezy.</span>
          <span>dinezy.in</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}

function clean(value: string | null, max: number): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}
