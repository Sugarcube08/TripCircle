import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripSummary } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { THEME } from '../theme';

interface TripCardProps {
  trip: TripSummary;
  onPress: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress }) => {
  const isSettled = trip.userNetBalancePaise === 0;
  const isOwed = trip.userNetBalancePaise > 0;
  const owes = trip.userNetBalancePaise < 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Cover Header */}
      {trip.coverImageUrl ? (
        <Image source={{ uri: trip.coverImageUrl }} style={styles.coverImage} />
      ) : (
        <View style={styles.placeholderCover}>
          <View style={styles.placeholderEmblem}>
            <Text style={styles.placeholderText}>
              {trip.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.placeholderGlow} />
        </View>
      )}

      {/* Card Body */}
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {trip.name}
          </Text>
          {trip.status === 'CLOSED' ? (
            <View style={styles.closedBadge}>
              <Ionicons name="lock-closed" size={12} color="#64748B" style={{ marginRight: 3 }} />
              <Text style={styles.closedText}>Closed</Text>
            </View>
          ) : (
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          )}
        </View>

        {/* Metadata Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={THEME.colors.textSecondary} />
            <Text style={styles.metaText}>{trip.memberCount} members</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="receipt-outline" size={14} color={THEME.colors.textSecondary} />
            <Text style={styles.metaText}>{trip.expenseCount} expenses</Text>
          </View>

          {trip.destination ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={14} color={THEME.colors.textSecondary} />
              <Text style={styles.metaText} numberOfLines={1}>
                {trip.destination}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Balance Footer */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.balanceLabel}>
              {isSettled
                ? 'Your Balance'
                : isOwed
                ? 'You are owed'
                : 'You owe'}
            </Text>
            <View style={styles.balanceStatusRow}>
              <View
                style={[
                  styles.statusPill,
                  isOwed && styles.statusPillCredit,
                  owes && styles.statusPillDebt,
                  isSettled && styles.statusPillSettled,
                ]}
              >
                <AmountText
                  paise={trip.userNetBalancePaise}
                  size="medium"
                  colorType={isOwed ? 'credit' : owes ? 'debt' : 'neutral'}
                />
              </View>
            </View>
          </View>

          <View style={styles.arrowBtn}>
            <Ionicons name="chevron-forward" size={18} color={THEME.colors.textMuted} />
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
    ...THEME.shadows.sm,
  },
  coverImage: {
    width: '100%',
    height: 110,
    backgroundColor: '#E2E8F0',
  },
  placeholderCover: {
    height: 90,
    backgroundColor: THEME.colors.darkCanvas,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: THEME.colors.primary,
    opacity: 0.15,
  },
  placeholderEmblem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00F5A0',
    letterSpacing: 1,
  },
  content: {
    padding: THEME.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    ...THEME.typography.h2,
    flex: 1,
    marginRight: THEME.spacing.sm,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  closedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.creditBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.credit,
    marginRight: 4,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.credit,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
    marginBottom: THEME.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.borderLight,
    marginVertical: THEME.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: THEME.spacing.xs,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  balanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    borderRadius: THEME.borderRadius.sm,
    paddingVertical: 1,
  },
  statusPillCredit: {},
  statusPillDebt: {},
  statusPillSettled: {},
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
