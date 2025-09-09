export async function fetchPexelsImage(query: string): Promise<string | null> {
  try {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) return null;
    const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: apiKey },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.photos?.[0];
    if (!photo) return null;
    return photo.src?.medium || photo.src?.large || photo.src?.original || null;
  } catch {
    return null;
  }
}

