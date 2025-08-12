import type { PMSApiInterface, PMSPatient, PMSAppointment, PMSApiCredentials } from "./types"

export class NookalAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials
  private baseUrl: string

  constructor(credentials: PMSApiCredentials) {
    this.credentials = credentials
    this.baseUrl = credentials.apiUrl || "https://api.nookal.com/production/v1"
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    // Nookal requires API key as a parameter
    const allParams = {
      api_key: this.credentials.apiKey,
      ...params,
    }

    Object.entries(allParams).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Nookal API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Nookal wraps responses in a status object
    if (data.status !== "success") {
      throw new Error(`Nookal API error: ${data.message || "Unknown error"}`)
    }

    return data
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest("/getLocations")
      return true
    } catch (error) {
      console.error("Nookal connection test failed:", error)
      return false
    }
  }

  async getPatients(lastModified?: string): Promise<PMSPatient[]> {
    try {
      const params: Record<string, string> = {}

      if (lastModified) {
        params.modified_since = lastModified
      }

      const response = await this.makeRequest("/getPatients", params)
      const patients = response.data?.patients || []

      return await this.filterEPCWCPatients(patients)
    } catch (error) {
      console.error("Error fetching Nookal patients:", error)
      throw error
    }
  }

  private async filterEPCWCPatients(patients: any[]): Promise<PMSPatient[]> {
    const filtered: PMSPatient[] = []

    for (const patient of patients) {
      const appointments = await this.getPatientAppointments(patient.ID)
      const patientType = this.determinePatientType(appointments)

      if (patientType) {
        filtered.push({
          id: patient.ID,
          firstName: patient.FirstName || "",
          lastName: patient.LastName || "",
          email: patient.Email,
          phone: patient.Phone,
          dateOfBirth: patient.DOB,
          gender: patient.Gender,
          address: {
            line1: patient.Address,
            suburb: patient.Suburb,
            state: patient.State,
            postcode: patient.Postcode,
            country: patient.Country,
          },
          patientType,
          physioName: patient.PrimaryPractitioner,
          lastModified: patient.LastModified,
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
      console.error("Error fetching Nookal appointments:", error)
      throw error
    }
  }

  async getPatientAppointments(patientId: string): Promise<PMSAppointment[]> {
    try {
      const response = await this.makeRequest("/getAppointments", {
        patient_id: patientId,
      })

      const appointments = response.data?.appointments || []

      return appointments.map((apt: any) => ({
        id: apt.ID,
        patientId: patientId,
        date: apt.Date + " " + apt.StartTime,
        type: apt.AppointmentType,
        status: this.mapAppointmentStatus(apt.Status),
        physioName: apt.Practitioner,
        durationMinutes: Number.parseInt(apt.Duration) || 0,
        notes: apt.Notes,
        lastModified: apt.LastModified,
      }))
    } catch (error) {
      console.error(`Error fetching Nookal appointments for patient ${patientId}:`, error)
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
    if (statusLower.includes("dna") || statusLower.includes("did not attend")) {
      return "dna"
    }

    return "scheduled"
  }
}
