import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { OperationForm } from './OperationForm';
import type { OperationSaved } from './OperationForm';
import { QuickActions } from './QuickActions';
import type { QuickActionKind } from './QuickActions';
import type { Dashboard } from './types';

const SAVED_TEXT: Record<QuickActionKind, string> = {
  expense: 'Списание сохранено.',
  transfer: 'Перевод сохранён.',
  adjustment: 'Корректировка сохранена.',
};

/**
 * Quick actions (UI-10) with the operation form they open and the result of the last save. The form is bound to the
 * month on screen (UI-16): the dashboard owner remounts it with `key={period}`, so it never outlives a period switch.
 */
export function QuickActionsPanel({ dashboard }: { dashboard: Dashboard }) {
  const [kind, setKind] = useState<QuickActionKind | null>(null);
  const [saved, setSaved] = useState<OperationSaved | null>(null);

  return (
    <View>
      <QuickActions
        status={dashboard.month.status}
        onAction={(next) => {
          setSaved(null);
          setKind(next);
        }}
      />
      {kind !== null && (
        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <OperationForm
            key={kind}
            kind={kind}
            dashboard={dashboard}
            onCancel={() => setKind(null)}
            onSaved={(result) => {
              setKind(null);
              setSaved(result);
            }}
          />
        </View>
      )}
      {saved !== null && (
        <View className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
          <Text accessibilityRole="alert" className="text-sm text-gray-900">
            {SAVED_TEXT[saved.kind]}
          </Text>
          {saved.warnings.map((message) => (
            <Text key={message} accessibilityRole="alert" className="mt-1 text-sm text-gray-900">
              {message}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
