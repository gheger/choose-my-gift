// Fetches an image URL for a given destination name using Unsplash API with API key from .env

export async function fetchDestinationImage(name) {
  const key = import.meta.env.VITE_UNSPLASH_KEY;
  if (!key) {
    console.warn('No Unsplash API key found in VITE_UNSPLASH_KEY');
    return { url: '', alt: '', photographer: '', source: 'Unsplash' };
  }
  const apiUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(name)}&client_id=${key}&orientation=landscape&per_page=1`;
  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      console.error('Unsplash API error:', res.status, res.statusText);
      return await fetchWorldFallback(key);
    }
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].urls && data.results[0].urls.regular) {
      return {
        url: data.results[0].urls.regular,
        alt: data.results[0].alt_description || '',
        photographer: data.results[0].user?.name || '',
        source: 'Unsplash',
      };
    } else {
      console.warn('No Unsplash image found for', name, data);
      return await fetchWorldFallback(key);
    }
  } catch (e) {
    console.error('Error fetching Unsplash image:', e);
    return await fetchWorldFallback(key);
  }
}

async function fetchWorldFallback(key) {
  try {
    const url = `https://api.unsplash.com/search/photos?query=world&client_id=${key}&orientation=landscape&per_page=1`;
    const res = await fetch(url);
    if (!res.ok) return { url: '', alt: '', photographer: '', source: 'Unsplash' };
    const data = await res.json();
    if (data.results && data.results[0] && data.results[0].urls && data.results[0].urls.regular) {
      return {
        url: data.results[0].urls.regular,
        alt: data.results[0].alt_description || '',
        photographer: data.results[0].user?.name || '',
        source: 'Unsplash',
      };
    }
  } catch (e) {}
  return { url: '', alt: '', photographer: '', source: 'Unsplash' };
}
