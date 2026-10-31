import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReopenConfirm } from './ReopenConfirm';

function renderConfirm(props: Partial<React.ComponentProps<typeof ReopenConfirm>> = {}) {
  const onConfirm = jest.fn();
  render(<ReopenConfirm period="2026-01" pending={false} onConfirm={onConfirm} onCancel={jest.fn()} {...props} />);
  return { onConfirm };
}

const confirmButton = () => screen.getByRole('button', { name: 'Подтвердить повторное открытие' });

describe('ReopenConfirm', () => {
  it('MON-12: shows the recalculation range from the preview and allows confirming', () => {
    const { onConfirm } = renderConfirm({ recalcRange: { from: '2026-01', to: '2026-03' } });

    expect(screen.getByText('Будут пересчитаны месяцы с января 2026 по март 2026.')).toBeTruthy();
    fireEvent.press(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('MON-12: while the preview loads a pending text is shown and confirming is disabled', () => {
    const { onConfirm } = renderConfirm({ loading: true });

    expect(screen.getByText('Определяем, какие месяцы будут пересчитаны…')).toBeTruthy();
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('MON-12: a preview error shows the message and disables confirming', () => {
    const { onConfirm } = renderConfirm({ error: 'Месяц не закрыт.' });

    expect(screen.getByText('Месяц не закрыт.')).toBeTruthy();
    expect(screen.queryByText(/Будут пересчитаны/)).toBeNull();
    expect(confirmButton().props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
