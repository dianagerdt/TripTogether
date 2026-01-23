'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getTrips, createTrip, joinTrip } from '@/lib/trips'
import { TripListItem, CreateTripData } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, TripsListSkeleton } from '@/components/ui'
import Link from 'next/link'

function CreateTripModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void 
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
    mutationFn: createTrip,
    onSuccess: () => {
      showToast('Поездка создана! 🎉', 'success')
      onSuccess()
      onClose()
      setTitle('')
      setDescription('')
      setStartDate('')
      setEndDate('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Ошибка создания поездки')
    }
  })

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Конец *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
                required
              />
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
      setError(err.response?.data?.detail || 'Неверный код приглашения')
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
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)

  const { data: trips, isLoading, error } = useQuery({
    queryKey: ['trips'],
    queryFn: getTrips,
  })

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['trips'] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-primary-600">TripTogether</h1>
            
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
        onSuccess={handleSuccess}
      />
      <JoinTripModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onSuccess={handleSuccess}
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
