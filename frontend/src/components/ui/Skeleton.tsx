'use client'

interface SkeletonProps {
  className?: string
}

// Base skeleton element with shimmer effect
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div 
      className={`animate-shimmer bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
    />
  )
}

// Skeleton for trip cards in list
export function TripCardSkeleton() {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3 mb-4" />
      <div className="flex justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  )
}

// Skeleton for trips list page
export function TripsListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Skeleton for preference card
export function PreferenceCardSkeleton() {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-2">
        <div>
          <Skeleton className="h-4 w-16 mb-1" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-6 w-12 rounded" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

// Skeleton for preferences list
export function PreferencesListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <PreferenceCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Skeleton for route card
export function RouteCardSkeleton() {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-16 rounded" />
      </div>
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  )
}

// Skeleton for routes list
export function RoutesListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <RouteCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Skeleton for participant list
export function ParticipantsListSkeleton() {
  return (
    <div className="card">
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            {i === 1 && <Skeleton className="h-5 w-20 rounded-full" />}
          </div>
        ))}
      </div>
    </div>
  )
}

// Full trip detail page skeleton
export function TripDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
      </div>

      {/* Trip info skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <Skeleton className="h-8 w-64 mb-3" />
              <Skeleton className="h-4 w-96 mb-4" />
              <div className="flex gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8 py-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-24" />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
            <PreferencesListSkeleton />
          </div>
          <div>
            <Skeleton className="h-6 w-32 mb-4" />
            <ParticipantsListSkeleton />
          </div>
        </div>
      </main>
    </div>
  )
}
