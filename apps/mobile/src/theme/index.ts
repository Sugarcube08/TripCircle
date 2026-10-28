export const THEME = {
  colors: {
    background: '#F8FAFC',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    primary: '#0D9488', // Teal
    primaryDark: '#0F766E',
    primaryLight: '#CCFBF1',
    credit: '#16A34A', // Money owed to user (Green)
    creditBg: '#DCFCE7',
    debt: '#DC2626',   // Money user owes (Red)
    debtBg: '#FEE2E2',
    pending: '#D97706', // Amber
    pendingBg: '#FEF3C7',
    border: '#E2E8F0',
    divider: '#F1F5F9',
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
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  typography: {
    h1: { fontSize: 26, fontWeight: '700' as const, color: '#0F172A' },
    h2: { fontSize: 20, fontWeight: '700' as const, color: '#0F172A' },
    h3: { fontSize: 17, fontWeight: '600' as const, color: '#0F172A' },
    body: { fontSize: 15, fontWeight: '400' as const, color: '#0F172A' },
    bodySmall: { fontSize: 13, fontWeight: '400' as const, color: '#64748B' },
    caption: { fontSize: 11, fontWeight: '500' as const, color: '#94A3B8' },
    amountLarge: { fontSize: 28, fontWeight: '800' as const },
    amountMedium: { fontSize: 18, fontWeight: '700' as const },
  },
};
