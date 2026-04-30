'use client';

import { create } from 'zustand';

type OnboardingStep = 1 | 2 | 3;

interface OnboardingState {
  step: OnboardingStep;
  vendorId: string | null;
  setStep: (step: OnboardingStep) => void;
  setVendorId: (id: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  vendorId: null,
  setStep: (step) => set({ step }),
  setVendorId: (id) => set({ vendorId: id }),
  reset: () => set({ step: 1, vendorId: null }),
}));
