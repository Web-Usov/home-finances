import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { parseMoneyMinor } from '@family-budget/types';
import type { EnvelopeRow } from './types';

const HEIGHT = 160;
const PAD = 10;
const COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#db2777', '#65a30d'];
const DEFAULT_SELECTED = 3;

interface Point {
  x: number;
  y: number;
}

/** REP-07: line chart of closing balances by month for the envelopes picked by the user. Null months are gaps. */
export function BalanceChart({ envelopes }: { envelopes: EnvelopeRow[] }) {
  const [selected, setSelected] = useState<string[]>(() => envelopes.slice(0, DEFAULT_SELECTED).map((e) => e.envelopeId));
  const [width, setWidth] = useState(0);

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const shown = envelopes.map((e, index) => ({ envelope: e, color: COLORS[index % COLORS.length] ?? '#2563eb' })).filter((s) => selected.includes(s.envelope.envelopeId));

  // Presentation scaling only: the plotted values are the API closing balances.
  const max = Math.max(0, ...shown.flatMap((s) => s.envelope.months.map((m) => (m.closing === null ? 0 : parseMoneyMinor(m.closing)))));
  const plotW = Math.max(0, width - PAD * 2);
  const plotH = HEIGHT - PAD * 2;

  const series = shown.map(({ envelope, color }) => {
    const points: (Point | null)[] = envelope.months.map((m, i) =>
      m.closing === null
        ? null
        : { x: PAD + (plotW * i) / 11, y: PAD + plotH - (max > 0 ? (plotH * parseMoneyMinor(m.closing)) / max : 0) },
    );
    return { envelope, color, points };
  });

  return (
    <View className="mb-3">
      <View role="group" accessibilityLabel="Выбор конвертов для графика" className="flex-row flex-wrap gap-2 mb-2">
        {envelopes.map((e, index) => {
          const checked = selected.includes(e.envelopeId);
          return (
            <Pressable
              key={e.envelopeId}
              role="checkbox"
              accessibilityLabel={`График: ${e.name}`}
              accessibilityState={{ checked }}
              onPress={() => toggle(e.envelopeId)}
              className={`rounded-lg border px-3 py-2 min-h-11 justify-center ${checked ? 'border-primary-600 bg-primary-50' : 'border-gray-300 bg-white'}`}
            >
              <Text className="text-sm text-gray-900" style={{ color: checked ? COLORS[index % COLORS.length] : undefined }}>
                {e.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View testID="balance-chart" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
        {shown.length === 0 ? (
          <Text className="text-gray-500 italic">Выберите конверты, чтобы построить график</Text>
        ) : (
          <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height: HEIGHT }} className="border-b border-l border-gray-200">
            {width > 0 &&
              series.map(({ envelope, color, points }) => (
                <View key={envelope.envelopeId} testID={`balance-series-${envelope.envelopeId}`} className="absolute inset-0">
                  {points.map((p, i) => {
                    const next = points[i + 1];
                    if (!p || !next) return null;
                    const dx = next.x - p.x;
                    const dy = next.y - p.y;
                    return (
                      <View
                        key={`seg-${i}`}
                        testID="balance-segment"
                        className="absolute h-0.5"
                        style={{ left: p.x, top: p.y - 1, width: Math.sqrt(dx * dx + dy * dy), backgroundColor: color, transformOrigin: 'left center', transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }}
                      />
                    );
                  })}
                  {points.map((p, i) =>
                    p ? (
                      <View key={`pt-${i}`} testID="balance-point" className="absolute w-2 h-2 rounded-full" style={{ left: p.x - 4, top: p.y - 4, backgroundColor: color }} />
                    ) : null,
                  )}
                </View>
              ))}
          </View>
        )}
        <View className="flex-row mt-1" style={{ paddingHorizontal: PAD }}>
          {Array.from({ length: 12 }, (_, i) => (
            <Text key={i} className="flex-1 text-center text-[10px] text-gray-500">{String(i + 1).padStart(2, '0')}</Text>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-x-4 mt-2" testID="balance-legend">
          {shown.map(({ envelope, color }) => (
            <Text key={envelope.envelopeId} className="text-xs text-gray-600"><Text style={{ color }}>■</Text> {envelope.name}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}
