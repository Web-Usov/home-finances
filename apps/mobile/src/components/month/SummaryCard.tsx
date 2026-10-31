import React from 'react';
import { Text, View } from 'react-native';
import { formatRubles, isNonZeroMoney } from '../../lib/money';
import type { Dashboard } from './types';

function Row({ label, value, strong = false, negative = false }: { label: string; value: string; strong?: boolean; negative?: boolean }) {
  return (
    <View className="flex-row justify-between items-baseline mb-2">
      <Text className="text-gray-600 flex-1 mr-2">{label}</Text>
      <Text
        accessibilityLabel={`${label}: ${value}`}
        className={`${strong ? 'text-base font-bold' : 'font-medium'} ${negative ? 'text-danger' : 'text-gray-900'}`}
      >
        {value}
      </Text>
    </View>
  );
}

/** Summary indicators (UI-07); adjustments are a separate indicator (UI-09). All figures are server-computed. */
export function SummaryCard({ summary }: { summary: Dashboard['summary'] }) {
  const { uncovered } = summary;
  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <Text className="text-lg font-semibold text-gray-800 mb-3">Сводные показатели</Text>
      <Row label="Доход" value={formatRubles(summary.income)} />
      <Row label="Распределено" value={formatRubles(summary.allocated)} />
      <Row label="Свободно" value={formatRubles(summary.free, { showNegative: true })} strong negative={summary.free.startsWith('-')} />

      <View className="border-t border-gray-100 pt-3 mt-1">
        <Row label="Корректировки (чистые)" value={formatRubles(summary.adjustmentsApplied, { signed: true })} />
      </View>

      <View className="border-t border-gray-100 pt-3 mt-1">
        <Row label="Не покрыто" value={formatRubles(uncovered.total)} strong />
        {isNonZeroMoney(uncovered.total) && (
          <View className="pl-3">
            <Row label="Списания" value={formatRubles(uncovered.expense)} />
            <Row label="Переводы" value={formatRubles(uncovered.transfer)} />
            <Row label="Корректировки" value={formatRubles(uncovered.adjustment)} />
          </View>
        )}
      </View>
    </View>
  );
}
