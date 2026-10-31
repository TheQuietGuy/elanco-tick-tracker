export type Level = 'low' | 'moderate' | 'high';
export interface Sighting { id: string; date: string; species: string; latinName: string; location: string; region: string; lat: number; lng: number; source: 'api' | 'user'; imageUrl: string | null; notes: string | null }
export interface Marker { location: string; region: string; lat: number; lng: number; count: number; recent: number; lastSeen: string; topSpecies: string | null }
export interface SpeciesInfo { species: string; latinName: string; hosts: string; habitat: string; peakMonths: number[]; identify: string; risk: string; severity: Level; sightings: number }
export interface City { name: string; region: string; lat: number; lng: number }
export interface Filters { from: string; to: string; species: string[]; location: string }
export interface Paged<T> { total: number; page: number; limit: number; pages: number; data: T[] }
export interface TrendPoint { period: string; start: string; count: number; bySpecies: Record<string, number> }
export interface SeasonMonth { month: number; total: number; bySpecies: Record<string, number> }
export interface Insights { total: number; byRegion: { region: string; count: number }[]; byLocation: { location: string; region: string; count: number }[]; bySpecies: { species: string; latinName: string; count: number }[] }
