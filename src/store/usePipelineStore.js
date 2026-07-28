import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const usePipelineStore = create(
  persist(
    (set, get) => ({
      sessionId: 'test-mock',
      currentStep: 1, // 1~6단계
      pipelineState: null,
      setCurrentStep: (step) => set({ currentStep: step }),
      setPipelineState: (state) => set({ pipelineState: state }),
      setSessionId: (id) => set({ sessionId: id })
    }),
    {
      name: 'gam2-pipeline-storage',
    }
  )
)
