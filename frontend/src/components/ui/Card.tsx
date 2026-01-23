'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { HTMLAttributes, forwardRef } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white rounded-xl shadow-sm border border-gray-100',
      bordered: 'bg-white rounded-xl border-2 border-gray-200',
      elevated: 'bg-white rounded-xl shadow-lg',
    }
    
    return (
      <div
        ref={ref}
        className={twMerge(clsx(variants[variant], 'p-6', className))}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
