export {
  createAcademy,
  fetchAcademy,
  fetchActiveJoinCode,
  fetchMyJoinRequests,
  fetchMyMemberships,
  getOwnerInvitationDetails,
  acceptOwnerInvitation,
  regenerateJoinCode,
  requestJoinByCode,
  updateAcademy,
  uploadAcademyLogo,
  removeAcademyLogo,
  type CreateAcademyInput,
  type UpdateAcademyInput,
  type OwnerInvitationDetails,
  type AcceptOwnerInvitationResult,
} from './api/academiesApi';
export {
  useAcademy,
  useActiveAcademy,
  useCreateAcademy,
  useJoinAcademy,
  useJoinCode,
  useMemberships,
  useRegenerateJoinCode,
  useUpdateAcademy,
} from './hooks/useAcademies';
export { AcademySwitcher } from './components/AcademySwitcher';
export { JoinCodeCard } from './components/JoinCodeCard';
