import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function MonthScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Месячный дашборд</Text>
        <Text className="text-gray-600 mb-6">Доход, распределение, свободные средства и состояние конвертов</Text>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Сводные показатели</Text>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Доход</Text>
            <Text className="font-medium">—</Text>
          </View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-gray-600">Распределено</Text>
            <Text className="font-medium">—</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-gray-600">Свободно</Text>
            <Text className="font-medium text-success">—</Text>
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Конверты</Text>
          <Text className="text-gray-500 italic">Здесь будут отображаться активные конверты</Text>
        </View>
      </View>
    </ScrollView>
  );
}
