/**
 * Event Cover Image Utility
 *
 * Fetches cover images from Unsplash based on event keywords
 * and caches them locally in localStorage.
 */

const COVER_CACHE_KEY = 'aircal-event-covers';
// Using Picsum Photos - high quality, seeded images (consistent per event type)
const IMAGE_BASE_URL = 'https://picsum.photos';

interface EventCover {
  keywords: string[];
  imageUrl: string;
  fetchedAt: number;
}

type CoverCache = Record<string, EventCover>;

// Extract keywords from event data
export function extractKeywords(
  summary: string,
  description?: string | null,
  location?: string | null
): string[] {
  const keywords: string[] = [];

  // Extract emojis from summary
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const emojis = summary.match(emojiRegex) || [];

  // Map common emojis to keywords
  const emojiMap: Record<string, string> = {
    '☕': 'coffee',
    '🍵': 'tea',
    '🏃': 'running',
    '🏋️': 'gym fitness',
    '💪': 'workout',
    '📚': 'books reading',
    '✍️': 'writing',
    '💻': 'computer work',
    '🎨': 'art creative',
    '🎵': 'music',
    '🎸': 'guitar music',
    '🎹': 'piano music',
    '🍽️': 'dinner food',
    '🍳': 'breakfast cooking',
    '🥗': 'healthy food salad',
    '✈️': 'travel airplane',
    '🚗': 'driving car',
    '🏠': 'home',
    '🏢': 'office work',
    '👥': 'meeting people',
    '📞': 'phone call',
    '📧': 'email',
    '🧘': 'yoga meditation',
    '😴': 'sleep rest',
    '🎉': 'party celebration',
    '🎂': 'birthday cake',
    '💼': 'business work',
    '📊': 'presentation charts',
    '🏥': 'hospital medical',
    '🦷': 'dentist',
    '💇': 'haircut salon',
    '🛒': 'shopping',
    '🏖️': 'beach vacation',
    '⛷️': 'skiing winter',
    '🎬': 'movie film',
    '📺': 'tv watching',
    '🎮': 'gaming',
    '🍺': 'drinks bar',
    '🍷': 'wine dinner',
  };

  emojis.forEach(emoji => {
    if (emojiMap[emoji]) {
      keywords.push(...emojiMap[emoji].split(' '));
    }
  });

  // Clean summary (remove emojis and special chars)
  const cleanSummary = summary
    .replace(emojiRegex, '')
    .replace(/[^\w\s]/g, ' ')
    .toLowerCase()
    .trim();

  // Common meeting/event words to filter out
  const stopWords = new Set([
    'meeting', 'call', 'sync', 'check', 'review', 'update', 'weekly',
    'daily', 'monthly', 'the', 'a', 'an', 'and', 'or', 'with', 'for',
    'to', 'from', 'in', 'on', 'at', 'by', 'up', 'down', 'out', 'off',
    'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'than', 'too', 'very', 'just', 'should', 'now', 'status', 'progress',
  ]);

  // Add meaningful words from summary
  cleanSummary.split(/\s+/).forEach(word => {
    if (word.length > 2 && !stopWords.has(word)) {
      keywords.push(word);
    }
  });

  // Add location keywords if available
  if (location) {
    const cleanLocation = location
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Add all meaningful location words (not just specific ones)
    cleanLocation.slice(0, 2).forEach(word => {
      keywords.push(word);
    });
  }

  // Add keywords from description if available
  if (description) {
    const cleanDesc = description
      .replace(emojiRegex, '')
      .replace(/[^\w\s]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 3); // Only take first few meaningful words

    keywords.push(...cleanDesc);
  }

  // Remove duplicates and limit
  return [...new Set(keywords)].slice(0, 5);
}

// Create a normalized key for the event type (for caching)
export function getEventTypeKey(summary: string): string {
  // Remove emojis, lowercase, and normalize
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  return summary
    .replace(emojiRegex, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Load cache from localStorage
function loadCoverCache(): CoverCache {
  try {
    const cached = localStorage.getItem(COVER_CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
}

// Save cache to localStorage
function saveCoverCache(cache: CoverCache): void {
  try {
    localStorage.setItem(COVER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

// Simple hash function to create consistent seed from keywords
function hashKeywords(keywords: string[]): string {
  const str = keywords.join('-');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

// Get image URL using Picsum Photos with seeded images
// Same keywords = same image (consistent), high quality photos
export function getUnsplashUrl(keywords: string[], width = 800, height = 400): string {
  // Picsum seed format: https://picsum.photos/seed/{seed}/width/height
  const seed = hashKeywords(keywords);
  return `${IMAGE_BASE_URL}/seed/${seed}/${width}/${height}`;
}

// Fetch and cache cover image for an event type
export async function fetchEventCover(
  summary: string,
  description?: string | null,
  location?: string | null
): Promise<string | null> {
  const key = getEventTypeKey(summary);
  if (!key) return null;

  const cache = loadCoverCache();

  // Check if we have a cached image (valid for 7 days)
  const cached = cache[key];
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  if (cached && Date.now() - cached.fetchedAt < oneWeek) {
    return cached.imageUrl;
  }

  // Extract keywords and fetch new image
  const keywords = extractKeywords(summary, description, location);
  if (keywords.length === 0) {
    // Default keywords if none found
    keywords.push('abstract', 'minimal');
  }

  const imageUrl = getUnsplashUrl(keywords);

  // Store in cache
  cache[key] = {
    keywords,
    imageUrl,
    fetchedAt: Date.now(),
  };
  saveCoverCache(cache);

  return imageUrl;
}

// Get cached cover for an event (sync, doesn't fetch)
export function getCachedCover(summary: string): EventCover | null {
  const key = getEventTypeKey(summary);
  if (!key) return null;

  const cache = loadCoverCache();
  return cache[key] || null;
}

// Clear the cover cache
export function clearCoverCache(): void {
  localStorage.removeItem(COVER_CACHE_KEY);
}

// Test function to demonstrate the system
export async function testEventCoverFetch(): Promise<{
  summary: string;
  keywords: string[];
  imageUrl: string;
}[]> {
  const testEvents = [
    { summary: '☕ Morning Routine', description: 'Coffee and planning', location: null },
    { summary: '💻 Deep Work', description: 'Focus time for coding', location: 'Home Office' },
    { summary: '🏋️ Gym Session', description: 'Workout and cardio', location: 'Fitness Center' },
    { summary: '📚 Reading + Writing', description: 'Personal development', location: null },
    { summary: 'Team Standup', description: 'Daily sync with team', location: 'Conference Room' },
    { summary: '🎉 Birthday Party', description: 'Celebration!', location: 'Restaurant' },
    { summary: 'Dentist Appointment', description: null, location: 'Medical Center' },
    { summary: '✈️ Flight to NYC', description: 'Business trip', location: 'Airport' },
  ];

  const results = [];

  for (const event of testEvents) {
    const keywords = extractKeywords(event.summary, event.description, event.location);
    const imageUrl = await fetchEventCover(event.summary, event.description, event.location);

    results.push({
      summary: event.summary,
      keywords,
      imageUrl: imageUrl || '',
    });
  }

  return results;
}
