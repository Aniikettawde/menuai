export default function AboutSection() {
  return (
    <section
      id="about"
      className="bg-[#FBF6EC] py-20 px-6 sm:px-10"
      aria-labelledby="about-heading"
    >
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm tracking-widest uppercase text-[#7A2333] font-medium mb-3">
          About Us
        </p>
        <h2
          id="about-heading"
          className="font-serif text-3xl sm:text-4xl text-[#111111] mb-6"
          style={{ fontFamily: 'var(--font-fraunces, serif)' }}
        >
          Built for restaurants that want regulars, not just footfall
        </h2>
        <p className="text-base sm:text-lg text-[#444444] leading-relaxed max-w-2xl mx-auto mb-10">
          Dinezy was founded to help independent restaurants in India turn
          first-time diners into loyal regulars — with QR menus, WhatsApp
          automation, and loyalty tools built for how neighborhood restaurants
          actually run, without the overhead of enterprise POS systems.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-10 border-t border-[#7A2333]/20 pt-8">
          <div className="flex flex-col items-center">
            <span
              className="font-serif text-xl text-[#111111]"
              style={{ fontFamily: 'var(--font-fraunces, serif)' }}
            >
              Aniket Tawde
            </span>
            <span className="text-sm text-[#7A2333] mt-1">Founder, Dinezy</span>
          </div>
          <div className="flex flex-col items-center">
            <span
              className="font-serif text-xl text-[#111111]"
              style={{ fontFamily: 'var(--font-fraunces, serif)' }}
            >
              Omkar Upadhey
            </span>
            <span className="text-sm text-[#7A2333] mt-1">Founder, Dinezy</span>
          </div>
        </div>
      </div>
    </section>
  )
}