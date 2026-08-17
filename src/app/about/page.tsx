// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 py-24">
        <h1 className="text-5xl font-bold text-slate-900">
          About Dinezy
        </h1>

        <p className="mt-6 text-lg text-slate-600">
          Dinezy is a next-generation digital dining platform that helps
          restaurants deliver a faster, smarter, and more engaging guest
          experience.
        </p>

        <div className="mt-12 space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              AI-Powered Dining
            </h2>
            <p className="mt-3 text-slate-600">
              Customers receive intelligent dish recommendations,
              food pairings, and personalized suggestions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              Smart Restaurant Management
            </h2>
            <p className="mt-3 text-slate-600">
              Restaurant owners can update menus instantly,
              manage availability, and gain valuable insights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900">
              Our Mission
            </h2>
            <p className="mt-3 text-slate-600">
              To make dining smarter for customers and more profitable
              for restaurants.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}
