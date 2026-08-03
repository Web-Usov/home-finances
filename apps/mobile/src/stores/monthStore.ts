import { create } from 'zustand';

interface MonthState {
  currentPeriod: string | null;
  setCurrentPeriod: (period: string) => void;
}

export const useMonthStore = create<MonthState>((set) => ({
  currentPeriod: null,
  setCurrentPeriod: (period) => set({ currentPeriod: period }),
}));
