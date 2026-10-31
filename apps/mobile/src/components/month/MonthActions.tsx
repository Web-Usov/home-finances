import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useMonthsControllerCloseV1, useMonthsControllerReopenV1 } from '../../api/months/months';
import { describeMonthError } from '../../lib/apiErrors';
import { formatPeriodLabel, nextPeriod } from '../../lib/period';
import type { ApiErrorResponse } from '../envelopes/types';
import { ReopenConfirm } from './ReopenConfirm';
import { invalidateMonthData, useCreateMonth } from './useMonthMutations';
import type { Dashboard, MonthSummary } from './types';

interface MonthActionsProps {
  month: Dashboard['month'];
  /** All existing months, ascending — decides which lifecycle actions are available. */
  months: MonthSummary[];
}

interface Notice {
  tone: 'info' | 'error';
  text: string;
}

function ActionButton({
  label,
  onPress,
  disabled,
  pending,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  pending?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending }}
      disabled={disabled || pending}
      onPress={onPress}
      className="flex-grow rounded-lg bg-gray-100 border border-gray-300 px-4 py-3 active:bg-gray-200 disabled:opacity-40"
    >
      <Text className="text-center font-semibold text-primary-700">{pending ? `${label}…` : label}</Text>
    </Pressable>
  );
}

/**
 * Month lifecycle actions (UI-06): create the next month, close, reopen (with confirmation).
 * Availability mirrors MON-01..MON-15 only to disable buttons; the API stays the authority and every refusal
 * (409 `VERSION_CONFLICT`, `MONTH_LOCKED`, `INVALID_STATUS_TRANSITION`, 422) is shown as its Russian message.
 */
export function MonthActions({ month, months }: MonthActionsProps) {
  const queryClient = useQueryClient();
  const [confirmingReopen, setConfirmingReopen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const fail = (error: unknown, fallback: string) => {
    const { code, message } = describeMonthError(error, fallback);
    setNotice({ tone: 'error', text: message });
    // The month changed under us: refresh so the retry uses the current version (ADR 0005).
    if (code === 'VERSION_CONFLICT') void invalidateMonthData(queryClient);
  };

  const createMutation = useCreateMonth();
  const closeMutation = useMonthsControllerCloseV1<AxiosError<ApiErrorResponse>>();
  const reopenMutation = useMonthsControllerReopenV1<AxiosError<ApiErrorResponse>>();

  const latest = months[months.length - 1];
  const hasDraft = months.some((m) => m.status === 'draft');
  const hasReopened = months.some((m) => m.status === 'reopened');
  const canCreateNext = latest !== undefined && !hasDraft;
  const canClose = month.status === 'open' || month.status === 'reopened';
  const canReopen = month.status === 'closed' && !hasReopened;

  const handleCreateNext = () => {
    if (!latest) return;
    setNotice(null);
    createMutation.mutate(
      { period: nextPeriod(latest.period) },
      {
        onSuccess: ({ month: created }) =>
          setNotice({
            tone: 'info',
            text: `${created.status === 'draft' ? 'Создан черновик' : 'Создан месяц'}: ${formatPeriodLabel(created.period)}.`,
          }),
        onError: (error) => fail(error, 'Не удалось создать месяц'),
      },
    );
  };

  const handleClose = () => {
    setNotice(null);
    closeMutation.mutate(
      { period: month.period, data: { version: month.version } },
      {
        onSuccess: ({ data }) => {
          void invalidateMonthData(queryClient);
          const promoted = data.promotedDraft
            ? ` Месяц ${formatPeriodLabel(data.promotedDraft.period)} теперь открыт.`
            : '';
          setNotice({ tone: 'info', text: `Месяц ${formatPeriodLabel(month.period)} закрыт.${promoted}` });
        },
        onError: (error) => fail(error, 'Не удалось закрыть месяц'),
      },
    );
  };

  const handleReopen = () => {
    setNotice(null);
    reopenMutation.mutate(
      { period: month.period, data: { version: month.version } },
      {
        onSuccess: ({ data }) => {
          setConfirmingReopen(false);
          void invalidateMonthData(queryClient);
          // MON-12: the preview endpoint (T-024) is pending, so the range is reported from the response.
          const { from, to } = data.recalcRange;
          setNotice({
            tone: 'info',
            text: `Месяц открыт повторно. Пересчитаны месяцы с ${formatPeriodLabel(from)} по ${formatPeriodLabel(to)}.`,
          });
        },
        onError: (error) => {
          setConfirmingReopen(false);
          fail(error, 'Не удалось открыть месяц повторно');
        },
      },
    );
  };

  let hint: string | null = null;
  if (month.status === 'draft') hint = 'Черновик нельзя закрыть, пока не закрыт текущий месяц.';
  else if (month.status === 'closed' && hasReopened) hint = 'Одновременно можно исправлять только один закрытый месяц.';
  else if (hasDraft && latest) hint = 'Черновик следующего месяца уже создан.';

  return (
    <View>
      <View className="flex-row flex-wrap gap-2">
        <ActionButton
          label="Создать следующий"
          onPress={handleCreateNext}
          disabled={!canCreateNext}
          pending={createMutation.isPending}
        />
        <ActionButton label="Закрыть" onPress={handleClose} disabled={!canClose} pending={closeMutation.isPending} />
        <ActionButton
          label="Открыть повторно"
          onPress={() => {
            setNotice(null);
            setConfirmingReopen(true);
          }}
          disabled={!canReopen}
        />
      </View>
      {hint && <Text className="mt-2 text-sm text-gray-600">{hint}</Text>}
      {confirmingReopen && (
        <ReopenConfirm
          period={month.period}
          pending={reopenMutation.isPending}
          onConfirm={handleReopen}
          onCancel={() => setConfirmingReopen(false)}
        />
      )}
      {notice && (
        <Text
          accessibilityRole="alert"
          className={`mt-3 text-sm ${notice.tone === 'error' ? 'text-danger' : 'text-gray-800'}`}
        >
          {notice.text}
        </Text>
      )}
    </View>
  );
}
