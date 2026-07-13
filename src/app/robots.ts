import { MetadataRoute } from 'next'
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/admin/', '/products/'],
      },
    ],
    sitemap: 'https://dinezy.in/sitemap.xml',
  }
}