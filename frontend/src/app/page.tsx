'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/trips')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero section */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          {/* Logo */}
          <div className="mb-8">
            <span className="text-6xl">✈️</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Trip<span className="text-primary-600">Together</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8">
            Планируйте путешествия с друзьями. Собирайте пожелания, 
            генерируйте маршруты с помощью AI и голосуйте за лучший вариант.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg px-8 py-3">
              Начать бесплатно
            </Link>
            <Link href="/login" className="btn-secondary text-lg px-8 py-3">
              Войти
            </Link>
          </div>

          {/* Features */}
          <div className="mt-16 grid sm:grid-cols-3 gap-8 text-left">
            <div className="card">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold text-gray-900 mb-2">Соберите пожелания</h3>
              <p className="text-sm text-gray-500">
                Каждый участник добавляет места, которые хочет посетить, с приоритетами.
              </p>
            </div>
            
            <div className="card">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="font-semibold text-gray-900 mb-2">AI-маршруты</h3>
              <p className="text-sm text-gray-500">
                Получите оптимальные маршруты, учитывающие пожелания всех участников.
              </p>
            </div>
            
            <div className="card">
              <div className="text-3xl mb-3">🗳️</div>
              <h3 className="font-semibold text-gray-900 mb-2">Голосование</h3>
              <p className="text-sm text-gray-500">
                Выберите лучший маршрут вместе — демократично и без споров.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-gray-400">
        TripTogether © 2026
      </footer>
    </div>
  )
}
