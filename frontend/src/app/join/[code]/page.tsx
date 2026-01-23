'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { joinTrip } from '@/lib/trips'
import { useToast } from '@/components/ui/Toast'
import Link from 'next/link'

export default function JoinByLinkPage() {
  const params = useParams()
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { showToast } = useToast()
  const inviteCode = params.code as string
  const [autoJoinAttempted, setAutoJoinAttempted] = useState(false)

  const joinMutation = useMutation({
    mutationFn: () => joinTrip(inviteCode),
    onSuccess: (trip) => {
      showToast('Вы присоединились к поездке! 🎒', 'success')
      router.push(`/trips/${trip.id}`)
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail
      if (detail === 'Вы уже являетесь участником этой поездки') {
        showToast('Вы уже участник этой поездки', 'info')
        router.push('/trips')
      } else {
        showToast(detail || 'Ошибка присоединения', 'error')
      }
    }
  })

  // Auto-join if authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && !autoJoinAttempted && !joinMutation.isPending) {
      setAutoJoinAttempted(true)
      joinMutation.mutate()
    }
  }, [authLoading, isAuthenticated, autoJoinAttempted, joinMutation])

  // Loading state
  if (authLoading || (isAuthenticated && joinMutation.isPending)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Присоединяемся к поездке...</p>
        </div>
      </div>
    )
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center animate-fade-in-up">
          <div className="text-6xl mb-4">✈️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Вас пригласили в поездку!
          </h1>
          <p className="text-gray-500 mb-6">
            Войдите или зарегистрируйтесь, чтобы присоединиться к планированию путешествия
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-gray-400 mb-1">Код приглашения</p>
            <p className="font-mono font-bold text-xl text-primary-600">{inviteCode}</p>
          </div>

          <div className="flex flex-col gap-3">
            <Link 
              href={`/login?redirect=/join/${inviteCode}`}
              className="btn-primary w-full"
            >
              Войти
            </Link>
            <Link 
              href={`/register?redirect=/join/${inviteCode}`}
              className="btn-secondary w-full"
            >
              Зарегистрироваться
            </Link>
          </div>

          <p className="mt-6 text-xs text-gray-400">
            После входа вы автоматически присоединитесь к поездке
          </p>
        </div>
      </div>
    )
  }

  // Error state
  if (joinMutation.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="card max-w-md w-full text-center animate-fade-in-up">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Не удалось присоединиться
          </h1>
          <p className="text-gray-500 mb-6">
            {(joinMutation.error as any)?.response?.data?.detail || 'Проверьте код приглашения или попробуйте позже'}
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => joinMutation.mutate()}
              className="btn-primary w-full"
            >
              Попробовать снова
            </button>
            <Link href="/trips" className="btn-secondary w-full">
              К моим поездкам
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return null
}
