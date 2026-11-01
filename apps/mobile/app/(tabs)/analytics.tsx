import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useReportingControllerYearlyAnalyticsV1 } from '../../src/api/reporting/reporting';
import { YearlyAnalyticsView } from '../../src/components/analytics/YearlyAnalyticsView';
import type { YearlyAnalytics } from '../../src/components/analytics/types';
import { getApiErrorMessage } from '../../src/components/envelopes/types';
import { buildHistoryLink } from '../../src/lib/drillDown';
import { todayPeriod } from '../../src/lib/period';

function YearButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} className="w-11 h-11 items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200">
      <Text className="text-lg font-semibold text-gray-800">{glyph}</Text>
    </Pressable>
  );
}

/** Analytics tab (UI-04): year switcher and the three yearly reports; values drill down to History (REP-10). */
export default function AnalyticsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string }>();
  const paramYear = Array.isArray(params.year) ? params.year[0] : params.year;
  // The optional `year` route param (YYYY) opens a given year; otherwise the current one.
  const [year, setYear] = useState(() => Number(paramYear && /^\d{4}$/.test(paramYear) ? paramYear : todayPeriod().slice(0, 4)));
  const query = useReportingControllerYearlyAnalyticsV1<YearlyAnalytics, unknown>({ year: String(year) });

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="items-center">
      <View className="w-full max-w-3xl p-4">
        <Text accessibilityRole="header" className="text-2xl font-bold text-gray-900 mb-2">Годовая аналитика</Text>
        <View className="flex-row items-center gap-1 mb-4">
          <YearButton label="Предыдущий год" glyph="‹" onPress={() => setYear((y) => y - 1)} />
          <Text accessibilityRole="header" className="flex-1 text-center text-lg font-bold text-gray-900">{year}</Text>
          <YearButton label="Следующий год" glyph="›" onPress={() => setYear((y) => y + 1)} />
        </View>

        {query.isLoading && (
          <View className="bg-white rounded-xl p-4 shadow-sm items-center">
            <ActivityIndicator />
            <Text className="text-gray-500 mt-2">Загрузка…</Text>
          </View>
        )}
        {query.error != null && (
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-danger">{getApiErrorMessage(query.error, 'Не удалось загрузить аналитику')}</Text>
            <Pressable accessibilityRole="button" onPress={() => void query.refetch()} className="mt-2">
              <Text className="text-primary-700 font-medium">Повторить</Text>
            </Pressable>
          </View>
        )}
        {query.data && <YearlyAnalyticsView data={query.data} onDrillDown={(key) => router.push(buildHistoryLink(key))} />}
      </View>
    </ScrollView>
  );
}
