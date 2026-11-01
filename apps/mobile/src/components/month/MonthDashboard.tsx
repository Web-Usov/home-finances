import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AllocationEditor } from './AllocationEditor';
import { IncomeForm } from './IncomeForm';
import { EnvelopeRow } from './EnvelopeRow';
import { MonthActions } from './MonthActions';
import { MonthStatusBadge } from './MonthStatusBadge';
import { PeriodSwitcher } from './PeriodSwitcher';
import { QuickActionsPanel } from './QuickActionsPanel';
import { SummaryCard } from './SummaryCard';
import type { Dashboard, MonthSummary } from './types';

interface MonthDashboardProps {
  dashboard: Dashboard;
  months: MonthSummary[];
  onPeriodChange: (period: string) => void;
}

/** The month dashboard (UI-02, UI-06..UI-10) for already-loaded data: header, summary, envelopes, warnings. */
export function MonthDashboard({ dashboard, months, onPeriodChange }: MonthDashboardProps) {
  const { month, summary, envelopes, warnings } = dashboard;
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState(false);
  const closed = month.status === 'closed';

  return (
    <View>
      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <PeriodSwitcher periods={months.map((m) => m.period)} current={month.period} onChange={onPeriodChange} />
        <View className="mt-3 mb-3">
          <MonthStatusBadge status={month.status} />
        </View>
        <MonthActions key={month.period} month={month} months={months} />
      </View>

      {warnings.map((warning, index) => (
        <View key={`${warning.code}-${index}`} className="mb-3 rounded-lg border border-amber-600 bg-amber-50 p-3">
          <Text accessibilityRole="alert" className="text-sm text-gray-900">
            {warning.message}
          </Text>
        </View>
      ))}

      <SummaryCard summary={summary} />

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-600 flex-1 mr-2">Доход можно изменить, пока месяц не закрыт</Text>
          {!editingIncome && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Изменить доход"
              accessibilityState={{ disabled: closed }}
              disabled={closed}
              onPress={() => setEditingIncome(true)}
              className="rounded-lg bg-gray-100 px-3 py-2 active:bg-gray-200 disabled:opacity-40"
            >
              <Text className="font-medium text-primary-700">Изменить доход</Text>
            </Pressable>
          )}
        </View>
        {editingIncome && (
          <IncomeForm
            period={month.period}
            version={month.version}
            initialIncome={summary.income}
            onDone={() => setEditingIncome(false)}
          />
        )}
      </View>

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-gray-600 flex-1 mr-2">Распределение дохода по конвертам</Text>
          {!editingAllocation && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Изменить распределение"
              accessibilityState={{ disabled: closed }}
              disabled={closed}
              onPress={() => setEditingAllocation(true)}
              className="rounded-lg bg-gray-100 px-3 py-2 active:bg-gray-200 disabled:opacity-40"
            >
              <Text className="font-medium text-primary-700">Изменить распределение</Text>
            </Pressable>
          )}
        </View>
        {editingAllocation && <AllocationEditor key={month.period} dashboard={dashboard} onDone={() => setEditingAllocation(false)} />}
      </View>

      <QuickActionsPanel key={month.period} dashboard={dashboard} />

      <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <Text className="text-lg font-semibold text-gray-800 mb-1">Конверты</Text>
        {envelopes.length === 0 ? (
          <Text className="text-gray-500 italic">В этом месяце конвертов нет</Text>
        ) : (
          envelopes.map((envelope) => <EnvelopeRow key={envelope.envelopeId} envelope={envelope} />)
        )}
      </View>
    </View>
  );
}
