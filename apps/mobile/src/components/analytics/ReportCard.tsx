import React from 'react';
import { Text, View } from 'react-native';

/** Titled white card shared by the three yearly reports. */
export function ReportCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
      <Text accessibilityRole="header" className="text-lg font-semibold text-gray-800">
        {title}
      </Text>
      {hint ? <Text className="text-sm text-gray-500 mb-2">{hint}</Text> : null}
      {children}
    </View>
  );
}
