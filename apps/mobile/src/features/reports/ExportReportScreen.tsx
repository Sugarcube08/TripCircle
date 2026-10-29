import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl } from '../../services/api';
import { getAccessToken } from '../../storage/secureStore';
import { dialog } from '../../components/ui';
import { THEME } from '../../theme';

interface ExportReportScreenProps {
  route: any;
  navigation: any;
}

export const ExportReportScreen: React.FC<ExportReportScreenProps> = ({
  route,
  navigation,
}) => {
  const { tripId } = route.params;
  const [reportType, setReportType] = useState<'TRIP_LEDGER' | 'INDIVIDUAL'>('TRIP_LEDGER');
  const [format, setFormat] = useState<'PDF' | 'XLSX'>('PDF');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/trips/${tripId}/reports/export?reportType=${reportType}&format=${format}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Report export failed with status: ${res.status}`);
      }

      await dialog.alert(
        'Report Generated',
        `Your ${format} report (${reportType === 'TRIP_LEDGER' ? 'Complete Trip Ledger' : 'Individual Statement'}) was generated successfully and verified with exact paise accounting.`,
        'success'
      );
      navigation.goBack();
    } catch (err) {
      dialog.alert('Export Error', (err as Error).message, 'error');
    } finally {
      setLoading(false);
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
        <Text style={styles.headerTitle}>Export Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Intro Banner */}
        <View style={styles.introCard}>
          <Ionicons name="document-text" size={32} color={THEME.colors.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.introTitle}>Auditable Financial Statements</Text>
          <Text style={styles.introText}>
            Generate verified, zero-sum financial records for this trip with full paise precision.
          </Text>
        </View>

        {/* Report Scope Selection */}
        <Text style={styles.sectionHeader}>SELECT REPORT TYPE</Text>
        <View style={styles.choiceGroup}>
          <TouchableOpacity
            style={[styles.choiceCard, reportType === 'TRIP_LEDGER' && styles.selectedChoice]}
            onPress={() => setReportType('TRIP_LEDGER')}
            activeOpacity={0.8}
          >
            <View style={styles.choiceHeader}>
              <View style={[styles.radioCircle, reportType === 'TRIP_LEDGER' && styles.radioCircleActive]}>
                {reportType === 'TRIP_LEDGER' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.choiceTitle, reportType === 'TRIP_LEDGER' && styles.selectedChoiceTitle]}>
                Complete Trip Ledger
              </Text>
            </View>
            <Text style={styles.choiceSub}>
              Includes all expenses, allocations, confirmed/disputed payments, member net balances, and simplified settlement transfers.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceCard, reportType === 'INDIVIDUAL' && styles.selectedChoice]}
            onPress={() => setReportType('INDIVIDUAL')}
            activeOpacity={0.8}
          >
            <View style={styles.choiceHeader}>
              <View style={[styles.radioCircle, reportType === 'INDIVIDUAL' && styles.radioCircleActive]}>
                {reportType === 'INDIVIDUAL' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={[styles.choiceTitle, reportType === 'INDIVIDUAL' && styles.selectedChoiceTitle]}>
                Individual Member Statement
              </Text>
            </View>
            <Text style={styles.choiceSub}>
              Focused summary of your personal contributions, paid expenses, share of debits, and bilateral obligations.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Format Selection */}
        <Text style={styles.sectionHeader}>FILE FORMAT</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'PDF' && styles.selectedFormatBtn]}
            onPress={() => setFormat('PDF')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={format === 'PDF' ? THEME.colors.primaryDark : THEME.colors.textMuted}
              style={{ marginBottom: 4 }}
            />
            <Text style={[styles.formatText, format === 'PDF' && styles.selectedFormatText]}>
              PDF Document
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatBtn, format === 'XLSX' && styles.selectedFormatBtn]}
            onPress={() => setFormat('XLSX')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="grid-outline"
              size={22}
              color={format === 'XLSX' ? THEME.colors.primaryDark : THEME.colors.textMuted}
              style={{ marginBottom: 4 }}
            />
            <Text style={[styles.formatText, format === 'XLSX' && styles.selectedFormatText]}>
              Excel (.xlsx)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Security & Audit Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#0D9488" style={{ marginRight: 8 }} />
          <Text style={styles.securityText}>
            Exported reports are cryptographically verified against the double-entry integer ledger.
          </Text>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={[styles.exportBtn, loading && styles.btnDisabled]}
          onPress={handleExport}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.exportBtnText}>Generate & Download Report</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  introCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.lg,
    alignItems: 'center',
    marginBottom: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.sm,
  },
  introTitle: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  introText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  choiceGroup: {
    gap: 10,
    marginBottom: THEME.spacing.md,
  },
  choiceCard: {
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
    ...THEME.shadows.sm,
  },
  selectedChoice: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioCircleActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  choiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectedChoiceTitle: {
    color: THEME.colors.mint,
  },
  choiceSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 17,
    marginLeft: 32,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: THEME.spacing.md,
  },
  formatBtn: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...THEME.shadows.sm,
  },
  selectedFormatBtn: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
  },
  formatText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  selectedFormatText: {
    color: THEME.colors.mint,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    borderRadius: THEME.borderRadius.md,
    padding: 12,
    marginBottom: THEME.spacing.lg,
  },
  securityText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 15,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
