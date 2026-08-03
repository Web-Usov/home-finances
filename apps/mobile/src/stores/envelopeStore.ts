import { create } from 'zustand';

interface EnvelopeState {
  selectedEnvelopeId: string | null;
  setSelectedEnvelopeId: (id: string | null) => void;
}

export const useEnvelopeStore = create<EnvelopeState>((set) => ({
  selectedEnvelopeId: null,
  setSelectedEnvelopeId: (id) => set({ selectedEnvelopeId: id }),
}));
