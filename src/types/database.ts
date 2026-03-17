// Supabase database types — manually synced with migrations 00001–00022
// Data ownership: all product tables reference patient_id, not user_id
// created_by (optional) tracks which auth user created a record (audit only, not access control)

export type UserRole = "patient" | "guardian";

export interface Patient {
  id: string;
  display_name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  patient_id: string | null;
  role: UserRole;
  display_name: string;
  created_at: string;
}

export interface Allergy {
  name: string;
  reaction: string;
  severity: "low" | "medium" | "high";
}

export interface MedicalProfile {
  id: string;
  patient_id: string;
  blood_type: string | null;
  rh_factor: string | null;
  allergies: Allergy[];
  chronic_conditions: string[];
  emergency_info: string | null;
  updated_at: string;
}

export interface DiaryEntry {
  id: string;
  patient_id: string;
  created_by: string | null;
  created_at: string;
  wellbeing_score: number;
  symptoms: string[];
  pain_location: string | null;
  pain_score: number | null;
  sleep_hours: number | null;
  sleep_quality: number | null;
  notes: string | null;
  tags: string[];
}

export interface Document {
  id: string;
  patient_id: string;
  created_by: string | null;
  created_at: string;
  document_date: string;
  category: string;
  title: string;
  doctor: string | null;
  lab: string | null;
  file_url: string | null;
  file_name: string | null;
  status: "normal" | "review" | "abnormal";
  tags: string[];
  notes: string | null;
}

export interface Medication {
  id: string;
  patient_id: string;
  created_by: string | null;
  name: string;
  dosage: string;
  schedule: string;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
}

export interface MedicationIntake {
  id: string;
  patient_id: string;
  medication_id: string;
  created_by: string | null;
  taken_at: string;
}

export type VitalType =
  | "blood_pressure"
  | "pulse"
  | "temperature"
  | "spo2"
  | "weight"
  | "glucose";

export interface Vital {
  id: string;
  patient_id: string;
  created_by: string | null;
  vital_type: VitalType;
  value: string;
  unit: string;
  measured_at: string;
  notes: string | null;
  created_at: string;
}

export type TimelineEventType =
  | "doctor_visit"
  | "analysis"
  | "procedure"
  | "hospitalization"
  | "treatment_change"
  | "other";

export interface TimelineEvent {
  id: string;
  patient_id: string;
  created_by: string | null;
  event_type: TimelineEventType;
  event_date: string;
  title: string;
  notes: string | null;
  created_at: string;
}

export interface EmotionEntry {
  id: string;
  patient_id: string;
  created_by: string | null;
  anxiety: number;
  depression: number;
  calmness: number;
  fatigue: number;
  hope: number;
  notes: string | null;
  created_at: string;
}

export interface DocumentParse {
  id: string;
  document_id: string;
  patient_id: string;
  doc_type: string | null;
  doc_date: string | null;
  lab_or_clinic: string | null;
  key_findings: { name: string; value: string; status?: string }[];
  summary: string | null;
  raw_response: string | null;
  created_at: string;
}

export interface DocumentOpinion {
  id: string;
  document_id: string;
  patient_id: string;
  opinion: string;
  raw_response: string | null;
  created_at: string;
}

export interface DoctorVisitPrep {
  id: string;
  patient_id: string;
  created_by: string | null;
  summary: string;
  raw_response: string | null;
  created_at: string;
}

export type AiFeatureName =
  | "ai_chat"
  | "document_parse"
  | "document_second_opinion"
  | "doctor_visit_prep";

export interface AiUsageEvent {
  id: string;
  patient_id: string;
  created_by: string | null;
  feature_name: AiFeatureName;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

export interface DoctorShareLink {
  id: string;
  patient_id: string;
  created_by: string | null;
  token: string;
  status: "active" | "revoked";
  expires_at: string;
  created_at: string;
}

export interface AiChatMessage {
  id: string;
  patient_id: string;
  created_by: string | null;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}
