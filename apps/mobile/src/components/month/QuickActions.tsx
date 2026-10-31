import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MonthStatus } from '@family-budget/types';
import { MONTH_LOCKED_MESSAGE } from '../../lib/apiErrors';

export type QuickActionKind = 'expense' | 'transfer' | 'adjustment';

const ACTIONS: { kind: QuickActionKind; label: string }[] = [
  { kind: 'expense', label: 'Списать' },
  { kind: 'transfer', label: 'Перевести' },
  { kind: 'adjustment', label: 'Скорректировать' },
];

interface QuickActionsProps {
  status: MonthStatus;
  /** Operation forms arrive with T-011; until then the buttons have nothing to open. */
  onAction?: (kind: QuickActionKind) => void;
}

/** Quick actions (UI-10): disabled in a closed month with the MSG-06 explanation (AC-14). */
export function QuickActions({ status, onAction }: QuickActionsProps) {
  const locked = status === 'closed';
  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <Text className="text-lg font-semibold text-gray-800 mb-3">Быстрые действия</Text>
      <View className="flex-row flex-wrap gap-2">
        {ACTIONS.map(({ kind, label }) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: locked }}
            disabled={locked}
            onPress={() => onAction?.(kind)}
            className="flex-grow rounded-lg bg-primary-600 px-4 py-3 active:bg-primary-700 disabled:opacity-40"
          >
            <Text className="text-center font-semibold text-white">{label}</Text>
          </Pressable>
        ))}
      </View>
      {locked && <Text className="mt-3 text-sm text-gray-700">{MONTH_LOCKED_MESSAGE}</Text>}
    </View>
  );
}
