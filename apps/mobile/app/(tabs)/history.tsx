import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function HistoryScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">История операций</Text>
        <Text className="text-gray-600 mb-6">Списания, переводы и корректировки</Text>

        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-gray-500 italic">История операций будет отображаться здесь</Text>
        </View>
      </View>
    </ScrollView>
  );
}
