'use client'

import { useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { Navbar } from '@/components/dinezy-landing/Navbar'
import { Hero } from '@/components/dinezy-landing/Hero'
import { Problem } from '@/components/dinezy-landing/Problem'
import { ProductJourney } from '@/components/dinezy-landing/ProductJourney'
import { DigitalMenu } from '@/components/dinezy-landing/DigitalMenu'
import { AIAssistant } from '@/components/dinezy-landing/AIAssistant'
import { WhatsAppSection } from '@/components/dinezy-landing/WhatsAppSection'
import { Retention } from '@/components/dinezy-landing/Retention'
import { Loyalty } from '@/components/dinezy-landing/Loyalty'
import { Reviews } from '@/components/dinezy-landing/Reviews'
import { AnalyticsSection } from '@/components/dinezy-landing/AnalyticsSection'
import { Ecosystem } from '@/components/dinezy-landing/Ecosystem'
import { DashboardShowcase } from '@/components/dinezy-landing/DashboardShowcase'
import { Testimonials } from '@/components/dinezy-landing/Testimonials'
import { FinalCTA } from '@/components/dinezy-landing/FinalCTA'
import { Footer } from '@/components/dinezy-landing/Footer'
import { BookDemoModal } from '@/components/landing/BookDemoModal'

export default function DinezyLanding() {
  const [demoOpen, setDemoOpen] = useState(false)
  const openDemo = () => setDemoOpen(true)

  return (
    <MotionConfig reducedMotion="never">
      <main className="relative min-h-screen overflow-x-hidden bg-white font-sans antialiased">
        <Navbar onBookDemo={openDemo} />
        <Hero onBookDemo={openDemo} />
        <Problem />
        <ProductJourney />
        <DigitalMenu />
        <AIAssistant />
        <WhatsAppSection />
        <Retention />
        <Loyalty />
        <Reviews />
        <AnalyticsSection />
        <Ecosystem />
        <DashboardShowcase />
        <Testimonials />
        <FinalCTA onBookDemo={openDemo} />
        <Footer />
        <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      </main>
    </MotionConfig>
  )
}
