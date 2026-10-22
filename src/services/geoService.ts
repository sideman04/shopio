import type { City, Country, Region } from '@/types'
import { api } from './apiClient'
import { mapCity, mapCountry, mapRegion } from './mappers'

/** Public geography service — `/countries`, `/regions`, `/cities`. */

export async function fetchCountries(): Promise<Country[]> {
  const response = await api.get<Record<string, unknown>[]>('/countries', { anonymous: true })
  return (response.data ?? []).map(mapCountry)
}

export async function fetchRegions(countryCode?: string): Promise<Region[]> {
  const response = await api.get<Record<string, unknown>[]>('/regions', {
    anonymous: true,
    query: { country: countryCode },
  })
  return (response.data ?? []).map(mapRegion)
}

export async function fetchCities(regionId?: number): Promise<City[]> {
  const response = await api.get<Record<string, unknown>[]>('/cities', {
    anonymous: true,
    query: { region_id: regionId },
  })
  return (response.data ?? []).map(mapCity)
}

export async function fetchCity(id: number): Promise<City | undefined> {
  try {
    const response = await api.get<Record<string, unknown>>(`/cities/${id}`, { anonymous: true })
    return mapCity(response.data)
  } catch {
    return undefined
  }
}
