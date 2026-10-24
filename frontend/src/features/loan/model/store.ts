"use client";
import { create } from "zustand";
interface FlowState {
  steps: Record<number, number>;
  setStep: (id: number, step: number) => void;
  reset: () => void;
}
export const useLoanFlow = create<FlowState>((set) => ({
  steps: {},
  setStep: (id, step) =>
    set((state) => ({ steps: { ...state.steps, [id]: step } })),
  reset: () => set({ steps: {} }),
}));
