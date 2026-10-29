import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

export type DialogType = 'info' | 'success' | 'warning' | 'error' | 'prompt';

export interface DialogConfig {
  title: string;
  message?: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  showCancel?: boolean;
  isPrompt?: boolean;
  promptPlaceholder?: string;
  promptDefaultValue?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  secureTextEntry?: boolean;
  multiline?: boolean;
}

interface DialogContextValue {
  showDialog: (config: DialogConfig) => Promise<{ confirmed: boolean; value?: string }>;
  showAlert: (title: string, message?: string, type?: DialogType) => Promise<void>;
  showConfirm: (
    title: string,
    message?: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      type?: DialogType;
    }
  ) => Promise<boolean>;
  showPrompt: (
    title: string,
    options?: {
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmText?: string;
      cancelText?: string;
      keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
      secureTextEntry?: boolean;
    }
  ) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

// Global imperative handle for calling dialog from outside React component tree
let globalDialogHandler: ((config: DialogConfig) => Promise<{ confirmed: boolean; value?: string }>) | null = null;

export const dialog = {
  alert: async (title: string, message?: string, type: DialogType = 'info') => {
    if (globalDialogHandler) {
      await globalDialogHandler({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'OK',
      });
    }
  },
  confirm: async (
    title: string,
    message?: string,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      type?: DialogType;
    }
  ): Promise<boolean> => {
    if (globalDialogHandler) {
      const res = await globalDialogHandler({
        title,
        message,
        type: options?.type || (options?.destructive ? 'error' : 'warning'),
        showCancel: true,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        destructive: options?.destructive,
      });
      return res.confirmed;
    }
    return false;
  },
  prompt: async (
    title: string,
    options?: {
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmText?: string;
      cancelText?: string;
      keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
      secureTextEntry?: boolean;
    }
  ): Promise<string | null> => {
    if (globalDialogHandler) {
      const res = await globalDialogHandler({
        title,
        message: options?.message,
        type: 'prompt',
        isPrompt: true,
        showCancel: true,
        promptPlaceholder: options?.placeholder,
        promptDefaultValue: options?.defaultValue,
        confirmText: options?.confirmText || 'Submit',
        cancelText: options?.cancelText || 'Cancel',
        keyboardType: options?.keyboardType,
        secureTextEntry: options?.secureTextEntry,
      });
      return res.confirmed ? (res.value ?? '') : null;
    }
    return null;
  },
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<DialogConfig | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const resolverRef = useRef<((val: { confirmed: boolean; value?: string }) => void) | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const showDialog = useCallback((newConfig: DialogConfig) => {
    return new Promise<{ confirmed: boolean; value?: string }>((resolve) => {
      resolverRef.current = resolve;
      setConfig(newConfig);
      setPromptValue(newConfig.promptDefaultValue || '');
      setVisible(true);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [scaleAnim, opacityAnim]);

  // Connect global handler
  globalDialogHandler = showDialog;

  const handleClose = (confirmed: boolean) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (resolverRef.current) {
        resolverRef.current({
          confirmed,
          value: confirmed ? promptValue.trim() : undefined,
        });
        resolverRef.current = null;
      }
      setConfig(null);
      setPromptValue('');
    });
  };

  const showAlert = useCallback(
    async (title: string, message?: string, type: DialogType = 'info') => {
      await showDialog({
        title,
        message,
        type,
        showCancel: false,
        confirmText: 'OK',
      });
    },
    [showDialog]
  );

  const showConfirm = useCallback(
    async (
      title: string,
      message?: string,
      options?: {
        confirmText?: string;
        cancelText?: string;
        destructive?: boolean;
        type?: DialogType;
      }
    ) => {
      const res = await showDialog({
        title,
        message,
        type: options?.type || (options?.destructive ? 'error' : 'warning'),
        showCancel: true,
        confirmText: options?.confirmText || 'Confirm',
        cancelText: options?.cancelText || 'Cancel',
        destructive: options?.destructive,
      });
      return res.confirmed;
    },
    [showDialog]
  );

  const showPrompt = useCallback(
    async (
      title: string,
      options?: {
        message?: string;
        placeholder?: string;
        defaultValue?: string;
        confirmText?: string;
        cancelText?: string;
        keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
        secureTextEntry?: boolean;
      }
    ) => {
      const res = await showDialog({
        title,
        message: options?.message,
        type: 'prompt',
        isPrompt: true,
        showCancel: true,
        promptPlaceholder: options?.placeholder,
        promptDefaultValue: options?.defaultValue,
        confirmText: options?.confirmText || 'Submit',
        cancelText: options?.cancelText || 'Cancel',
        keyboardType: options?.keyboardType,
        secureTextEntry: options?.secureTextEntry,
      });
      return res.confirmed ? (res.value ?? '') : null;
    },
    [showDialog]
  );

  const getIconConfig = (type?: DialogType, destructive?: boolean) => {
    if (destructive || type === 'error') {
      return {
        name: 'alert-circle' as const,
        color: '#F43F5E',
        bgColor: 'rgba(244, 63, 94, 0.15)',
        borderColor: 'rgba(244, 63, 94, 0.3)',
      };
    }
    if (type === 'warning') {
      return {
        name: 'warning' as const,
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
      };
    }
    if (type === 'success') {
      return {
        name: 'checkmark-circle' as const,
        color: '#00F5A0',
        bgColor: 'rgba(0, 245, 160, 0.15)',
        borderColor: 'rgba(0, 245, 160, 0.3)',
      };
    }
    if (type === 'prompt') {
      return {
        name: 'create-outline' as const,
        color: '#0D9488',
        bgColor: 'rgba(13, 148, 136, 0.15)',
        borderColor: 'rgba(13, 148, 136, 0.3)',
      };
    }
    return {
      name: 'information-circle' as const,
      color: '#0EA5E9',
      bgColor: 'rgba(14, 165, 233, 0.15)',
      borderColor: 'rgba(14, 165, 233, 0.3)',
    };
  };

  const iconInfo = config ? getIconConfig(config.type, config.destructive) : null;

  return (
    <DialogContext.Provider value={{ showDialog, showAlert, showConfirm, showPrompt }}>
      {children}

      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => handleClose(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback onPress={() => !config?.isPrompt && handleClose(false)}>
            <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]} />
          </TouchableWithoutFeedback>

          {config && (
            <Animated.View
              style={[
                styles.card,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Header Icon Badge */}
              {iconInfo && (
                <View
                  style={[
                    styles.iconBadge,
                    {
                      backgroundColor: iconInfo.bgColor,
                      borderColor: iconInfo.borderColor,
                    },
                  ]}
                >
                  <Ionicons name={iconInfo.name} size={28} color={iconInfo.color} />
                </View>
              )}

              {/* Title */}
              <Text style={styles.title}>{config.title}</Text>

              {/* Message */}
              {config.message ? (
                <Text style={styles.message}>{config.message}</Text>
              ) : null}

              {/* Prompt Input Field */}
              {config.isPrompt ? (
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={[
                      styles.input,
                      isFocused && styles.inputFocused,
                      config.multiline && styles.inputMultiline,
                    ]}
                    value={promptValue}
                    onChangeText={setPromptValue}
                    placeholder={config.promptPlaceholder || 'Type here...'}
                    placeholderTextColor="#64748B"
                    keyboardType={config.keyboardType || 'default'}
                    secureTextEntry={config.secureTextEntry}
                    multiline={config.multiline}
                    autoFocus
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    selectionColor={THEME.colors.primary}
                  />
                </View>
              ) : null}

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                {config.showCancel !== false && (
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={() => handleClose(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>
                      {config.cancelText || 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    config.destructive
                      ? styles.destructiveButton
                      : styles.confirmButton,
                    config.showCancel === false && styles.fullWidthButton,
                  ]}
                  onPress={() => handleClose(true)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.confirmButtonText,
                      config.destructive && styles.destructiveButtonText,
                    ]}
                  >
                    {config.confirmText || 'OK'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </DialogContext.Provider>
  );
};

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 16, 0.82)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#131B2E',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#0B0F19',
    borderWidth: 1,
    borderColor: '#26334D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F8FAFC',
  },
  inputFocused: {
    borderColor: '#0D9488',
  },
  inputMultiline: {
    height: 80,
    textAlignVertical: 'top',
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidthButton: {
    flex: 1,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#94A3B8',
  },
  confirmButton: {
    backgroundColor: '#0D9488',
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  destructiveButton: {
    backgroundColor: '#F43F5E',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
  },
});
