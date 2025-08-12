export interface PMSPatient {
  id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  dateOfBirth?: string
  gender?: string
  address?: {
    line1?: string
    line2?: string
    suburb?: string
    state?: string
    postcode?: string
    country?: string
  }
  patientType: "EPC" | "WC"
  physioName?: string
  lastModified: string
}

export interface PMSAppointment {
  id: string
  patientId: string
  date: string
  type?: string
  status: "completed" | "cancelled" | "dna" | "scheduled"
  physioName?: string
  durationMinutes?: number
  notes?: string
  lastModified: string
}

export interface PMSApiCredentials {
  apiKey: string
  apiUrl?: string
  clinicId?: string
}

export interface SyncResult {
  success: boolean
  patientsProcessed: number
  patientsAdded: number
  patientsUpdated: number
  errors: string[]
  lastModified?: string
}

export interface PMSApiInterface {
  testConnection(): Promise<boolean>
  getPatients(lastModified?: string): Promise<PMSPatient[]>
  getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]>
  getPatientAppointments(patientId: string): Promise<PMSAppointment[]>
}

export type PMSType = "cliniko" | "halaxy" | "nookal"

export interface SyncLogEntry {
  id: string
  userId: string
  pmsType: PMSType
  syncType: "full" | "incremental" | "manual"
  status: "running" | "completed" | "failed" | "paused"
  startedAt: string
  completedAt?: string
  lastModifiedSync?: string
  patientsProcessed: number
  patientsAdded: number
  patientsUpdated: number
  errorMessage?: string
  retryCount: number
}
