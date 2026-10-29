import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getApiBaseUrl } from '../../services/api';
import { getAccessToken } from '../../storage/secureStore';
import { ScreenHeader, SegmentedControl, dialog } from '../../components/ui';
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
        `Your ${format} report (${reportType === 'TRIP_LEDGER' ? 'Complete Trip Ledger' : 'Individual Statement'}) was generated successfully with full paise accounting.`,
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
      <ScreenHeader
        title="Export Reports"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIconCircle}>
            <Ionicons name="document-text-outline" size={24} color={THEME.colors.primary} />
          </View>
          <View style={styles.introTextCol}>
            <Text style={styles.introTitle}>Auditable Statements</Text>
            <Text style={styles.introText}>
              Export verified, zero-sum financial records with integer paise precision.
            </Text>
          </View>
        </View>

        {/* Report Scope Selection */}
        <Text style={styles.sectionHeader}>SELECT REPORT TYPE</Text>
        <View style={styles.choiceGroup}>
          <TouchableOpacity
            style={[styles.choiceCard, reportType === 'TRIP_LEDGER' && styles.selectedChoice]}
            onPress={() => setReportType('TRIP_LEDGER')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: reportType === 'TRIP_LEDGER' }}
          >
            <View style={styles.choiceHeader}>
              <View style={[styles.radioCircle, reportType === 'TRIP_LEDGER' && styles.radioCircleActive]}>
                {reportType === 'TRIP_LEDGER' && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
              </View>
              <Text style={[styles.choiceTitle, reportType === 'TRIP_LEDGER' && styles.selectedChoiceTitle]}>
                Complete Trip Ledger
              </Text>
            </View>
            <Text style={styles.choiceSub}>
              Includes all expenses, allocations, payments, member net balances, and simplified settlement transfers.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceCard, reportType === 'INDIVIDUAL' && styles.selectedChoice]}
            onPress={() => setReportType('INDIVIDUAL')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: reportType === 'INDIVIDUAL' }}
          >
            <View style={styles.choiceHeader}>
              <View style={[styles.radioCircle, reportType === 'INDIVIDUAL' && styles.radioCircleActive]}>
                {reportType === 'INDIVIDUAL' && <Ionicons name="checkmark" size={12} color="#FFFFFF" />}
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

        {/* Format Selection via SegmentedControl */}
        <Text style={styles.sectionHeader}>FILE FORMAT</Text>
        <SegmentedControl
          options={[
            { id: 'PDF', label: 'PDF Document', icon: 'document-text-outline' },
            { id: 'XLSX', label: 'Excel (.xlsx)', icon: 'grid-outline' },
          ]}
          selectedId={format}
          onSelect={(id) => setFormat(id as 'PDF' | 'XLSX')}
          style={{ marginBottom: THEME.spacing.md }}
        />

        {/* Security & Audit Note */}
        <View style={styles.securityNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={THEME.colors.primary} style={{ marginRight: 8 }} />
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
          accessibilityRole="button"
          accessibilityLabel="Generate and download report"
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
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
  scrollContent: {
    padding: THEME.spacing.md,
    paddingBottom: THEME.spacing.xxl,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surface,
    padding: 16,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.lg,
    gap: 14,
  },
  introIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTextCol: {
    flex: 1,
  },
  introTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 2,
  },
  introText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 8,
    marginLeft: 4,
  },
  choiceGroup: {
    gap: 10,
    marginBottom: THEME.spacing.lg,
  },
  choiceCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 14,
  },
  selectedChoice: {
    borderColor: THEME.colors.primary,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.colors.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
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
    lineHeight: 18,
    paddingLeft: 30,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 12,
    borderRadius: THEME.borderRadius.md,
    marginBottom: THEME.spacing.lg,
  },
  securityText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.borderRadius.md,
    height: THEME.dimensions.buttonHeight,
    ...THEME.shadows.md,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  exportBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
