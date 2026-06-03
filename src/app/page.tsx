'use client'

import ClientEffects from '../components/ClientEffects'
import LandingNavbar from '@/components/LandingNavbar'

export default function Home() {
  return (
    <>
      <ClientEffects />
      <LandingNavbar />

      <main id="top" className="relative z-10 pt-20">
        {/* HERO */}
        <section className="hero">
          <div className="hero-grid" />

          <div className="hero-eyebrow">
            <span className="dot" />
            AI-Powered Restaurant Intelligence
          </div>

          <h1>
            Your menu,
            <br />
            <em>reimagined</em> with AI
          </h1>

          <p className="hero-sub">
            Give your guests a smart, conversational menu experience. Let AI upsell for you — and get
            deep analytics on every interaction.
          </p>

          <div className="hero-actions">
            <a href="#cta" className="btn-primary">
              Get Your QR Code
            </a>
            <a href="#how" className="btn-ghost">
              See How It Works
            </a>
          </div>

          <div className="hero-visual">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div className="phone-frame">
                <div className="phone-notch" />
                <div className="phone-screen">
                  <div className="phone-header">
                    <span className="phone-logo">
                      <span className="gold">Menu</span>AI
                    </span>
                    <span className="phone-badge">✦ AI-Active</span>
                  </div>

                  <div className="menu-items">
                    <div className="menu-item">
                      <div className="menu-item-img">🍛</div>
                      <div className="menu-item-info">
                        <div className="menu-item-name">Butter Chicken</div>
                        <div className="menu-item-price">₹320</div>
                      </div>
                      <div className="menu-item-type dot-nonveg" />
                    </div>

                    <div className="menu-item">
                      <div className="menu-item-img">🧆</div>
                      <div className="menu-item-info">
                        <div className="menu-item-name">Paneer Tikka</div>
                        <div className="menu-item-price">₹280</div>
                      </div>
                      <div className="menu-item-type dot-veg" />
                    </div>

                    <div className="menu-item">
                      <div className="menu-item-img">🍞</div>
                      <div className="menu-item-info">
                        <div className="menu-item-name">Garlic Naan</div>
                        <div className="menu-item-price">₹60</div>
                      </div>
                      <div className="menu-item-type dot-veg" />
                    </div>
                  </div>

                  <div className="ai-bubble">
                    <div className="ai-bubble-label">✦ AI Suggestion</div>
                    <div className="ai-bubble-text">
                      The <strong style={{ color: 'var(--gold)' }}>Dal Makhani</strong> pairs perfectly
                      with Butter Chicken — guests who order both rate it 4.9★
                    </div>
                  </div>
                </div>
              </div>

              <div className="float-card">
                <div className="float-card-title">Top Searches</div>
                <div className="float-stat">
                  <div className="float-stat-label">Biryani</div>
                  <div className="float-stat-bar">
                    <div className="float-stat-fill" style={{ width: '85%' }} />
                  </div>
                </div>
                <div className="float-stat">
                  <div className="float-stat-label">Paneer</div>
                  <div className="float-stat-bar">
                    <div className="float-stat-fill" style={{ width: '62%' }} />
                  </div>
                </div>
                <div className="float-stat">
                  <div className="float-stat-label">Desserts</div>
                  <div className="float-stat-bar">
                    <div className="float-stat-fill" style={{ width: '41%' }} />
                  </div>
                </div>
              </div>

              <div className="float-qr">
                <div className="qr-grid">
                  {[
                    1, 1, 1, 0, 1, 0,
                    1, 0, 1, 1, 0, 1,
                    1, 1, 1, 0, 1, 1,
                    0, 1, 0, 1, 1, 0,
                    1, 0, 1, 0, 1, 1,
                    1, 1, 0, 1, 0, 1,
                  ].map((dark, i) => (
                    <div
                      key={i}
                      className={`qr-cell ${dark ? 'qr-dark' : 'qr-light'}`}
                    />
                  ))}
                </div>
                <div className="float-qr-label">Scan to explore</div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="scroll-mt-28">
          <div className="reveal">
            <div className="section-eyebrow">The Process</div>
            <h2 className="section-h2">
              Three steps to
              <br />
              <em>smarter dining</em>
            </h2>
          </div>

          <div className="steps reveal reveal-delay-1">
            <div className="step">
              <div className="step-line" />
              <div className="step-num">01 /</div>
              <div className="step-icon">📲</div>
              <h3>We give you a QR</h3>
              <p>
                Each table gets a unique QR code. Print it, stick it, and your smart menu goes live
                instantly — no app download needed for guests.
              </p>
            </div>

            <div className="step">
              <div className="step-line" />
              <div className="step-num">02 /</div>
              <div className="step-icon">🤖</div>
              <h3>AI meets your guests</h3>
              <p>
                Guests browse your full menu and chat with the AI — asking questions, discovering
                pairings, and getting personalised recommendations in real time.
              </p>
            </div>

            <div className="step">
              <div className="step-line" />
              <div className="step-num">03 /</div>
              <div className="step-icon">📊</div>
              <h3>You get the insights</h3>
              <p>
                Every search, every suggestion, every accepted upsell flows into your analytics
                dashboard — so you know exactly what&apos;s working and what&apos;s not.
              </p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="scroll-mt-28">
          <div className="reveal">
            <div className="section-eyebrow">Features</div>
            <h2 className="section-h2">
              Everything a restaurant
              <br />
              <em>actually needs</em>
            </h2>
          </div>

          <div className="features-grid">
            <div className="feat-card tall gold-glow reveal">
              <span className="feat-tag">✦ AI Chatbot</span>
              <h3>Conversational menu that upsells naturally</h3>
              <p>
                The AI knows your entire menu, its pairings, ingredients, and which add-ons other
                guests loved. It nudges at the right moment — without being pushy.
              </p>

              <div className="chat-preview">
                <div className="chat-msg chat-user">What&apos;s good here? I like spicy food</div>
                <div className="chat-msg chat-ai">
                  <strong>Lal Maas</strong> is our spiciest dish — slow-cooked Rajasthani lamb.
                  Guests who order it almost always add a <strong>Missi Roti</strong> (₹55) to soak
                  up the sauce 🌶️
                </div>
                <div className="chat-msg chat-user">What about something vegetarian?</div>
                <div className="chat-msg chat-ai">
                  Try the <strong>Achari Paneer</strong> — tangy, spicy, and our most re-ordered veg
                  dish this week. Add a <strong>Mango Lassi</strong> to balance the heat?
                </div>
                <div
                  className="chat-msg chat-ai"
                  style={{ background: 'var(--card-2)', borderColor: 'var(--border)' }}
                >
                  <div className="typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>

            <div className="feat-card reveal reveal-delay-1">
              <span className="feat-tag">📊 Analytics</span>
              <h3>Know what every guest searched for</h3>
              <p>
                Real-time dashboard tracks every interaction — searches, views, upsell accepts, and
                order patterns.
              </p>

              <div className="analytics-preview">
                <div className="anal-row">
                  <span className="anal-label">Butter Chicken</span>
                  <div className="anal-bar">
                    <div className="anal-fill fill-gold" style={{ width: '88%' }} />
                  </div>
                  <span className="anal-val">88%</span>
                </div>
                <div className="anal-row">
                  <span className="anal-label">Biryani</span>
                  <div className="anal-bar">
                    <div className="anal-fill fill-gold" style={{ width: '74%' }} />
                  </div>
                  <span className="anal-val">74%</span>
                </div>
                <div className="anal-row">
                  <span className="anal-label">Paneer dishes</span>
                  <div className="anal-bar">
                    <div className="anal-fill fill-green" style={{ width: '61%' }} />
                  </div>
                  <span className="anal-val">61%</span>
                </div>
                <div className="anal-row">
                  <span className="anal-label">Desserts</span>
                  <div className="anal-bar">
                    <div className="anal-fill fill-blue" style={{ width: '39%' }} />
                  </div>
                  <span className="anal-val">39%</span>
                </div>

                <div className="insight-card">
                  <div className="insight-head">
                    <div className="insight-dot" />
                    <span className="insight-label">AI Insight</span>
                  </div>
                  <div className="insight-text">
                    Guests who search &quot;spicy&quot; are 3× more likely to order Lal Maas.
                    Consider featuring it during dinner hours.
                  </div>
                </div>
              </div>
            </div>

            <div className="feat-card reveal reveal-delay-2">
              <span className="feat-tag">💰 Upsell Tracking</span>
              <h3>See which AI suggestions guests actually accepted</h3>

              <div className="upsell-items">
                {[
                  { emoji: '🥗', name: 'Dal Makhani add-on', stat: 'Suggested 340 times this month', rate: '67%' },
                  { emoji: '🥭', name: 'Mango Lassi pairing', stat: 'Suggested 218 times this month', rate: '54%' },
                  { emoji: '🍞', name: 'Garlic Naan upgrade', stat: 'Suggested 189 times this month', rate: '48%' },
                ].map((item) => (
                  <div className="upsell-item" key={item.name}>
                    <div className="upsell-emoji">{item.emoji}</div>
                    <div className="upsell-info">
                      <div className="upsell-name">{item.name}</div>
                      <div className="upsell-stat">{item.stat}</div>
                    </div>
                    <div className="upsell-rate">{item.rate}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* METRICS */}
        <section id="metrics" className="scroll-mt-28">
          <div className="reveal">
            <div className="section-eyebrow">Impact</div>
            <h2 className="section-h2">
              Numbers that
              <br />
              <em>speak for themselves</em>
            </h2>
          </div>

          <div className="metrics-grid reveal reveal-delay-1">
            {[
              { num: '23%', label: 'Average uplift in order value' },
              { num: '4.8★', label: 'Average guest satisfaction' },
              { num: '3s', label: 'AI response time' },
              { num: '100%', label: 'Menu interaction tracked' },
            ].map((m) => (
              <div className="metric-card" key={m.label}>
                <div className="metric-num gold">{m.num}</div>
                <div className="metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="cta" className="scroll-mt-28">
          <div className="cta-inner reveal">
            <h2>
              Ready to make your menu
              <br />
              <em>work harder?</em>
            </h2>
            <p>
              Get your restaurant&apos;s QR code set up in minutes. No hardware. No app downloads.
              Just results.
            </p>

            <div className="cta-actions">
              <a href="#" className="btn-primary">
                Get Started — It&apos;s Free
              </a>
              <a href="#" className="btn-ghost">
                Book a Demo
              </a>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer>
          <div className="footer-logo">
            <span className="gold">Menu</span>AI
          </div>
          <div className="footer-copy">© 2025 MenuAI. All rights reserved.</div>
        </footer>
      </main>
    </>
  )
}