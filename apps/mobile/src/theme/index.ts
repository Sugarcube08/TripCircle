export const THEME = {
  colors: {
    // Brand Core
    primary: '#0D9488',       // Crisp Teal
    primaryDark: '#0F766E',   // Deep Teal
    primaryLight: 'rgba(13, 148, 136, 0.15)',  // Subtle Teal Glow
    mint: '#00F5A0',          // Electric Mint Accent
    emerald: '#10B981',       // Emerald Green (Positive settlements)
    cyan: '#0EA5E9',          // Electric Cyan Accent

    // Canvas & Cards (Sleek Midnight Obsidian Fintech Theme)
    background: '#0B0F19',    // Midnight Obsidian Canvas
    card: '#131B2E',          // Deep Obsidian Card
    cardAlt: '#1E293B',       // Slate Elevated Surface
    darkCanvas: '#0B0F19',    // Midnight Obsidian
    darkCard: '#131B2E',      // Deep Obsidian Card
    darkCardAlt: '#1E293B',   // Slate Dark Card

    // Typography (Crystal Clear Contrast on Obsidian)
    textPrimary: '#F8FAFC',   // Slate 50 (Crisp Bright White - High Contrast)
    textSecondary: '#94A3B8', // Slate 400 (Clean Readable Secondary)
    textMuted: '#64748B',     // Slate 500 (Subtle Captions & Subtitles)
    textLight: '#94A3B8',     // Slate 400 (Visible Placeholders & Secondary Details)

    // Financial Indicators
    credit: '#00F5A0',        // Owed to user (Electric Mint / Green)
    creditBg: 'rgba(0, 245, 160, 0.12)',
    creditBorder: 'rgba(0, 245, 160, 0.3)',
    debt: '#EF4444',          // User owes (Red)
    debtBg: 'rgba(239, 68, 68, 0.12)',
    debtBorder: 'rgba(239, 68, 68, 0.3)',
    pending: '#F59E0B',       // Pending action (Amber)
    pendingBg: 'rgba(245, 158, 11, 0.12)',
    pendingBorder: 'rgba(245, 158, 11, 0.3)',

    // UI Structure
    border: '#1E293B',        // Slate Dark Border
    borderLight: '#26334D',   // Soft Card Border
    borderDark: '#334155',    // Slate 700
    divider: '#1E293B',
    inputBg: '#172239',       // Elevated Input Background
    inputBorder: '#2D3B55',   // Refined Input Border

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
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 2,
    },
    md: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.45,
      shadowRadius: 16,
      elevation: 8,
    },
  },
  typography: {
    h1: { fontSize: 26, fontWeight: '700' as const, color: '#F8FAFC', letterSpacing: -0.5 },
    h2: { fontSize: 20, fontWeight: '700' as const, color: '#F8FAFC', letterSpacing: -0.3 },
    h3: { fontSize: 16, fontWeight: '600' as const, color: '#F8FAFC', letterSpacing: -0.2 },
    body: { fontSize: 15, fontWeight: '400' as const, color: '#F8FAFC', lineHeight: 22 },
    bodyMedium: { fontSize: 15, fontWeight: '500' as const, color: '#F8FAFC' },
    bodySmall: { fontSize: 13, fontWeight: '400' as const, color: '#94A3B8' },
    bodySmallMedium: { fontSize: 13, fontWeight: '500' as const, color: '#CBD5E1' },
    caption: { fontSize: 11, fontWeight: '600' as const, color: '#64748B', letterSpacing: 0.5 },
    amountLarge: { fontSize: 28, fontWeight: '800' as const, color: '#F8FAFC', letterSpacing: -0.5 },
    amountMedium: { fontSize: 18, fontWeight: '700' as const, color: '#F8FAFC', letterSpacing: -0.3 },
  },
};
