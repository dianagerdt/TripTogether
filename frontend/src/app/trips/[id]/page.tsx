'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getTrip, deleteTrip, leaveTrip } from '@/lib/trips'
import { getPreferences, createPreference, deletePreference, PLACE_TYPE_LABELS, PLACE_TYPES } from '@/lib/preferences'
import { getRoutes, generateRoutes } from '@/lib/routes'
import api from '@/lib/api'
import { Trip, Participant, Preference, PlaceType, CreatePreferenceData, RouteOption } from '@/types'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

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
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  // Autofocus on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

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
      setError(err.response?.data?.detail || 'Ошибка')
    }
  })

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Добавить пожелание</h2>
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate({ country, city, location: location || undefined, place_type: placeType, priority, comment: comment || undefined }) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Страна *</label>
              <input ref={inputRef} type="text" value={country} onChange={(e) => setCountry(e.target.value)} className="input" placeholder="Италия" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Город *</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="input" placeholder="Рим" required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Место (опционально)</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="input" placeholder="Колизей" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
            <select value={placeType} onChange={(e) => setPlaceType(e.target.value as PlaceType)} className="input">
              {PLACE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Приоритет: {priority}</label>
            <input type="range" min="1" max="5" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full accent-primary-600" />
            <div className="flex justify-between text-xs text-gray-400">
              <span>Низкий</span>
              <span>Высокий</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input min-h-[60px]" placeholder="Почему хочу посетить..." />
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

function PreferenceCard({ pref, tripId, isOwner, onDelete }: { pref: Preference; tripId: number; isOwner: boolean; onDelete: () => void }) {
  const { showToast } = useToast()
  const deleteMutation = useMutation({ 
    mutationFn: () => deletePreference(tripId, pref.id), 
    onSuccess: () => {
      showToast('Пожелание удалено', 'info')
      onDelete()
    }
  })
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
            <button 
              onClick={() => deleteMutation.mutate()} 
              className="text-red-500 hover:text-red-700 text-sm transition-colors"
              disabled={deleteMutation.isPending}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {pref.comment && <p className="text-sm text-gray-500 mb-2 italic">"{pref.comment}"</p>}
      <div className="text-xs text-gray-400">от {pref.username}</div>
    </div>
  )
}

function RouteCard({ route, tripId, isVoted, onVote, onRemoveVote }: { route: RouteOption; tripId: number; isVoted: boolean; onVote: () => void; onRemoveVote: () => void }) {
  const { showToast } = useToast()
  
  const handleVote = () => {
    onVote()
    showToast('Голос учтён! 🗳️', 'success')
  }
  
  const handleRemoveVote = () => {
    onRemoveVote()
    showToast('Голос отменён', 'info')
  }
  
  return (
    <div className={`card stagger-item transition-all ${isVoted ? 'ring-2 ring-primary-500 shadow-md' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-semibold text-lg">{route.title}</h4>
        <span className="text-sm bg-gray-100 px-2 py-1 rounded">🗳️ {route.vote_count}</span>
      </div>
      <p className="text-sm text-gray-600 whitespace-pre-wrap mb-3">{route.description}</p>
      {route.reasoning && (
        <details className="text-sm text-gray-500 mb-3">
          <summary className="cursor-pointer hover:text-gray-700 transition-colors">Почему этот маршрут?</summary>
          <p className="mt-2 pl-4 border-l-2 border-gray-200">{route.reasoning}</p>
        </details>
      )}
      <button onClick={isVoted ? handleRemoveVote : handleVote} className={isVoted ? 'btn-secondary w-full' : 'btn-primary w-full'}>
        {isVoted ? '✓ Голос отдан — нажмите, чтобы отменить' : 'Голосовать за этот маршрут'}
      </button>
    </div>
  )
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
  const [showShareMenu, setShowShareMenu] = useState(false)

  const { data: trip, isLoading } = useQuery({ queryKey: ['trip', tripId], queryFn: () => getTrip(tripId) })
  const { data: preferences } = useQuery({ queryKey: ['preferences', tripId], queryFn: () => getPreferences(tripId) })
  const { data: routes } = useQuery({ queryKey: ['routes', tripId], queryFn: () => getRoutes(tripId) })
  const { data: myVotes } = useQuery({ queryKey: ['myVotes', tripId], queryFn: () => api.get(`/api/trips/${tripId}/my-votes`).then(r => r.data.route_option_ids as number[]) })

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
      showToast(err.response?.data?.detail || 'Ошибка генерации', 'error')
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

  if (isLoading || !trip) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>

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
    else if (action === 'generate') generateMutation.mutate()
    else if (action === 'vote') setActiveTab('routes')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Link href="/trips" className="text-gray-500 hover:text-gray-700">← Назад</Link>
            <h1 className="text-xl font-bold text-primary-600">TripTogether</h1>
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
                <button onClick={() => confirm('Удалить поездку?') && deleteMutation.mutate()} className="btn-danger text-sm" disabled={deleteMutation.isPending}>Удалить</button>
              ) : (
                <button onClick={() => confirm('Покинуть поездку?') && leaveMutation.mutate()} className="btn-secondary text-sm" disabled={leaveMutation.isPending}>Покинуть</button>
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
                  <h3 className="text-lg font-semibold">Пожелания участников</h3>
                  <button onClick={() => setShowAddPref(true)} className="btn-primary text-sm">+ Добавить</button>
                </div>
                {preferences && preferences.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-4">📍</div>
                    <h3 className="text-lg font-semibold mb-2">Пока нет пожеланий</h3>
                    <p className="text-gray-500 mb-6">Добавьте места, которые хотите посетить</p>
                    <button onClick={() => setShowAddPref(true)} className="btn-primary">Добавить первое пожелание</button>
                  </div>
                ) : (
                  <div className="space-y-4">{preferences?.map((p) => <PreferenceCard key={p.id} pref={p} tripId={tripId} isOwner={p.user_id === user?.id} onDelete={handleRefresh} />)}</div>
                )}
              </div>
            )}

            {activeTab === 'routes' && (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">AI-маршруты</h3>
                  <button 
                    onClick={() => generateMutation.mutate()} 
                    className="btn-primary text-sm" 
                    disabled={generateMutation.isPending || !preferences?.length || trip.generation_count >= 3}
                  >
                    {generateMutation.isPending ? '⏳ Генерация...' : `🤖 Сгенерировать (осталось ${3 - trip.generation_count})`}
                  </button>
                </div>
                {generateMutation.isError && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{(generateMutation.error as any)?.response?.data?.detail || 'Ошибка генерации'}</div>}
                {routes && routes.length === 0 ? (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-4">🗺️</div>
                    <h3 className="text-lg font-semibold mb-2">Маршруты ещё не созданы</h3>
                    <p className="text-gray-500 mb-6">{preferences?.length ? 'Сгенерируйте AI-маршруты на основе пожеланий' : 'Сначала добавьте пожелания'}</p>
                  </div>
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
                {routes && routes.length > 0 ? (
                  <div className="card">
                    <div className="space-y-4">
                      {routes.sort((a, b) => b.vote_count - a.vote_count).map((r, i) => (
                        <div key={r.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 && r.vote_count > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                              {i + 1}
                            </span>
                            <span className="font-medium">{r.title}</span>
                          </div>
                          <span className="font-semibold text-primary-600">{r.vote_count} {r.vote_count === 1 ? 'голос' : r.vote_count >= 2 && r.vote_count <= 4 ? 'голоса' : 'голосов'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card text-center py-12">
                    <div className="text-4xl mb-4">🗳️</div>
                    <h3 className="text-lg font-semibold mb-2">Сначала сгенерируйте маршруты</h3>
                    <p className="text-gray-500">Голосование начнётся после генерации маршрутов</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Участники</h3>
            <div className="card">
              <div className="space-y-3">
                {trip.participants?.map((p: Participant) => (
                  <div key={p.id} className="flex items-center justify-between stagger-item">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-medium">{p.username[0].toUpperCase()}</div>
                      <span className="font-medium">{p.username}</span>
                    </div>
                    {p.role === 'organizer' && <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">Организатор</span>}
                  </div>
                ))}
              </div>
              
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
    </div>
  )
}

export default function TripDetailPage() {
  return <ProtectedRoute><TripDetailContent /></ProtectedRoute>
}
