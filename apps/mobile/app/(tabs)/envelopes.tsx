import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { formatMoneyMinor } from '@family-budget/types';
import { formatRubles } from '../../src/lib/money';
import { useEnvelopesControllerListV1 } from '../../src/api/envelopes/envelopes';
import { EnvelopeCard } from '../../src/components/envelopes/EnvelopeCard';
import { EnvelopeCreateForm } from '../../src/components/envelopes/EnvelopeCreateForm';
import { getApiErrorMessage } from '../../src/components/envelopes/types';

export default function EnvelopesScreen() {
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const query = useEnvelopesControllerListV1();

  const envelopes = query.data?.envelopes ?? [];
  const active = envelopes.filter((envelope) => envelope.status === 'active');
  const archived = envelopes.filter((envelope) => envelope.status === 'archived');

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="items-center">
      <View className="w-full max-w-3xl p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Конверты</Text>
        <Text className="text-gray-600 mb-6">Управление накопительными конвертами</Text>

        {showCreate ? (
          <EnvelopeCreateForm
            onCreated={() => setShowCreate(false)}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <Pressable
            onPress={() => setShowCreate(true)}
            className="bg-primary-600 rounded-xl p-4 mb-6 active:bg-primary-700"
          >
            <Text className="text-white text-center font-semibold">Создать конверт</Text>
          </Pressable>
        )}

        <Text className="text-lg font-semibold text-gray-800 mb-3">Активные</Text>

        {query.isLoading && (
          <View className="bg-white rounded-xl p-4 shadow-sm items-center mb-3">
            <ActivityIndicator />
            <Text className="text-gray-500 mt-2">Загрузка…</Text>
          </View>
        )}

        {query.isError && (
          <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <Text className="text-danger">
              {getApiErrorMessage(query.error, 'Не удалось загрузить конверты')}
            </Text>
            <Pressable onPress={() => query.refetch()} className="mt-2">
              <Text className="text-primary-700 font-medium">Повторить</Text>
            </Pressable>
          </View>
        )}

        {query.isSuccess && active.length === 0 && (
          <View className="bg-white rounded-xl p-4 shadow-sm mb-3">
            <Text className="text-gray-500 italic">Активных конвертов нет</Text>
          </View>
        )}

        {active.map((envelope) => (
          <EnvelopeCard key={envelope.id} envelope={envelope} />
        ))}

        {archived.length > 0 && (
          <View className="mt-6">
            <Pressable
              onPress={() => setShowArchived((value) => !value)}
              className="flex-row items-center mb-3"
            >
              <Text className="text-lg font-semibold text-gray-800 flex-1">
                Архивные ({archived.length})
              </Text>
              <Text className="text-primary-700 font-medium">
                {showArchived ? 'Скрыть' : 'Показать'}
              </Text>
            </Pressable>
            {showArchived &&
              archived.map((envelope) => (
                <View key={envelope.id} className="bg-white rounded-xl p-4 shadow-sm mb-3 opacity-60">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-base font-medium text-gray-700 flex-1 mr-2">
                      {envelope.name}
                    </Text>
                    <Text className="text-base text-gray-500">
                      {formatRubles(formatMoneyMinor(envelope.balanceMinor))}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}