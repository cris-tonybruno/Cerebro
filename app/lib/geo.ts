import { sb } from "./supabase";

// M5 — Localização: lugares conhecidos primeiro, reverse geocode cacheado depois.

export type Geo = { lat: number; lng: number };

function haversineM(a: Geo, b: Geo): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Resolve o rótulo do lugar: 1) lugar conhecido no raio, 2) cache, 3) Nominatim (e cacheia)
export async function resolvePlace(geo: Geo): Promise<string | null> {
  const { data: places } = await sb().from("known_places").select("name, lat, lng, radius_m");
  for (const p of places ?? []) {
    if (haversineM(geo, { lat: p.lat, lng: p.lng }) <= p.radius_m) return p.name;
  }

  const key = `${geo.lat.toFixed(3)},${geo.lng.toFixed(3)}`; // ~110m de granularidade
  const { data: cached } = await sb()
    .from("geocode_cache")
    .select("label")
    .eq("key", key)
    .maybeSingle();
  if (cached?.label) return cached.label;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${geo.lat}&lon=${geo.lng}&format=jsonv2&zoom=16&accept-language=pt`,
      { headers: { "User-Agent": "cerebro-pessoal/1.0 (projeto pessoal)" } }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const a = json.address ?? {};
    const label =
      [a.suburb ?? a.neighbourhood ?? a.road, a.city ?? a.town ?? a.village]
        .filter(Boolean)
        .join(", ") || json.display_name?.split(",").slice(0, 2).join(",");
    if (label) {
      await sb().from("geocode_cache").upsert({ key, label });
      return label;
    }
  } catch (err) {
    console.error("nominatim:", err);
  }
  return null;
}

export async function updateCurrentLocation(geo: Geo, source: string, label?: string | null) {
  const { error } = await sb()
    .from("current_location")
    .upsert({ id: 1, lat: geo.lat, lng: geo.lng, place_label: label ?? null, source, updated_at: new Date().toISOString() });
  if (error) console.error("current_location:", error.message);
}

export async function getCurrentLocation(): Promise<(Geo & { place_label: string | null; updated_at: string }) | null> {
  const { data } = await sb()
    .from("current_location")
    .select("lat, lng, place_label, updated_at")
    .eq("id", 1)
    .maybeSingle();
  return data ?? null;
}
