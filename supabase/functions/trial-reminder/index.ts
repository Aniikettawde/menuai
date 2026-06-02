// supabase/functions/trial-reminder/index.ts
// Deploy: supabase functions deploy trial-reminder
// Schedule via Supabase cron: run daily at 9 AM IST (3:30 UTC)
//   SELECT cron.schedule('trial-reminder', '30 3 * * *', $$
//     SELECT net.http_post(
//       url := 'https://<project>.supabase.co/functions/v1/trial-reminder',
//       headers := '{"Authorization": "Bearer <anon_key>"}'::jsonb
//     );
//   $$);

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!  // or any email provider
const APP_URL = Deno.env.get('APP_URL') ?? 'https://menuai.vercel.app'

serve(async () => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Find trials ending in the next 24 hours, reminder not yet sent
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 1)

    const { data: subs, error } = await sb
      .from('subscriptions')
      .select('user_id, trial_end')
      .eq('plan', 'trial')
      .eq('trial_reminder_sent', false)
      .gte('trial_end', tomorrow.toISOString())
      .lt('trial_end', dayAfter.toISOString())

    if (error) throw error
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
    }

    let sent = 0

    for (const sub of subs) {
      // Get user email from auth
      const { data: { user } } = await sb.auth.admin.getUserById(sub.user_id)
      if (!user?.email) continue

      const trialEndDate = new Date(sub.trial_end).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric'
      })

      // Send via Resend (swap for any email provider)
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'MenuAI <noreply@menuai.app>',
          to: user.email,
          subject: '⏰ Your MenuAI trial ends tomorrow',
          html: buildEmail(user.email, trialEndDate, APP_URL),
        }),
      })

      if (emailRes.ok) {
        // Mark reminder sent
        await sb
          .from('subscriptions')
          .update({ trial_reminder_sent: true })
          .eq('user_id', sub.user_id)
        sent++
      }
    }

    return new Response(JSON.stringify({ sent }), { status: 200 })
  } catch (err) {
    console.error('trial-reminder error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

function buildEmail(email: string, trialEndDate: string, appUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Your MenuAI trial ends tomorrow</title>
</head>
<body style="background:#0a0a0a;color:#ffffff;font-family:-apple-system,sans-serif;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#141414;border:1px solid #27272a;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#f97316;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:20px;font-weight:700;color:#000;">Your trial ends tomorrow</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px 24px;">
      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:20px;">
        Hi there! Your 7-day free trial of MenuAI ends on <strong style="color:#fff;">${trialEndDate}</strong>.
      </p>

      <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:24px;">
        To keep your AI-powered menu live and your analytics running, activate your plan before the trial ends.
      </p>

      <!-- CTA -->
      <a href="${appUrl}/dashboard/billing"
        style="display:block;background:#f97316;color:#000;text-align:center;padding:14px 24px;border-radius:12px;font-weight:700;font-size:15px;text-decoration:none;margin-bottom:24px;">
        Activate for ₹999/month →
      </a>

      <!-- What you get -->
      <div style="background:#0a0a0a;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 12px;">
          What you keep with a paid plan
        </p>
        <ul style="margin:0;padding-left:16px;color:#a1a1aa;font-size:13px;line-height:1.8;">
          <li>Gemini AI chatbot for your customers</li>
          <li>Full analytics dashboard</li>
          <li>AI upsell engine</li>
          <li>Unlimited menu items</li>
          <li>QR code generator</li>
        </ul>
      </div>

      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;">
        If you have questions, reply to this email. We're happy to help.
      </p>
    </div>
  </div>
</body>
</html>
`
}
