import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { formatMoneyMinor, formatSignedMoneyMinor } from '@family-budget/types';
import { FormInput } from '../FormInput';
import { MONTH_LOCKED_MESSAGE, describeMonthError } from '../../lib/apiErrors';
import { amountToApiString, amountToMinor, computeAllocationTotals } from '../../lib/allocation';
import { formatRubles } from '../../lib/money';
import { formatPeriodLower } from '../../lib/period';
import { useSaveAllocations } from './useSaveAllocations';
import type { Dashboard } from './types';

interface AllocationFormValues {
  income: string;
  amounts: Record<string, string>;
}

interface AllocationEditorProps {
  dashboard: Dashboard;
  onDone: () => void;
}

const MONEY_ERROR = 'Сумма в рублях, до 2 знаков после запятой';

/** MSG-01 with the exact overflow X. */
export function overflowMessage(overflowMinor: number): string {
  return `Распределено на ${formatRubles(formatMoneyMinor(overflowMinor))} больше дохода. Уменьшите суммы по конвертам.`;
}

/**
 * Allocation editor (UI-11..UI-15): income plus one amount row per active envelope (archived ones are excluded, ENV-12).
 * Totals and free funds follow the typed values (UI-13); an overflow blocks saving and names the exact excess (UI-14).
 * Read-only in a closed month (MSG-06). Starting values are the allocations the API stored or copied (UI-12).
 */
export function AllocationEditor({ dashboard, onDone }: AllocationEditorProps) {
  const { month, summary, envelopes } = dashboard;
  const locked = month.status === 'closed';
  const active = envelopes.filter((envelope) => envelope.status === 'active');
  const save = useSaveAllocations();

  const methods = useForm<AllocationFormValues>({
    defaultValues: {
      income: summary.income,
      amounts: Object.fromEntries(active.map((envelope) => [envelope.envelopeId, envelope.replenished])),
    },
  });
  const { control, handleSubmit, setError, clearErrors, formState } = methods;

  const income = useWatch({ control, name: 'income' }) ?? '';
  const amounts = useWatch({ control, name: 'amounts' }) ?? {};
  const totals = computeAllocationTotals(
    income,
    active.map((envelope) => amounts[envelope.envelopeId] ?? ''),
  );
  const overflow = totals.overflowMinor > 0;
  const incomeInvalid = totals.incomeMinor === null;
  const blocked = locked || overflow || incomeInvalid || totals.hasInvalid || save.isPending;

  const onSubmit = (values: AllocationFormValues) => {
    clearErrors('root');
    const incomeMinor = amountToMinor(values.income);
    if (incomeMinor === null) return;
    const incomeValue = amountToApiString(values.income);
    const incomeChanged = incomeMinor !== amountToMinor(summary.income);
    save.mutate(
      {
        period: month.period,
        version: month.version,
        allocations: Object.fromEntries(active.map((e) => [e.envelopeId, amountToApiString(values.amounts[e.envelopeId] ?? '')])),
        // Raising the income must land before the allocations, lowering it after them (FIN-02 on both endpoints).
        income: incomeChanged ? { value: incomeValue, incomeFirst: incomeMinor >= (amountToMinor(summary.allocated) ?? 0) } : undefined,
      },
      {
        onSuccess: onDone,
        onError: (error) => {
          setError('root', { message: describeMonthError(error, 'Не удалось сохранить распределение').message });
        },
      },
    );
  };

  return (
    <FormProvider {...methods}>
      <View className="mt-3 rounded-lg border border-gray-200 p-3">
        <Text className="text-base font-semibold text-gray-800 mb-3">Распределение: {formatPeriodLower(month.period)}</Text>
        {locked && <Text className="mb-3 text-sm text-gray-700">{MONTH_LOCKED_MESSAGE}</Text>}

        <FormInput
          label="Доход месяца (₽)"
          controllerProps={{
            name: 'income',
            rules: { validate: (v: string) => (amountToMinor(v) !== null && v.trim() !== '') || MONEY_ERROR },
          }}
          keyboardType="decimal-pad"
          autoCapitalize="none"
          editable={!locked}
          accessibilityLabel="Доход для распределения"
        />

        {active.length === 0 ? (
          <Text className="text-gray-500 italic mb-3">Нет активных конвертов для распределения</Text>
        ) : (
          active.map((envelope) => (
            <FormInput
              key={envelope.envelopeId}
              label={`${envelope.name} (₽)`}
              controllerProps={{
                name: `amounts.${envelope.envelopeId}`,
                rules: { validate: (v: string) => amountToMinor(v ?? '') !== null || MONEY_ERROR },
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              autoCapitalize="none"
              editable={!locked}
              accessibilityLabel={`Распределение: ${envelope.name}`}
            />
          ))
        )}

        <View className="rounded-lg bg-gray-50 p-3 mb-3">
          <View className="flex-row justify-between mb-1">
            <Text className="text-gray-700">Распределено</Text>
            <Text
              className="font-semibold text-gray-900"
              accessibilityLabel={`Распределено в редакторе: ${formatRubles(formatMoneyMinor(totals.allocatedMinor))}`}
            >
              {formatRubles(formatMoneyMinor(totals.allocatedMinor))}
            </Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-700">Свободно</Text>
            <Text
              className="font-semibold text-gray-900"
              accessibilityLabel={`Свободно в редакторе: ${formatRubles(formatSignedMoneyMinor(totals.freeMinor))}`}
            >
              {formatRubles(formatSignedMoneyMinor(totals.freeMinor))}
            </Text>
          </View>
        </View>

        {overflow && (
          <Text accessibilityRole="alert" className="text-sm text-danger mb-3">
            {overflowMessage(totals.overflowMinor)}
          </Text>
        )}
        {formState.errors.root && (
          <Text accessibilityRole="alert" className="text-sm text-danger mb-3">
            {formState.errors.root.message}
          </Text>
        )}

        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Сохранить распределение"
            accessibilityState={{ disabled: blocked }}
            disabled={blocked}
            onPress={handleSubmit(onSubmit)}
            className="flex-1 rounded-lg bg-primary-600 py-3 active:bg-primary-700 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-white">{save.isPending ? 'Сохранение…' : 'Сохранить'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть редактор"
            disabled={save.isPending}
            onPress={onDone}
            className="flex-1 rounded-lg bg-gray-200 py-3 active:bg-gray-300"
          >
            <Text className="text-center font-semibold text-gray-700">Отмена</Text>
          </Pressable>
        </View>
      </View>
    </FormProvider>
  );
}
