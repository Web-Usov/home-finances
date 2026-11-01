import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatRubles } from '../../lib/money';
import { ReportCard } from './ReportCard';
import type { YearlyAnalytics } from './types';

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const NAME_W = 'w-32';
const CELL_W = 'w-28';

/** Report 2 (REP-05 / REP-06): closing balance of every envelope by month; a missing month is "—", never 0. */
export function BalancesReport({ report }: { report: YearlyAnalytics['envelopeBalances'] }) {
  const [showArchived, setShowArchived] = useState(true);
  const rows = report.envelopes.filter((e) => showArchived || e.status !== 'archived');
  const hasArchived = report.envelopes.some((e) => e.status === 'archived');

  return (
    <ReportCard title="Балансы конвертов" hint="Закрывающий баланс на конец месяца; «—» — конверта в этом месяце не было">
      {hasArchived && (
        <Pressable
          role="switch"
          accessibilityRole="switch"
          accessibilityLabel="Архивные конверты"
          accessibilityState={{ checked: showArchived }}
          onPress={() => setShowArchived((v) => !v)}
          className="self-start rounded-lg border border-gray-300 px-3 py-2 mb-2 min-h-11 justify-center"
        >
          <Text className="text-sm text-gray-900">{showArchived ? '☑' : '☐'} Показывать архивные</Text>
        </Pressable>
      )}
      {rows.length === 0 ? (
        <Text className="text-gray-500 italic">Конвертов за этот год нет</Text>
      ) : (
        <ScrollView horizontal testID="balances-scroll">
          <View role="table" accessibilityLabel="Балансы конвертов по месяцам">
            <View role="row" className="flex-row py-2 border-b border-gray-200">
              <Text role="columnheader" className={`${NAME_W} text-xs font-medium text-gray-500`}>Конверт</Text>
              {report.periods.map((p, i) => (
                <Text key={p} role="columnheader" className={`${CELL_W} text-right text-xs font-medium text-gray-500`}>
                  {MONTH_SHORT[i] ?? p}
                </Text>
              ))}
            </View>
            {rows.map((envelope) => {
              const archived = envelope.status === 'archived';
              return (
                <View key={envelope.envelopeId} role="row" accessibilityLabel={`${envelope.name}${archived ? ', архивный' : ''}`} className="flex-row py-2 border-b border-gray-100">
                  <View role="rowheader" className={NAME_W}>
                    <Text className={`text-sm ${archived ? 'text-gray-500' : 'text-gray-900'}`} numberOfLines={2}>{envelope.name}</Text>
                    {archived && <Text className="text-xs text-warning">В архиве</Text>}
                  </View>
                  {envelope.months.map((m) => (
                    <Text key={m.period} role="cell" className={`${CELL_W} text-right text-sm ${m.closing === null ? 'text-gray-400' : 'text-gray-900'}`}>
                      {m.closing === null ? '—' : formatRubles(m.closing)}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </ReportCard>
  );
}
