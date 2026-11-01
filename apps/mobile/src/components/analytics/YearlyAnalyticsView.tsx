import React from 'react';
import { View } from 'react-native';
import type { DrillDownKey } from '../../lib/drillDown';
import { BalancesReport } from './BalancesReport';
import { IncomeReport } from './IncomeReport';
import type { YearlyAnalytics } from './types';
import { UncoveredReport } from './UncoveredReport';

/** The three mandatory yearly reports (REP-01). */
export function YearlyAnalyticsView({ data, onDrillDown }: { data: YearlyAnalytics; onDrillDown: (key: DrillDownKey) => void }) {
  return (
    <View>
      <IncomeReport report={data.incomeReport} />
      <BalancesReport report={data.envelopeBalances} />
      <UncoveredReport report={data.uncoveredOperations} onDrillDown={onDrillDown} />
    </View>
  );
}
