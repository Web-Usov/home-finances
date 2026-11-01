import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, useWindowDimensions } from 'react-native';
import { AppShell } from '../../src/components/navigation/AppShell';
import { WIDE_BREAKPOINT } from '../../src/components/navigation/sections';
import { useUIStore } from '../../src/stores';

type TabIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function TabLabel({ focused, title }: { focused: boolean; title: string }) {
  return (
    <Text
      className={`text-xs ${focused ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}
    >
      {title}
    </Text>
  );
}

function TabIcon({ color, focused, name }: { color: string; focused: boolean; name: TabIconName }) {
  return <MaterialCommunityIcons color={color} name={name} size={focused ? 24 : 22} />;
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const { setActiveTab } = useUIStore();

  return (
    <AppShell>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#6b7280',
          tabBarStyle: isWide ? { display: 'none' } : undefined,
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
            tabBarIcon: ({ color, focused }) => (
              <TabIcon color={color} focused={focused} name="view-dashboard-outline" />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Месяц" />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'История',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon color={color} focused={focused} name="history" />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="История" />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'Аналитика',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon color={color} focused={focused} name="chart-line" />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Аналитика" />,
          }}
        />
        <Tabs.Screen
          name="envelopes"
          options={{
            title: 'Конверты',
            tabBarIcon: ({ color, focused }) => (
              <TabIcon color={color} focused={focused} name="wallet-outline" />
            ),
            tabBarLabel: ({ focused }) => <TabLabel focused={focused} title="Конверты" />,
          }}
        />
      </Tabs>
    </AppShell>
  );
}
