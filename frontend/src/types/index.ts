// User types
export interface User {
  id: number
  email: string
  username: string
  is_active: boolean
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterData {
  email: string
  username: string
  password: string
}

// Trip types
export type GenerationStatus = 'idle' | 'in_progress' | 'completed' | 'failed'
export type ParticipantRole = 'organizer' | 'participant'

export interface Participant {
  id: number
  user_id: number
  username: string
  role: ParticipantRole
  joined_at: string
}

export interface Trip {
  id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  invite_code: string
  generation_status: GenerationStatus
  generation_count: number
  created_by_id: number
  created_at: string
  participants?: Participant[]
}

export interface TripListItem {
  id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  generation_status: GenerationStatus
  participant_count: number
  is_organizer: boolean
}

export interface CreateTripData {
  title: string
  description?: string
  start_date: string
  end_date: string
}

// Preference types
export type PlaceType = 'museum' | 'park' | 'viewpoint' | 'food' | 'activity' | 'district' | 'other'

export interface Preference {
  id: number
  trip_id: number
  user_id: number
  username: string
  country: string
  city: string
  location: string | null
  place_type: PlaceType
  priority: number
  comment: string | null
  created_at: string
}

export interface CreatePreferenceData {
  country: string
  city: string
  location?: string
  place_type: PlaceType
  priority: number
  comment?: string
}

// Route types
export interface RouteOption {
  id: number
  trip_id: number
  option_number: number
  title: string
  description: string
  reasoning: string | null
  created_at: string
  vote_count: number
}

export interface GenerateRoutesResponse {
  status: string
  message: string
  routes: RouteOption[]
}

// Vote types
export interface Vote {
  id: number
  user_id: number
  route_option_id: number
  created_at: string
}

// API Error
export interface ApiError {
  detail: string
}
