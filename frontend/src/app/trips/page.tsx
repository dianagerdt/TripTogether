'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { getTrips, createTrip, joinTrip } from '@/lib/trips'
import { TripListItem, CreateTripData } from '@/types'
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

  const mutation = useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
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

  const mutation = useMutation({
    mutationFn: joinTrip,
    onSuccess: () => {
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
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

function TripCard({ trip }: { trip: TripListItem }) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }

  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg text-gray-900">{trip.title}</h3>
          {trip.is_organizer && (
            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
              Организатор
            </span>
          )}
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

        {isLoading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Загрузка...</p>
          </div>
        )}

        {error && (
          <div className="card text-center py-12">
            <p className="text-red-500">Ошибка загрузки поездок</p>
          </div>
        )}

        {trips && trips.length === 0 && (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Пока нет поездок
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              Создайте свою первую поездку и пригласите друзей для совместного планирования маршрута.
            </p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Создать первую поездку
            </button>
          </div>
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
