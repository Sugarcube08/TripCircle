import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  Modal,
  SafeAreaView,
} from 'react-native';
import { apiRequest } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AmountText } from '../../components/AmountText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { THEME } from '../../theme';

interface MemberProfileScreenProps {
  route: any;
  navigation: any;
}

export const MemberProfileScreen: React.FC<MemberProfileScreenProps> = ({
  route,
  navigation,
}) => {
  const { tripId, memberId } = route.params;
  const [trip, setTrip] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [tripData, planData] = await Promise.all([
          apiRequest(`/trips/${tripId}`),
          apiRequest(`/trips/${tripId}/settlement`),
        ]);
        setTrip(tripData);
        setPlan(planData);
      } catch (err) {
        Alert.alert('Error', (err as Error).message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [tripId]);

  if (loading) {
    return <LoadingIndicator message="Loading member profile..." />;
  }

  const member = trip?.members.find((m: any) => m.id === memberId);
  const memberBalance = plan?.memberBalances.find((b: any) => b.memberId === memberId);

  // Find bilateral obligations involving this member
  const bilateral = plan?.bilateralObligations.find((o: any) => o.otherMemberId === memberId);
  const directObligation = bilateral ? bilateral.amountPaise : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileHeader}>
          <MemberAvatar name={member?.user.name || 'Member'} avatarUrl={member?.user.avatarUrl} size={64} />
          <Text style={styles.name}>{member?.user.name}</Text>
          <Text style={styles.email}>{member?.user.email}</Text>
          {member?.user.phone ? <Text style={styles.phone}>{member?.user.phone}</Text> : null}
        </View>

        {/* Net Balance Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>TRIP NET BALANCE</Text>
          <AmountText paise={memberBalance?.netBalancePaise || 0} size="large" />
          <Text style={styles.balanceStatus}>
            {(memberBalance?.netBalancePaise || 0) > 0
              ? 'Owed money across the trip'
              : (memberBalance?.netBalancePaise || 0) < 0
              ? 'Owes money to the group'
              : 'All settled up'}
          </Text>
        </View>

        {/* Direct Obligation with Current User */}
        {directObligation !== 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>BETWEEN YOU AND {member?.user.name?.toUpperCase()}</Text>
            {directObligation > 0 ? (
              <Text style={styles.directText}>
                {member?.user.name} owes you{' '}
                <AmountText paise={directObligation} size="medium" colorType="credit" />
              </Text>
            ) : (
              <Text style={styles.directText}>
                You owe {member?.user.name}{' '}
                <AmountText paise={-directObligation} size="medium" colorType="debt" />
              </Text>
            )}
          </View>
        ) : null}

        {/* Financial Metrics */}
        <View style={styles.metricsCard}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Expenses Paid</Text>
            <AmountText paise={memberBalance?.totalPaidPaise || 0} size="medium" colorType="neutral" />
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Total Expense Share</Text>
            <AmountText paise={memberBalance?.totalExpenseSharePaise || 0} size="medium" colorType="neutral" />
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Confirmed Payments Made</Text>
            <AmountText paise={memberBalance?.paymentsMadePaise || 0} size="medium" colorType="neutral" />
          </View>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Confirmed Payments Received</Text>
            <AmountText paise={memberBalance?.paymentsReceivedPaise || 0} size="medium" colorType="neutral" />
          </View>
        </View>

        {/* Payment QR button */}
        {member?.user.paymentQrUrl ? (
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => setQrModalVisible(true)}
          >
            <Text style={styles.qrBtnText}>📷 View Payment QR Code</Text>
          </TouchableOpacity>
        ) : null}

        {/* Payment QR Modal */}
        <Modal
          visible={qrModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQrModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>{member?.user.name}'s Payment QR</Text>
              <Image source={{ uri: member?.user.paymentQrUrl }} style={styles.qrImage} />
              <TouchableOpacity
                style={styles.closeQrBtn}
                onPress={() => setQrModalVisible(false)}
              >
                <Text style={styles.closeQrText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scroll: {
    padding: THEME.spacing.md,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  name: {
    ...THEME.typography.h1,
    marginTop: 8,
  },
  email: {
    ...THEME.typography.bodySmall,
    marginTop: 2,
  },
  phone: {
    ...THEME.typography.bodySmall,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  balanceStatus: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginTop: 4,
  },
  directText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
  },
  metricsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.divider,
  },
  metricLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
  },
  qrBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
  },
  qrBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: 24,
    alignItems: 'center',
    width: 280,
  },
  qrTitle: {
    ...THEME.typography.h3,
    marginBottom: 16,
    textAlign: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
    backgroundColor: '#F1F5F9',
  },
  closeQrBtn: {
    marginTop: 20,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 6,
  },
  closeQrText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
});
