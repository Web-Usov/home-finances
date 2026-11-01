import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { adjacentYearPeriod, formatPeriodLabel, neighbourPeriod } from '../../lib/period';

interface PeriodSwitcherProps {
  /** Existing periods, ascending. */
  periods: string[];
  current: string;
  onChange: (period: string) => void;
}

function StepButton({
  label,
  glyph,
  target,
  onChange,
}: {
  label: string;
  glyph: string;
  target: string | null;
  onChange: (period: string) => void;
}) {
  const disabled = target === null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => target && onChange(target)}
      className="w-10 h-10 items-center justify-center rounded-lg bg-gray-100 active:bg-gray-200 disabled:opacity-40"
    >
      <Text className="text-lg font-semibold text-gray-800">{glyph}</Text>
    </Pressable>
  );
}

/** Month and year switcher (UI-06). Month-only: there is no day selection anywhere (AC-21). */
export function PeriodSwitcher({ periods, current, onChange }: PeriodSwitcherProps) {
  return (
    <View className="flex-row items-center gap-1">
      <StepButton label="Предыдущий год" glyph="«" target={adjacentYearPeriod(periods, current, -1)} onChange={onChange} />
      <StepButton label="Предыдущий месяц" glyph="‹" target={neighbourPeriod(periods, current, -1)} onChange={onChange} />
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        className="flex-1 text-center text-base font-bold text-gray-900"
      >
        {formatPeriodLabel(current)}
      </Text>
      <StepButton label="Следующий месяц" glyph="›" target={neighbourPeriod(periods, current, 1)} onChange={onChange} />
      <StepButton label="Следующий год" glyph="»" target={adjacentYearPeriod(periods, current, 1)} onChange={onChange} />
    </View>
  );
}
