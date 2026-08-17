import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { FormInput } from '../FormInput';
import {
  getEnvelopesControllerListV1QueryKey,
  useEnvelopesControllerUpdateV1,
} from '../../api/envelopes/envelopes';
import type { EnvelopesControllerUpdateV1Body } from '../../api/model';
import { getApiErrorMessage } from './types';
import type { ApiErrorResponse, EnvelopeWithBalance } from './types';

const renameSchema = z.object({
  name: z.string().min(1, 'Введите название').max(100, 'Максимум 100 символов'),
});

type RenameFormValues = z.infer<typeof renameSchema>;

interface EnvelopeRenameFormProps {
  envelope: EnvelopeWithBalance;
  onDone: () => void;
}

export function EnvelopeRenameForm({ envelope, onDone }: EnvelopeRenameFormProps) {
  const queryClient = useQueryClient();
  const methods = useForm<RenameFormValues>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: envelope.name },
  });
  const { handleSubmit, setError, formState } = methods;
  const { errors } = formState;

  const updateMutation = useEnvelopesControllerUpdateV1<AxiosError<ApiErrorResponse>>({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getEnvelopesControllerListV1QueryKey() });
        onDone();
      },
      onError: (error) => {
        setError('root', {
          message: getApiErrorMessage(error, 'Не удалось переименовать конверт'),
        });
      },
    },
  });

  const onSubmit = (values: RenameFormValues) => {
    const body: EnvelopesControllerUpdateV1Body = { name: values.name };
    updateMutation.mutate({ id: envelope.id, data: body });
  };

  return (
    <FormProvider {...methods}>
      <View className="mt-2">
        <FormInput label="Новое название" controllerProps={{ name: 'name' }} autoFocus />
        {errors.root && (
          <Text className="text-sm text-danger -mt-2 mb-2">{errors.root.message}</Text>
        )}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handleSubmit(onSubmit)}
            disabled={updateMutation.isPending}
            className="flex-1 bg-primary-600 rounded-lg py-2 active:bg-primary-700 disabled:opacity-50"
          >
            <Text className="text-white text-center font-semibold">
              {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDone}
            disabled={updateMutation.isPending}
            className="flex-1 bg-gray-200 rounded-lg py-2 active:bg-gray-300"
          >
            <Text className="text-gray-700 text-center font-semibold">Отмена</Text>
          </Pressable>
        </View>
      </View>
    </FormProvider>
  );
}