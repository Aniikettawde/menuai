import type { Metadata } from 'next'
import FoodCostCalculator from './FoodCostCalculator'
import './food-cost-calculator.css'

export const metadata: Metadata = {
  title: 'Free Restaurant Food Cost Calculator | Dinezy',
  description:
    'Calculate recipe cost, cost per portion, food cost percentage, gross profit, channel net profit and suggested menu prices for your restaurant. Free, no signup.',
  alternates: { canonical: 'https://dinezy.in/food-cost-calculator' },
  openGraph: {
    title: 'Free Restaurant Food Cost Calculator | Dinezy',
    description:
      'Free restaurant food cost calculator for recipe costing, food cost %, profit, delivery commissions, GST and what-if ingredient price changes.',
    url: 'https://dinezy.in/food-cost-calculator',
    siteName: 'Dinezy',
    type: 'website',
  },
}

const faq = [
  {
    question: 'What is food cost percentage?',
    answer: 'Food cost percentage is cost per portion divided by the selling price excluding GST, multiplied by 100. A lower percentage leaves more room for labour, rent, commissions and other operating costs.',
  },
  {
    question: 'Does the calculator account for ingredient yield?',
    answer: 'Yes. Purchase price is converted to a base unit and adjusted by the ingredient yield percentage before recipe quantity is costed. This lets an ingredient such as trimmed chicken or peeled onions reflect usable cost rather than only purchase cost.',
  },
  {
    question: 'Can I compare Zomato and Swiggy pricing?',
    answer: 'Yes. Their commission and deduction assumptions are editable, so you can model your own commercial terms instead of relying on one universal rate.',
  },
  {
    question: 'Is the GST calculation tax advice?',
    answer: 'No. The calculator is a management-planning tool. Restaurant GST treatment can vary by outlet and circumstances, so confirm your actual tax treatment with your tax professional.',
  },
]

export default function FoodCostCalculatorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Dinezy Restaurant Food Cost Calculator',
    url: 'https://dinezy.in/food-cost-calculator',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <FoodCostCalculator />
      <section className="fcr-seo-section" aria-labelledby="fcr-faq-title">
        <div className="fcr-container fcr-narrow">
          <p className="fcr-eyebrow">Restaurant costing guide</p>
          <h2 id="fcr-faq-title">Food cost calculator for restaurants in India</h2>
          <p>
            Build recipe-level costing using real purchase packs, usable yield, actual recipe quantities, packaging and channel-level costs. The calculator keeps ingredient purchase cost in the recipe cost and uses the ex-GST selling price when it computes food cost percentage and margin.
          </p>
          <div className="fcr-faq-grid">
            {faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
