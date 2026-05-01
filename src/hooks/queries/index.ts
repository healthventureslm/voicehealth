export {
  usePatients,
  usePatient,
  useCreatePatient,
  useUpdatePatient,
  useTransferPatient,
  usePatientWardHistory,
} from "./usePatients";
export { useWards, useMyWards } from "./useWards";
export {
  useConsultations,
  useConsultation,
  useCreateConsultation,
  useUpdateConsultation,
  useAddenda,
  useCreateAddendum,
  useClinicalReports,
} from "./useConsultations";
export { useTemplates } from "./useTemplates";
export {
  useHospitalUsers,
  useSetUserWards,
  useSetUserRole,
  useRemoveUserFromHospital,
  useInvitations,
  useSendInvitation,
  useRevokeInvitation,
} from "./useAdminUsers";
export type { HospitalUserRow } from "./useAdminUsers";
export { useCreateWard, useUpdateWard, useDeleteWard } from "./useAdminWards";
export {
  useAdminTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "./useAdminTemplates";
export {
  useHospitals,
  useCreateHospital,
  useUpdateHospital,
  useGlobalStats,
} from "./useHospitals";
