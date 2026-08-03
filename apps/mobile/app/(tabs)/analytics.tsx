import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export default function AnalyticsScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Годовая аналитика</Text>
        <Text className="text-gray-600 mb-6">Доход, балансы конвертов и непокрытые операции</Text>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Доход и распределение</Text>
          <Text className="text-gray-500 italic">Годовая диаграмма будет здесь</Text>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Балансы конвертов</Text>
          <Text className="text-gray-500 italic">Таблица балансов по месяцам</Text>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Непокрытые операции</Text>
          <Text className="text-gray-500 italic">Аналитика непокрытых сумм</Text>
        </View>
      </View>
    </ScrollView>
  );
}
