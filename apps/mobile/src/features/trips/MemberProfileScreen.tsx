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
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiRequest } from '../../services/api';
import { MemberAvatar } from '../../components/MemberAvatar';
import { AmountText } from '../../components/AmountText';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { resolveMediaUrl } from '../../utils/media';
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
  const [downloadingQr, setDownloadingQr] = useState(false);

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
  const memberBalance = plan?.memberBalances?.find((b: any) => b.memberId === memberId);

  const memberName = member?.displayName || member?.user?.name || 'Offline Member';
  const memberEmail = member?.email || member?.user?.email || (member?.isDummy ? 'Offline Participant' : 'N/A');
  const memberPhone = member?.phone || member?.user?.phone;
  const isDummy = member?.isDummy || !member?.userId;

  // Find bilateral obligations involving this member
  const bilateral = plan?.bilateralObligations?.find((o: any) => o.otherMemberId === memberId);
  const directObligation = bilateral ? bilateral.amountPaise : 0;

  const handleSaveOrShareQr = async () => {
    const rawQrUrl = resolveMediaUrl(member?.user?.paymentQrUrl);
    if (!rawQrUrl) return;
    try {
      setDownloadingQr(true);
      const filename = `tripcircle_qr_${member.user?.id || memberId}.png`;
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const result = await FileSystem.downloadAsync(rawQrUrl, localUri);
      if (result.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(result.uri, {
            mimeType: 'image/png',
            dialogTitle: `Save or Share ${memberName}'s QR Code`,
          });
        } else {
          Alert.alert('QR Saved', `Payment QR code saved to temporary cache: ${result.uri}`);
        }
      } else {
        throw new Error(`Failed to download QR code (status ${result.status})`);
      }
    } catch (err) {
      Alert.alert('Error Saving QR', (err as Error).message);
    } finally {
      setDownloadingQr(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{memberName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <MemberAvatar
            name={memberName}
            avatarUrl={member?.user?.avatarUrl}
            size={76}
            showBorder
            borderColor={THEME.colors.primary}
          />
          <Text style={styles.name}>{memberName}</Text>
          <Text style={styles.email}>{memberEmail}</Text>
          {memberPhone ? (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={THEME.colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.phone}>{memberPhone}</Text>
            </View>
          ) : null}

          {isDummy && (
            <View style={styles.dummyNoticeBadge}>
              <Ionicons name="people-circle-outline" size={16} color={THEME.colors.mint} style={{ marginRight: 6 }} />
              <Text style={styles.dummyNoticeText}>
                Offline Participant — Fully calculated in all expenses and settlements
              </Text>
            </View>
          )}
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
                  {memberName} owes you{' '}
                  <AmountText paise={directObligation} size="medium" colorType="credit" />
                </Text>
              </View>
            ) : (
              <View style={styles.obligationContent}>
                <Text style={styles.obligationText}>
                  You owe {memberName}{' '}
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
        {member?.user?.paymentQrUrl ? (
          <TouchableOpacity
            style={styles.qrBtn}
            onPress={() => setQrModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.qrBtnText}>View {memberName.split(' ')[0]}'s Payment QR</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noQrNotice}>
            <Ionicons name="information-circle-outline" size={18} color={THEME.colors.textMuted} />
            <Text style={styles.noQrText}>
              {memberName} has not uploaded a payment QR code yet.
            </Text>
          </View>
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
              <View>
                <Text style={styles.qrTitle}>{memberName}'s Payment QR</Text>
                <Text style={styles.qrSubtitle}>Authorized participant settlement code</Text>
              </View>
              <TouchableOpacity onPress={() => setQrModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={THEME.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrContainer}>
              {resolveMediaUrl(member?.user?.paymentQrUrl) ? (
                <Image
                  source={{ uri: resolveMediaUrl(member?.user?.paymentQrUrl)! }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            {/* Recipient Account Name Verification Callout */}
            <View style={styles.verifyCallout}>
              <Ionicons name="shield-checkmark" size={16} color={THEME.colors.primary} />
              <Text style={styles.verifyCalloutText}>
                Confirm recipient is <Text style={styles.boldText}>{memberName}</Text> before approving payment in UPI app.
              </Text>
            </View>

            {/* Action Buttons: Save / Share QR & Pay Now */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.saveQrButton}
                onPress={handleSaveOrShareQr}
                disabled={downloadingQr}
                activeOpacity={0.85}
              >
                {downloadingQr ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.saveQrButtonText}>Save / Share QR</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.recordPayButton}
                onPress={() => {
                  setQrModalVisible(false);
                  navigation.navigate('AddPayment', {
                    tripId,
                    defaultReceiverMemberId: memberId,
                  });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={THEME.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.recordPayButtonText}>Record Payment</Text>
              </TouchableOpacity>
            </View>
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
    backgroundColor: THEME.colors.background,
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
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  name: {
    ...THEME.typography.h2,
    marginTop: THEME.spacing.sm,
  },
  email: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  phone: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textMuted,
  },
  dummyNoticeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.borderRadius.md,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.35)',
  },
  dummyNoticeText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
    flex: 1,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: THEME.spacing.sm,
  },
  amountText: {
    marginBottom: 4,
  },
  balanceStatus: {
    ...THEME.typography.bodySmall,
    color: THEME.colors.textSecondary,
  },
  obligationCard: {
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.primary,
  },
  obligationHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primary,
    letterSpacing: 0.8,
    marginBottom: THEME.spacing.sm,
  },
  obligationContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  obligationText: {
    ...THEME.typography.bodyMedium,
    fontWeight: '600',
    flex: 1,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: THEME.borderRadius.full,
    marginLeft: 12,
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
    ...THEME.typography.bodyMedium,
    color: THEME.colors.textSecondary,
  },
  qrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    paddingVertical: 14,
    borderRadius: THEME.borderRadius.lg,
    marginTop: 4,
    ...THEME.shadows.sm,
  },
  qrBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  noQrNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    gap: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  noQrText: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  qrModalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.xl,
    padding: THEME.spacing.lg,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  qrSubtitle: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  qrContainer: {
    width: 240,
    height: 240,
    backgroundColor: '#FFFFFF',
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  verifyCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  verifyCalloutText: {
    fontSize: 12,
    color: '#15803D',
    flex: 1,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '700',
  },
  modalActions: {
    width: '100%',
    gap: 8,
  },
  saveQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 12,
    width: '100%',
  },
  saveQrButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recordPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.md,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
    paddingVertical: 12,
    width: '100%',
  },
  recordPayButtonText: {
    color: THEME.colors.mint,
    fontSize: 14,
    fontWeight: '700',
  },
});
