'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import type { MenuItem, MenuCategory } from '@/types'

interface TranslatePayloadItem {
  id: string
  type: 'item' | 'category'
  field: 'name' | 'description'
  text: string
}

const sessionCache = new Map<string, string>()

export function useTranslatedMenu(items: MenuItem[], categories: MenuCategory[]) {
  const language = useAppStore((s) => s.language ?? 'en')
  const restaurant = useAppStore((s) => s.restaurant)
  const setIsTranslating = useAppStore((s) => s.setIsTranslating)
  const [, forceRender] = useState(0)
  const inFlightRef = useRef<Set<string>>(new Set())

  const itemIds = useMemo(() => items.map((i) => i.id).join(','), [items])
  const categoryIds = useMemo(() => categories.map((c) => c.id).join(','), [categories])

  useEffect(() => {
    if (language === 'en' || !restaurant || items.length === 0) {
      setIsTranslating(false)
      return
    }

    const payload: TranslatePayloadItem[] = []
    for (const cat of categories) {
      const key = `${language}:${cat.id}:name`
      if (!sessionCache.has(key)) payload.push({ id: cat.id, type: 'category', field: 'name', text: cat.name })
    }
    for (const item of items) {
      const nameKey = `${language}:${item.id}:name`
      if (!sessionCache.has(nameKey)) payload.push({ id: item.id, type: 'item', field: 'name', text: item.name })
      if (item.description) {
        const descKey = `${language}:${item.id}:description`
        if (!sessionCache.has(descKey)) {
          payload.push({ id: item.id, type: 'item', field: 'description', text: item.description })
        }
      }
    }

    if (payload.length === 0) {
      setIsTranslating(false)
      return
    }

    const requestTag = `${language}:${itemIds}:${categoryIds}`
    if (inFlightRef.current.has(requestTag)) return // already loading, flag already true

    inFlightRef.current.add(requestTag)
    setIsTranslating(true)

    void fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, targetLang: language, items: payload }),
    })
      .then((r) => r.json())
      .then((data: { translations?: Record<string, string> }) => {
        if (!data.translations) return
        for (const [key, value] of Object.entries(data.translations)) {
          sessionCache.set(`${language}:${key}`, value)
        }
        forceRender((n) => n + 1)
      })
      .catch((err) => console.error('Menu translation failed:', err))
      .finally(() => {
        inFlightRef.current.delete(requestTag)
        if (inFlightRef.current.size === 0) setIsTranslating(false)
      })
  }, [language, restaurant, items, categories, itemIds, categoryIds, setIsTranslating])

  function translateItem(item: MenuItem): MenuItem {
    if (language === 'en') return item
    const name = sessionCache.get(`${language}:${item.id}:name`)
    const description = sessionCache.get(`${language}:${item.id}:description`)
    if (!name && !description) return item
    return { ...item, name: name ?? item.name, description: description ?? item.description }
  }

  function translateCategory(cat: MenuCategory): MenuCategory {
    if (language === 'en') return cat
    const name = sessionCache.get(`${language}:${cat.id}:name`)
    if (!name) return cat
    return { ...cat, name }
  }

  return { translateItem, translateCategory }
}