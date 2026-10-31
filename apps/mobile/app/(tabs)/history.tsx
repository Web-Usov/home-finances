import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMonthsControllerListV1 } from '../../src/api/months/months';
import {
  getReportingControllerMonthlyDashboardV1QueryKey,
  useReportingControllerMonthlyDashboardV1,
} from '../../src/api/reporting/reporting';
import { getApiErrorMessage } from '../../src/components/envelopes/types';
import { HistoryView } from '../../src/components/history/HistoryView';
import type { HistoryTypeFilter } from '../../src/components/history/HistoryView';
import type { MonthsListResponse } from '../../src/components/month/types';
import { isValidPeriod } from '../../src/lib/period';
import { useMonthStore } from '../../src/stores';

const TYPES: HistoryTypeFilter[] = ['expense', 'transfer', 'adjustment', 'initial_balance'];

const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * History tab (UI-03). Deep-link params `period` (YYYY-MM), `envelopeId` and `type` preselect the view — the analytics
 * drill-down (T-013) links here. The period is shared with the month screen through the month store.
 */
export default function HistoryScreen() {
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ period?: string; envelopeId?: string; type?: string }>();
  const paramPeriod = single(params.period);
  const paramEnvelope = single(params.envelopeId) ?? null;
  const paramType = single(params.type);
  const { currentPeriod, setCurrentPeriod } = useMonthStore();

  const [envelopeId, setEnvelopeId] = useState<string | null>(paramEnvelope);
  const [type, setType] = useState<HistoryTypeFilter | null>(
    TYPES.find((value) => value === paramType) ?? null,
  );

  useEffect(() => {
    if (paramPeriod !== undefined && isValidPeriod(paramPeriod)) setCurrentPeriod(paramPeriod);
  }, [paramPeriod, setCurrentPeriod]);
  useEffect(() => {
    setEnvelopeId(paramEnvelope);
  }, [paramEnvelope]);
  useEffect(() => {
    setType(TYPES.find((value) => value === paramType) ?? null);
  }, [paramType]);

  const monthsQuery = useMonthsControllerListV1<MonthsListResponse>();
  const months = monthsQuery.data?.months ?? [];
  const hasMonths = months.length > 0;

  const queryParams = currentPeriod ? { period: currentPeriod } : undefined;
  const dashboardQuery = useReportingControllerMonthlyDashboardV1(queryParams, { query: { enabled: hasMonths } });
  const dashboard = dashboardQuery.data;

  // Same pinning as the month screen: stay on the month the API resolved.
  useEffect(() => {
    if (!currentPeriod && dashboard) {
      queryClient.setQueryData(getReportingControllerMonthlyDashboardV1QueryKey({ period: dashboard.month.period }), dashboard);
      setCurrentPeriod(dashboard.month.period);
    }
  }, [currentPeriod, dashboard, queryClient, setCurrentPeriod]);

  const error = monthsQuery.error ?? dashboardQuery.error;
  const loading = monthsQuery.isLoading || (hasMonths && dashboardQuery.isLoading);

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="items-center">
      <View className="w-full max-w-3xl p-4">
        <Text accessibilityRole="header" className="text-2xl font-bold text-gray-900 mb-2">
          История операций
        </Text>
        <Text className="text-gray-600 mb-4">Списания, переводы и корректировки</Text>

        {loading && (
          <View className="bg-white rounded-xl p-4 shadow-sm items-center">
            <ActivityIndicator />
            <Text className="text-gray-500 mt-2">Загрузка…</Text>
          </View>
        )}

        {error != null && (
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-danger">{getApiErrorMessage(error, 'Не удалось загрузить историю')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void monthsQuery.refetch();
                void dashboardQuery.refetch();
              }}
              className="mt-2"
            >
              <Text className="text-primary-700 font-medium">Повторить</Text>
            </Pressable>
          </View>
        )}

        {monthsQuery.isSuccess && !hasMonths && (
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-gray-500 italic">Месяцев пока нет. Создайте первый месяц на вкладке «Месяц».</Text>
          </View>
        )}

        {dashboard && (
          <HistoryView
            key={dashboard.month.period}
            dashboard={dashboard}
            months={months}
            envelopeId={envelopeId}
            type={type}
            onPeriodChange={setCurrentPeriod}
            onEnvelopeChange={setEnvelopeId}
            onTypeChange={setType}
          />
        )}
      </View>
    </ScrollView>
  );
}
