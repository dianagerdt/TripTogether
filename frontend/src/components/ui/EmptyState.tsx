'use client'

import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  variant?: 'default' | 'compact'
}

// Fun illustrations using CSS and emoji
const illustrations: Record<string, ReactNode> = {
  '🗺️': (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-100 to-accent-100 rounded-full animate-pulse"></div>
      <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
        <span className="text-5xl animate-bounce-slow">🗺️</span>
      </div>
      {/* Decorative elements */}
      <div className="absolute -top-2 -right-2 text-2xl animate-float">✈️</div>
      <div className="absolute -bottom-1 -left-1 text-xl animate-float-delayed">🧳</div>
    </div>
  ),
  '📍': (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-100 to-orange-100 rounded-full"></div>
      <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
        <span className="text-5xl animate-bounce-slow">📍</span>
      </div>
      <div className="absolute -top-2 right-2 text-xl animate-float">⭐</div>
      <div className="absolute bottom-0 -left-2 text-lg animate-float-delayed">🌍</div>
    </div>
  ),
  '🗳️': (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-full"></div>
      <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
        <span className="text-5xl">🗳️</span>
      </div>
      <div className="absolute -top-1 -right-1 text-xl animate-float">✓</div>
      <div className="absolute -bottom-1 left-2 text-lg animate-float-delayed">👆</div>
    </div>
  ),
  '🤖': (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full animate-pulse-slow"></div>
      <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
        <span className="text-5xl">🤖</span>
      </div>
      <div className="absolute -top-2 right-0 text-xl animate-spin-slow">⚡</div>
      <div className="absolute bottom-0 -left-2 text-lg animate-float">✨</div>
    </div>
  ),
  '👥': (
    <div className="relative w-32 h-32 mx-auto mb-6">
      <div className="absolute inset-0 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full"></div>
      <div className="absolute inset-2 bg-white rounded-full flex items-center justify-center">
        <span className="text-5xl">👥</span>
      </div>
      <div className="absolute -top-1 -right-2 text-xl animate-float">🎉</div>
      <div className="absolute -bottom-2 left-0 text-lg animate-float-delayed">💬</div>
    </div>
  ),
}

export function EmptyState({ 
  icon, 
  title, 
  description, 
  action, 
  secondaryAction,
  variant = 'default' 
}: EmptyStateProps) {
  const illustration = illustrations[icon]
  
  if (variant === 'compact') {
    return (
      <div className="text-center py-8 animate-fade-in-up">
        <div className="text-4xl mb-3">{icon}</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-sm mx-auto">{description}</p>
        {action && (
          <button onClick={action.onClick} className="btn-primary text-sm">
            {action.label}
          </button>
        )}
      </div>
    )
  }
  
  return (
    <div className="card text-center py-12 animate-fade-in-up">
      {illustration || (
        <div className="text-6xl mb-6">{icon}</div>
      )}
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-md mx-auto">{description}</p>
      <div className="flex items-center justify-center gap-3">
        {secondaryAction && (
          <button onClick={secondaryAction.onClick} className="btn-secondary">
            {secondaryAction.label}
          </button>
        )}
        {action && (
          <button onClick={action.onClick} className="btn-primary">
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
