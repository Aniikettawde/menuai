// src/app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/admin-guard'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser()
  if (!user) redirect('/dashboard/login')

  return (
    <div className="min-h-dvh bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-60 -left-60 h-[500px] w-[500px] rounded-full bg-purple-600/5 blur-[140px]" />
        <div className="absolute top-1/3 -right-60 h-[400px] w-[400px] rounded-full bg-blue-500/4 blur-[120px]" />
      </div>
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050505]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 text-xs font-black text-white shadow-lg">
              A
            </div>
            <div>
              <p className="text-sm font-bold text-white">Dinezy Admin</p>
              <p className="text-[10px] text-zinc-600">Super dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white">
              ← Back to dashboard
            </a>
            <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-[10px] font-semibold text-purple-400">
              Admin
            </span>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}