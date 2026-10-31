import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatPeriodGenitive, formatPeriodLower } from '../../lib/period';

interface ReopenConfirmProps {
  period: string;
  /**
   * Months that the reopening will recalculate (MON-12). The preview endpoint (T-024) is not available yet,
   * so callers pass nothing today and the dialog falls back to a generic warning; the range of the
   * performed reopening is reported afterwards from the reopen response.
   */
  recalcRange?: { from: string; to: string } | null;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Inline confirmation before reopening a closed month (MON-12, AC-15). */
export function ReopenConfirm({ period, recalcRange, pending, onConfirm, onCancel }: ReopenConfirmProps) {
  return (
    <View className="mt-3 rounded-lg border border-amber-600 bg-amber-50 p-3">
      <Text className="text-base font-semibold text-gray-900 mb-1">
        Открыть {formatPeriodLower(period)} повторно?
      </Text>
      <Text className="text-sm text-gray-800 mb-3">
        {recalcRange
          ? `Будут пересчитаны месяцы с ${formatPeriodGenitive(recalcRange.from)} по ${formatPeriodLower(recalcRange.to)}.`
          : 'Все последующие месяцы будут пересчитаны.'}
      </Text>
      <View className="flex-row gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Подтвердить повторное открытие"
          disabled={pending}
          onPress={onConfirm}
          className="flex-1 rounded-lg bg-primary-600 py-3 active:bg-primary-700 disabled:opacity-50"
        >
          <Text className="text-center font-semibold text-white">{pending ? 'Открытие…' : 'Открыть'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Отмена"
          disabled={pending}
          onPress={onCancel}
          className="flex-1 rounded-lg bg-gray-200 py-3 active:bg-gray-300 disabled:opacity-50"
        >
          <Text className="text-center font-semibold text-gray-700">Отмена</Text>
        </Pressable>
      </View>
    </View>
  );
}
