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
import { Ionicons } from '@expo/vector-icons';
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{member?.user.name || 'Member'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <MemberAvatar
            name={member?.user.name || 'Member'}
            avatarUrl={member?.user.avatarUrl}
            size={76}
            showBorder
            borderColor={THEME.colors.primary}
          />
          <Text style={styles.name}>{member?.user.name}</Text>
          <Text style={styles.email}>{member?.user.email}</Text>
          {member?.user.phone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={THEME.colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.phone}>{member.user.phone}</Text>
            </View>
          ) : null}
        </View>

        {/* Net Balance Hero Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>TRIP NET BALANCE</Text>
          <AmountText
            paise={memberBalance?.netBalancePaise || 0}
            size="large"
            style={styles.amountText}
          />
          <Text style={styles.balanceStatus}>
            {(memberBalance?.netBalancePaise || 0) > 0
              ? 'Owed money across the group'
              : (memberBalance?.netBalancePaise || 0) < 0
              ? 'Owes money to the group'
              : 'All settled up with zero balance'}
          </Text>
        </View>

        {/* Bilateral Direct Obligation */}
        {directObligation !== 0 && (
          <View style={styles.obligationCard}>
            <Text style={styles.obligationHeader}>DIRECT SETTLEMENT WITH YOU</Text>
            {directObligation > 0 ? (
              <View style={styles.obligationContent}>
                <Text style={styles.obligationText}>
                  {member?.user.name} owes you{' '}
                  <AmountText paise={directObligation} size="medium" colorType="credit" />
                </Text>
              </View>
            ) : (
              <View style={styles.obligationContent}>
                <Text style={styles.obligationText}>
                  You owe {member?.user.name}{' '}
                  <AmountText paise={-directObligation} size="medium" colorType="debt" />
                </Text>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() =>
                    navigation.navigate('AddPayment', {
                      tripId,
                      defaultReceiverMemberId: memberId,
                    })
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons name="send" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.payBtnText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Financial Metrics */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>FINANCIAL STATS</Text>
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
          <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.metricLabel}>Confirmed Payments Received</Text>
            <AmountText paise={memberBalance?.paymentsReceivedPaise || 0} size="medium" colorType="neutral" />
          </View>
        </View>

        {/* Payment QR Button */}
        {member?.user.paymentQrUrl && (
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.qrBtnText}>View {member?.user.name.split(' ')[0]}'s Payment QR</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Payment QR Modal */}
      <Modal
        visible={qrModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.qrTitle}>{member?.user.name}'s QR</Text>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Image
              source={{ uri: member?.user.paymentQrUrl }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
  },
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  name: {
    ...THEME.typography.h2,
    fontSize: 20,
    color: THEME.colors.textPrimary,
    marginTop: 10,
  },
  email: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phone: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 4,
    textAlign: 'center',
  },
  balanceStatus: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  obligationCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    padding: THEME.spacing.md,
    marginBottom: THEME.spacing.md,
  },
  obligationHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#0F766E',
    marginBottom: 8,
  },
  obligationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  obligationText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textPrimary,
    flex: 1,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: THEME.borderRadius.full,
    marginLeft: 10,
  },
  payBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.borderLight,
  },
  metricLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primaryDark,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.md,
    marginTop: 4,
    ...THEME.shadows.md,
  },
  qrBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  qrModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    ...THEME.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  qrTitle: {
    ...THEME.typography.h3,
    color: THEME.colors.textPrimary,
  },
  qrImage: {
    width: 220,
    height: 220,
    backgroundColor: '#F8FAFC',
    borderRadius: THEME.borderRadius.sm,
  },
});
