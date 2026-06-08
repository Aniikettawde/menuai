export default function AccessDenied() {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-8">
      <h2 className="text-xl font-bold text-red-400">
        Access Denied
      </h2>

      <p className="mt-2 text-zinc-400">
        Your account is not linked to any restaurant.
      </p>
    </div>
  )
}