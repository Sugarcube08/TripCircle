import { Ionicons } from '@expo/vector-icons';

export interface CategoryVisualConfig {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  border: string;
}

export const CATEGORY_CONFIGS: Record<string, CategoryVisualConfig> = {
  FOOD_DINING: {
    key: 'FOOD_DINING',
    name: 'Food & Dining',
    icon: 'restaurant-outline',
    color: '#F97316',
    bg: 'rgba(249, 115, 22, 0.14)',
    border: 'rgba(249, 115, 22, 0.28)',
  },
  TRANSPORT: {
    key: 'TRANSPORT',
    name: 'Transport',
    icon: 'car-outline',
    color: '#38BDF8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: 'rgba(56, 189, 248, 0.28)',
  },
  ACCOMMODATION: {
    key: 'ACCOMMODATION',
    name: 'Accommodation',
    icon: 'bed-outline',
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.14)',
    border: 'rgba(139, 92, 246, 0.28)',
  },
  SHOPPING: {
    key: 'SHOPPING',
    name: 'Shopping',
    icon: 'bag-handle-outline',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.28)',
  },
  ACTIVITIES_ENTERTAINMENT: {
    key: 'ACTIVITIES_ENTERTAINMENT',
    name: 'Activities & Fun',
    icon: 'ticket-outline',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.28)',
  },
  GROCERIES: {
    key: 'GROCERIES',
    name: 'Groceries',
    icon: 'cart-outline',
    color: '#14B8A6',
    bg: 'rgba(20, 184, 166, 0.14)',
    border: 'rgba(20, 184, 166, 0.28)',
  },
  FUEL: {
    key: 'FUEL',
    name: 'Fuel',
    icon: 'flash-outline',
    color: '#EC4899',
    bg: 'rgba(236, 72, 153, 0.14)',
    border: 'rgba(236, 72, 153, 0.28)',
  },
  TICKETS_RESERVATIONS: {
    key: 'TICKETS_RESERVATIONS',
    name: 'Tickets',
    icon: 'calendar-outline',
    color: '#6366F1',
    bg: 'rgba(99, 102, 241, 0.14)',
    border: 'rgba(99, 102, 241, 0.28)',
  },
  MISCELLANEOUS: {
    key: 'MISCELLANEOUS',
    name: 'General',
    icon: 'receipt-outline',
    color: '#0D9488',
    bg: 'rgba(13, 148, 136, 0.14)',
    border: 'rgba(13, 148, 136, 0.28)',
  },
};

const DEFAULT_CONFIG: CategoryVisualConfig = {
  key: 'MISCELLANEOUS',
  name: 'General',
  icon: 'receipt-outline',
  color: '#0D9488',
  bg: 'rgba(13, 148, 136, 0.14)',
  border: 'rgba(13, 148, 136, 0.28)',
};

/**
 * Centrally maps a category key, name, or arbitrary label to its standard
 * icon glyph, accent color, and dark-mode surface tint.
 */
export function getCategoryConfig(keyOrName?: string | null): CategoryVisualConfig {
  if (!keyOrName) return DEFAULT_CONFIG;

  const normalized = keyOrName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  if (CATEGORY_CONFIGS[normalized]) {
    return CATEGORY_CONFIGS[normalized];
  }

  // Fuzzy match on lowercase string
  const lower = keyOrName.toLowerCase();
  if (lower.includes('food') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('meal') || lower.includes('drink')) {
    return CATEGORY_CONFIGS.FOOD_DINING;
  }
  if (lower.includes('travel') || lower.includes('cab') || lower.includes('taxi') || lower.includes('flight') || lower.includes('transport') || lower.includes('car')) {
    return CATEGORY_CONFIGS.TRANSPORT;
  }
  if (lower.includes('stay') || lower.includes('hotel') || lower.includes('room') || lower.includes('resort') || lower.includes('airbnb')) {
    return CATEGORY_CONFIGS.ACCOMMODATION;
  }
  if (lower.includes('grocer') || lower.includes('market') || lower.includes('supermarket')) {
    return CATEGORY_CONFIGS.GROCERIES;
  }
  if (lower.includes('activity') || lower.includes('ticket') || lower.includes('tour') || lower.includes('entertainment')) {
    return CATEGORY_CONFIGS.ACTIVITIES_ENTERTAINMENT;
  }
  if (lower.includes('fuel') || lower.includes('gas') || lower.includes('petrol')) {
    return CATEGORY_CONFIGS.FUEL;
  }
  if (lower.includes('shop') || lower.includes('mall') || lower.includes('souvenir')) {
    return CATEGORY_CONFIGS.SHOPPING;
  }

  return DEFAULT_CONFIG;
}
