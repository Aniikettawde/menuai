// src/app/admin/whatsapp/page.tsx
import WhatsAppInbox from '@/components/whatsapp/WhatsAppInbox';

export default function WhatsAppAdminPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <WhatsAppInbox />
    </div>
  );
}