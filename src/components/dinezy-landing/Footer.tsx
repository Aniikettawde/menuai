'use client'

const FOOTER_LINKS = {
  Product: [
    { label: 'Features', href: '#journey' },
    { label: 'WhatsApp', href: '#whatsapp' },
    { label: 'AI Menu', href: '#ai' },
    { label: 'Loyalty', href: '#loyalty' },
    { label: 'Analytics', href: '#analytics' },
  ],
  Resources: [
    { label: 'Contact', href: 'mailto:hello@dinezy.in' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-line bg-white px-5 py-14 sm:px-8">
      <div className="mx-auto max-w-content">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <a href="#top" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink text-[14px] font-bold text-white">
                D
              </span>
              <span className="font-display text-[17px] font-semibold tracking-tight">Dinezy</span>
            </a>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ink-soft">
              The restaurant growth platform that turns one-time diners into repeat customers.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-faint">
                {title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[14px] text-ink-soft transition-colors hover:text-ink"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-line pt-8 sm:flex-row sm:items-center">
          <p className="text-[12px] text-ink-faint">
            © {new Date().getFullYear()} Dinezy. All rights reserved.
          </p>
          <p className="text-[12px] text-ink-faint">Made for restaurants in India</p>
        </div>
      </div>
    </footer>
  )
}
