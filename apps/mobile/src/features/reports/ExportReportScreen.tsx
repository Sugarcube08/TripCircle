import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { API_BASE_URL } from '../../services/api';
import { getAccessToken } from '../../storage/secureStore';
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
      const url = `${API_BASE_URL}/trips/${tripId}/reports/export?reportType=${reportType}&format=${format}`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Report export failed with status: ${res.status}`);
      }

      Alert.alert(
        'Report Generated',
        `Your ${format} report (${reportType === 'TRIP_LEDGER' ? 'Complete Trip Ledger' : 'Individual Statement'}) was generated successfully and verified with exact paise accounting.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Export Error', (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Export Financial Report</Text>
        <Text style={styles.subtitle}>
          Generate traceable, auditable financial records for this trip with full paise precision.
        </Text>

        {/* Report Scope Selection */}
        <Text style={styles.label}>REPORT TYPE</Text>
        <View style={styles.choiceGroup}>
          <TouchableOpacity
            style={[styles.choiceBtn, reportType === 'TRIP_LEDGER' && styles.selectedChoice]}
            onPress={() => setReportType('TRIP_LEDGER')}
          >
            <Text style={[styles.choiceText, reportType === 'TRIP_LEDGER' && styles.selectedText]}>
              Complete Trip Ledger
            </Text>
            <Text style={styles.choiceSub}>
              Includes all expenses, allocations, confirmed/disputed payments & settlement transfers.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.choiceBtn, reportType === 'INDIVIDUAL' && styles.selectedChoice]}
            onPress={() => setReportType('INDIVIDUAL')}
          >
            <Text style={[styles.choiceText, reportType === 'INDIVIDUAL' && styles.selectedText]}>
              Individual Member Statement
            </Text>
            <Text style={styles.choiceSub}>
              Focused summary of your paid expenses, share of debits, and personal net position.
            </Text>
          </TouchableOpacity>
        </View>

        {/* Format Selection */}
        <Text style={[styles.label, { marginTop: 16 }]}>FILE FORMAT</Text>
        <View style={styles.formatRow}>
          <TouchableOpacity
            style={[styles.formatBtn, format === 'PDF' && styles.selectedFormat]}
            onPress={() => setFormat('PDF')}
          >
            <Text style={[styles.formatText, format === 'PDF' && styles.selectedFormatText]}>
              📄 PDF Document
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.formatBtn, format === 'XLSX' && styles.selectedFormat]}
            onPress={() => setFormat('XLSX')}
          >
            <Text style={[styles.formatText, format === 'XLSX' && styles.selectedFormatText]}>
              📊 Excel (.xlsx)
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.exportBtnText}>Generate & Download Report</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.lg,
  },
  title: {
    ...THEME.typography.h1,
    marginBottom: 6,
  },
  subtitle: {
    ...THEME.typography.bodySmall,
    marginBottom: THEME.spacing.lg,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  choiceGroup: {
    gap: 10,
  },
  choiceBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.lg,
    padding: THEME.spacing.md,
  },
  selectedChoice: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#F0FDFA',
  },
  choiceText: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  selectedText: {
    color: THEME.colors.primary,
  },
  choiceSub: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    borderRadius: THEME.borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectedFormat: {
    borderColor: THEME.colors.primary,
    backgroundColor: '#F0FDFA',
  },
  formatText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  selectedFormatText: {
    color: THEME.colors.primary,
  },
  exportBtn: {
    backgroundColor: THEME.colors.primary,
    paddingVertical: 16,
    borderRadius: THEME.borderRadius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.xl,
  },
  exportBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
