import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useMonthsControllerListV1 } from '../../src/api/months/months';
import {
  getReportingControllerMonthlyDashboardV1QueryKey,
  useReportingControllerMonthlyDashboardV1,
} from '../../src/api/reporting/reporting';
import { FirstMonthForm } from '../../src/components/month/FirstMonthForm';
import { MonthDashboard } from '../../src/components/month/MonthDashboard';
import type { MonthsListResponse } from '../../src/components/month/types';
import { getApiErrorMessage } from '../../src/components/envelopes/types';
import { useMonthStore } from '../../src/stores';

export default function MonthScreen() {
  const queryClient = useQueryClient();
  const { currentPeriod, setCurrentPeriod } = useMonthStore();

  const monthsQuery = useMonthsControllerListV1<MonthsListResponse>();
  const months = monthsQuery.data?.months ?? [];
  const hasMonths = months.length > 0;

  // Without a chosen period the API picks the working month (open, reopened, draft, latest).
  const params = currentPeriod ? { period: currentPeriod } : undefined;
  const dashboardQuery = useReportingControllerMonthlyDashboardV1(params, { query: { enabled: hasMonths } });
  const dashboard = dashboardQuery.data;

  // Pin the period the API resolved, so the view stays on this month when the working month moves on (e.g. after closing it).
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
        <Text accessibilityRole="header" className="text-2xl font-bold text-gray-900 mb-4">
          Месяц
        </Text>

        {loading && (
          <View className="bg-white rounded-xl p-4 shadow-sm items-center">
            <ActivityIndicator />
            <Text className="text-gray-500 mt-2">Загрузка…</Text>
          </View>
        )}

        {error != null && (
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-danger">{getApiErrorMessage(error, 'Не удалось загрузить месяц')}</Text>
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

        {monthsQuery.isSuccess && !hasMonths && <FirstMonthForm onCreated={setCurrentPeriod} />}

        {dashboard && <MonthDashboard dashboard={dashboard} months={months} onPeriodChange={setCurrentPeriod} />}
      </View>
    </ScrollView>
  );
}
