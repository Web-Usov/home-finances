import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SideNav } from './SideNav';
import { WIDE_BREAKPOINT } from './sections';

/** UI-01: sidebar next to the content on wide screens, content only (bottom tabs) on phones. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <View className={wide ? 'flex-1 flex-row' : 'flex-1'}>
      {wide ? <SideNav /> : null}
      <View className="flex-1">{children}</View>
    </View>
  );
}
