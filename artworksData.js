import { zigguratssArtworkSources } from './zigguratssSources.js';

export const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80&auto=format",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80&auto=format",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=400&q=80&auto=format",
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80&auto=format",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80&auto=format",
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=400&q=80&auto=format"
];

export function createColorfulFallback(seed) {
  const s = (seed >>> 0) || 1;
  const hue1 = s % 360;
  const hue2 = (hue1 + 120) % 360;
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
      <rect width="400" height="400" fill="hsl(${hue1}, 70%, 60%)"/>
      <circle cx="${80 + (s % 240)}" cy="${80 + ((s >> 4) % 240)}" r="${40 + ((s >> 8) % 60)}" fill="hsl(${hue2}, 70%, 70%)" opacity="0.7"/>
      <circle cx="${200 + ((s >> 2) % 150)}" cy="${200 + ((s >> 6) % 150)}" r="${30 + ((s >> 10) % 50)}" fill="hsl(${(hue1 + 60) % 360}, 70%, 65%)" opacity="0.6"/>
    </svg>
  `)}`;
}

// Define categories with exactly 16 images each
const CATEGORIES = {
  Landscape: { start: 400, end: 415 }, // 16 images
  Abstract: { start: 116, end: 131 }, // 16 images
  Portrait: { start: 156, end: 171 }, // 16 images
  Conceptual: { start: 196, end: 211 }, // 16 images
  Figurative: { start: 236, end: 251 }, // 16 images
  'Urban abstraction': { start: 276, end: 291 } // 16 images
};

// Remove duplicates and filter valid URLs
const uniqueSources = [...new Set(zigguratssArtworkSources.filter(url => 
  url && typeof url === 'string' && url.includes('.jpg')
))];

console.log(`✅ Unique images in source: ${uniqueSources.length}`);

// Create ID to URL mapping
const idToUrl = new Map();
uniqueSources.forEach(url => {
  const match = url.match(/art-(\d+)\.jpg/);
  if (match) idToUrl.set(parseInt(match[1]), url);
});

// Build category maps with exactly 16 images each
const categoryMap = new Map();
Object.entries(CATEGORIES).forEach(([cat, range]) => {
  const images = [];
  for (let id = range.start; id <= range.end; id++) {
    const url = idToUrl.get(id);
    if (url) {
      images.push(url);
    } else {
      console.warn(`⚠️ Missing art-${id}.jpg for ${cat}, using fallback`);
      images.push(createColorfulFallback(id * 1000 + cat.length));
    }
  }
  categoryMap.set(cat, images);
});

export const artworksByCategory = {
  Landscape: categoryMap.get('Landscape') || [],
  Abstract: categoryMap.get('Abstract') || [],
  Portrait: categoryMap.get('Portrait') || [],
  Conceptual: categoryMap.get('Conceptual') || [],
  Figurative: categoryMap.get('Figurative') || [],
  'Urban abstraction': categoryMap.get('Urban abstraction') || []
};

export const artworks = [
  { id: 1, title: 'Landscape', category: 'Landscape', artist: 'Claude Monet', style: 'Impressionism', imageCount: 16 },
  { id: 2, title: 'Abstract', category: 'Abstract', artist: 'Wassily Kandinsky', style: 'Abstract Expressionism', imageCount: 16 },
  { id: 3, title: 'Portrait', category: 'Portrait', artist: 'John Singer Sargent', style: 'Realism', imageCount: 16 },
  { id: 4, title: 'Conceptual', category: 'Conceptual', artist: 'Marcel Duchamp', style: 'Dadaism', imageCount: 16 },
  { id: 5, title: 'Figurative', category: 'Figurative', artist: 'Edgar Degas', style: 'Baroque', imageCount: 16 },
  { id: 6, title: 'Urban abstraction', category: 'Urban abstraction', artist: 'Various', style: 'Contemporary', imageCount: 16 }
];

export function getArtworkSourcesForCategory(category) {
  return artworksByCategory[category] || [];
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function getSafeImagesForCategory(category, count, seed) {
  const pool = getArtworkSourcesForCategory(category);
  if (!pool.length) {
    return Array(count).fill(0).map((_, i) => createColorfulFallback(seed + i));
  }

  const rnd = mulberry32(seed);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Take exactly 16 images (or less if pool is smaller)
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  // Fill with fallbacks if needed
  while (selected.length < count) {
    selected.push(createColorfulFallback(seed + selected.length));
  }

  return selected;
}

// Verification
console.log('\n🔍 VERIFYING CATEGORIES (16 images each):');
Object.entries(artworksByCategory).forEach(([cat, imgs]) => {
  console.log(`${imgs.length === 16 ? '✅' : '❌'} ${cat}: ${imgs.length}/16 images`);
});