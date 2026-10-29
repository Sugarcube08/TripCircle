import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { THEME } from '../../theme';

export interface BadgeProps {
  children?: React.ReactNode;
  label?: string;
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  size?: 'sm' | 'md';
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  label,
  variant = 'default',
  size = 'md',
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          container: { backgroundColor: THEME.colors.cardAlt, borderColor: THEME.colors.border },
          text: { color: THEME.colors.textSecondary },
        };
      case 'destructive':
        return {
          container: { backgroundColor: THEME.colors.debtBg, borderColor: THEME.colors.debtBorder },
          text: { color: THEME.colors.debt },
        };
      case 'success':
        return {
          container: { backgroundColor: THEME.colors.creditBg, borderColor: THEME.colors.creditBorder },
          text: { color: THEME.colors.credit },
        };
      case 'warning':
        return {
          container: { backgroundColor: THEME.colors.pendingBg, borderColor: THEME.colors.pendingBorder },
          text: { color: THEME.colors.pending },
        };
      case 'outline':
        return {
          container: { backgroundColor: 'transparent', borderColor: THEME.colors.border },
          text: { color: THEME.colors.textPrimary },
        };
      default:
        return {
          container: { backgroundColor: THEME.colors.primaryLight, borderColor: 'rgba(13, 148, 136, 0.3)' },
          text: { color: THEME.colors.primary },
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        vStyles.container,
        style,
      ]}
    >
      {icon}
      {label ? (
        <Text
          style={[
            styles.text,
            size === 'sm' ? styles.textSm : styles.textMd,
            vStyles.text,
            icon ? { marginLeft: 4 } : null,
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : (
        children
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sizeSm: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  sizeMd: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  text: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  textSm: {
    fontSize: 10,
  },
  textMd: {
    fontSize: 11,
  },
});
