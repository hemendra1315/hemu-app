import { create } from 'zustand';

export type TestModeRole = 'student' | 'coach' | 'academy_owner' | 'parent' | null;

type TestModeState = {
  activeRole: TestModeRole;
  targetAcademyId: string | null;
  setTestMode: (role: TestModeRole, academyId?: string | null) => void;
  exitTestMode: () => void;
};

export const useTestModeStore = create<TestModeState>((set) => ({
  activeRole: null,
  targetAcademyId: null,
  setTestMode: (role, academyId = null) => set({ activeRole: role, targetAcademyId: academyId }),
  exitTestMode: () => set({ activeRole: null, targetAcademyId: null }),
}));
