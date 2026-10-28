import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface MemberAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  showBorder?: boolean;
  borderColor?: string;
}

export const MemberAvatar: React.FC<MemberAvatarProps> = ({
  name,
  avatarUrl,
  size = 40,
  showBorder = false,
  borderColor = '#FFFFFF',
}) => {
  const initials = (name || 'Member')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'M';

  // Deterministic palette based on name hash
  const colors = [
    '#0D9488', // Teal
    '#0284C7', // Sky
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F97316', // Orange
    '#10B981', // Emerald
  ];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  const borderStyle = showBorder
    ? {
        borderWidth: 2,
        borderColor: borderColor,
      }
    : null;

  if (avatarUrl && !avatarUrl.includes('dicebear')) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
          borderStyle,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        borderStyle,
      ]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(10, size * 0.38) }]}>
        {initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
