'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getErrorMessage } from '@/lib/errors'

export default function LoginPage() {
  const { login } = useAuth()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login({ email, password }, redirect || undefined)
    } catch (err: any) {
      setError(getErrorMessage(err, 'Ошибка входа. Проверьте данные.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-600">TripTogether</h1>
          <p className="text-gray-500 mt-2">Планируйте путешествия с друзьями</p>
        </div>

        {/* Card */}
        <div className="card">
          <h2 className="text-2xl font-semibold text-center mb-6">Вход</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Входим...' : 'Войти'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Нет аккаунта?{' '}
            <Link 
              href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : '/register'} 
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
