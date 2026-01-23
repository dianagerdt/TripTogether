'use client'

import { useMemo } from 'react'
import { Preference } from '@/types'

interface WishCloudProps {
  preferences: Preference[]
  onPreferenceClick?: (pref: Preference) => void
}

// Colors for different priorities
const PRIORITY_COLORS = [
  'bg-gray-100 text-gray-600 hover:bg-gray-200',     // 1
  'bg-blue-100 text-blue-700 hover:bg-blue-200',     // 2
  'bg-green-100 text-green-700 hover:bg-green-200',  // 3
  'bg-orange-100 text-orange-700 hover:bg-orange-200', // 4
  'bg-primary-100 text-primary-700 hover:bg-primary-200 ring-2 ring-primary-300', // 5
]

// Size classes based on priority
const PRIORITY_SIZES = [
  'text-xs px-2 py-1',     // 1
  'text-sm px-2 py-1',     // 2
  'text-sm px-3 py-1.5',   // 3
  'text-base px-3 py-1.5', // 4
  'text-lg px-4 py-2 font-semibold', // 5
]

export function WishCloud({ preferences, onPreferenceClick }: WishCloudProps) {
  // Group preferences by location and calculate total priority
  const cloudItems = useMemo(() => {
    const locationMap = new Map<string, { 
      label: string
      fullLabel: string
      priority: number
      count: number
      prefs: Preference[]
    }>()

    preferences.forEach((p) => {
      const key = p.location 
        ? `${p.location}, ${p.city}`
        : p.city
      
      const existing = locationMap.get(key)
      if (existing) {
        existing.priority = Math.max(existing.priority, p.priority)
        existing.count++
        existing.prefs.push(p)
      } else {
        locationMap.set(key, {
          label: p.location || p.city,
          fullLabel: key,
          priority: p.priority,
          count: 1,
          prefs: [p]
        })
      }
    })

    return Array.from(locationMap.values())
      .sort((a, b) => b.priority - a.priority)
  }, [preferences])

  if (preferences.length === 0) return null

  return (
    <div className="card mb-6 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">☁️</span>
        <h3 className="font-semibold text-gray-900">Облако пожеланий</h3>
        <span className="text-xs text-gray-400">({preferences.length} мест)</span>
      </div>
      
      <div className="flex flex-wrap gap-2 justify-center">
        {cloudItems.map((item, i) => (
          <button
            key={item.fullLabel}
            onClick={() => item.prefs[0] && onPreferenceClick?.(item.prefs[0])}
            className={`
              rounded-full transition-all duration-300 cursor-pointer
              hover:scale-110 hover:shadow-md
              animate-fade-in-up
              ${PRIORITY_COLORS[item.priority - 1]}
              ${PRIORITY_SIZES[item.priority - 1]}
            `}
            style={{ 
              animationDelay: `${i * 50}ms`,
              transform: `rotate(${(i % 5 - 2) * 2}deg)`
            }}
            title={`${item.fullLabel} (приоритет: ${item.priority}${item.count > 1 ? `, ${item.count} пожелания` : ''})`}
          >
            {item.label}
            {item.count > 1 && (
              <span className="ml-1 opacity-60">×{item.count}</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Legend */}
      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-200"></span>
          Низкий
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-200"></span>
          Средний
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-4 rounded-full bg-primary-200 ring-1 ring-primary-300"></span>
          Высокий
        </span>
      </div>
    </div>
  )
}
