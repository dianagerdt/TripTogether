'use client'

import { useEffect, useState } from 'react'

const GENERATION_STEPS = [
  { emoji: '📊', text: 'Анализируем пожелания участников...' },
  { emoji: '🗺️', text: 'Изучаем географию и расстояния...' },
  { emoji: '🤔', text: 'Ищем оптимальные маршруты...' },
  { emoji: '⚖️', text: 'Балансируем интересы всех участников...' },
  { emoji: '✨', text: 'Генерируем финальные варианты...' },
]

interface GenerationProgressProps {
  isGenerating: boolean
}

export function GenerationProgress({ isGenerating }: GenerationProgressProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isGenerating) {
      setCurrentStep(0)
      setProgress(0)
      return
    }

    // Progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev
        return prev + Math.random() * 3
      })
    }, 200)

    // Step animation
    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % GENERATION_STEPS.length)
    }, 3000)

    return () => {
      clearInterval(progressInterval)
      clearInterval(stepInterval)
    }
  }, [isGenerating])

  if (!isGenerating) return null

  const step = GENERATION_STEPS[currentStep]

  return (
    <div className="card mb-6 overflow-hidden animate-fade-in-up">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary-50 via-accent-50 to-primary-50 animate-shimmer bg-[length:200%_100%] opacity-50" />
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center animate-pulse-slow">
            <span className="text-2xl animate-bounce-slow">{step.emoji}</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI генерирует маршруты</h3>
            <p className="text-sm text-gray-500 animate-fade-in" key={currentStep}>
              {step.text}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between mt-4">
          {GENERATION_STEPS.map((s, i) => (
            <div 
              key={i}
              className={`flex flex-col items-center transition-all duration-300 ${i <= currentStep ? 'opacity-100 scale-100' : 'opacity-40 scale-90'}`}
            >
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-300 ${
                  i < currentStep 
                    ? 'bg-green-100 text-green-600' 
                    : i === currentStep 
                      ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-300 ring-offset-2' 
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {i < currentStep ? '✓' : s.emoji}
              </div>
            </div>
          ))}
        </div>

        {/* Fun facts during wait */}
        <div className="mt-4 p-3 bg-white/50 rounded-lg text-center">
          <p className="text-xs text-gray-500">
            💡 Знаете ли вы? AI анализирует расстояния, время в пути и популярность мест для создания оптимального маршрута
          </p>
        </div>
      </div>
    </div>
  )
}
