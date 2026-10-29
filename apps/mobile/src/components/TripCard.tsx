import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TripSummary } from '@tripcircle/contracts';
import { AmountText } from './AmountText';
import { THEME } from '../theme';
import { resolveMediaUrl } from '../utils/media';

interface TripCardProps {
  trip: TripSummary;
  onPress: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress }) => {
  const [coverError, setCoverError] = React.useState(false);
  const coverUrl = resolveMediaUrl(trip.coverImageUrl);
  const isSettled = trip.userNetBalancePaise === 0;
  const isOwed = trip.userNetBalancePaise > 0;
  const owes = trip.userNetBalancePaise < 0;

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Trip ${trip.name}, ${trip.status === 'CLOSED' ? 'Closed' : 'Active'}`}
    >
      {/* Cover Header */}
      {coverUrl && !coverError ? (
        <Image
          source={{ uri: coverUrl }}
          style={styles.coverImage}
          onError={() => setCoverError(true)}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholderCover}>
          <View style={styles.placeholderEmblem}>
            <Text style={styles.placeholderText}>
              {trip.name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
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
              <Ionicons name="lock-closed" size={11} color={THEME.colors.textMuted} style={{ marginRight: 3 }} />
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
            <Ionicons name="people-outline" size={13} color={THEME.colors.textSecondary} />
            <Text style={styles.metaText}>{trip.memberCount} members</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="receipt-outline" size={13} color={THEME.colors.textSecondary} />
            <Text style={styles.metaText}>{trip.expenseCount} expenses</Text>
          </View>

          {trip.destination ? (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={13} color={THEME.colors.textSecondary} />
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
            <Ionicons name="chevron-forward" size={16} color={THEME.colors.textMuted} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: THEME.colors.surface,
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
    height: 100,
    backgroundColor: THEME.colors.surfaceAlt,
  },
  placeholderCover: {
    height: 72,
    backgroundColor: THEME.colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  placeholderEmblem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.5,
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
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginRight: 8,
    letterSpacing: -0.3,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: THEME.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  closedText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: THEME.borderRadius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.colors.emerald,
    marginRight: 5,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.emerald,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: THEME.colors.textMuted,
    marginBottom: 4,
  },
  balanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: THEME.borderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  statusPillCredit: {
    backgroundColor: THEME.colors.creditBg,
    borderColor: THEME.colors.creditBorder,
  },
  statusPillDebt: {
    backgroundColor: THEME.colors.debtBg,
    borderColor: THEME.colors.debtBorder,
  },
  statusPillSettled: {
    backgroundColor: THEME.colors.settledBg,
    borderColor: THEME.colors.settledBorder,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
