import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { AxiosError } from 'axios';
import type { OperationsControllerListV1200 } from '../../api/model';
import { useOperationsControllerListV1 } from '../../api/operations/operations';
import { MONTH_LOCKED_MESSAGE, describeMonthError } from '../../lib/apiErrors';
import type { ApiErrorResponse } from '../envelopes/types';
import { getApiErrorMessage } from '../envelopes/types';
import { OperationForm } from '../month/OperationForm';
import type { OperationSaved } from '../month/OperationForm';
import { PeriodSwitcher } from '../month/PeriodSwitcher';
import type { Dashboard, MonthSummary } from '../month/types';
import { OperationRow } from './OperationRow';
import type { EditableOperationType, HistoryOperation } from './types';
import { useDeleteOperation } from './useOperationMutations';

export type HistoryTypeFilter = 'expense' | 'transfer' | 'adjustment' | 'initial_balance';

const TYPE_OPTIONS: { value: HistoryTypeFilter | null; label: string }[] = [
  { value: null, label: 'Все типы' },
  { value: 'expense', label: 'Списания' },
  { value: 'transfer', label: 'Переводы' },
  { value: 'adjustment', label: 'Корректировки' },
  { value: 'initial_balance', label: 'Стартовые остатки' },
];

interface FilterChipsProps<T extends string> {
  label: string;
  options: { value: T | null; label: string }[];
  value: T | null;
  onChange: (value: T | null) => void;
}

function FilterChips<T extends string>({ label, options, value, onChange }: FilterChipsProps<T>) {
  return (
    <View className="mt-3" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value ?? 'all'}
              accessibilityRole="radio"
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              className={`rounded-lg border px-3 py-2 ${selected ? 'border-primary-600 bg-primary-50' : 'border-gray-300 bg-white'}`}
            >
              <Text className="text-sm text-gray-900">{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface HistoryViewProps {
  dashboard: Dashboard;
  months: MonthSummary[];
  envelopeId: string | null;
  type: HistoryTypeFilter | null;
  onPeriodChange: (period: string) => void;
  onEnvelopeChange: (envelopeId: string | null) => void;
  onTypeChange: (type: HistoryTypeFilter | null) => void;
}

/**
 * Operation history of one month (UI-03, HIST-11): insertion order from the API (sequence_no), filters by envelope and
 * type, edit and delete for unlocked months (HIST-07/08), read-only for a closed one (HIST-10, MSG-06). Both mutations
 * carry the displayed month's version; the dashboard of that month is the source of envelope names, status and version.
 */
export function HistoryView({
  dashboard,
  months,
  envelopeId,
  type,
  onPeriodChange,
  onEnvelopeChange,
  onTypeChange,
}: HistoryViewProps) {
  const { month, envelopes } = dashboard;
  const closed = month.status === 'closed';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; warnings: string[] } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useDeleteOperation();

  const list = useOperationsControllerListV1<OperationsControllerListV1200, AxiosError<ApiErrorResponse>>({
    period: month.period,
    ...(envelopeId !== null ? { envelopeId } : {}),
    ...(type !== null ? { type } : {}),
  });
  const operations: HistoryOperation[] = list.data?.operations ?? [];
  const envelopeNames = Object.fromEntries(envelopes.map((envelope) => [envelope.envelopeId, envelope.name]));

  const resetTransient = () => {
    setEditingId(null);
    setDeletingId(null);
    setNotice(null);
    setDeleteError(null);
  };

  const confirmDelete = (operation: HistoryOperation) => {
    setDeleteError(null);
    remove.mutate(
      { id: operation.id, version: month.version },
      {
        onSuccess: (response) => {
          setDeletingId(null);
          setNotice({ text: 'Операция удалена.', warnings: response.warnings.map((warning) => warning.message) });
        },
        onError: (error) => setDeleteError(describeMonthError(error, 'Не удалось удалить операцию').message),
      },
    );
  };

  const onSaved = (saved: OperationSaved) => {
    setEditingId(null);
    setNotice({ text: 'Операция изменена.', warnings: saved.warnings });
  };

  return (
    <View>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <PeriodSwitcher
          periods={months.map((m) => m.period)}
          current={month.period}
          onChange={(period) => {
            resetTransient();
            onPeriodChange(period);
          }}
        />
        <FilterChips
          label="Конверт"
          options={[
            { value: null, label: 'Все конверты' },
            ...envelopes.map((envelope) => ({ value: envelope.envelopeId, label: envelope.name })),
          ]}
          value={envelopeId}
          onChange={onEnvelopeChange}
        />
        <FilterChips label="Тип" options={TYPE_OPTIONS} value={type} onChange={onTypeChange} />
      </View>

      {closed && (
        <View className="mb-3 rounded-lg border border-gray-300 bg-gray-100 p-3">
          <Text accessibilityRole="alert" className="text-sm text-gray-900">
            {MONTH_LOCKED_MESSAGE}
          </Text>
        </View>
      )}

      {notice !== null && (
        <View className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
          <Text accessibilityRole="alert" className="text-sm text-gray-900">
            {notice.text}
          </Text>
          {notice.warnings.map((message) => (
            <Text key={message} accessibilityRole="alert" className="mt-1 text-sm text-gray-900">
              {message}
            </Text>
          ))}
        </View>
      )}

      {list.isLoading && (
        <View className="bg-white rounded-xl p-4 shadow-sm items-center">
          <ActivityIndicator />
          <Text className="text-gray-500 mt-2">Загрузка…</Text>
        </View>
      )}

      {list.error != null && (
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-danger">{getApiErrorMessage(list.error, 'Не удалось загрузить историю')}</Text>
          <Pressable accessibilityRole="button" onPress={() => void list.refetch()} className="mt-2">
            <Text className="text-primary-700 font-medium">Повторить</Text>
          </Pressable>
        </View>
      )}

      {list.isSuccess && operations.length === 0 && (
        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-gray-500 italic">Операций нет</Text>
        </View>
      )}

      {operations.map((operation) =>
        editingId === operation.id && operation.type !== 'initial_balance' ? (
          <View key={operation.id} className="bg-white rounded-xl p-4 shadow-sm mb-2">
            <OperationForm
              kind={operation.type as EditableOperationType}
              dashboard={dashboard}
              editing={operation}
              onSaved={onSaved}
              onCancel={() => setEditingId(null)}
            />
          </View>
        ) : (
          <View key={operation.id}>
            <OperationRow
              operation={operation}
              envelopeNames={envelopeNames}
              canChange={!closed}
              onEdit={() => {
                setNotice(null);
                setDeletingId(null);
                setEditingId(operation.id);
              }}
              onDelete={() => {
                setNotice(null);
                setEditingId(null);
                setDeleteError(null);
                setDeletingId(operation.id);
              }}
            />
            {deletingId === operation.id && (
              <View className="mb-2 rounded-lg border border-danger bg-white p-3">
                <Text className="text-sm text-gray-900">
                  Удалить операцию № {operation.sequenceNo}? Остатки этого и следующих месяцев будут пересчитаны.
                </Text>
                {deleteError !== null && (
                  <Text accessibilityRole="alert" className="mt-1 text-sm text-danger">
                    {deleteError}
                  </Text>
                )}
                <View className="mt-2 flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Подтвердить удаление"
                    disabled={remove.isPending}
                    onPress={() => confirmDelete(operation)}
                    className="flex-1 rounded-lg bg-danger py-3 disabled:opacity-50"
                  >
                    <Text className="text-center font-semibold text-white">
                      {remove.isPending ? 'Удаление…' : 'Удалить'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Отменить удаление"
                    disabled={remove.isPending}
                    onPress={() => setDeletingId(null)}
                    className="flex-1 rounded-lg bg-gray-200 py-3"
                  >
                    <Text className="text-center font-semibold text-gray-700">Отмена</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ),
      )}
    </View>
  );
}
