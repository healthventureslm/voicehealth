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
  usePatientTimeline,
  usePatientNotes,
  usePatientDocuments,
  useCreateDocumentFromNotes,
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
  useHospitalDetail,
  useGlobalStats,
} from "./useHospitals";
export { useDashboardStats } from "./useDashboardStats";
export { useHospitalAnalytics } from "./useHospitalAnalytics";
export type { AnalyticsBucket } from "./useHospitalAnalytics";
