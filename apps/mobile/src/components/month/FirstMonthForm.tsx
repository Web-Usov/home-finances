import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MoneyStringSchema } from '@family-budget/types';
import { FormInput } from '../FormInput';
import { describeMonthError } from '../../lib/apiErrors';
import { normalizeMoneyInput } from '../../lib/money';
import { isValidPeriod, todayPeriod } from '../../lib/period';
import { useCreateMonth } from './useMonthMutations';

const firstMonthSchema = z.object({
  period: z.string().refine(isValidPeriod, 'Введите месяц как ГГГГ-ММ (месяц от 01 до 12), например 2026-01'),
  income: z
    .string()
    .refine(
      (value) => value.trim() === '' || MoneyStringSchema.safeParse(normalizeMoneyInput(value)).success,
      'Сумма в рублях, до 2 знаков после запятой',
    ),
});

type FirstMonthValues = z.infer<typeof firstMonthSchema>;

/** Empty state: pick the first month (month-only, AC-21) and its income; the month is created as "Открыт" (SCOPE-23, MON-05). */
export function FirstMonthForm({ onCreated }: { onCreated: (period: string) => void }) {
  const methods = useForm<FirstMonthValues>({
    resolver: zodResolver(firstMonthSchema),
    defaultValues: { period: todayPeriod(), income: '' },
  });
  const { handleSubmit, setError, formState } = methods;
  const mutation = useCreateMonth();

  const onSubmit = (values: FirstMonthValues) => {
    const income = values.income.trim() === '' ? undefined : normalizeMoneyInput(values.income);
    mutation.mutate(
      { period: values.period, income },
      {
        onSuccess: ({ month }) => onCreated(month.period),
        onError: (error) => setError('root', { message: describeMonthError(error, 'Не удалось создать месяц').message }),
      },
    );
  };

  return (
    <FormProvider {...methods}>
      <View className="bg-white rounded-xl p-4 shadow-sm">
        <Text className="text-lg font-semibold text-gray-800 mb-1">Начните с первого месяца</Text>
        <Text className="text-gray-600 mb-4">Выберите месяц учёта и введите общий доход. Прошлую историю восстанавливать не нужно.</Text>
        <FormInput
          label="Первый месяц (ГГГГ-ММ)"
          controllerProps={{ name: 'period' }}
          placeholder="2026-01"
          autoCapitalize="none"
          accessibilityLabel="Первый месяц"
        />
        <FormInput
          label="Доход месяца (₽)"
          controllerProps={{ name: 'income' }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoCapitalize="none"
          accessibilityLabel="Доход месяца"
        />
        {formState.errors.root && (
          <Text accessibilityRole="alert" className="text-sm text-danger -mt-2 mb-2">
            {formState.errors.root.message}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Создать месяц"
          disabled={mutation.isPending}
          onPress={handleSubmit(onSubmit)}
          className="rounded-lg bg-primary-600 py-3 active:bg-primary-700 disabled:opacity-50"
        >
          <Text className="text-center font-semibold text-white">{mutation.isPending ? 'Создание…' : 'Создать месяц'}</Text>
        </Pressable>
      </View>
    </FormProvider>
  );
}
