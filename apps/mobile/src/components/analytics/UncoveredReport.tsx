import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { isNonZeroMoney, formatRubles } from '../../lib/money';
import type { DrillDownKey } from '../../lib/drillDown';
import { formatPeriodLabel } from '../../lib/period';
import { ReportCard } from './ReportCard';
import type { YearlyAnalytics } from './types';

interface UncoveredReportProps {
  report: YearlyAnalytics['uncoveredOperations'];
  /** REP-10: called with the API drill-down key of the tapped value. */
  onDrillDown: (key: DrillDownKey) => void;
}

const HEADERS = ['Списания', 'Переводы', 'Коррект.', 'Всего'];

function Cell({ value, label, drillDown, onDrillDown, bold = false }: {
  value: string;
  label: string;
  drillDown?: DrillDownKey;
  onDrillDown: (key: DrillDownKey) => void;
  bold?: boolean;
}) {
  const text = formatRubles(value);
  const className = `pl-2 text-right text-sm ${bold ? 'font-bold' : ''}`;
  if (!drillDown || !isNonZeroMoney(value)) {
    return <Text role="cell" className={`w-28 ${className} text-gray-500`}>{text}</Text>;
  }
  return (
    <View role="cell" className="w-28">
      <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${text}. Открыть историю`} onPress={() => onDrillDown(drillDown)} className="min-h-9 justify-center">
        <Text className={`${className} text-primary-700 underline`}>{text}</Text>
      </Pressable>
    </View>
  );
}

function Header({ first }: { first: string }) {
  return (
    <View role="row" className="flex-row py-2 border-b border-gray-200">
      <Text role="columnheader" className="w-32 text-xs font-medium text-gray-500">{first}</Text>
      {HEADERS.map((title) => (
        <Text key={title} role="columnheader" className="w-28 pl-2 text-right text-xs font-medium text-gray-500">{title}</Text>
      ))}
    </View>
  );
}

/** Report 3 (REP-08..REP-11): uncovered expenses, transfers and negative adjustments by month and envelope, with drill-down. */
export function UncoveredReport({ report, onDrillDown }: UncoveredReportProps) {
  const { months, totals } = report;
  const withEnvelopes = months.filter((m) => m.envelopes.length > 0);
  return (
    <ReportCard title="Непокрытые операции" hint="Не переносятся в долг и не уменьшают будущие пополнения. Нажмите сумму, чтобы открыть историю">
      <ScrollView horizontal testID="uncovered-scroll">
        <View role="table" accessibilityLabel="Непокрытые операции по месяцам и типам">
          <Header first="Месяц" />
          {months.map((m) => {
            const label = formatPeriodLabel(m.period);
            return (
              <View key={m.period} role="row" accessibilityLabel={`Непокрытые, ${label}`} className="flex-row items-center py-1 border-b border-gray-100">
                <Text role="rowheader" className="w-32 text-sm text-gray-800">{label}</Text>
                <Cell value={m.expense} label={`${label}, списания`} drillDown={m.drillDownByType.expense} onDrillDown={onDrillDown} />
                <Cell value={m.transfer} label={`${label}, переводы`} drillDown={m.drillDownByType.transfer} onDrillDown={onDrillDown} />
                <Cell value={m.adjustment} label={`${label}, корректировки`} drillDown={m.drillDownByType.adjustment} onDrillDown={onDrillDown} />
                <Cell value={m.total} label={`${label}, всего`} drillDown={m.drillDown} onDrillDown={onDrillDown} bold />
              </View>
            );
          })}
          <View role="row" accessibilityLabel="Непокрытые, итого за год" className="flex-row py-2 bg-gray-50">
            <Text role="rowheader" className="w-32 text-sm font-bold text-gray-900">Итого</Text>
            <Cell value={totals.expense} label="Итого, списания" onDrillDown={onDrillDown} bold />
            <Cell value={totals.transfer} label="Итого, переводы" onDrillDown={onDrillDown} bold />
            <Cell value={totals.adjustment} label="Итого, корректировки" onDrillDown={onDrillDown} bold />
            <Cell value={totals.total} label="Итого, всего" onDrillDown={onDrillDown} bold />
          </View>
        </View>
      </ScrollView>

      {withEnvelopes.length > 0 && (
        <View className="mt-4" testID="uncovered-by-envelope">
          <Text accessibilityRole="header" className="text-base font-semibold text-gray-800 mb-1">По конвертам</Text>
          <ScrollView horizontal>
            <View role="table" accessibilityLabel="Непокрытые операции по конвертам">
              <Header first="Месяц · конверт" />
              {withEnvelopes.flatMap((m) =>
                m.envelopes.map((e) => {
                  const label = `${formatPeriodLabel(m.period)}, ${e.name}`;
                  return (
                    <View key={`${m.period}-${e.envelopeId}`} role="row" accessibilityLabel={`Непокрытые по конверту, ${label}`} className="flex-row items-center py-1 border-b border-gray-100">
                      <View role="rowheader" className="w-32">
                        <Text className="text-xs text-gray-500">{formatPeriodLabel(m.period)}</Text>
                        <Text className="text-sm text-gray-800" numberOfLines={2}>{e.name}</Text>
                      </View>
                      <Cell value={e.expense} label={`${label}, списания`} drillDown={{ ...e.drillDown, type: 'expense' }} onDrillDown={onDrillDown} />
                      <Cell value={e.transfer} label={`${label}, переводы`} drillDown={{ ...e.drillDown, type: 'transfer' }} onDrillDown={onDrillDown} />
                      <Cell value={e.adjustment} label={`${label}, корректировки`} drillDown={{ ...e.drillDown, type: 'adjustment' }} onDrillDown={onDrillDown} />
                      <Cell value={e.total} label={`${label}, всего`} drillDown={e.drillDown} onDrillDown={onDrillDown} bold />
                    </View>
                  );
                }),
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </ReportCard>
  );
}
