'use client'

import { useState } from 'react'
import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { TrustedBy } from '@/components/landing/TrustedBy'
import { WhyDinezy } from '@/components/landing/WhyDinezy'
import { ProductDemo } from '@/components/landing/ProductDemo'
import { Features } from '@/components/landing/Features'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { WhatsAppSection } from '@/components/landing/WhatsAppSection'
import { Analytics } from '@/components/landing/Analytics'
import { Testimonials } from '@/components/landing/Testimonials'
import { Pricing } from '@/components/landing/Pricing'
import { FAQ } from '@/components/landing/FAQ'
import { FinalCTA } from '@/components/landing/FinalCTA'
import { Footer } from '@/components/landing/Footer'
import { BookDemoModal } from '@/components/landing/BookDemoModal'

export default function DinezyLanding() {
  const [demoOpen, setDemoOpen] = useState(false)
  const openDemo = () => setDemoOpen(true)

  return (
    <main className="min-h-screen overflow-x-hidden bg-white">
      <Navbar onBookDemo={openDemo} />
      <Hero onBookDemo={openDemo} />
      <WhyDinezy />
      <ProductDemo />
      <Features />
      <HowItWorks />
      <WhatsAppSection />
      <Analytics />
      <Pricing />
      <FAQ />
      <FinalCTA onBookDemo={openDemo} />
      <Footer />
      <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </main>
  )
}
