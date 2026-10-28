export const THEME = {
  colors: {
    // Brand Core
    primary: '#0D9488',       // Crisp Teal
    primaryDark: '#0F766E',   // Deep Teal
    primaryLight: '#F0FDFA',  // Ultra Light Teal
    mint: '#00F5A0',          // Electric Mint Accent
    emerald: '#10B981',       // Emerald Green
    cyan: '#0EA5E9',          // Electric Cyan Accent

    // Canvas & Cards (Light & Dark)
    background: '#F8FAFC',    // Modern Light Gray Canvas
    card: '#FFFFFF',          // Pure White Card
    cardAlt: '#F1F5F9',       // Subtle Gray Surface
    darkCanvas: '#0B0F19',    // Midnight Obsidian
    darkCard: '#131B2E',      // Deep Obsidian Card
    darkCardAlt: '#1E293B',   // Slate Dark Card

    // Typography
    textPrimary: '#0F172A',   // Slate 900
    textSecondary: '#475569', // Slate 600
    textMuted: '#94A3B8',     // Slate 400
    textLight: '#F8FAFC',     // Slate 50

    // Financial Indicators
    credit: '#10B981',        // Owed to user (Emerald Green)
    creditBg: '#ECFDF5',      // Mint/Green soft bg
    creditBorder: '#A7F3D0',
    debt: '#EF4444',          // User owes (Red)
    debtBg: '#FEF2F2',        // Red soft bg
    debtBorder: '#FECACA',
    pending: '#F59E0B',       // Pending action (Amber)
    pendingBg: '#FFFBEB',
    pendingBorder: '#FDE68A',

    // UI Structure
    border: '#E2E8F0',        // Slate 200
    borderLight: '#F1F5F9',   // Slate 100
    borderDark: '#334155',    // Slate 700
    divider: '#E2E8F0',
    inputBg: '#FFFFFF',
    inputBorder: '#CBD5E1',

    // Category Badges
    categories: {
      food: '#F97316',
      stay: '#8B5CF6',
      transport: '#3B82F6',
      drinks: '#EC4899',
      activities: '#10B981',
      shopping: '#F59E0B',
      other: '#64748B',
    },

    white: '#FFFFFF',
    black: '#000000',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  typography: {
    h1: { fontSize: 26, fontWeight: '700' as const, color: '#0F172A', letterSpacing: -0.5 },
    h2: { fontSize: 20, fontWeight: '700' as const, color: '#0F172A', letterSpacing: -0.3 },
    h3: { fontSize: 16, fontWeight: '600' as const, color: '#0F172A', letterSpacing: -0.2 },
    body: { fontSize: 15, fontWeight: '400' as const, color: '#0F172A', lineHeight: 22 },
    bodyMedium: { fontSize: 15, fontWeight: '500' as const, color: '#0F172A' },
    bodySmall: { fontSize: 13, fontWeight: '400' as const, color: '#64748B' },
    bodySmallMedium: { fontSize: 13, fontWeight: '500' as const, color: '#475569' },
    caption: { fontSize: 11, fontWeight: '600' as const, color: '#94A3B8', letterSpacing: 0.5 },
    amountLarge: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    amountMedium: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  },
};
