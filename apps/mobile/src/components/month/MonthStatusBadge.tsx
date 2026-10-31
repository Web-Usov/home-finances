import React from 'react';
import { Text, View } from 'react-native';
import type { MonthStatus } from '@family-budget/types';
import { STATUS_LABELS } from './types';

const TONES: Record<MonthStatus, string> = {
  draft: 'bg-gray-100 border-gray-400',
  open: 'bg-green-50 border-green-600',
  closed: 'bg-gray-200 border-gray-600',
  reopened: 'bg-amber-50 border-amber-600',
};

/** Status chip; the label carries the meaning, colour only reinforces it (NFR-22). */
export function MonthStatusBadge({ status }: { status: MonthStatus }) {
  return (
    <View className={`self-start rounded-full border px-3 py-1 ${TONES[status]}`}>
      <Text className="text-sm font-medium text-gray-900" accessibilityLabel={`Статус месяца: ${STATUS_LABELS[status]}`}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
