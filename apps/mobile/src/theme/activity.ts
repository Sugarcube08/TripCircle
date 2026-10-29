import { Ionicons } from '@expo/vector-icons';

export interface ActivityVisualConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  border: string;
}

/**
 * Centralized mapping for activity log & notification events.
 * Provides accessible, semantic visual indicators calibrated for dark surfaces.
 */
export function getActivityConfig(type?: string | null, title?: string | null): ActivityVisualConfig {
  const combined = `${type || ''} ${title || ''}`.toLowerCase();

  if (combined.includes('payment_confirmed') || (combined.includes('payment') && combined.includes('confirm'))) {
    return {
      icon: 'checkmark-circle-outline',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.15)',
      border: 'rgba(16, 185, 129, 0.3)',
    };
  }

  if (combined.includes('payment_disputed') || combined.includes('dispute')) {
    return {
      icon: 'alert-circle-outline',
      color: '#EF4444',
      bg: 'rgba(239, 68, 68, 0.15)',
      border: 'rgba(239, 68, 68, 0.3)',
    };
  }

  if (combined.includes('payment') || combined.includes('transfer')) {
    return {
      icon: 'paper-plane-outline',
      color: '#38BDF8',
      bg: 'rgba(56, 189, 248, 0.15)',
      border: 'rgba(56, 189, 248, 0.3)',
    };
  }

  if (combined.includes('expense') || combined.includes('spent') || combined.includes('paid')) {
    return {
      icon: 'receipt-outline',
      color: '#00F5A0',
      bg: 'rgba(0, 245, 160, 0.15)',
      border: 'rgba(0, 245, 160, 0.3)',
    };
  }

  if (combined.includes('member') || combined.includes('invite') || combined.includes('join')) {
    return {
      icon: 'person-add-outline',
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.15)',
      border: 'rgba(139, 92, 246, 0.3)',
    };
  }

  if (combined.includes('discount') || combined.includes('waive')) {
    return {
      icon: 'pricetag-outline',
      color: '#F59E0B',
      bg: 'rgba(245, 158, 11, 0.15)',
      border: 'rgba(245, 158, 11, 0.3)',
    };
  }

  if (combined.includes('close') || combined.includes('lock')) {
    return {
      icon: 'lock-closed-outline',
      color: '#94A3B8',
      bg: 'rgba(148, 163, 184, 0.15)',
      border: 'rgba(148, 163, 184, 0.3)',
    };
  }

  return {
    icon: 'notifications-outline',
    color: '#0D9488',
    bg: 'rgba(13, 148, 136, 0.15)',
    border: 'rgba(13, 148, 136, 0.3)',
  };
}
