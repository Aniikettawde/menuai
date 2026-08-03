'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'

const WHATSAPP_NUMBER = '917507002369'
const PREFILL_MESSAGE = "Hey Dinezy! 🎉 Send me today's best restaurant offers in Pune"

export function WhatsAppFloatingButton() {
  const [showTooltip, setShowTooltip] = useState(true)

  const handleClick = () => {
    const encodedMessage = encodeURIComponent(PREFILL_MESSAGE)
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2">
      {showTooltip && (
        <div className="relative hidden sm:flex items-center rounded-full bg-white px-4 py-2 shadow-lg border border-black/5 animate-in fade-in slide-in-from-right-2">
          <span className="text-[13px] font-medium text-[#211E1B] whitespace-nowrap">
            Get updated offers 🔥
          </span>
          <button
            onClick={() => setShowTooltip(false)}
            className="ml-2 text-[#A39C90] hover:text-[#211E1B] text-xs"
            aria-label="Dismiss tooltip"
          >
            ✕
          </button>
        </div>
      )}

      <button
        onClick={handleClick}
        aria-label="Get updated offers on WhatsApp"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
        <MessageCircle size={26} className="relative fill-white text-white" strokeWidth={0} />
      </button>
    </div>
  )
}