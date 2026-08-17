import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { MoneyStringSchema } from '@family-budget/types';
import { FormInput } from '../FormInput';
import {
  getEnvelopesControllerListV1QueryKey,
  useEnvelopesControllerCreateV1,
} from '../../api/envelopes/envelopes';
import type { EnvelopesControllerCreateV1Body } from '../../api/model';
import { getApiErrorMessage } from './types';
import type { ApiErrorResponse } from './types';

/**
 * Form-level schema for creating an envelope. `initialBalance` is a free-text
 * string in the form (empty = no starting balance); non-empty values must
 * satisfy the canonical `MoneyStringSchema` from @family-budget/types. The API
 * body is assembled in `onSubmit` to match EnvelopesControllerCreateV1Body.
 */
const createFormSchema = z.object({
  name: z.string().min(1, 'Введите название').max(100, 'Максимум 100 символов'),
  initialBalance: z
    .string()
    .refine(
      (value) => value === '' || MoneyStringSchema.safeParse(value).success,
      'Сумма в рублях, до 2 знаков после запятой',
    ),
});

type CreateFormValues = z.infer<typeof createFormSchema>;

interface EnvelopeCreateFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

export function EnvelopeCreateForm({ onCreated, onCancel }: EnvelopeCreateFormProps) {
  const queryClient = useQueryClient();
  const methods = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: { name: '', initialBalance: '' },
  });
  const { handleSubmit, reset, setError, formState } = methods;
  const { errors } = formState;

  const createMutation = useEnvelopesControllerCreateV1<AxiosError<ApiErrorResponse>>({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getEnvelopesControllerListV1QueryKey() });
        reset();
        onCreated();
      },
      onError: (error) => {
        setError('root', {
          message: getApiErrorMessage(error, 'Не удалось создать конверт'),
        });
      },
    },
  });

  const onSubmit = (values: CreateFormValues) => {
    const body: EnvelopesControllerCreateV1Body = { name: values.name };
    if (values.initialBalance !== '') {
      body.initialBalance = values.initialBalance;
    }
    createMutation.mutate({ data: body });
  };

  return (
    <FormProvider {...methods}>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="text-lg font-semibold text-gray-800 mb-3">Новый конверт</Text>
        <FormInput
          label="Название"
          controllerProps={{ name: 'name' }}
          placeholder="Напр. Продукты"
          autoCapitalize="sentences"
        />
        <FormInput
          label="Стартовый остаток (₽)"
          controllerProps={{ name: 'initialBalance' }}
          placeholder="0.00"
          keyboardType="decimal-pad"
          autoCapitalize="none"
        />
        {errors.root && (
          <Text className="text-sm text-danger -mt-2 mb-2">{errors.root.message}</Text>
        )}
        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={createMutation.isPending}
            className="flex-1 bg-primary-600 rounded-lg py-3 active:bg-primary-700 disabled:opacity-50"
          >
            <Text className="text-white text-center font-semibold">
              {createMutation.isPending ? 'Создание…' : 'Создать'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            disabled={createMutation.isPending}
            className="flex-1 bg-gray-200 rounded-lg py-3 active:bg-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Отмена</Text>
          </Pressable>
        </View>
      </View>
    </FormProvider>
  );
}