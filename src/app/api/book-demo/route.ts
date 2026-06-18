import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Simple in-memory store — replace with your DB (Supabase, Prisma, etc.) in production
const bookings: BookingEntry[] = []

interface BookingEntry {
  id: string
  name: string
  brand: string
  email: string
  phone: string
  city: string
  createdAt: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, brand, email, phone, city } = body

    // Basic server-side validation
    if (!name || !brand || !email || !phone || !city) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    // Save booking
    const booking: BookingEntry = {
      id: crypto.randomUUID(),
      name: name.trim(),
      brand: brand.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      city: city.trim(),
      createdAt: new Date().toISOString(),
    }
    bookings.push(booking)

    const formattedDate = new Date(booking.createdAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'full',
      timeStyle: 'short',
    })

    // 1. Notify you (owner) immediately
    await resend.emails.send({
      from: 'Dinezy Demos <noreply@dinezy.in>',
      to: 'dinezyofficial@gmail.com',
      subject: `🔔 New demo request — ${brand} (${city})`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#050816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050816;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#d946ef);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Dinezy</p>
                    <h1 style="margin:8px 0 0;color:#fff;font-size:22px;font-weight:800;">New Demo Request 🎉</h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="background:#080f1e;border:1px solid rgba(255,255,255,0.08);border-top:0;border-radius:0 0 16px 16px;padding:32px;">
                    
                    <p style="margin:0 0 24px;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.6;">
                      Someone just booked a demo on <strong style="color:#fff;">dinezy.in</strong>. Here are their details:
                    </p>
                    
                    <!-- Details card -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:12px;overflow:hidden;">
                      ${[
                        ['👤 Name', booking.name],
                        ['🏪 Restaurant / Brand', booking.brand],
                        ['📧 Email', booking.email],
                        ['📱 Phone', booking.phone],
                        ['🏙️ City', booking.city],
                        ['🕐 Submitted at', formattedDate],
                      ].map(([label, value], idx) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
                          <td style="padding:12px 16px;color:rgba(255,255,255,0.4);font-size:12px;font-weight:600;white-space:nowrap;width:40%;">${label}</td>
                          <td style="padding:12px 16px;color:#fff;font-size:14px;font-weight:600;">${value}</td>
                        </tr>
                      `).join('')}
                    </table>
                    
                    <!-- CTA -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                      <tr>
                        <td align="center">
                          <a href="mailto:${booking.email}?subject=Your Dinezy Demo — Let's schedule it!&body=Hi ${encodeURIComponent(booking.name)},%0A%0AThanks for your interest in Dinezy! I'd love to walk you through the platform.%0A%0AWhen works best for a 30-minute demo this week?%0A%0ABest,%0ATeam Dinezy"
                            style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#d946ef);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">
                            Reply to ${booking.name} →
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin:20px 0 0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">
                      This is an automated notification from Dinezy. Booking ID: ${booking.id}
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    // 2. Send confirmation to the person who booked
    await resend.emails.send({
      from: 'Dinezy <noreply@dinezy.in>',
      to: booking.email,
      subject: `Your Dinezy demo is booked, ${booking.name.split(' ')[0]}! 🎉`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#050816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050816;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
                
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#7c3aed,#d946ef);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">Dinezy</p>
                    <h1 style="margin:8px 0 4px;color:#fff;font-size:26px;font-weight:800;">You're all set! 🚀</h1>
                    <p style="margin:0;color:rgba(255,255,255,0.7);font-size:14px;">We'll reach out within 2 hours to schedule your live demo.</p>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="background:#080f1e;border:1px solid rgba(255,255,255,0.08);border-top:0;border-radius:0 0 16px 16px;padding:32px;">
                    
                    <p style="margin:0 0 20px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.7;">
                      Hi <strong style="color:#fff;">${booking.name.split(' ')[0]}</strong>,
                    </p>
                    <p style="margin:0 0 20px;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;">
                      Thanks for your interest in Dinezy! We've received your demo request for <strong style="color:#fff;">${booking.brand}</strong> in ${booking.city}.
                      Our team will reach out to <strong style="color:#a78bfa;">${booking.email}</strong> shortly to schedule a 30-minute live walkthrough.
                    </p>
                    
                    <!-- What to expect -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.2);border-radius:12px;padding:20px;margin-bottom:24px;">
                      <tr><td>
                        <p style="margin:0 0 14px;color:#a78bfa;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">What happens next</p>
                        ${[
                          ['📞', 'We call or WhatsApp you within 2 hours'],
                          ['🗓️', 'Schedule a 30-min live demo at your convenience'],
                          ['🍽️', "We set up your restaurant's menu live on the call"],
                          ['🚀', '7-day free trial starts right after — no card needed'],
                        ].map(([icon, text]) => `
                          <p style="margin:0 0 10px;color:rgba(255,255,255,0.7);font-size:14px;">
                            <span style="margin-right:8px;">${icon}</span>${text}
                          </p>
                        `).join('')}
                      </td></tr>
                    </table>
                    
                    <p style="margin:0 0 24px;color:rgba(255,255,255,0.4);font-size:13px;line-height:1.6;">
                      In the meantime, feel free to WhatsApp us at 
                      <a href="https://wa.me/918605123549" style="color:#a78bfa;text-decoration:none;">+91 86051 23549</a> 
                      if you have any questions.
                    </p>
                    
                    <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">
                      Cheers,<br/>
                      <strong style="color:#fff;">Team Dinezy</strong><br/>
                      <span style="color:rgba(255,255,255,0.3);font-size:12px;">AI-powered QR menus for modern restaurants</span>
                    </p>
                    
                    <hr style="border:0;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;" />
                    <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;text-align:center;">
                      Dinezy · Balewadi, Pune 411045 · 
                      <a href="https://dinezy.in" style="color:rgba(255,255,255,0.3);text-decoration:none;">dinezy.in</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    })

    return NextResponse.json({ success: true, id: booking.id })

  } catch (err) {
    console.error('[demo-booking] error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// Optional: GET endpoint to list all bookings (protect this in production!)
export async function GET() {
  return NextResponse.json({ bookings, total: bookings.length })
}