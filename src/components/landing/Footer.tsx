export function Footer() {
  return (
    <footer className="bg-white px-5 pb-8 pt-14 sm:px-8 sm:pt-16">
      <div className="mx-auto max-w-content">
        <div className="grid gap-10 border-b border-line pb-10 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink text-[13px] font-bold text-white">
                D
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
                Dinezy
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-soft">
              The restaurant growth platform — QR menus, WhatsApp automation, loyalty and
              analytics in one place.
            </p>
            <div className="mt-5 space-y-1.5 text-[13px] text-ink-soft">
              <p>Balewadi, Pune 411045, Maharashtra, India</p>
              <p>
                <a href="mailto:support@dinezy.in" className="transition-colors hover:text-accent">
                  support@dinezy.in
                </a>
              </p>
              <p>
                <a href="tel:+917507002369" className="transition-colors hover:text-accent">
                  +91 75070 02369
                </a>
              </p>
            </div>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink">Legal</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
              <li>
                <a href="/privacy-policy" className="hover:text-ink">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-ink">
                  Terms &amp; Conditions
                </a>
              </li>
              <li>
                <a href="/refunds" className="hover:text-ink">
                  Refund &amp; Cancellation Policy
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink">Company</p>
            <ul className="mt-4 space-y-2.5 text-[13px] text-ink-soft">
              <li>
                <a href="/contact" className="hover:text-ink">
                  Contact us
                </a>
              </li>
              <li>
                <a href="https://linkedin.com" target="_blank" rel="noreferrer" className="hover:text-ink">
                  LinkedIn
                </a>
              </li>
              <li>
                <a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-ink">
                  Instagram
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-6 sm:flex-row">
          <p className="text-[12px] text-ink-faint">© {new Date().getFullYear()} Dinezy. Made in India.</p>
          <p className="text-[12px] text-ink-faint">All prices in INR.</p>
        </div>
      </div>
    </footer>
  )
}
