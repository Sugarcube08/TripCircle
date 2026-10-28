import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { TripSummary } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { THEME } from '../theme';

interface TripCardProps {
  trip: TripSummary;
  onPress: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress }) => {
  const isSettled = trip.userNetBalancePaise === 0;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      {trip.coverImageUrl ? (
        <Image source={{ uri: trip.coverImageUrl }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverImage, styles.placeholderCover]}>
          <Text style={styles.placeholderText}>{trip.name.substring(0, 2).toUpperCase()}</Text>
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.name}
          </Text>
          {trip.status === 'CLOSED' ? (
            <View style={styles.closedBadge}>
              <Text style={styles.closedText}>Closed</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.subtitle}>
          {trip.memberCount} members · {trip.expenseCount} expenses
          {trip.destination ? ` · ${trip.destination}` : ''}
        </Text>

        <View style={styles.footer}>
          <View>
            <Text style={styles.balanceLabel}>
              {isSettled
                ? 'All settled up'
                : trip.userNetBalancePaise > 0
                ? 'You are owed'
                : 'You owe'}
            </Text>
            <AmountText paise={trip.userNetBalancePaise} size="medium" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    marginHorizontal: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#E2E8F0',
  },
  placeholderCover: {
    backgroundColor: THEME.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  content: {
    padding: THEME.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...THEME.typography.h2,
    flex: 1,
  },
  closedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  closedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  subtitle: {
    ...THEME.typography.bodySmall,
    marginTop: 4,
  },
  footer: {
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.divider,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textSecondary,
    marginBottom: 2,
  },
});
