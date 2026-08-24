import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Holds the active tenant. Every query is scoped by this id, so it is persisted
 * to survive reloads and cleared on sign-out.
 */
type AcademyState = {
  activeAcademyId: string | null;
  setActiveAcademy: (academyId: string | null) => void;
};

export const useAcademyStore = create<AcademyState>()(
  persist(
    (set) => ({
      activeAcademyId: null,
      setActiveAcademy: (academyId) => set({ activeAcademyId: academyId }),
    }),
    { name: 'cam.active-academy' },
  ),
);
