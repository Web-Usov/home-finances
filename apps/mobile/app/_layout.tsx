import React from 'react';
import { Stack } from 'expo-router';
import { Providers } from '../src/providers';
import '../global.css';

export default function RootLayout() {
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  );
}
