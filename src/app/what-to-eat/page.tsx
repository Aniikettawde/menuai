import type { Metadata } from 'next'
import FoodAssistant from './FoodAssistant'

export const metadata: Metadata = {
  title: 'Dinezy AI — What Should I Eat?',
  description:
    'Tell Dinezy what you are craving and get sensible restaurant and dish recommendations from Dinezy menus and live web research.',
  alternates: {
    canonical: 'https://dinezy.in/what-to-eat',
  },
  openGraph: {
    title: 'Dinezy AI — What Should I Eat?',
    description: 'Tell Dinezy what you are craving. We’ll help you decide.',
    url: 'https://dinezy.in/what-to-eat',
    siteName: 'Dinezy',
    type: 'website',
  },
}

export default function WhatToEatPage() {
  return <FoodAssistant />
}
