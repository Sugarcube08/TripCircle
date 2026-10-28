import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  VersionMetadata,
  UpdateCheckResult,
} from '../services/updateService';
import { THEME } from '../theme';

let lastCheckTimestamp = 0;
const CHECK_COOLDOWN_MS = 15 * 60 * 1000; // Check at most every 15 minutes

export const UpdatePromptModal: React.FC = () => {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [visible, setVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const check = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastCheckTimestamp < CHECK_COOLDOWN_MS) {
      return;
    }
    lastCheckTimestamp = now;

    const res = await checkForAppUpdate();
    if (res.isAvailable && res.latestVersion) {
      setUpdateResult(res);
      setVisible(true);
    }
  };

  useEffect(() => {
    check(true);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        check(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!visible || !updateResult || !updateResult.latestVersion) {
    return null;
  }

  const update = updateResult.latestVersion;
  const isMandatory = updateResult.isMandatory;

  const handleUpdateNow = async () => {
    try {
      setErrorMsg(null);
      setDownloading(true);
      setDownloadProgress(0);

      await downloadAndInstallUpdate(update, (progress) => {
        setDownloadProgress(progress);
      });
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header Icon */}
          <View style={styles.iconCircle}>
            <Ionicons name="arrow-down-circle" size={32} color={THEME.colors.primary} />
          </View>

          <Text style={styles.title}>
            {isMandatory ? 'Required Update' : 'New Version Available'}
          </Text>

          <View style={styles.versionBadgesRow}>
            <View style={styles.versionBadgeCurrent}>
              <Text style={styles.versionBadgeCurrentText}>Current: v{updateResult.installedVersion}</Text>
            </View>
            <Ionicons name="arrow-forward" size={14} color={THEME.colors.textMuted} />
            <View style={styles.versionBadgeNew}>
              <Text style={styles.versionBadgeNewText}>v{update.version}</Text>
            </View>
          </View>

          {/* Release Notes */}
          {update.releaseNotes.length > 0 && (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>WHAT'S NEW</Text>
              {update.releaseNotes.map((note, idx) => (
                <View key={idx} style={styles.noteItem}>
                  <Text style={styles.bulletPoint}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Download Progress Bar */}
          {downloading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${Math.round(downloadProgress * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                Downloading package... {Math.round(downloadProgress * 100)}%
              </Text>
            </View>
          )}

          {/* Error Message */}
          {errorMsg && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={THEME.colors.debt} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            {!isMandatory && !downloading && (
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={() => setVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.laterBtnText}>Later</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.updateBtn, downloading && styles.btnDisabled]}
              onPress={handleUpdateNow}
              disabled={downloading}
              activeOpacity={0.85}
            >
              {downloading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.updateBtnText}>
                  {errorMsg ? 'Retry Update' : 'Update Now'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 15, 25, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    ...THEME.shadows.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    ...THEME.typography.h2,
    fontSize: 18,
    color: THEME.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  versionBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  versionBadgeCurrent: {
    backgroundColor: THEME.colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  versionBadgeCurrentText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  versionBadgeNew: {
    backgroundColor: THEME.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  versionBadgeNewText: {
    fontSize: 12,
    color: THEME.colors.mint,
    fontWeight: '700',
  },
  notesBox: {
    width: '100%',
    backgroundColor: THEME.colors.inputBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: THEME.colors.textMuted,
    marginBottom: 6,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bulletPoint: {
    color: THEME.colors.primary,
    fontSize: 14,
    marginRight: 6,
    lineHeight: 18,
  },
  noteText: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 14,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: THEME.colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
  },
  progressText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.debtBg,
    borderWidth: 1,
    borderColor: THEME.colors.debtBorder,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: THEME.colors.debt,
    flex: 1,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  laterBtn: {
    flex: 1,
    backgroundColor: THEME.colors.cardAlt,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textSecondary,
  },
  updateBtn: {
    flex: 2,
    backgroundColor: THEME.colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  updateBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
