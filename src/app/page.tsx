// app/page.tsx
// Home page — just a landing / redirect hint
// Real entry is /r/[slug] for each restaurant
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center p-8 text-center">
      <div className="text-gradient-gold font-display text-4xl font-bold mb-4">MenuAI</div>
      <p className="text-[var(--text-secondary)] text-lg mb-8">
        Scan the QR code at your table to explore the menu.
      </p>
      <p className="text-[var(--text-muted)] text-sm">
        Restaurant owners:{' '}
        <Link href="/admin" className="text-[var(--brand-gold)] underline">
          Admin Dashboard →
        </Link>
      </p>
    </main>
  )
}
