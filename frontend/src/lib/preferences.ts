import api from './api'
import { Preference, CreatePreferenceData } from '@/types'

export async function getPreferences(tripId: number): Promise<Preference[]> {
  const response = await api.get<Preference[]>(`/api/trips/${tripId}/preferences`)
  return response.data
}

export async function createPreference(tripId: number, data: CreatePreferenceData): Promise<Preference> {
  const response = await api.post<Preference>(`/api/trips/${tripId}/preferences`, data)
  return response.data
}

export async function updatePreference(
  tripId: number, 
  prefId: number, 
  data: Partial<CreatePreferenceData>
): Promise<Preference> {
  const response = await api.patch<Preference>(`/api/trips/${tripId}/preferences/${prefId}`, data)
  return response.data
}

export async function deletePreference(tripId: number, prefId: number): Promise<void> {
  await api.delete(`/api/trips/${tripId}/preferences/${prefId}`)
}

export const PLACE_TYPE_LABELS: Record<string, string> = {
  museum: '🏛️ Музей',
  park: '🌳 Парк',
  viewpoint: '🏔️ Достопримечательность',
  food: '🍕 Еда',
  activity: '🎯 Активность',
  district: '🏘️ Район',
  other: '📍 Другое',
}

export const PLACE_TYPES = [
  { value: 'viewpoint', label: '🏔️ Достопримечательность' },
  { value: 'museum', label: '🏛️ Музей' },
  { value: 'park', label: '🌳 Парк' },
  { value: 'food', label: '🍕 Еда' },
  { value: 'activity', label: '🎯 Активность' },
  { value: 'district', label: '🏘️ Район' },
  { value: 'other', label: '📍 Другое' },
]

// Reactions
export const AVAILABLE_EMOJIS = ['👍', '❤️', '🔥', '🤩', '🙏', '😍']

export interface ReactionData {
  emoji: string
  count: number
  users: string[]
  user_reacted: boolean
}

export interface PreferenceReactions {
  preference_id: number
  reactions: ReactionData[]
}

export async function getTripReactions(tripId: number): Promise<PreferenceReactions[]> {
  const response = await api.get<PreferenceReactions[]>(`/api/preferences/trips/${tripId}/reactions`)
  return response.data
}

export async function addReaction(preferenceId: number, emoji: string): Promise<void> {
  await api.post(`/api/preferences/${preferenceId}/reactions`, { emoji })
}

export async function removeReaction(preferenceId: number): Promise<void> {
  await api.delete(`/api/preferences/${preferenceId}/reactions`)
}
