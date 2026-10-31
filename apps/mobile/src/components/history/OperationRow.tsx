import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatMoneyMinor } from '@family-budget/types';
import { formatRubles } from '../../lib/money';
import type { HistoryOperation } from './types';
import { isEditable } from './types';

const money = (minor: number) => formatRubles(formatMoneyMinor(minor));

export function typeLabel(operation: HistoryOperation): string {
  switch (operation.type) {
    case 'expense':
      return 'Списание';
    case 'transfer':
      return 'Перевод';
    case 'adjustment':
      return operation.sign === '-' ? 'Корректировка −' : 'Корректировка +';
    default:
      return 'Стартовый остаток';
  }
}

interface OperationRowProps {
  operation: HistoryOperation;
  envelopeNames: Record<string, string>;
  /** False in a closed month (HIST-10): no edit / delete buttons. */
  canChange: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * One history row (UI-03, HIST-11): type, envelope(s), full amount, covered and uncovered parts, comment and the
 * stable sequence number. Amounts come from the API as kopecks and are only formatted here. An uncovered part gets a
 * warning mark and text, not just a color (NFR-22).
 */
export function OperationRow({ operation, envelopeNames, canChange, onEdit, onDelete }: OperationRowProps) {
  const name = (id: string) => envelopeNames[id] ?? 'Неизвестный конверт';
  const envelopes =
    operation.destinationEnvelopeId !== null
      ? `${name(operation.sourceEnvelopeId)} → ${name(operation.destinationEnvelopeId)}`
      : name(operation.sourceEnvelopeId);
  const result = operation.result;
  const uncovered = result !== null && result.uncoveredMinor > 0;
  const label = typeLabel(operation);

  return (
    <View
      accessibilityLabel={`Операция ${operation.sequenceNo}: ${label}`}
      className={`rounded-lg border p-3 mb-2 ${uncovered ? 'border-amber-600 bg-amber-50' : 'border-gray-200 bg-white'}`}
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-gray-500">№ {operation.sequenceNo}</Text>
        <Text className="text-xs text-gray-500">{label}</Text>
      </View>
      <View className="flex-row items-center justify-between mt-1">
        <Text className="flex-1 mr-2 text-base font-medium text-gray-900">{envelopes}</Text>
        <Text className="text-base font-semibold text-gray-900">{money(operation.requestedMinor)}</Text>
      </View>
      {result !== null && (
        <Text className="mt-1 text-sm text-gray-700">Покрыто: {money(result.coveredMinor)}</Text>
      )}
      {uncovered && (
        <Text accessibilityRole="alert" className="mt-1 text-sm font-semibold text-gray-900">
          ⚠ Не покрыто: {money(result.uncoveredMinor)}
        </Text>
      )}
      {operation.comment !== null && operation.comment !== '' && (
        <Text className="mt-1 text-sm text-gray-600">{operation.comment}</Text>
      )}
      {canChange && isEditable(operation) && (
        <View className="mt-2 flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Изменить операцию ${operation.sequenceNo}`}
            onPress={onEdit}
            className="rounded-lg bg-gray-100 px-3 py-2 active:bg-gray-200"
          >
            <Text className="font-medium text-primary-700">Изменить</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Удалить операцию ${operation.sequenceNo}`}
            onPress={onDelete}
            className="rounded-lg bg-gray-100 px-3 py-2 active:bg-gray-200"
          >
            <Text className="font-medium text-danger">Удалить</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
