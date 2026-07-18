import type { SVGProps } from 'react'

/** Shared line-icon set — replaces emoji placeholders across the landing page.
 *  Single stroke weight, round joins, sized to inherit color via `currentColor`
 *  so every usage can be tinted with a text-* class. */

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export function QrIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="14.5" y="3.5" width="6" height="6" rx="1.2" />
      <rect x="3.5" y="14.5" width="6" height="6" rx="1.2" />
      <path d="M14.5 14.5h3v3h-3zM20.5 14.5v3M14.5 20.5h6" />
    </svg>
  )
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 3.2 1 4.6 2 5.5H4c1-.9 2-2.3 2-5.5Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}

export function ChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5h16v11H9l-4 3.5v-3.5H4Z" />
      <path d="M8 9.5h8M8 13h5" />
    </svg>
  )
}

export function HeartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20s-7-4.35-9.5-9C.8 7.2 2.6 4 6 4c2 0 3.3 1.1 4 2.2C10.7 5.1 12 4 14 4c3.4 0 5.2 3.2 3.5 7-2.5 4.65-5.5 9-5.5 9Z" />
    </svg>
  )
}

export function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="9" width="17" height="11" rx="1.2" />
      <path d="M3.5 12.5h17M12 9v11" />
      <path d="M12 9c-1.5 0-3.5-.7-3.5-2.6S10 4 12 6c2-2 3.5-.5 3.5.4S13.5 9 12 9Z" />
    </svg>
  )
}

export function TemplateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
      <path d="M3.5 9h17M8 13h8M8 16h5" />
    </svg>
  )
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 14.5 9l6 .8-4.4 4.1 1.1 6-5.2-2.9-5.2 2.9 1.1-6-4.4-4.1L9.5 9Z" />
    </svg>
  )
}

export function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 9a3 3 0 0 0 3 3 3 3 0 0 0-3 3 3 3 0 0 0-3-3 3 3 0 0 0 3-3Z" />
    </svg>
  )
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </svg>
  )
}

export function CoffeeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z" />
      <path d="M16 10.5h1.5a2.25 2.25 0 0 1 0 4.5H16" />
      <path d="M8 5.5c-.6.6-.6 1.2 0 1.8M11.5 5.5c-.6.6-.6 1.2 0 1.8" />
    </svg>
  )
}