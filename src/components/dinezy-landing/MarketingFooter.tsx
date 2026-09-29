import Link from 'next/link'

const columns = [
  {
    title: 'Product',
    links: [
      ['Digital menu', '/restaurant-digital-menu'],
      ['QR menu', '/restaurant-qr-menu'],
      ['Restaurant marketing', '/restaurant-marketing'],
      ['WhatsApp marketing', '/restaurant-whatsapp-marketing'],
      ['Restaurant analytics', '/restaurant-analytics'],
      ['Restaurant loyalty', '/restaurant-loyalty-program'],
      ['AI menu assistant', '/ai-menu-assistant'],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Free QR generator', '/qr-generator'],
      ['Blog', '/blog'],
      ['Digital menu in Pune', '/restaurant-digital-menu/pune'],
      ['Partner program', '/partner'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Privacy', '/privacy'],
      ['Terms', '/terms'],
      ['Contact', 'mailto:hello@dinezy.in'],
    ],
  },
]

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#E8E0D5] bg-[#FCFAF7]">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-7">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#171313] text-sm font-bold text-white">D</span>
              <span className="font-display text-[17px] font-semibold tracking-tight text-[#171313]">Dinezy</span>
            </Link>
            <h2 className="mt-6 max-w-sm font-display text-2xl font-semibold tracking-tight text-[#171313]">
              A digital menu built for the restaurant business.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#756A60]">
              QR menus, guest engagement, loyalty, WhatsApp marketing and restaurant analytics in one place.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8B8178]">{column.title}</p>
              <div className="mt-4 space-y-2.5">
                {column.links.map(([label, href]) => {
                  const className = 'block text-sm text-[#5F564F] transition hover:text-[#171313]'
                  if (href.startsWith('mailto:')) {
                    return <a key={href} href={href} className={className}>{label}</a>
                  }
                  return <Link key={href} href={href} className={className}>{label}</Link>
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[#E8E0D5] pt-6 text-xs text-[#8B8178] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Dinezy. All rights reserved.</p>
          <p>Built for restaurants in India.</p>
        </div>
      </div>
    </footer>
  )
}
