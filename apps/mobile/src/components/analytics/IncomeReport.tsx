import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { parseMoneyMinor } from '@family-budget/types';
import { formatRubles } from '../../lib/money';
import { formatPeriodLabel } from '../../lib/period';
import { ReportCard } from './ReportCard';
import type { YearlyAnalytics } from './types';

const NO_VALUE = '—';

/** Bar height as a share of the largest value; presentation only, the numbers themselves come from the API. */
function share(value: string | null, max: number): number {
  if (value === null || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((parseMoneyMinor(value) / max) * 100)));
}

function money(value: string | null, signed = false) {
  return value === null ? NO_VALUE : formatRubles(value, { showNegative: signed });
}

function freeClass(value: string | null) {
  return value?.startsWith('-') ? 'text-danger font-semibold' : 'text-gray-900';
}

/** REP-02: grouped income / allocated bars for the 12 months. Decorative: the table below carries the exact values. */
function IncomeChart({ months }: { months: YearlyAnalytics['incomeReport']['months'] }) {
  const max = Math.max(0, ...months.flatMap((m) => [m.income, m.allocated]).map((v) => (v === null ? 0 : parseMoneyMinor(v))));
  return (
    <View testID="income-chart" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="mt-2 mb-3">
      <View className="flex-row items-end h-28 gap-1">
        {months.map((m) => (
          <View key={m.period} testID="income-chart-month" className="flex-1 flex-row items-end justify-center gap-px h-full">
            <View className="w-1/2 bg-primary-500 rounded-t" style={{ height: `${share(m.income, max)}%` }} />
            <View className="w-1/2 bg-info rounded-t" style={{ height: `${share(m.allocated, max)}%` }} />
          </View>
        ))}
      </View>
      <View className="flex-row gap-1 mt-1">
        {months.map((m) => (
          <Text key={m.period} className="flex-1 text-center text-[10px] text-gray-500">
            {m.period.slice(5)}
          </Text>
        ))}
      </View>
      <View className="flex-row gap-4 mt-2">
        <Text className="text-xs text-gray-600">■ Доход</Text>
        <Text className="text-xs text-gray-600">■ Распределено</Text>
      </View>
    </View>
  );
}

function Row({ cells, bold = false, label }: { cells: React.ReactNode[]; bold?: boolean; label: string }) {
  return (
    <View role="row" accessibilityLabel={label} className={`flex-row py-2 border-b border-gray-100 ${bold ? 'bg-gray-50' : ''}`}>
      {cells}
    </View>
  );
}

/** Report 1 (REP-02..REP-04): income, allocated and free funds by month with yearly totals. */
export function IncomeReport({ report }: { report: YearlyAnalytics['incomeReport'] }) {
  const { months, totals } = report;
  return (
    <ReportCard title="Доход и распределение" hint="Свободные средства не входят в балансы конвертов">
      <IncomeChart months={months} />
      <ScrollView horizontal testID="income-scroll">
      <View role="table" accessibilityLabel="Доход, распределение и свободные средства по месяцам">
        <View role="row" className="flex-row py-2 border-b border-gray-200">
          {['Месяц', 'Доход', 'Распределено', 'Свободно'].map((title, i) => (
            <Text key={title} role="columnheader" className={`text-xs font-medium text-gray-500 ${i === 0 ? 'w-20' : 'w-28 pl-2 text-right'}`}>
              {title}
            </Text>
          ))}
        </View>
        {months.map((m) => (
          <Row
            key={m.period}
            label={`Доход, ${formatPeriodLabel(m.period)}`}
            cells={[
              <Text key="p" role="rowheader" className="w-20 text-sm text-gray-800">{formatPeriodLabel(m.period).split(' ')[0]}</Text>,
              <Text key="i" role="cell" className="w-28 pl-2 text-right text-sm text-gray-900">{money(m.income)}</Text>,
              <Text key="a" role="cell" className="w-28 pl-2 text-right text-sm text-gray-900">{money(m.allocated)}</Text>,
              <Text key="f" role="cell" className={`w-28 pl-2 text-right text-sm ${freeClass(m.free)}`}>{money(m.free, true)}</Text>,
            ]}
          />
        ))}
        <Row
          bold
          label="Доход, итого за год"
          cells={[
            <Text key="p" role="rowheader" className="w-20 text-sm font-bold text-gray-900">Итого</Text>,
            <Text key="i" role="cell" className="w-28 pl-2 text-right text-sm font-bold text-gray-900">{money(totals.income)}</Text>,
            <Text key="a" role="cell" className="w-28 pl-2 text-right text-sm font-bold text-gray-900">{money(totals.allocated)}</Text>,
            <Text key="f" role="cell" className={`w-28 pl-2 text-right text-sm font-bold ${freeClass(totals.free)}`}>{money(totals.free, true)}</Text>,
          ]}
        />
      </View>
      </ScrollView>
    </ReportCard>
  );
}
