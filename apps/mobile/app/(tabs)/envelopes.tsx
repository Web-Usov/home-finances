import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';

export default function EnvelopesScreen() {
  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Конверты</Text>
        <Text className="text-gray-600 mb-6">Управление накопительными конвертами</Text>

        <View className="bg-white rounded-xl p-4 shadow-sm mb-4">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Активные</Text>
          <Text className="text-gray-500 italic">Список активных конвертов</Text>
        </View>

        <View className="bg-white rounded-xl p-4 shadow-sm">
          <Text className="text-lg font-semibold text-gray-800 mb-2">Архивные</Text>
          <Text className="text-gray-500 italic">Список архивных конвертов</Text>
        </View>

        <Pressable className="bg-primary-600 rounded-xl p-4 mt-4 active:bg-primary-700">
          <Text className="text-white text-center font-semibold">Создать конверт</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
