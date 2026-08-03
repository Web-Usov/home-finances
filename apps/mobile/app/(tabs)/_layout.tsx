import React from 'react';
import { Tabs } from 'expo-router';
import { Text, useWindowDimensions } from 'react-native';
import { useUIStore } from '../../src/stores';

function TabLabel({ focused, title }: { focused: boolean; title: string }) {
  return (
    <Text
      className={`text-xs ${focused ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}
    >
      {title}
    </Text>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWeb = width >= 768;
  const { activeTab, setActiveTab } = useUIStore();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isWeb ? { display: 'none' } : undefined,
      }}
      screenListeners={{
        tabPress: (e) => {
          setActiveTab(e.target?.split('/').pop() || 'month');
        },
      }}
    >
      <Tabs.Screen
        name="month"
        options={{
          title: 'Месяц',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Месяц" />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'История',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="История" />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Аналитика',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Аналитика" />,
        }}
      />
      <Tabs.Screen
        name="envelopes"
        options={{
          title: 'Конверты',
          tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Конверты" />,
        }}
      />
    </Tabs>
  );
}
