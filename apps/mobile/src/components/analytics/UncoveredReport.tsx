import React from 'react';
import { Pressable, Text, View } from 'react-native';
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

function Cell({ value, label, drillDown, onDrillDown, bold = false }: {
  value: string;
  label: string;
  drillDown?: DrillDownKey;
  onDrillDown: (key: DrillDownKey) => void;
  bold?: boolean;
}) {
  const text = formatRubles(value);
  const className = `flex-1 text-right text-sm ${bold ? 'font-bold' : ''}`;
  if (!drillDown || !isNonZeroMoney(value)) {
    return <Text role="cell" className={`${className} text-gray-500`}>{text}</Text>;
  }
  return (
    <View role="cell" className="flex-1">
      <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${text}. Открыть историю`} onPress={() => onDrillDown(drillDown)} className="min-h-9 justify-center">
        <Text className={`${className} text-primary-700 underline`}>{text}</Text>
      </Pressable>
    </View>
  );
}

/** Report 3 (REP-08..REP-11): uncovered expenses, transfers and negative adjustments by month, with drill-down. */
export function UncoveredReport({ report, onDrillDown }: UncoveredReportProps) {
  const { months, totals } = report;
  return (
    <ReportCard title="Непокрытые операции" hint="Не переносятся в долг и не уменьшают будущие пополнения. Нажмите сумму, чтобы открыть историю">
      <View role="table" accessibilityLabel="Непокрытые операции по месяцам и типам">
        <View role="row" className="flex-row py-2 border-b border-gray-200">
          {['Месяц', 'Списания', 'Переводы', 'Коррект.', 'Всего'].map((title, i) => (
            <Text key={title} role="columnheader" className={`text-xs font-medium text-gray-500 ${i === 0 ? 'w-16' : 'flex-1 text-right'}`}>
              {title}
            </Text>
          ))}
        </View>
        {months.map((m) => {
          const label = formatPeriodLabel(m.period);
          return (
            <View key={m.period} role="row" accessibilityLabel={`Непокрытые, ${label}`} className="flex-row items-center py-1 border-b border-gray-100">
              <Text role="rowheader" className="w-16 text-sm text-gray-800">{label.split(' ')[0]?.slice(0, 3)}</Text>
              <Cell value={m.expense} label={`${label}, списания`} drillDown={m.drillDownByType.expense} onDrillDown={onDrillDown} />
              <Cell value={m.transfer} label={`${label}, переводы`} drillDown={m.drillDownByType.transfer} onDrillDown={onDrillDown} />
              <Cell value={m.adjustment} label={`${label}, корректировки`} drillDown={m.drillDownByType.adjustment} onDrillDown={onDrillDown} />
              <Cell value={m.total} label={`${label}, всего`} drillDown={m.drillDown} onDrillDown={onDrillDown} bold />
            </View>
          );
        })}
        <View role="row" accessibilityLabel="Непокрытые, итого за год" className="flex-row py-2 bg-gray-50">
          <Text role="rowheader" className="w-16 text-sm font-bold text-gray-900">Итого</Text>
          <Cell value={totals.expense} label="Итого, списания" onDrillDown={onDrillDown} bold />
          <Cell value={totals.transfer} label="Итого, переводы" onDrillDown={onDrillDown} bold />
          <Cell value={totals.adjustment} label="Итого, корректировки" onDrillDown={onDrillDown} bold />
          <Cell value={totals.total} label="Итого, всего" onDrillDown={onDrillDown} bold />
        </View>
      </View>
    </ReportCard>
  );
}
