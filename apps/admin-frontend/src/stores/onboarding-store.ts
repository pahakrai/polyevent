'use client';

import { create } from 'zustand';

type OnboardingStep = 1 | 2 | 3;

interface OnboardingState {
  step: OnboardingStep;
  vendorId: string | null;
  venueId: string | null;
  setStep: (step: OnboardingStep) => void;
  setVendorId: (id: string) => void;
  setVenueId: (id: string) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  step: 1,
  vendorId: null,
  venueId: null,
  setStep: (step) => set({ step }),
  setVendorId: (id) => set({ vendorId: id }),
  setVenueId: (id) => set({ venueId: id }),
  reset: () => set({ step: 1, vendorId: null, venueId: null }),
}));
