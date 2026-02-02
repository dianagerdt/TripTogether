'use client'

import { useEffect, useRef, useState } from 'react'
import { Preference } from '@/types'

interface YandexMapProps {
  preferences: Preference[]
  apiKey?: string
  center?: [number, number] // [latitude, longitude]
  zoom?: number
  height?: string
}

declare global {
  interface Window {
    ymaps: any
  }
}

export default function YandexMap({
  preferences,
  apiKey = '',
  center,
  zoom = 10,
  height = '600px'
}: YandexMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Yandex Maps script
  useEffect(() => {
    if (!apiKey) {
      setError('Yandex Maps API key не настроен')
      return
    }

    // Check if script already loaded
    if (window.ymaps) {
      window.ymaps.ready(() => setIsLoaded(true))
      return
    }

    const script = document.createElement('script')
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async = true
    script.onload = () => {
      if (window.ymaps) {
        window.ymaps.ready(() => setIsLoaded(true))
      }
    }
    script.onerror = () => {
      setError('Не удалось загрузить Яндекс Карты')
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector(`script[src*="api-maps.yandex.ru"]`)
      if (existingScript) {
        existingScript.remove()
      }
    }
  }, [apiKey])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !window.ymaps || mapInstance) return

    window.ymaps.ready(() => {
      try {
        // Calculate center if not provided
        let mapCenter: [number, number] = center || [55.751244, 37.618423] // Moscow default
        
        if (!center && preferences.length > 0) {
          const coords = preferences
            .filter(p => p.latitude && p.longitude)
            .map(p => [p.latitude!, p.longitude!])
          
          if (coords.length > 0) {
            // Calculate average center
            const avgLat = coords.reduce((sum, [lat]) => sum + lat, 0) / coords.length
            const avgLon = coords.reduce((sum, [, lon]) => sum + lon, 0) / coords.length
            mapCenter = [avgLat, avgLon]
          }
        }

        const map = new window.ymaps.Map(mapRef.current, {
          center: mapCenter,
          zoom: zoom,
          controls: ['zoomControl', 'fullscreenControl', 'typeSelector']
        })

        setMapInstance(map)

        // Add markers for preferences with coordinates
        preferences
          .filter(p => p.latitude && p.longitude)
          .forEach((pref) => {
            const placeTypeEmoji: Record<string, string> = {
              museum: '🏛️',
              park: '🌳',
              viewpoint: '👁️',
              food: '🍽️',
              activity: '🎯',
              district: '🏘️',
              other: '📍'
            }

            const emoji = placeTypeEmoji[pref.place_type] || '📍'
            const priorityColors: Record<number, string> = {
              5: '#ef4444', // red
              4: '#f97316', // orange
              3: '#eab308', // yellow
              2: '#84cc16', // green
              1: '#22c55e'  // emerald
            }
            const color = priorityColors[pref.priority] || '#3b82f6'

            const balloonContent = `
              <div style="padding: 8px; font-family: Arial, sans-serif;">
                <div style="font-weight: bold; margin-bottom: 4px;">
                  ${emoji} ${pref.location || pref.city}
                </div>
                <div style="color: #666; font-size: 12px; margin-bottom: 4px;">
                  ${pref.city}, ${pref.country}
                </div>
                ${pref.comment ? `<div style="color: #888; font-size: 11px; margin-top: 4px;">${pref.comment}</div>` : ''}
                <div style="color: #999; font-size: 10px; margin-top: 4px;">
                  Приоритет: ${pref.priority}/5 | ${pref.username}
                </div>
              </div>
            `

            const placemark = new window.ymaps.Placemark(
              [pref.latitude!, pref.longitude!],
              {
                balloonContent: balloonContent,
                hintContent: `${pref.location || pref.city}, ${pref.city}`
              },
              {
                preset: 'islands#circleIcon',
                iconColor: color,
                iconImageSize: [32, 32],
                iconImageOffset: [-16, -16]
              }
            )

            map.geoObjects.add(placemark)
          })

        // Auto-fit bounds if we have markers
        const markers = preferences.filter(p => p.latitude && p.longitude)
        if (markers.length > 0 && !center) {
          const bounds = markers.map(p => [p.latitude!, p.longitude!] as [number, number])
          map.setBounds(bounds, {
            checkZoomRange: true,
            duration: 300
          })
        }

      } catch (err: any) {
        console.error('Map initialization error:', err)
        setError(`Ошибка инициализации карты: ${err.message}`)
      }
    })
  }, [isLoaded, preferences, center, zoom, mapInstance])

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg border border-gray-200">
        <div className="text-center text-gray-600">
          <p className="text-lg font-semibold mb-2">⚠️</p>
          <p>{error}</p>
          {!apiKey && (
            <p className="text-sm text-gray-500 mt-2">
              Настройте YANDEX_API_KEY в переменных окружения
            </p>
          )}
        </div>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg border border-gray-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка карты...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <div ref={mapRef} style={{ width: '100%', height: height }} />
      {preferences.filter(p => p.latitude && p.longitude).length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 pointer-events-none">
          <div className="text-center text-gray-500">
            <p className="text-lg font-semibold mb-2">📍</p>
            <p>Нет мест с координатами для отображения</p>
            <p className="text-sm mt-2">Добавьте пожелания, и они появятся на карте</p>
          </div>
        </div>
      )}
    </div>
  )
}
