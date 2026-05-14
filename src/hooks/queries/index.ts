export {
  usePatients,
  usePatientsDirectory,
  usePatient,
  useCreatePatient,
  useUpdatePatient,
  useTransferPatient,
  usePatientWardHistory,
} from "./usePatients";
export type { PatientDirectoryEntry } from "./usePatients";
export { useWards, useMyWards } from "./useWards";
export {
  useConsultations,
  useConsultation,
  useCreateConsultation,
  useUpdateConsultation,
  useAddenda,
  useCreateAddendum,
  useClinicalReports,
  useUpdateClinicalReport,
  usePatientTimeline,
  usePatientNotes,
  usePatientDocuments,
  useCreateDocumentFromNotes,
} from "./useConsultations";
export { useTemplates } from "./useTemplates";
export { useConsultationScripts } from "./useConsultationScripts";
export type { ConsultationScript } from "./useConsultationScripts";
export { usePatientTranscriptHistory } from "./usePatientTranscriptHistory";
export {
  useAdminScripts,
  useCreateScript,
  useUpdateScript,
  useDeleteScript,
} from "./useAdminScripts";
export type { AdminScript, CreateScriptInput, UpdateScriptInput } from "./useAdminScripts";
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
