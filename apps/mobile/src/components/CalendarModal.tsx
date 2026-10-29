import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

interface CalendarModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string; // YYYY-MM-DD
  minDate?: string; // YYYY-MM-DD
  title?: string;
  allowClear?: boolean;
  onClear?: () => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  minDate,
  title = 'Select Date',
  allowClear = false,
  onClear,
}) => {
  const today = new Date().toISOString().split('T')[0];

  const markedDates: Record<string, any> = {};

  if (selectedDate) {
    markedDates[selectedDate] = {
      selected: true,
      selectedColor: THEME.colors.primary,
      selectedTextColor: '#FFFFFF',
    };
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="calendar" size={20} color={THEME.colors.primary} style={{ marginRight: 8 }} />
              <Text style={styles.title}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={THEME.colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Wix react-native-calendars Calendar component */}
          <View style={styles.calendarWrapper}>
            <Calendar
              current={selectedDate || minDate || today}
              minDate={minDate}
              onDayPress={(day: { dateString: string }) => {
                onSelectDate(day.dateString);
                onClose();
              }}
              markedDates={markedDates}
              theme={{
                backgroundColor: 'transparent',
                calendarBackground: 'transparent',
                textSectionTitleColor: THEME.colors.textMuted,
                selectedDayBackgroundColor: THEME.colors.primary,
                selectedDayTextColor: '#FFFFFF',
                todayTextColor: THEME.colors.primary,
                dayTextColor: THEME.colors.textPrimary,
                textDisabledColor: THEME.colors.border,
                dotColor: THEME.colors.primary,
                selectedDotColor: '#FFFFFF',
                arrowColor: THEME.colors.primary,
                monthTextColor: THEME.colors.textPrimary,
                indicatorColor: THEME.colors.primary,
                textDayFontSize: 14,
                textMonthFontSize: 15,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
            />
          </View>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => {
                if (!minDate || today >= minDate) {
                  onSelectDate(today);
                  onClose();
                }
              }}
            >
              <Text style={styles.quickActionText}>Today</Text>
            </TouchableOpacity>

            {allowClear && onClear && (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => {
                  onClear();
                  onClose();
                }}
              >
                <Text style={[styles.quickActionText, { color: THEME.colors.debt }]}>Clear</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.md,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.borderRadius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: THEME.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  calendarWrapper: {
    borderRadius: THEME.borderRadius.md,
    backgroundColor: THEME.colors.cardAlt,
    padding: THEME.spacing.xs,
    overflow: 'hidden',
  },
  calendar: {
    backgroundColor: 'transparent',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
    paddingTop: THEME.spacing.xs,
    gap: THEME.spacing.sm,
  },
  quickActionBtn: {
    paddingVertical: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.sm,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  doneBtn: {
    paddingVertical: THEME.spacing.xs,
    paddingHorizontal: THEME.spacing.sm,
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME.colors.textMuted,
  },
});
