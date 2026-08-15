export interface GeocodeResult {
  latitude: number;
  longitude: number;
  place_name: string;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error("Mapbox token not configured");
  }

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");
  url.searchParams.set("types", "address,place,poi");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Geocoding failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    features?: Array<{
      center: [number, number];
      place_name: string;
    }>;
  };

  const feature = data.features?.[0];
  if (!feature) return null;

  return {
    longitude: feature.center[0],
    latitude: feature.center[1],
    place_name: feature.place_name,
  };
}
