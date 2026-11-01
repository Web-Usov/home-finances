import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { formatMoneyMinor } from '@family-budget/types';
import { formatRubles } from '../../lib/money';
import { EnvelopeRenameForm } from './EnvelopeRenameForm';
import {
  useEnvelopesControllerArchiveV1,
} from '../../api/envelopes/envelopes';
import { invalidateBudgetData } from '../../lib/queryKeys';
import { getApiErrorMessage } from './types';
import type { ApiErrorResponse, EnvelopeWithBalance } from './types';

interface EnvelopeCardProps {
  envelope: EnvelopeWithBalance;
}

export function EnvelopeCard({ envelope }: EnvelopeCardProps) {
  const queryClient = useQueryClient();
  const [isRenaming, setIsRenaming] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const archiveMutation = useEnvelopesControllerArchiveV1<AxiosError<ApiErrorResponse>>({
    mutation: {
      onSuccess: () => {
        setArchiveError(null);
        void invalidateBudgetData(queryClient);
      },
      onError: (error) => {
        setArchiveError(getApiErrorMessage(error, 'Не удалось архивировать конверт'));
      },
    },
  });

  const handleArchive = () => {
    setArchiveError(null);
    archiveMutation.mutate({ id: envelope.id });
  };

  if (isRenaming) {
    return (
      <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
        <EnvelopeRenameForm envelope={envelope} onDone={() => setIsRenaming(false)} />
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
      <View className="flex-row justify-between items-start mb-3">
        <Text className="text-lg font-semibold text-gray-800 flex-1 mr-2">{envelope.name}</Text>
        <Text className="text-lg font-bold text-gray-900">
          {formatRubles(formatMoneyMinor(envelope.balanceMinor))}
        </Text>
      </View>
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => setIsRenaming(true)}
          className="flex-1 bg-gray-100 rounded-lg py-2 active:bg-gray-200"
        >
          <Text className="text-primary-700 text-center font-medium">Переименовать</Text>
        </Pressable>
        <Pressable
          onPress={handleArchive}
          disabled={archiveMutation.isPending}
          className="flex-1 bg-gray-100 rounded-lg py-2 active:bg-gray-200 disabled:opacity-50"
        >
          <Text className="text-danger text-center font-medium">
            {archiveMutation.isPending ? 'Архивация…' : 'Архивировать'}
          </Text>
        </Pressable>
      </View>
      {archiveError && <Text className="text-sm text-danger mt-2">{archiveError}</Text>}
    </View>
  );
}