'use client'

import React, { useState, useRef, useEffect } from 'react'
import type { ChangeEvent, FormEvent, MouseEvent, FocusEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getTrip, deleteTrip, leaveTrip } from '@/lib/trips'
import { getPreferences, createPreference, updatePreference, deletePreference, PLACE_TYPE_LABELS, PLACE_TYPES, getTripReactions, addReaction, removeReaction, AVAILABLE_EMOJIS, PreferenceReactions, ReactionData } from '@/lib/preferences'
import { getAllCountries, getCitiesForCountry, searchCities } from '@/lib/cities'
import { getRoutes, generateRoutes } from '@/lib/routes'
import api from '@/lib/api'
import { Trip, Participant, Preference, PlaceType, CreatePreferenceData, RouteOption } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, TripDetailSkeleton, PreferencesListSkeleton, RoutesListSkeleton } from '@/components/ui'
import { GenerationProgress } from '@/components/ui/GenerationProgress'
import { WishCloud } from '@/components/ui/WishCloud'
import { getErrorMessage } from '@/lib/errors'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
// @ts-ignore - react-markdown types
import ReactMarkdown from 'react-markdown'

// Helper: Parse inline Markdown (bold, italic, etc.)
function parseInlineMarkdown(text: string): any {
  if (!text) return null
  
  const parts: any[] = []
  let key = 0
  
  // Simple regex for **bold** and *italic*
  const boldRegex = /\*\*(.+?)\*\*/g
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
  
  let lastIndex = 0
  let match
  
  // Find all bold matches first
  const boldMatches: Array<{ start: number; end: number; content: string }> = []
  while ((match = boldRegex.exec(text)) !== null) {
    boldMatches.push({ start: match.index, end: match.index + match[0].length, content: match[1] })
  }
  
  // Find italic matches (not part of bold)
  const italicMatches: Array<{ start: number; end: number; content: string }> = []
  while ((match = italicRegex.exec(text)) !== null) {
    const isPartOfBold = boldMatches.some(m => m.start <= match!.index && m.end >= match!.index + match![0].length)
    if (!isPartOfBold) {
      italicMatches.push({ start: match.index, end: match.index + match[0].length, content: match[1] })
    }
  }
  
  // Combine and sort all matches
  const allMatches = [
    ...boldMatches.map(m => ({ ...m, type: 'bold' as const })),
    ...italicMatches.map(m => ({ ...m, type: 'italic' as const }))
  ].sort((a, b) => a.start - b.start)
  
  // Build parts
  for (const m of allMatches) {
    if (m.start > lastIndex) {
      parts.push(text.substring(lastIndex, m.start))
    }
    if (m.type === 'bold') {
      parts.push(<strong key={key++}>{m.content}</strong>)
    } else {
      parts.push(<em key={key++}>{m.content}</em>)
    }
    lastIndex = m.end
  }
  
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? <>{parts}</> : text
}

// Helper: Render Markdown text as JSX
function renderMarkdown(text: string): any {
  if (!text) return null
  
  const lines = text.split('\n')
  const elements: any[] = []
  let key = 0
  let inList = false
  let listItems: any[] = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (!trimmed) {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
        listItems = []
        inList = false
      }
      if (i < lines.length - 1) {
        elements.push(<br key={key++} />)
      }
      continue
    }
    
    // Headers
    if (trimmed.startsWith('### ')) {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
        listItems = []
        inList = false
      }
      elements.push(<h3 key={key++} className="text-base font-semibold mt-3 mb-2">{parseInlineMarkdown(trimmed.slice(4))}</h3>)
      continue
    }
    if (trimmed.startsWith('## ')) {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
        listItems = []
        inList = false
      }
      elements.push(<h2 key={key++} className="text-lg font-semibold mt-4 mb-2">{parseInlineMarkdown(trimmed.slice(3))}</h2>)
      continue
    }
    if (trimmed.startsWith('# ')) {
      if (inList && listItems.length > 0) {
        elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
        listItems = []
        inList = false
      }
      elements.push(<h1 key={key++} className="text-xl font-bold mt-4 mb-2">{parseInlineMarkdown(trimmed.slice(2))}</h1>)
      continue
    }
    
    // Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        inList = true
        listItems = []
      }
      listItems.push(<li key={key++} className="mb-1">{parseInlineMarkdown(trimmed.slice(2))}</li>)
      continue
    }
    
    if (inList && listItems.length > 0) {
      elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
      listItems = []
      inList = false
    }
    
    // Regular paragraph - preserve whitespace for formatting
    elements.push(<p key={key++} className="mb-2 whitespace-pre-wrap">{parseInlineMarkdown(line)}</p>)
  }
  
  if (inList && listItems.length > 0) {
    elements.push(<ul key={key++} className="ml-6 mb-2 list-disc">{listItems}</ul>)
  }
  
  return elements.length > 0 ? <>{elements}</> : <p className="mb-2">{text}</p>
}

// Helper: What's next hints
function getNextStepHint(
  preferencesCount: number, 
  routesCount: number, 
  participantsCount: number,
  hasVoted: boolean
): { text: string; action?: string; icon: string } | null {
  if (participantsCount <= 1) {
    return { text: 'Пригласите друзей, чтобы вместе спланировать поездку', action: 'invite', icon: '👥' }
  }
  if (preferencesCount === 0) {
    return { text: 'Добавьте места, которые хотите посетить', action: 'add_preference', icon: '📍' }
  }
  if (preferencesCount < 3) {
    return { text: 'Добавьте ещё пожелания для лучшего маршрута', action: 'add_preference', icon: '💡' }
  }
  if (routesCount === 0) {
    return { text: 'Сгенерируйте AI-маршруты на основе пожеланий', action: 'generate', icon: '🤖' }
  }
  if (!hasVoted && routesCount > 0) {
    return { text: 'Проголосуйте за понравившийся маршрут', action: 'vote', icon: '🗳️' }
  }
  return null
}

function AddPreferenceModal({
  isOpen,
  onClose,
  tripId,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  tripId: number
  onSuccess: () => void
}) {
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [placeType, setPlaceType] = useState<PlaceType>('viewpoint')
  const [priority, setPriority] = useState(3)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false)
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cityInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const countrySuggestions = country ? getAllCountries().filter(c => c.toLowerCase().includes(country.toLowerCase())).slice(0, 8) : []
  const citySuggestions = city && country ? getCitiesForCountry(country).filter(c => c.toLowerCase().includes(city.toLowerCase())).slice(0, 8) : 
                         city ? searchCities(city).slice(0, 8) : []

  // Autofocus on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset city when country changes
  useEffect(() => {
    if (country) {
      setCity('')
    }
  }, [country])

  const mutation = useMutation({
    mutationFn: (data: CreatePreferenceData) => createPreference(tripId, data),
    onSuccess: () => {
      showToast('Пожелание добавлено! 📍', 'success')
      onSuccess()
      onClose()
      setCountry('')
      setCity('')
      setLocation('')
      setPlaceType('viewpoint')
      setPriority(3)
      setComment('')
      setError('')
    },
    onError: (err: any) => {
      setError(getErrorMessage(err, 'Ошибка'))
    }
  })

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Добавить пожелание</h2>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); mutation.mutate({ country, city, location: location || undefined, place_type: placeType, priority, comment: comment || undefined }) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Страна *</label>
              <input 
                ref={inputRef} 
                type="text" 
                value={country} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setCountry(e.target.value); setShowCountrySuggestions(true) }}
                onFocus={() => setShowCountrySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 300)}
                className="input" 
                placeholder="Италия" 
                required 
              />
              {showCountrySuggestions && countrySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {countrySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setCountry(suggestion); setShowCountrySuggestions(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Город *</label>
              <input 
                ref={cityInputRef}
                type="text" 
                value={city} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setCity(e.target.value); setShowCitySuggestions(true) }}
                onFocus={() => setShowCitySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 300)}
                className="input" 
                placeholder="Рим" 
                required 
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setCity(suggestion); setShowCitySuggestions(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Место (опционально)</label>
            <input type="text" value={location} onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} className="input" placeholder="Колизей" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select value={placeType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPlaceType(e.target.value as PlaceType)} className="input">
              {PLACE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет: {priority}</label>
            <input type="range" min="1" max="5" value={priority} onChange={(e: ChangeEvent<HTMLInputElement>) => setPriority(Number(e.target.value))} className="w-full accent-primary-600" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Низкий</span>
              <span>Высокий</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)} className="input min-h-[60px]" placeholder="Почему хочу посетить..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Отмена</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {mutation.isPending ? 'Добавляем...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditPreferenceModal({
  isOpen,
  onClose,
  tripId,
  preference,
  onSuccess,
}: {
  isOpen: boolean
  onClose: () => void
  tripId: number
  preference: Preference | null
  onSuccess: () => void
}) {
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [location, setLocation] = useState('')
  const [placeType, setPlaceType] = useState<PlaceType>('viewpoint')
  const [priority, setPriority] = useState(3)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false)
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cityInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const countrySuggestions = country ? getAllCountries().filter(c => c.toLowerCase().includes(country.toLowerCase())).slice(0, 8) : []
  const citySuggestions = city && country ? getCitiesForCountry(country).filter(c => c.toLowerCase().includes(city.toLowerCase())).slice(0, 8) : 
                         city ? searchCities(city).slice(0, 8) : []

  // Load preference data when modal opens
  useEffect(() => {
    if (isOpen && preference) {
      setCountry(preference.country)
      setCity(preference.city)
      setLocation(preference.location || '')
      setPlaceType(preference.place_type)
      setPriority(preference.priority)
      setComment(preference.comment || '')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, preference])

  // Reset city when country changes
  useEffect(() => {
    if (country && preference && country !== preference.country) {
      setCity('')
    }
  }, [country, preference])

  const mutation = useMutation({
    mutationFn: (data: Partial<CreatePreferenceData>) => updatePreference(tripId, preference!.id, data),
    onSuccess: () => {
      showToast('Пожелание обновлено! ✏️', 'success')
      onSuccess()
      onClose()
    },
    onError: (err: any) => {
      setError(getErrorMessage(err, 'Ошибка'))
    }
  })

  if (!isOpen || !preference) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Редактировать пожелание</h2>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <form onSubmit={(e: FormEvent<HTMLFormElement>) => { 
          e.preventDefault(); 
          mutation.mutate({ country, city, location: location || undefined, place_type: placeType, priority, comment: comment || undefined }) 
        }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Страна *</label>
              <input 
                ref={inputRef} 
                type="text" 
                value={country} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setCountry(e.target.value); setShowCountrySuggestions(true) }}
                onFocus={() => setShowCountrySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCountrySuggestions(false), 300)}
                className="input" 
                placeholder="Италия" 
                required 
              />
              {showCountrySuggestions && countrySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {countrySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setCountry(suggestion); setShowCountrySuggestions(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Город *</label>
              <input 
                ref={cityInputRef}
                type="text" 
                value={city} 
                onChange={(e: ChangeEvent<HTMLInputElement>) => { setCity(e.target.value); setShowCitySuggestions(true) }}
                onFocus={() => setShowCitySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 300)}
                className="input" 
                placeholder="Рим" 
                required 
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {citySuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => { setCity(suggestion); setShowCitySuggestions(false) }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Место (опционально)</label>
            <input type="text" value={location} onChange={(e: ChangeEvent<HTMLInputElement>) => setLocation(e.target.value)} className="input" placeholder="Колизей" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select value={placeType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPlaceType(e.target.value as PlaceType)} className="input">
              {PLACE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет: {priority}</label>
            <input type="range" min="1" max="5" value={priority} onChange={(e: ChangeEvent<HTMLInputElement>) => setPriority(Number(e.target.value))} className="w-full accent-primary-600" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Низкий</span>
              <span>Высокий</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)} className="input min-h-[60px]" placeholder="Почему хочу посетить..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn-secondary">Отмена</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 btn-primary disabled:opacity-50">
              {mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PreferenceCard({ 
  pref, 
  tripId, 
  isOwner, 
  onDelete,
  onEdit,
  reactions,
  onReact
}: { 
  pref: Preference
  tripId: number
  isOwner: boolean
  onDelete: () => void
  onEdit: () => void
  reactions?: ReactionData[]
  onReact: (emoji: string) => void
  key?: number | string
}) {
  const { showToast } = useToast()
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  
  const deleteMutation = useMutation({ 
    mutationFn: () => deletePreference(tripId, pref.id), 
    onSuccess: () => {
      showToast('Пожелание удалено', 'info')
      onDelete()
    }
  })
  
  const userReaction = reactions?.find(r => r.user_reacted)
  
  return (
    <div className="card stagger-item">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-sm text-gray-500">{PLACE_TYPE_LABELS[pref.place_type]}</span>
          <h4 className="font-semibold">{pref.location ? `${pref.location}, ` : ''}{pref.city}, {pref.country}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium px-2 py-1 bg-primary-100 text-primary-700 rounded">⭐ {pref.priority}</span>
          {isOwner && (
            <div className="flex items-center gap-1">
              <button 
                onClick={onEdit}
                className="text-blue-500 hover:text-blue-700 text-sm transition-colors"
                title="Редактировать"
              >
                ✏️
              </button>
              <button 
                onClick={() => deleteMutation.mutate(undefined)} 
                className="text-red-500 hover:text-red-700 text-sm transition-colors"
                disabled={deleteMutation.isPending}
                title="Удалить"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>
      {pref.comment && <p className="text-sm text-gray-500 mb-2 italic">"{pref.comment}"</p>}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">от {pref.username}</div>
        
        {/* Reactions */}
        <div className="flex items-center gap-1">
          {reactions && reactions.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              {reactions.map((r) => (
                <button 
                  key={r.emoji}
                  onClick={() => onReact(r.user_reacted ? '' : r.emoji)}
                  className={`text-sm px-2 py-0.5 rounded-full transition-all ${r.user_reacted ? 'bg-primary-100 scale-110' : 'bg-gray-100 hover:bg-gray-200'}`}
                  title={r.users.join(', ')}
                >
                  {r.emoji} {r.count}
                </button>
              ))}
            </div>
          )}
          
          {/* Add reaction button */}
          <div className="relative">
            <button 
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`text-lg px-2 py-0.5 rounded-full transition-all ${userReaction ? 'bg-primary-50' : 'hover:bg-gray-100 opacity-50 hover:opacity-100'}`}
            >
              {userReaction ? userReaction.emoji : '😊'}
            </button>
            
            {showEmojiPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                <div className="absolute bottom-full right-0 mb-2 p-2 bg-white rounded-xl shadow-lg border border-gray-100 z-50 animate-scale-in flex gap-1">
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(userReaction?.emoji === emoji ? '' : emoji)
                        setShowEmojiPicker(false)
                      }}
                      className={`text-xl p-1 rounded hover:bg-gray-100 transition-all hover:scale-125 ${userReaction?.emoji === emoji ? 'bg-primary-100' : ''}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteCard({ route, tripId, isVoted, onVote, onRemoveVote }: { route: RouteOption; tripId: number; isVoted: boolean; onVote: () => void; onRemoveVote: () => void; key?: number | string }) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  
  const handleVote = () => {
    onVote()
    showToast('Голос учтён! 🗳️', 'success')
  }
  
  const handleRemoveVote = () => {
    onRemoveVote()
    showToast('Голос отменён', 'info')
  }
  
  const copyToClipboard = async () => {
    // Format route as Markdown
    const markdown = `# ${route.title}\n\n` +
      `**Голосов:** ${route.vote_count}\n\n` +
      `${route.description}\n\n` +
      (route.reasoning ? `## Почему этот маршрут?\n\n${route.reasoning}\n` : '')
    
    try {
      await navigator.clipboard.writeText(markdown)
      setCopied(true)
      showToast('Маршрут скопирован в буфер обмена! 📋', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      showToast('Ошибка копирования', 'error')
    }
  }
  
  return (
    <div className={`card stagger-item transition-all ${isVoted ? 'ring-2 ring-primary-500 shadow-md' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-lg">{route.title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-sm bg-gray-100 px-2 py-1 rounded">🗳️ {route.vote_count}</span>
          <button
            onClick={copyToClipboard}
            className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-1"
            title="Копировать в буфер обмена"
          >
            {copied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
        </div>
      </div>
      <div className="mb-3">
        <div className="text-sm text-gray-700 markdown-content prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:mb-2 prose-ul:ml-6 prose-li:mb-1 max-h-96 overflow-y-auto pr-2">
          <ReactMarkdown children={route.description || ''} />
        </div>
      </div>
      {route.reasoning && (
        <details className="text-sm text-gray-500 mb-3">
          <summary className="cursor-pointer hover:text-gray-700 transition-colors">Почему этот маршрут?</summary>
          <div className="mt-2 pl-4 border-l-2 border-gray-200 max-h-64 overflow-y-auto pr-2">
            <div className="text-gray-600 markdown-content prose prose-sm max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:mb-2 prose-ul:ml-6 prose-li:mb-1">
              <ReactMarkdown children={route.reasoning || ''} />
            </div>
          </div>
        </details>
      )}
      <button onClick={isVoted ? handleRemoveVote : handleVote} className={isVoted ? 'btn-secondary w-full' : 'btn-primary w-full'}>
        {isVoted ? '✓ Голос отдан — нажмите, чтобы отменить' : 'Голосовать за этот маршрут'}
      </button>
    </div>
  )
}

// Group preferences by country and city
function groupPreferences(preferences: Preference[]) {
  const groups: Record<string, { country: string; city: string; items: Preference[] }> = {}
  
  preferences.forEach((p) => {
    const key = `${p.country}|${p.city}`
    if (!groups[key]) {
      groups[key] = { country: p.country, city: p.city, items: [] }
    }
    groups[key].items.push(p)
  })
  
  // Sort groups by total priority (highest first)
  return Object.values(groups).sort((a, b) => {
    const sumA = a.items.reduce((sum, p) => sum + p.priority, 0)
    const sumB = b.items.reduce((sum, p) => sum + p.priority, 0)
    return sumB - sumA
  })
}

function TripDetailContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const tripId = Number(params.id)
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = useState<'preferences' | 'routes' | 'voting'>('preferences')
  const [showAddPref, setShowAddPref] = useState(false)
  const [showEditPref, setShowEditPref] = useState(false)
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [groupByCity, setGroupByCity] = useState(true)
  const [filterType, setFilterType] = useState<PlaceType | 'all'>('all')
  const [filterAuthor, setFilterAuthor] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'date' | 'author'>('priority')

  const { data: trip, isLoading } = useQuery<Trip>({ queryKey: ['trip', tripId], queryFn: () => getTrip(tripId) })
  const { data: preferences } = useQuery<Preference[]>({ queryKey: ['preferences', tripId], queryFn: () => getPreferences(tripId) })
  const { data: routes } = useQuery<RouteOption[]>({ queryKey: ['routes', tripId], queryFn: () => getRoutes(tripId) })
  const { data: myVotes } = useQuery<number[]>({ queryKey: ['myVotes', tripId], queryFn: () => api.get(`/api/trips/${tripId}/my-votes`).then((r: any) => r.data.route_option_ids as number[]) })
  const { data: reactions } = useQuery<PreferenceReactions[]>({ 
    queryKey: ['reactions', tripId], 
    queryFn: () => getTripReactions(tripId),
    enabled: !!preferences?.length
  })

  const deleteMutation = useMutation({ 
    mutationFn: () => deleteTrip(tripId), 
    onSuccess: () => { 
      showToast('Поездка удалена', 'info')
      queryClient.invalidateQueries({ queryKey: ['trips'] }); 
      router.push('/trips') 
    } 
  })
  const leaveMutation = useMutation({ 
    mutationFn: () => leaveTrip(tripId), 
    onSuccess: () => { 
      showToast('Вы покинули поездку', 'info')
      queryClient.invalidateQueries({ queryKey: ['trips'] }); 
      router.push('/trips') 
    } 
  })
  const generateMutation = useMutation({ 
    mutationFn: () => generateRoutes(tripId), 
    onSuccess: () => {
      showToast('Маршруты сгенерированы! 🎉', 'success')
      queryClient.invalidateQueries({ queryKey: ['routes', tripId] })
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      setActiveTab('routes')
    },
    onError: (err: any) => {
      const errorMessage = getErrorMessage(err, 'Ошибка генерации маршрутов')
      // Show longer error message for quota/rate limit errors
      if (err?.response?.status === 429 || errorMessage.includes('лимит') || errorMessage.includes('quota')) {
        showToast(errorMessage, 'error')
      } else {
        showToast(errorMessage, 'error')
      }
    }
  })
  
  const voteMutation = useMutation({
    mutationFn: (routeId: number) => api.post(`/api/trips/${tripId}/votes`, { route_option_id: routeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVotes', tripId] })
      queryClient.invalidateQueries({ queryKey: ['routes', tripId] })
    }
  })
  
  const removeVoteMutation = useMutation({
    mutationFn: (routeId: number) => api.delete(`/api/trips/${tripId}/votes/${routeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVotes', tripId] })
      queryClient.invalidateQueries({ queryKey: ['routes', tripId] })
    }
  })
  
  const reactionMutation = useMutation({
    mutationFn: ({ prefId, emoji }: { prefId: number; emoji: string }) => 
      emoji ? addReaction(prefId, emoji) : removeReaction(prefId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reactions', tripId] })
    }
  })
  
  // Helper to get reactions for a preference
  const getReactionsForPref = (prefId: number) => {
    return reactions?.find(r => r.preference_id === prefId)?.reactions || []
  }
  
  const handleReaction = (prefId: number, emoji: string) => {
    reactionMutation.mutate({ prefId, emoji })
  }

  // Filter and sort preferences
  const filteredAndSortedPreferences = preferences ? (() => {
    let filtered = [...preferences]
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.place_type === filterType)
    }
    
    // Filter by author
    if (filterAuthor !== 'all') {
      filtered = filtered.filter(p => p.username === filterAuthor)
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        return b.priority - a.priority
      } else if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      } else if (sortBy === 'author') {
        return a.username.localeCompare(b.username)
      }
      return 0
    })
    
    return filtered
  })() : null

  // Get unique authors for filter
  const uniqueAuthors = preferences ? Array.from(new Set(preferences.map(p => p.username))).sort() : []

  if (isLoading || !trip) return <TripDetailSkeleton />

  const isOrganizer = trip.created_by_id === user?.id
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const handleRefresh = () => { queryClient.invalidateQueries({ queryKey: ['preferences', tripId] }) }
  
  // Share functions
  const copyInviteCode = () => { 
    navigator.clipboard.writeText(trip.invite_code)
    showToast('Код скопирован! 📋', 'success')
    setShowShareMenu(false)
  }
  
  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${trip.invite_code}`
    navigator.clipboard.writeText(link)
    showToast('Ссылка скопирована! 🔗', 'success')
    setShowShareMenu(false)
  }
  
  const shareViaMessenger = () => {
    const text = `Присоединяйся к поездке "${trip.title}" в TripTogether! Код: ${trip.invite_code}`
    if (navigator.share) {
      navigator.share({ title: 'TripTogether', text })
    } else {
      navigator.clipboard.writeText(text)
      showToast('Текст скопирован для отправки 📤', 'success')
    }
    setShowShareMenu(false)
  }
  
  // Next step hint
  const nextHint = getNextStepHint(
    preferences?.length || 0,
    routes?.length || 0,
    trip.participants?.length || 0,
    (myVotes?.length || 0) > 0
  )
  
  const handleHintAction = (action?: string) => {
    if (action === 'invite') setShowShareMenu(true)
    else if (action === 'add_preference') setShowAddPref(true)
    else if (action === 'generate') generateMutation.mutate(undefined)
    else if (action === 'vote') setActiveTab('routes')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/trips" className="text-gray-500 hover:text-gray-700">← Назад</Link>
            <Link href="/trips">
              <Logo size="md" className="hover:opacity-80 transition-opacity" />
            </Link>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{trip.title}</h2>
              {trip.description && <p className="text-gray-500 mb-3">{trip.description}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>📅 {formatDate(trip.start_date)} — {formatDate(trip.end_date)}</span>
                <span>👥 {trip.participants?.length || 0}</span>
                <span className={`px-2 py-1 rounded text-xs ${trip.generation_status === 'completed' ? 'bg-green-100 text-green-700' : trip.generation_status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                  {trip.generation_status === 'completed' ? '✓ Маршруты готовы' : trip.generation_status === 'in_progress' ? '⏳ Генерация...' : 'Нет маршрутов'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Share menu */}
              <div className="relative">
                <button 
                  onClick={() => setShowShareMenu(!showShareMenu)} 
                  className="btn-primary text-sm"
                >
                  🔗 Пригласить
                </button>
                {showShareMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 z-50 animate-scale-in overflow-hidden">
                      <div className="p-3 border-b border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Код приглашения</p>
                        <p className="font-mono font-bold text-lg text-primary-600">{trip.invite_code}</p>
                      </div>
                      <div className="p-2">
                        <button onClick={copyInviteCode} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
                          📋 Скопировать код
                        </button>
                        <button onClick={copyInviteLink} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
                          🔗 Скопировать ссылку
                        </button>
                        <button onClick={shareViaMessenger} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
                          📤 Поделиться
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {isOrganizer ? (
                <button onClick={() => confirm('Удалить поездку?') && deleteMutation.mutate(undefined)} className="btn-danger text-sm" disabled={deleteMutation.isPending}>Удалить</button>
              ) : (
                <button onClick={() => confirm('Покинуть поездку?') && leaveMutation.mutate(undefined)} className="btn-secondary text-sm" disabled={leaveMutation.isPending}>Покинуть</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {[
              { key: 'preferences', label: 'Пожелания', icon: '📍', count: preferences?.length },
              { key: 'routes', label: 'Маршруты', icon: '🗺️', count: routes?.length },
              { key: 'voting', label: 'Голосование', icon: '🗳️' },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {tab.icon} {tab.label} {tab.count !== undefined && <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* "What's next?" hint */}
        {nextHint && (
          <div 
            className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-accent-50 border border-primary-100 rounded-xl flex items-center justify-between cursor-pointer hover:shadow-sm transition-all animate-fade-in-up"
            onClick={() => handleHintAction(nextHint.action)}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{nextHint.icon}</span>
              <div>
                <p className="text-xs font-medium text-primary-600 uppercase tracking-wide">Что дальше?</p>
                <p className="text-sm text-gray-700">{nextHint.text}</p>
              </div>
            </div>
            <span className="text-primary-600 text-xl">→</span>
          </div>
        )}
        
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {activeTab === 'preferences' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold">Пожелания участников</h3>
                    {preferences && preferences.length > 2 && (
                      <button 
                        onClick={() => setGroupByCity(!groupByCity)}
                        className={`text-xs px-3 py-1 rounded-full transition-colors ${groupByCity ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {groupByCity ? '📍 По городам' : '📋 Списком'}
                      </button>
                    )}
                  </div>
                  <button onClick={() => setShowAddPref(true)} className="btn-primary text-sm">+ Добавить</button>
                </div>
                
                {/* Filters and Sort */}
                {preferences && preferences.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Фильтр:</span>
                      <select 
                        value={filterType} 
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value as PlaceType | 'all')}
                        className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">Все типы</option>
                        {PLACE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <select 
                        value={filterAuthor} 
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterAuthor(e.target.value)}
                        className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="all">Все авторы</option>
                        {uniqueAuthors.map((author) => (
                          <option key={author} value={author}>{author}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Сортировка:</span>
                      <select 
                        value={sortBy} 
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setSortBy(e.target.value as 'priority' | 'date' | 'author')}
                        className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="priority">По приоритету</option>
                        <option value="date">По дате</option>
                        <option value="author">По автору</option>
                      </select>
                    </div>
                    {(filterType !== 'all' || filterAuthor !== 'all') && (
                      <button 
                        onClick={() => { setFilterType('all'); setFilterAuthor('all') }}
                        className="text-xs text-primary-600 hover:text-primary-700 underline"
                      >
                        Сбросить фильтры
                      </button>
                    )}
                  </div>
                )}
                {/* Wish Cloud visualization */}
                {preferences && preferences.length >= 3 && (
                  <WishCloud preferences={preferences} />
                )}
                
                {!preferences ? (
                  <PreferencesListSkeleton />
                ) : preferences.length === 0 ? (
                  <EmptyState
                    icon="📍"
                    title="Пока нет пожеланий"
                    description="Добавьте места, которые хотите посетить в этой поездке"
                    action={{
                      label: "Добавить первое пожелание",
                      onClick: () => setShowAddPref(true)
                    }}
                  />
                ) : groupByCity ? (
                  <div className="space-y-6">
                    {groupPreferences(filteredAndSortedPreferences || []).map((group) => (
                      <div key={`${group.country}-${group.city}`} className="animate-fade-in-up">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                          <span className="text-lg">🌍</span>
                          <h4 className="font-semibold text-gray-900">{group.city}, {group.country}</h4>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {group.items.length} {group.items.length === 1 ? 'место' : group.items.length >= 2 && group.items.length <= 4 ? 'места' : 'мест'}
                          </span>
                        </div>
                        <div className="space-y-3 pl-2 border-l-2 border-primary-100">
                          {group.items.map((p) => (
                            <PreferenceCard 
                              key={p.id} 
                              pref={p} 
                              tripId={tripId} 
                              isOwner={p.user_id === user?.id} 
                              onDelete={handleRefresh}
                              onEdit={() => { setEditingPreference(p); setShowEditPref(true) }}
                              reactions={getReactionsForPref(p.id)} 
                              onReact={(emoji) => handleReaction(p.id, emoji)} 
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAndSortedPreferences?.map((p) => (
                      <PreferenceCard 
                        key={p.id} 
                        pref={p} 
                        tripId={tripId} 
                        isOwner={p.user_id === user?.id} 
                        onDelete={handleRefresh}
                        onEdit={() => { setEditingPreference(p); setShowEditPref(true) }}
                        reactions={getReactionsForPref(p.id)} 
                        onReact={(emoji) => handleReaction(p.id, emoji)} 
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'routes' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">AI-маршруты</h3>
                  <div className="flex gap-2">
                    {routes && routes.length > 0 && (
                      <button 
                        onClick={() => {
                          const sortedRoutes = [...routes].sort((a, b) => b.vote_count - a.vote_count)
                          const winner = sortedRoutes[0]
                          if (winner) {
                            const exportText = `МАРШРУТ ПОЕЗДКИ: ${trip.title}\n\n` +
                              `Даты: ${formatDate(trip.start_date)} — ${formatDate(trip.end_date)}\n` +
                              `Участников: ${trip.participants?.length || 0}\n\n` +
                              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `🏆 ВЫБРАННЫЙ МАРШРУТ\n` +
                              `Голосов: ${winner.vote_count}\n\n` +
                              `${winner.title}\n\n` +
                              `${winner.description}\n\n` +
                              (winner.reasoning ? `Почему этот маршрут:\n${winner.reasoning}\n\n` : '') +
                              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `Все варианты маршрутов:\n\n` +
                              sortedRoutes.map((r, i) => 
                                `${i + 1}. ${r.title} (${r.vote_count} голосов)\n${r.description}\n`
                              ).join('\n') +
                              `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
                              `Сгенерировано в TripTogether\n`
                            
                            const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `маршрут-${trip.title.replace(/[^a-zа-яё0-9]/gi, '-').toLowerCase()}.txt`
                            document.body.appendChild(a)
                            a.click()
                            document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            showToast('Маршрут экспортирован! 📄', 'success')
                          }
                        }}
                        className="btn-secondary text-sm"
                      >
                        📄 Экспорт маршрута
                      </button>
                    )}
                    <button 
                      onClick={() => generateMutation.mutate(undefined)} 
                      className="btn-primary text-sm" 
                      disabled={generateMutation.isPending || !preferences?.length || trip.generation_count >= (trip.max_generation_count || 10)}
                    >
                      {generateMutation.isPending ? '⏳ Генерация...' : `🤖 Сгенерировать (осталось ${(trip.max_generation_count || 10) - trip.generation_count})`}
                    </button>
                  </div>
                </div>
                {generateMutation.isError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{getErrorMessage(generateMutation.error, 'Ошибка генерации')}</div>}
                
                <GenerationProgress isGenerating={generateMutation.isPending || trip.generation_status === 'in_progress'} />
                
                {!routes ? (
                  <RoutesListSkeleton />
                ) : routes.length === 0 ? (
                  <EmptyState
                    icon="🤖"
                    title="Маршруты ещё не созданы"
                    description={preferences?.length ? 'AI сгенерирует оптимальные маршруты на основе всех пожеланий' : 'Сначала добавьте пожелания участников'}
                    action={preferences?.length ? {
                      label: "🤖 Сгенерировать маршруты",
                      onClick: () => generateMutation.mutate(undefined)
                    } : undefined}
                  />
                ) : (
                  <div className="space-y-4">
                    {routes?.map((r) => (
                      <RouteCard 
                        key={r.id} 
                        route={r} 
                        tripId={tripId} 
                        isVoted={myVotes?.includes(r.id) || false} 
                        onVote={() => voteMutation.mutate(r.id)}
                        onRemoveVote={() => removeVoteMutation.mutate(r.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'voting' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Результаты голосования</h3>
                {routes && routes.length > 0 ? (() => {
                  const sortedRoutes = [...routes].sort((a, b) => b.vote_count - a.vote_count)
                  const maxVotes = Math.max(...sortedRoutes.map(r => r.vote_count), 1)
                  const winner = sortedRoutes[0]?.vote_count > 0 ? sortedRoutes[0] : null
                  const totalVotes = sortedRoutes.reduce((sum, r) => sum + r.vote_count, 0)
                  
                  return (
                    <div className="space-y-4">
                      {winner && totalVotes > 0 && (
                        <div className={`card bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 ${winner.vote_count > 0 ? 'animate-winner-glow' : ''}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">🏆</span>
                            <div>
                              <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Победитель</p>
                              <p className="text-lg font-bold text-gray-900">{winner.title}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 bg-yellow-200 rounded-full h-3 overflow-hidden">
                              <div 
                                className="bg-yellow-500 h-full rounded-full animate-progress-fill"
                                style={{ width: `${(winner.vote_count / maxVotes) * 100}%` }}
                              />
                            </div>
                            <span className="text-lg font-bold text-yellow-700 min-w-[60px] text-right animate-vote-count-up">
                              {winner.vote_count}
                            </span>
                          </div>
                          <p className="text-xs text-yellow-600 mt-2">
                            {totalVotes > 0 ? `${Math.round((winner.vote_count / totalVotes) * 100)}% участников выбрали этот маршрут` : 'Пока нет голосов'}
                          </p>
                        </div>
                      )}
                      
                      <div className="card">
                        <div className="space-y-4">
                          {sortedRoutes.map((r, i) => {
                            const isWinner = winner?.id === r.id && r.vote_count > 0
                            const percentage = maxVotes > 0 ? (r.vote_count / maxVotes) * 100 : 0
                            const votePercentage = totalVotes > 0 ? (r.vote_count / totalVotes) * 100 : 0
                            
                            return (
                              <div 
                                key={r.id} 
                                className={`p-4 rounded-lg border-2 transition-all stagger-item ${
                                  isWinner 
                                    ? 'bg-yellow-50 border-yellow-300 shadow-md' 
                                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-3 flex-1">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                      isWinner 
                                        ? 'bg-yellow-400 text-yellow-900 shadow-md scale-110' 
                                        : i === 0 && r.vote_count > 0
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      {isWinner ? '🏆' : i + 1}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className="font-semibold text-gray-900 mb-1">{r.title}</h4>
                                      {r.description && (
                                        <p className="text-xs text-gray-500 line-clamp-1">{r.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className={`text-2xl font-bold transition-all ${
                                      isWinner ? 'text-yellow-700 animate-vote-count-up' : 'text-primary-600'
                                    }`}>
                                      {r.vote_count}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {r.vote_count === 1 ? 'голос' : r.vote_count >= 2 && r.vote_count <= 4 ? 'голоса' : 'голосов'}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Progress bar */}
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>{votePercentage > 0 ? `${Math.round(votePercentage)}%` : '0%'}</span>
                                    <span>{r.vote_count} из {totalVotes} голосов</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isWinner 
                                          ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                                          : 'bg-primary-500'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Show if user voted for this route */}
                                {myVotes?.includes(r.id) && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-primary-600">
                                    <span>✓</span>
                                    <span>Вы проголосовали за этот маршрут</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      
                      {totalVotes === 0 && (
                        <div className="card bg-blue-50 border border-blue-200 text-center py-6">
                          <p className="text-blue-700 font-medium">Пока никто не проголосовал</p>
                          <p className="text-sm text-blue-600 mt-1">Будьте первым, кто выберет лучший маршрут!</p>
                        </div>
                      )}
                    </div>
                  )
                })() : (
                  <EmptyState
                    icon="🗳️"
                    title="Сначала сгенерируйте маршруты"
                    description="Голосование начнётся после того, как AI создаст варианты маршрутов"
                    action={preferences?.length ? {
                      label: "Перейти к маршрутам",
                      onClick: () => setActiveTab('routes')
                    } : undefined}
                  />
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Участники</h3>
            <div className="card">
              <div className="space-y-3">
                {trip.participants?.map((p: Participant) => {
                  const prefCount = preferences?.filter(pref => pref.user_id === p.user_id).length || 0
                  const hasActivity = prefCount > 0
                  
                  return (
                    <div key={p.id} className="flex items-center justify-between stagger-item">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium transition-all ${hasActivity ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                            {p.username[0].toUpperCase()}
                          </div>
                          {/* Activity indicator dot */}
                          {hasActivity && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white" title="Добавил пожелания" />
                          )}
                        </div>
                        <div>
                          <span className="font-medium">{p.username}</span>
                          {prefCount > 0 && (
                            <div className="text-xs text-gray-400">
                              📍 {prefCount} {prefCount === 1 ? 'пожелание' : prefCount >= 2 && prefCount <= 4 ? 'пожелания' : 'пожеланий'}
                            </div>
                          )}
                        </div>
                      </div>
                      {p.role === 'organizer' && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">Организатор</span>}
                    </div>
                  )
                })}
              </div>
              
              {/* Activity summary */}
              {preferences && preferences.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Всего пожеланий:</span>
                    <span className="font-semibold text-primary-600">{preferences.length}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">Активных участников:</span>
                    <span className="font-semibold text-green-600">
                      {new Set(preferences.map(p => p.user_id)).size} / {trip.participants?.length || 0}
                    </span>
                  </div>
                </div>
              )}
              
              {/* Invite reminder */}
              {(trip.participants?.length || 0) <= 2 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <button 
                    onClick={() => setShowShareMenu(true)}
                    className="w-full text-center py-3 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <span>👥</span>
                    <span>Пригласить друзей</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <AddPreferenceModal isOpen={showAddPref} onClose={() => setShowAddPref(false)} tripId={tripId} onSuccess={handleRefresh} />
      <EditPreferenceModal 
        isOpen={showEditPref} 
        onClose={() => { setShowEditPref(false); setEditingPreference(null) }} 
        tripId={tripId} 
        preference={editingPreference}
        onSuccess={handleRefresh} 
      />
    </div>
  )
}

export default function TripDetailPage() {
  return (
    <ProtectedRoute>
      <TripDetailContent />
    </ProtectedRoute>
  )
}
