export interface VenueInfo {
  name: string;
  city: string;
  lat: number;
  lon: number;
  altitudeM: number;
  country: "USA" | "MEX" | "CAN";
}

// WC 2026 stadiums — altitudes verified via Open-Elevation API 2026-06-27
const WC_2026_VENUES: (VenueInfo & { keywords: string[] })[] = [
  { name: "Estadio Azteca",          city: "Mexico City",  lat: 19.303, lon: -99.151,  altitudeM: 2287, country: "MEX", keywords: ["azteca", "mexico city", "ciudad de mexico", "cdmx"] },
  { name: "Estadio Akron",           city: "Guadalajara",  lat: 20.617, lon: -103.397, altitudeM: 1623, country: "MEX", keywords: ["akron", "guadalajara"] },
  { name: "Estadio BBVA",            city: "Monterrey",    lat: 25.669, lon: -100.246, altitudeM: 493,  country: "MEX", keywords: ["bbva", "monterrey"] },
  { name: "AT&T Stadium",            city: "Dallas",       lat: 32.748, lon: -97.093,  altitudeM: 180,  country: "USA", keywords: ["at&t", "att stadium", "dallas", "arlington"] },
  { name: "Hard Rock Stadium",       city: "Miami",        lat: 25.958, lon: -80.239,  altitudeM: 13,   country: "USA", keywords: ["hard rock", "miami", "miami gardens"] },
  { name: "SoFi Stadium",            city: "Los Angeles",  lat: 33.954, lon: -118.339, altitudeM: 86,   country: "USA", keywords: ["sofi", "los angeles", "inglewood", "la"] },
  { name: "MetLife Stadium",         city: "New York",     lat: 40.814, lon: -74.074,  altitudeM: 2,    country: "USA", keywords: ["metlife", "new york", "new jersey", "east rutherford"] },
  { name: "Levi's Stadium",          city: "San Francisco",lat: 37.403, lon: -121.970, altitudeM: 9,    country: "USA", keywords: ["levi", "san francisco", "santa clara", "bay area"] },
  { name: "Lumen Field",             city: "Seattle",      lat: 47.595, lon: -122.332, altitudeM: 16,   country: "USA", keywords: ["lumen", "seattle", "centurylink"] },
  { name: "Gillette Stadium",        city: "Boston",       lat: 42.091, lon: -71.264,  altitudeM: 12,   country: "USA", keywords: ["gillette", "boston", "foxborough", "foxboro", "new england"] },
  { name: "Arrowhead Stadium",       city: "Kansas City",  lat: 39.048, lon: -94.484,  altitudeM: 313,  country: "USA", keywords: ["arrowhead", "kansas city"] },
  { name: "Mercedes-Benz Stadium",   city: "Atlanta",      lat: 33.755, lon: -84.401,  altitudeM: 302,  country: "USA", keywords: ["mercedes", "atlanta"] },
  { name: "Lincoln Financial Field", city: "Philadelphia", lat: 39.901, lon: -75.168,  altitudeM: 4,    country: "USA", keywords: ["lincoln", "philadelphia"] },
  { name: "BC Place",                city: "Vancouver",    lat: 49.278, lon: -123.112, altitudeM: 20,   country: "CAN", keywords: ["bc place", "vancouver"] },
  { name: "BMO Field",               city: "Toronto",      lat: 43.633, lon: -79.419,  altitudeM: 76,   country: "CAN", keywords: ["bmo", "toronto"] },
  { name: "NRG Stadium",             city: "Houston",      lat: 29.685, lon: -95.411,  altitudeM: 15,   country: "USA", keywords: ["nrg", "houston"] },
  { name: "Estadio Banorte",         city: "Culiacán",     lat: 24.791, lon: -107.394, altitudeM: 60,   country: "MEX", keywords: ["banorte", "culiacan", "culiacán"] },
];

const DEFAULT_VENUE: VenueInfo = {
  name: "Unknown",
  city: "Unknown",
  lat: 0,
  lon: 0,
  altitudeM: 0,
  country: "USA",
};

export function resolveVenueInfo(venueName: string | null | undefined): VenueInfo | null {
  if (!venueName) return null;
  const norm = venueName.toLowerCase();
  const match = WC_2026_VENUES.find((v) => v.keywords.some((kw) => norm.includes(kw)));
  if (match) {
    const { keywords: _k, ...info } = match;
    return info;
  }
  return null;
}

export function resolveVenueInfoWithFallback(venueName: string | null | undefined): VenueInfo {
  return resolveVenueInfo(venueName) ?? DEFAULT_VENUE;
}
