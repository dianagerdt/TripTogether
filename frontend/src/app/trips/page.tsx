'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getTrips, createTrip, joinTrip } from '@/lib/trips'
import { TripListItem, CreateTripData, Trip } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { getErrorMessage } from '@/lib/errors'
import { EmptyState, TripsListSkeleton } from '@/components/ui'
import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

function CreateTripModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean
  onClose: () => void
  onSuccess: (trip: Trip) => void 
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')
  const [dateErrors, setDateErrors] = useState<{ start?: string; end?: string }>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const todayStr = () => new Date().toISOString().slice(0, 10)

  const validateDates = (): boolean => {
    const err: { start?: string; end?: string } = {}
    if (startDate && startDate < todayStr()) {
      err.start = 'Дата начала не может быть в прошлом'
    }
    if (startDate && endDate && endDate < startDate) {
      err.end = 'Дата окончания должна быть не раньше даты начала'
    }
    setDateErrors(err)
    return Object.keys(err).length === 0
  }

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (startDate || endDate) setDateErrors({})
  }, [startDate, endDate])

  const mutation = useMutation({
    mutationFn: createTrip,
    onSuccess: (createdTrip) => {
      showToast('Поездка создана! 🎉', 'success')
      onSuccess(createdTrip)
      onClose()
      setTitle('')
      setDescription('')
      setStartDate('')
      setEndDate('')
    },
    onError: (err: any) => {
      setError(getErrorMessage(err, 'Ошибка создания поездки'))
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validateDates()) return
    mutation.mutate({
      title,
      description: description || undefined,
      start_date: startDate,
      end_date: endDate,
    })
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Новая поездка</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название *
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Поездка в Италию"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="Кратко о поездке..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Начало *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={todayStr()}
                className={`input ${dateErrors.start ? 'border-red-500' : ''}`}
                required
                aria-invalid={!!dateErrors.start}
                aria-describedby={dateErrors.start ? 'start-date-error' : undefined}
              />
              {dateErrors.start && (
                <p id="start-date-error" className="mt-1 text-sm text-red-600" role="alert">
                  {dateErrors.start}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Конец *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || todayStr()}
                className={`input ${dateErrors.end ? 'border-red-500' : ''}`}
                required
                aria-invalid={!!dateErrors.end}
                aria-describedby={dateErrors.end ? 'end-date-error' : undefined}
              />
              {dateErrors.end && (
                <p id="end-date-error" className="mt-1 text-sm text-red-600" role="alert">
                  {dateErrors.end}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {mutation.isPending ? 'Создаём...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function JoinTripModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [inviteCode, setInviteCode] = useState('')
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
    mutationFn: joinTrip,
    onSuccess: () => {
      showToast('Вы присоединились к поездке! 🎒', 'success')
      onSuccess()
      onClose()
      setInviteCode('')
    },
    onError: (err: any) => {
      setError(getErrorMessage(err, 'Неверный код приглашения'))
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    mutation.mutate(inviteCode)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Присоединиться к поездке</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Код приглашения
            </label>
            <input
              ref={inputRef}
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="input"
              placeholder="Введите код"
              required
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 btn-primary disabled:opacity-50"
            >
              {mutation.isPending ? 'Подключаемся...' : 'Присоединиться'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function getDaysUntilTrip(startDateStr: string): { text: string; color: string } | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(startDateStr)
  startDate.setHours(0, 0, 0, 0)
  
  const diffTime = startDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return { text: 'Завершена', color: 'text-gray-400' }
  if (diffDays === 0) return { text: '🎉 Сегодня!', color: 'text-green-600' }
  if (diffDays === 1) return { text: '⏰ Завтра!', color: 'text-orange-600' }
  if (diffDays <= 7) return { text: `🔥 Через ${diffDays} дн.`, color: 'text-orange-500' }
  if (diffDays <= 30) return { text: `${diffDays} дн.`, color: 'text-primary-600' }
  return null // Don't show for trips more than 30 days away
}

function TripCard({ trip }: { trip: TripListItem }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  const daysInfo = getDaysUntilTrip(trip.start_date)

  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="card-hover cursor-pointer stagger-item">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg text-gray-900">{trip.title}</h3>
          <div className="flex items-center gap-2">
            {daysInfo && (
              <span className={`text-xs font-medium ${daysInfo.color}`}>
                {daysInfo.text}
              </span>
            )}
            {trip.is_organizer && (
              <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                Организатор
              </span>
            )}
          </div>
        </div>
        
        {trip.description && (
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">{trip.description}</p>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            📅 {formatDate(trip.start_date)} — {formatDate(trip.end_date)}
          </span>
          <span>👥 {trip.participant_count}</span>
        </div>
      </div>
    </Link>
  )
}

function TripsContent() {
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
  })

  const handleCreateSuccess = (trip: Trip) => {
    queryClient.invalidateQueries({ queryKey: ['trips'] })
    router.push(`/trips/${trip.id}`)
  }

  const handleJoinSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['trips'] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/trips">
              <Logo size="md" className="hover:opacity-80 transition-opacity" />
            </Link>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">
                Привет, <span className="font-medium">{user?.username}</span>!
              </span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Мои поездки</h2>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowJoinModal(true)}
              className="btn-secondary"
            >
              Присоединиться
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              + Создать поездку
            </button>
          </div>
        </div>

        {isLoading && <TripsListSkeleton />}

        {error && (
          <div className="card text-center py-12">
            <p className="text-red-500">Ошибка загрузки поездок</p>
          </div>
        )}

        {trips && trips.length === 0 && (
          <EmptyState
            icon="🗺️"
            title="Пока нет поездок"
            description="Создайте свою первую поездку и пригласите друзей для совместного планирования маршрута."
            action={{
              label: "Создать первую поездку",
              onClick: () => setShowCreateModal(true)
            }}
            secondaryAction={{
              label: "Присоединиться по коду",
              onClick: () => setShowJoinModal(true)
            }}
          />
        )}

        {trips && trips.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      <CreateTripModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
      />
      <JoinTripModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleJoinSuccess}
      />
    </div>
  )
}

export default function TripsPage() {
  return (
    <ProtectedRoute>
      <TripsContent />
    </ProtectedRoute>
  )
}
