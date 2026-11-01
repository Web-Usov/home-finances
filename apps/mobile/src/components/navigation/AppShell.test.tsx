import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppShell } from './AppShell';

let mockWidth = 1280;
const mockPath = '/history';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
}));
jest.mock('expo-router', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    usePathname: () => mockPath,
    Link: ({
      children,
      href,
      accessibilityLabel,
      accessibilityState,
    }: {
      children: React.ReactNode;
      href: string;
      accessibilityLabel: string;
      accessibilityState: { selected: boolean };
    }) => (
      <RNText
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="link"
        accessibilityState={accessibilityState}
        testID={`link:${href}`}
      >
        {children}
      </RNText>
    ),
  };
});

describe('UI-01 wide-screen navigation', () => {
  it('UI-01: from 768 px a sidebar with the four sections replaces the tab bar, active one is marked', () => {
    mockWidth = 1280;
    render(
      <AppShell>
        <Text>content</Text>
      </AppShell>,
    );
    expect(screen.getByLabelText('Основная навигация').props.role).toBe('navigation');
    for (const title of ['Месяц', 'История', 'Аналитика', 'Конверты']) {
      expect(screen.getByRole('link', { name: title })).toBeTruthy();
    }
    expect(screen.getByRole('link', { name: 'История' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('link', { name: 'Месяц' }).props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('UI-01: below 768 px there is no sidebar (bottom tab bar is used)', () => {
    mockWidth = 390;
    render(
      <AppShell>
        <Text>content</Text>
      </AppShell>,
    );
    expect(screen.queryByLabelText('Основная навигация')).toBeNull();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
