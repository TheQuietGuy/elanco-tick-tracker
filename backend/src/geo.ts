// UK city reference data. The source API only supplies a city name, so coordinates and a region are resolved here.
export interface City { name: string; region: string; lat: number; lng: number }
export const CITIES: City[] = [
  { name: 'London', region: 'London', lat: 51.5074, lng: -0.1278 },
  { name: 'Birmingham', region: 'West Midlands', lat: 52.4862, lng: -1.8904 },
  { name: 'Manchester', region: 'North West', lat: 53.4808, lng: -2.2426 },
  { name: 'Liverpool', region: 'North West', lat: 53.4084, lng: -2.9916 },
  { name: 'Leeds', region: 'Yorkshire and the Humber', lat: 53.8008, lng: -1.5491 },
  { name: 'Sheffield', region: 'Yorkshire and the Humber', lat: 53.3811, lng: -1.4701 },
  { name: 'Newcastle', region: 'North East', lat: 54.9783, lng: -1.6178 },
  { name: 'Nottingham', region: 'East Midlands', lat: 52.9548, lng: -1.1581 },
  { name: 'Leicester', region: 'East Midlands', lat: 52.6369, lng: -1.1398 },
  { name: 'Bristol', region: 'South West', lat: 51.4545, lng: -2.5879 },
  { name: 'Southampton', region: 'South East', lat: 50.9097, lng: -1.4044 },
  { name: 'Cardiff', region: 'Wales', lat: 51.4816, lng: -3.1791 },
  { name: 'Glasgow', region: 'Scotland', lat: 55.8642, lng: -4.2518 },
  { name: 'Edinburgh', region: 'Scotland', lat: 55.9533, lng: -3.1883 },
];
const byKey = new Map(CITIES.map((c) => [c.name.toLowerCase(), c]));
export const findCity = (name: string): City | undefined => byKey.get(name.trim().toLowerCase());
