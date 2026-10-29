export * from './categories';
export * from './activity';

export const THEME = {
  colors: {
    // Brand Core
    primary: '#0D9488', // Crisp Teal
    primaryDark: '#0F766E', // Deep Teal
    primaryLight: 'rgba(13, 148, 136, 0.15)', // Subtle Teal Glow
    primaryActive: '#14B8A6',
    mint: '#00F5A0', // Electric Mint Accent
    emerald: '#10B981', // Positive Status Accent
    cyan: '#0EA5E9', // Electric Cyan Accent

    // Surfaces & Hierarchy (Midnight Obsidian Fintech Theme)
    background: '#0B0F19', // Midnight Obsidian Canvas
    surface: '#131B2E', // Deep Obsidian Card / Surface
    surfaceElevated: '#1A233A', // Elevated Surface
    surfaceAlt: '#1E293B', // Slate Alternative Card
    surfaceSubtle: '#0F1626', // Subtle Inset / Form Well
    card: '#131B2E', // Deep Obsidian Card (Backwards compatible)
    cardAlt: '#1E293B', // Slate Card (Backwards compatible)
    darkCanvas: '#0B0F19',
    darkCard: '#131B2E',
    darkCardAlt: '#1E293B',

    // Typography (High-contrast, crystal-clear readability)
    textPrimary: '#F8FAFC', // Slate 50 (Crisp Bright White)
    textSecondary: '#94A3B8', // Slate 400 (Clean Secondary Details)
    textMuted: '#64748B', // Slate 500 (Subtle Captions & Subtitles)
    textLight: '#94A3B8', // Slate 400 (Visible Placeholders)
    textInverse: '#0B0F19', // Dark text on light accent pills

    // Financial Indicators (Strict Semantic Distinction)
    credit: '#00F5A0', // Owed to user (Electric Mint / Green)
    creditBg: 'rgba(0, 245, 160, 0.12)',
    creditBorder: 'rgba(0, 245, 160, 0.28)',
    debt: '#F87171', // User owes (Readable Red)
    debtBg: 'rgba(239, 68, 68, 0.12)',
    debtBorder: 'rgba(239, 68, 68, 0.28)',
    settled: '#94A3B8', // Exactly ₹0.00
    settledBg: 'rgba(148, 163, 184, 0.12)',
    settledBorder: 'rgba(148, 163, 184, 0.25)',

    // Payment Workflow Statuses
    confirmed: '#10B981',
    confirmedBg: 'rgba(16, 185, 129, 0.14)',
    confirmedBorder: 'rgba(16, 185, 129, 0.3)',
    pending: '#F59E0B',
    pendingBg: 'rgba(245, 158, 11, 0.14)',
    pendingBorder: 'rgba(245, 158, 11, 0.3)',
    disputed: '#EF4444',
    disputedBg: 'rgba(239, 68, 68, 0.14)',
    disputedBorder: 'rgba(239, 68, 68, 0.3)',
    cancelled: '#64748B',
    cancelledBg: 'rgba(100, 116, 139, 0.14)',
    cancelledBorder: 'rgba(100, 116, 139, 0.25)',

    // System Feedback
    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.14)',
    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.14)',
    error: '#EF4444',
    errorBg: 'rgba(239, 68, 68, 0.14)',
    info: '#38BDF8',
    infoBg: 'rgba(56, 189, 248, 0.14)',

    // Structure & Forms
    border: '#1E293B', // Slate Dark Border
    borderLight: '#26334D', // Soft Card Border
    borderDark: '#334155', // Focused Border
    focus: '#0D9488',
    divider: '#1E293B',
    inputBg: '#131B2E',
    inputBorder: '#26334D',
    inputFocusBorder: '#0D9488',

    // Static Utility Colors
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

  dimensions: {
    minTouchTarget: 44, // WCAG 2.1 AA accessible target
    headerHeight: 56,
    inputHeight: 52,
    buttonHeight: 48,
    buttonHeightSm: 36,
    buttonHeightLg: 54,
    avatarSm: 32,
    avatarMd: 40,
    avatarLg: 48,
    avatarXl: 72,
  },

  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  motion: {
    fast: 150,
    normal: 250,
    slow: 350,
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
} as const;
