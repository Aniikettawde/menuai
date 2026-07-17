// src/app/api/whatsapp/templates/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { listWhatsAppTemplates } from '@/lib/whatsapp';

export async function GET() {
  try {
    const templates = await listWhatsAppTemplates();

    // only show APPROVED templates — Meta will reject sends of pending/rejected ones anyway
    const approved = templates.filter((t: any) => t.status === 'APPROVED');

    // extract body text with {{n}} placeholder count, useful for the UI
    const shaped = approved.map((t: any) => {
      const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
      const bodyText = bodyComponent?.text || '';
      const placeholderCount = (bodyText.match(/\{\{\d+\}\}/g) || []).length;
      return {
        name: t.name,
        language: t.language,
        category: t.category,
        bodyText,
        placeholderCount,
      };
    });

    return NextResponse.json({ templates: shaped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch templates' }, { status: 500 });
  }
}