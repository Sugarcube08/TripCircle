import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { formatPaiseToRupees } from '../utils/formatters';
import { THEME } from '../theme';

interface AmountTextProps {
  paise: number;
  size?: 'small' | 'medium' | 'large';
  showSign?: boolean;
  colorType?: 'auto' | 'credit' | 'debt' | 'neutral';
  style?: TextStyle;
}

export const AmountText: React.FC<AmountTextProps> = ({
  paise,
  size = 'medium',
  showSign = false,
  colorType = 'auto',
  style,
}) => {
  let textColor: string = THEME.colors.textPrimary;

  if (colorType === 'credit') {
    textColor = THEME.colors.credit;
  } else if (colorType === 'debt') {
    textColor = THEME.colors.debt;
  } else if (colorType === 'auto') {
    if (paise > 0) textColor = THEME.colors.credit;
    else if (paise < 0) textColor = THEME.colors.debt;
  }

  const fontStyle =
    size === 'large'
      ? THEME.typography.amountLarge
      : size === 'small'
      ? THEME.typography.bodySmall
      : THEME.typography.amountMedium;

  return (
    <Text style={[styles.text, fontStyle, { color: textColor }, style]}>
      {formatPaiseToRupees(paise, showSign)}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});
