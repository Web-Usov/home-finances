import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ReopenConfirm } from './ReopenConfirm';

describe('ReopenConfirm', () => {
  it('MON-12: shows the recalculation range when a preview range is provided (plug-in point for T-024)', () => {
    render(
      <ReopenConfirm
        period="2026-01"
        recalcRange={{ from: '2026-01', to: '2026-03' }}
        pending={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText('Будут пересчитаны месяцы с января 2026 по март 2026.')).toBeTruthy();
  });
});
