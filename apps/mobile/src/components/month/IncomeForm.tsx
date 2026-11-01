import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { MoneyStringSchema } from '@family-budget/types';
import { FormInput } from '../FormInput';
import { useMonthsControllerUpdateIncomeV1 } from '../../api/months/months';
import { describeMonthError } from '../../lib/apiErrors';
import { normalizeMoneyInput } from '../../lib/money';
import type { ApiErrorResponse } from '../envelopes/types';
import { invalidateBudgetData } from '../../lib/queryKeys';

/** Form-level schema: the typed text must normalise to a canonical `MoneyStringSchema` value. */
const incomeFormSchema = z.object({
  income: z
    .string()
    .refine((value) => MoneyStringSchema.safeParse(normalizeMoneyInput(value)).success, 'Сумма в рублях, до 2 знаков после запятой'),
});

type IncomeFormValues = z.infer<typeof incomeFormSchema>;

interface IncomeFormProps {
  period: string;
  version: number;
  /** Current income as an API decimal string, used as the starting value. */
  initialIncome: string;
  onDone: () => void;
}

/** Change the month income (UI-02, API-03). Sends the month `version`; a conflict refetches the month. */
export function IncomeForm({ period, version, initialIncome, onDone }: IncomeFormProps) {
  const queryClient = useQueryClient();
  const methods = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeFormSchema),
    defaultValues: { income: initialIncome },
  });
  const { handleSubmit, setError, formState } = methods;

  const mutation = useMonthsControllerUpdateIncomeV1<AxiosError<ApiErrorResponse>>({
    mutation: {
      onSuccess: async () => {
        await invalidateBudgetData(queryClient);
        onDone();
      },
      onError: (error) => {
        const { code, message } = describeMonthError(error, 'Не удалось изменить доход');
        setError('root', { message });
        if (code === 'VERSION_CONFLICT') void invalidateBudgetData(queryClient);
      },
    },
  });

  const onSubmit = (values: IncomeFormValues) => {
    mutation.mutate({ period, data: { income: normalizeMoneyInput(values.income), version } });
  };

  return (
    <FormProvider {...methods}>
      <View className="mt-3 rounded-lg border border-gray-200 p-3">
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
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Сохранить доход"
            disabled={mutation.isPending}
            onPress={handleSubmit(onSubmit)}
            className="flex-1 rounded-lg bg-primary-600 py-3 active:bg-primary-700 disabled:opacity-50"
          >
            <Text className="text-center font-semibold text-white">{mutation.isPending ? 'Сохранение…' : 'Сохранить'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Отмена"
            disabled={mutation.isPending}
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
