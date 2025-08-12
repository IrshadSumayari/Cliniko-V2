import type { PMSApiInterface, PMSPatient, PMSAppointment, PMSApiCredentials } from "./types"

export class HalaxyAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials
  private baseUrl: string

  constructor(credentials: PMSApiCredentials) {
    this.credentials = credentials
    this.baseUrl = credentials.apiUrl || "https://api.halaxy.com/v1"
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.credentials.apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Halaxy API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest("/profile")
      return true
    } catch (error) {
      console.error("Halaxy connection test failed:", error)
      return false
    }
  }

  async getPatients(lastModified?: string): Promise<PMSPatient[]> {
    try {
      const params: Record<string, string> = {
        limit: "100",
      }

      if (lastModified) {
        params.modified_since = lastModified
      }

      const response = await this.makeRequest("/patients", params)
      const patients = response.data || []

      return await this.filterEPCWCPatients(patients)
    } catch (error) {
      console.error("Error fetching Halaxy patients:", error)
      throw error
    }
  }

  private async filterEPCWCPatients(patients: any[]): Promise<PMSPatient[]> {
    const filtered: PMSPatient[] = []

    for (const patient of patients) {
      const appointments = await this.getPatientAppointments(patient.id)
      const patientType = this.determinePatientType(appointments)

      if (patientType) {
        filtered.push({
          id: patient.id,
          firstName: patient.first_name || "",
          lastName: patient.last_name || "",
          email: patient.email,
          phone: patient.mobile_phone || patient.home_phone,
          dateOfBirth: patient.date_of_birth,
          gender: patient.gender,
          address: {
            line1: patient.address?.street_address,
            suburb: patient.address?.suburb,
            state: patient.address?.state,
            postcode: patient.address?.postcode,
            country: patient.address?.country,
          },
          patientType,
          physioName: patient.primary_practitioner?.name,
          lastModified: patient.updated_at,
        })
      }
    }

    return filtered
  }

  private determinePatientType(appointments: PMSAppointment[]): "EPC" | "WC" | null {
    for (const appointment of appointments) {
      const type = appointment.type?.toLowerCase() || ""
      const notes = appointment.notes?.toLowerCase() || ""

      if (type.includes("epc") || notes.includes("epc") || type.includes("enhanced primary care")) {
        return "EPC"
      }

      if (
        type.includes("workers comp") ||
        type.includes("workcover") ||
        type.includes("wc") ||
        notes.includes("workers comp")
      ) {
        return "WC"
      }
    }

    return null
  }

  async getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = []

      for (const patientId of patientIds) {
        const appointments = await this.getPatientAppointments(patientId)
        const completedAppointments = appointments.filter(
          (apt) => apt.status === "completed" && (!lastModified || apt.lastModified > lastModified),
        )
        allAppointments.push(...completedAppointments)
      }

      return allAppointments
    } catch (error) {
      console.error("Error fetching Halaxy appointments:", error)
      throw error
    }
  }

  async getPatientAppointments(patientId: string): Promise<PMSAppointment[]> {
    try {
      const response = await this.makeRequest(`/patients/${patientId}/appointments`)
      const appointments = response.data || []

      return appointments.map((apt: any) => ({
        id: apt.id,
        patientId: patientId,
        date: apt.start_time,
        type: apt.appointment_type?.name,
        status: this.mapAppointmentStatus(apt.status),
        physioName: apt.practitioner?.name,
        durationMinutes: apt.duration_minutes,
        notes: apt.notes,
        lastModified: apt.updated_at,
      }))
    } catch (error) {
      console.error(`Error fetching Halaxy appointments for patient ${patientId}:`, error)
      return []
    }
  }

  private mapAppointmentStatus(status: string): "completed" | "cancelled" | "dna" | "scheduled" {
    const statusLower = status?.toLowerCase() || ""

    if (statusLower.includes("completed") || statusLower.includes("attended")) {
      return "completed"
    }
    if (statusLower.includes("cancelled")) {
      return "cancelled"
    }
    if (statusLower.includes("dna") || statusLower.includes("no show")) {
      return "dna"
    }

    return "scheduled"
  }
}
