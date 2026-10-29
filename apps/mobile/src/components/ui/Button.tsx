import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { THEME } from '../../theme';

export interface ButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle | TextStyle[];
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  title,
  variant = 'default',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return styles.variantSecondary;
      case 'outline':
        return styles.variantOutline;
      case 'ghost':
        return styles.variantGhost;
      case 'destructive':
        return styles.variantDestructive;
      default:
        return styles.variantDefault;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  const getTextColor = (): string => {
    if (disabled) return THEME.colors.textMuted;
    switch (variant) {
      case 'outline':
      case 'ghost':
        return THEME.colors.textPrimary;
      case 'secondary':
        return THEME.colors.primary;
      case 'destructive':
        return '#FFFFFF';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        getVariantStyle(),
        getSizeStyle(),
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          {title ? (
            <Text
              style={[
                styles.text,
                { color: getTextColor() },
                icon ? { marginLeft: 8 } : null,
                textStyle,
              ]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: THEME.borderRadius.md,
    minHeight: THEME.dimensions.minTouchTarget,
  },
  variantDefault: {
    backgroundColor: THEME.colors.primary,
  },
  variantSecondary: {
    backgroundColor: THEME.colors.primaryLight,
  },
  variantOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  variantGhost: {
    backgroundColor: 'transparent',
  },
  variantDestructive: {
    backgroundColor: THEME.colors.debt,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sizeLg: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
  },
});
