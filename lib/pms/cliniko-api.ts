import type { PMSApiInterface, PMSPatient, PMSAppointment, PMSApiCredentials } from "./types"

export class ClinikoAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials
  private baseUrl: string
  private region: string

  constructor(credentials: PMSApiCredentials) {
    this.credentials = credentials
    this.region = credentials.apiKey.split("-").pop() || "au2"
    this.baseUrl = `https://api.${this.region}.cliniko.com/v1`

    console.log(`🔧 Cliniko API initialized:`)
    console.log(`   Region: ${this.region}`)
    console.log(`   Base URL: ${this.baseUrl}`)
    console.log(`   API Key: ${credentials.apiKey.substring(0, 20)}...`)
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    const basicKey = Buffer.from(this.credentials.apiKey).toString("base64")
    console.log(`🔑 Authorization: Basic ${basicKey.substring(0, 20)}...`)

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${basicKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "MyPhysioFlow/1.0",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Cliniko API error: ${response.status} ${response.statusText}`, errorText)
      throw new Error(`Cliniko API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log("🔍 Testing Cliniko connection...")
      console.log("   Region:", this.region)
      console.log("   Base URL:", this.baseUrl)
      console.log(
        "   API Key format:",
        this.credentials.apiKey ? `${this.credentials.apiKey.substring(0, 10)}...` : "missing",
      )

      const response = await this.makeRequest("/businesses", { per_page: "1" })
      console.log("✅ Connection test successful - found businesses:", response.businesses?.length || 0)
      return true
    } catch (error) {
      console.error("❌ Cliniko connection test failed:", error)
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          throw new Error("Invalid API key - please check your Cliniko API key is correct")
        } else if (error.message.includes("403")) {
          throw new Error("API key does not have sufficient permissions")
        } else if (error.message.includes("404")) {
          throw new Error("Cliniko API endpoint not found - please check your region")
        } else {
          throw new Error(`Cliniko API error: ${error.message}`)
        }
      }
      throw new Error("Unknown error connecting to Cliniko")
    }
  }

  async getPatients(lastModified?: string): Promise<PMSPatient[]> {
    try {
      const params: Record<string, string> = {
        per_page: "50",
        sort: "updated_at",
      }

      if (lastModified) {
        params.updated_since = lastModified
      }

      const allPatients: PMSPatient[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        params.page = page.toString()
        const response = await this.makeRequest("/bookings", params)

        const bookings = response.bookings || []
        const individualAppointments = bookings.filter(
          (booking) => booking.patient && booking.appointment_type && !booking.unavailable_block_type,
        )

        const filteredPatients = await this.processBookingsForPatients(individualAppointments)
        allPatients.push(...filteredPatients)

        hasMore = response.links?.next !== undefined
        page++

        if (page > 100) break
      }

      return allPatients
    } catch (error) {
      console.error("Error fetching Cliniko patients:", error)
      throw error
    }
  }

  private async processBookingsForPatients(bookings: any[]): Promise<PMSPatient[]> {
    const patientMap = new Map<string, PMSPatient>()

    for (const booking of bookings) {
      if (!booking.patient?.links?.self) continue

      const patientId = booking.patient.links.self.split("/").pop()
      if (!patientId || patientMap.has(patientId)) continue

      const patientData = await this.getPatientDetails(patientId)
      if (!patientData) continue

      const appointmentType = await this.getAppointmentTypeDetails(booking.appointment_type.links.self)
      const patientType = this.determinePatientTypeFromBooking(booking, appointmentType)

      if (patientType) {
        patientMap.set(patientId, {
          id: patientId,
          firstName: patientData.first_name || "",
          lastName: patientData.last_name || "",
          email: patientData.email,
          phone: patientData.phone_number,
          dateOfBirth: patientData.date_of_birth,
          gender: patientData.gender,
          address: {
            line1: patientData.address_1,
            line2: patientData.address_2,
            suburb: patientData.city,
            state: patientData.state,
            postcode: patientData.post_code,
            country: patientData.country,
          },
          patientType,
          physioName: booking.patient_name,
          lastModified: patientData.updated_at,
        })
      }
    }

    return Array.from(patientMap.values())
  }

  private async getPatientDetails(patientId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/patients/${patientId}`)
      return response
    } catch (error) {
      console.error(`Error fetching patient details for ${patientId}:`, error)
      return null
    }
  }

  private async getAppointmentTypeDetails(appointmentTypeUrl: string): Promise<any> {
    try {
      const appointmentTypeId = appointmentTypeUrl.split("/").pop()
      const response = await this.makeRequest(`/appointment_types/${appointmentTypeId}`)
      return response
    } catch (error) {
      console.error(`Error fetching appointment type details:`, error)
      return null
    }
  }

  private determinePatientTypeFromBooking(booking: any, appointmentType: any): "EPC" | "WC" | null {
    const appointmentTypeName = appointmentType?.name?.toLowerCase() || ""
    const notes = booking.notes?.toLowerCase() || ""

    if (
      appointmentTypeName.includes("epc") ||
      appointmentTypeName.includes("enhanced primary care") ||
      appointmentTypeName.includes("medicare") ||
      notes.includes("epc") ||
      notes.includes("enhanced primary care") ||
      notes.includes("medicare")
    ) {
      return "EPC"
    }

    if (
      appointmentTypeName.includes("workers comp") ||
      appointmentTypeName.includes("workcover") ||
      appointmentTypeName.includes("wc") ||
      appointmentTypeName.includes("work injury") ||
      notes.includes("workers comp") ||
      notes.includes("workcover") ||
      notes.includes("work injury")
    ) {
      return "WC"
    }

    return null
  }

  async getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]> {
    try {
      const params: Record<string, string> = {
        per_page: "50",
      }

      if (lastModified) {
        params.updated_since = lastModified
      }

      const allAppointments: PMSAppointment[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        params.page = page.toString()
        const response = await this.makeRequest("/bookings", params)

        const bookings = response.bookings || []
        const completedBookings = bookings.filter(
          (booking) =>
            booking.patient &&
            booking.appointment_type &&
            !booking.unavailable_block_type &&
            !booking.cancelled_at &&
            !booking.did_not_arrive &&
            new Date(booking.ends_at) < new Date(),
        )

        const appointments = completedBookings
          .filter((booking) => {
            const patientId = booking.patient.links.self.split("/").pop()
            return patientIds.includes(patientId)
          })
          .map((booking) => this.mapBookingToAppointment(booking))

        allAppointments.push(...appointments)

        hasMore = response.links?.next !== undefined
        page++

        if (page > 100) break
      }

      return allAppointments
    } catch (error) {
      console.error("Error fetching Cliniko appointments:", error)
      throw error
    }
  }

  private mapBookingToAppointment(booking: any): PMSAppointment {
    const patientId = booking.patient.links.self.split("/").pop()

    return {
      id: booking.id,
      patientId: patientId,
      date: booking.starts_at,
      type: booking.appointment_type?.name || "Unknown",
      status: "completed",
      physioName: booking.patient_name,
      durationMinutes: this.calculateDuration(booking.starts_at, booking.ends_at),
      notes: booking.notes,
      lastModified: booking.updated_at,
    }
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime)
    const end = new Date(endTime)
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  }

  async getPatientAppointments(patientId: string): Promise<PMSAppointment[]> {
    const bookings = await this.getPatientBookings(patientId)
    return bookings.map((booking) => this.mapBookingToAppointment(booking))
  }

  private async getPatientBookings(patientId: string): Promise<any[]> {
    try {
      const response = await this.makeRequest("/bookings", {
        patient_id: patientId,
        per_page: "50",
      })

      return response.bookings || []
    } catch (error) {
      console.error(`Error fetching bookings for patient ${patientId}:`, error)
      return []
    }
  }

  private mapBookingStatus(status: string): "completed" | "cancelled" | "dna" | "scheduled" {
    const statusLower = status?.toLowerCase() || ""

    if (statusLower.includes("completed") || statusLower.includes("arrived") || statusLower.includes("confirmed")) {
      return "completed"
    }
    if (statusLower.includes("cancelled") || statusLower.includes("deleted")) {
      return "cancelled"
    }
    if (statusLower.includes("dna") || statusLower.includes("did not attend") || statusLower.includes("no show")) {
      return "dna"
    }

    return "scheduled"
  }
}
