import React from 'react';
import { Text, View } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { SECTIONS } from './sections';

/** UI-01: left navigation of the wide layout (the bottom tab bar is used below the breakpoint). */
export function SideNav() {
  const pathname = usePathname();

  return (
    <View
      accessibilityLabel="Основная навигация"
      role="navigation"
      className="w-56 border-r border-gray-200 bg-white p-3"
    >
      {SECTIONS.map((section) => {
        const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link
            key={section.name}
            accessibilityLabel={section.title}
            accessibilityRole="link"
            accessibilityState={{ selected: active }}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-3 mb-1 ${
              active ? 'bg-primary-50 text-primary-600 font-semibold' : 'text-gray-600'
            }`}
            href={section.href}
          >
            <Text>{section.title}</Text>
          </Link>
        );
      })}
    </View>
  );
}
