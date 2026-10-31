import React from 'react';
import { Text, View } from 'react-native';
import { formatRubles, isNonZeroMoney } from '../../lib/money';
import type { DashboardEnvelope } from './types';

function Flow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-sm text-gray-600 flex-1 mr-2">{label}</Text>
      <Text className="text-sm text-gray-900">{value}</Text>
    </View>
  );
}

/** One envelope of the month dashboard (UI-08): closing balance, replenishment and spending; uncovered parts when present. */
export function EnvelopeRow({ envelope }: { envelope: DashboardEnvelope }) {
  const hasTransfers = isNonZeroMoney(envelope.transfersIn) || isNonZeroMoney(envelope.transfersOut);
  return (
    <View className="py-3 border-t border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-gray-800">{envelope.name}</Text>
          {envelope.status === 'archived' && <Text className="text-xs text-gray-500">В архиве</Text>}
        </View>
        <Text className="text-base font-bold text-gray-900" accessibilityLabel={`Остаток: ${formatRubles(envelope.closing)}`}>
          {formatRubles(envelope.closing)}
        </Text>
      </View>
      <Flow label="Пополнено распределением" value={formatRubles(envelope.replenished)} />
      <Flow label="Списано" value={formatRubles(envelope.spent)} />
      {hasTransfers && (
        <Flow
          label="Переводы (внутрь / наружу)"
          value={`${formatRubles(envelope.transfersIn)} / ${formatRubles(envelope.transfersOut)}`}
        />
      )}
      {isNonZeroMoney(envelope.adjustmentApplied) && (
        <Flow label="Корректировка" value={formatRubles(envelope.adjustmentApplied, { signed: true })} />
      )}
      {isNonZeroMoney(envelope.uncovered.total) && (
        <View className="mt-1 rounded-lg bg-amber-50 border border-amber-600 px-2 py-1">
          <Text className="text-sm text-gray-900">Не покрыто: {formatRubles(envelope.uncovered.total)}</Text>
        </View>
      )}
    </View>
  );
}
