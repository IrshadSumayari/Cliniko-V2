import type {
  PMSApiInterface,
  PMSPatient,
  PMSAppointment,
  PMSApiCredentials,
} from "./types";

export class NookalAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials;
  private baseUrl: string;

  constructor(credentials: PMSApiCredentials) {
    this.credentials = credentials;
    this.baseUrl = credentials.apiUrl || "https://api.nookal.com/production/v2";
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}${endpoint}`);

    const allParams = {
      api_key: this.credentials.apiKey,
      ...params,
    };

    Object.entries(allParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      console.log(`[NOOKAL] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[NOOKAL] HTTP Error: ${response.status} ${response.statusText}`
        );
        console.error(`[NOOKAL] Error body: ${errorText}`);
        throw new Error(
          `Nookal API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (data.status && data.status !== "success") {
        console.error(`[NOOKAL] API returned error status: ${data.status}`);
        throw new Error(`Nookal API error: ${data.message || "Unknown error"}`);
      }

      return data;
    } catch (error) {
      console.error(`[NOOKAL] Request failed:`, error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log(
        "[NOOKAL] Testing connection with getAppointments endpoint..."
      );
      const response = await this.makeRequest("/getAppointments", {
        limit: "1",
      });
      console.log("[NOOKAL] ✅ Connection test successful!");
      return true;
    } catch (error) {
      console.error("[NOOKAL] ❌ Connection test failed:", error);
      return false;
    }
  }

  async getAllPatients(): Promise<PMSPatient[]> {
    try {
      console.log("[NOOKAL] Fetching all patients...");
      const response = await this.makeRequest("/getpatients");
      const patients =
        response.data?.results?.patients ||
        response.data?.patients ||
        response.patients ||
        [];
      console.log(`[NOOKAL] Found ${patients.length} total patients`);

      return await this.filterEPCWCPatients(patients);
    } catch (error) {
      console.error("Error fetching all Nookal patients:", error);
      throw error;
    }
  }

  async getModifiedPatients(lastModified: Date): Promise<PMSPatient[]> {
    try {
      const modifiedSince = lastModified.toISOString().split("T")[0];
      console.log(
        `[NOOKAL] Fetching patients modified since: ${modifiedSince}`
      );

      const response = await this.makeRequest("/getpatients", {
        modified_since: modifiedSince,
      });

      const patients =
        response.data?.results?.patients ||
        response.data?.patients ||
        response.patients ||
        [];
      return await this.filterEPCWCPatients(patients);
    } catch (error) {
      console.error("Error fetching modified Nookal patients:", error);
      throw error;
    }
  }

  async getPatients(
    lastModified?: string,
    appointmentTypeIds?: string[]
  ): Promise<PMSPatient[]> {
    try {
      const params: Record<string, string> = {};

      if (lastModified) {
        params.modified_since = lastModified;
      }

      if (appointmentTypeIds && appointmentTypeIds.length > 0) {
        console.log(
          "⚠️ Nookal API doesn't support appointment type filtering, fetching all patients"
        );
      }

      const response = await this.makeRequest("/getpatients", params);
      const patients =
        response.data?.results?.patients ||
        response.data?.patients ||
        response.patients ||
        [];

      return await this.filterEPCWCPatients(patients);
    } catch (error) {
      console.error("Error fetching Nookal patients:", error);
      throw error;
    }
  }

  async getPatientsWithAppointments(
    lastModified?: string,
    appointmentTypeIds?: string[]
  ): Promise<{ patients: PMSPatient[]; appointments: PMSAppointment[] }> {
    try {
      // First, get all patients
      const patients = await this.getPatients(lastModified, appointmentTypeIds);
      console.log(`[NOOKAL] Found ${patients.length} EPC/WC patients`);

      // Use efficient batch processing for appointments
      const allAppointments = await this.getAppointmentsBatch(
        patients,
        lastModified
      );

      return { patients, appointments: allAppointments };
    } catch (error) {
      console.error("Error fetching Nookal patients with appointments:", error);
      throw error;
    }
  }

  private async getAppointmentsBatch(
    patients: PMSPatient[],
    lastModified?: string
  ): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = [];
      const BATCH_SIZE = 200; // Same batch size as Cliniko for consistency
      const totalBatches = Math.ceil(patients.length / BATCH_SIZE);

      console.log(
        `[NOOKAL] Processing appointments in ${totalBatches} batches of ${BATCH_SIZE}`
      );

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIndex = batchIndex * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, patients.length);
        const batch = patients.slice(startIndex, endIndex);

        const batchPromises = batch.map(async (patient) => {
          try {
            const patientAppointments = await this.getPatientAppointments(
              patient.id.toString(),
              lastModified ? new Date(lastModified) : undefined
            );

            const validAppointments = patientAppointments.filter((apt) => {
              const today = new Date();
              const appointmentDate = new Date(
                apt.appointment_date || apt.date
              );

              return (
                apt.cancelled_at === null && // cancelled_at = null
                apt.did_not_arrive === false && // did_not_arrive = false
                appointmentDate <= today // appointment_date <= today
              );
            });

            return validAppointments;
          } catch (error) {
            console.error(
              `[NOOKAL] Error fetching appointments for patient ${patient.id}:`,
              error
            );
            return [];
          }
        });

        // Wait for all patients in this batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Flatten results and add to all appointments
        for (const patientAppointments of batchResults) {
          allAppointments.push(...patientAppointments);
        }

        console.log(
          `[NOOKAL] ✅ Batch ${batchIndex + 1} completed: ${batchResults.reduce((sum, apts) => sum + apts.length, 0)} appointments`
        );

        // Small delay between batches to be respectful to the API
        if (batchIndex < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `[NOOKAL] 🎯 Batch processing completed: ${allAppointments.length} total appointments from ${patients.length} patients`
      );

      return allAppointments;
    } catch (error) {
      console.error("[NOOKAL] Error in batch appointment processing:", error);
      throw error;
    }
  }

  private async filterEPCWCPatients(patients: any[]): Promise<PMSPatient[]> {
    const filtered: PMSPatient[] = [];

    for (const patient of patients) {
      const appointments = await this.getPatientAppointments(
        patient.ID || patient.id
      );
      const patientType = this.determinePatientType(appointments);
      if (patientType) {
        filtered.push({
          id: patient.ID || patient.id,
          firstName: patient.FirstName || patient.first_name || "",
          lastName: patient.LastName || patient.last_name || "",
          email: patient.Email || patient.email,
          phone: patient.Phone || patient.phone,
          dateOfBirth: patient.DOB || patient.date_of_birth,
          gender: patient.Gender || patient.gender,
          address: {
            line1: patient.Address || patient.address,
            suburb: patient.Suburb || patient.suburb,
            state: patient.State || patient.state,
            postcode: patient.Postcode || patient.postcode,
            country: patient.Country || patient.country,
          },
          patientType,
          physioName:
            patient.PrimaryPractitioner || patient.primary_practitioner,
          lastModified: patient.LastModified || patient.last_modified,
        });
      }
    }

    return filtered;
  }

  isEPCPatient(patient: any): boolean {
    return patient.patientType === "EPC" || patient.patient_type === "EPC";
  }

  isWCPatient(patient: any): boolean {
    return patient.patientType === "WC" || patient.patient_type === "WC";
  }

  isCompletedAppointment(appointment: any): boolean {
    const status = (
      appointment.status ||
      appointment.Status ||
      ""
    ).toLowerCase();
    const cancelled =
      appointment.cancelled === "1" || appointment.cancelled === true;
    const dna = appointment.DNA === "1" || appointment.did_not_arrive === true;

    // Check if appointment is up to current date
    const appointmentDate = new Date(
      appointment.appointmentDate || appointment.Date || appointment.date
    );
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); // Include today's appointments

    const isCompleted = status === "completed";
    const isNotCancelled = !cancelled;
    const isNotDNA = !dna;
    const isUpToCurrentDate = appointmentDate <= currentDate;

    return isCompleted && isNotCancelled && isNotDNA && isUpToCurrentDate;
  }

  private determinePatientType(
    appointments: PMSAppointment[]
  ): "EPC" | "WC" | any {
    console.log("appointmentsPlus", appointments);
    for (const appointment of appointments) {
      const type = appointment.type?.toLowerCase() || "";
      const notes = appointment.notes?.toLowerCase() || "";

      if (
        type.includes("epc") ||
        notes.includes("epc") ||
        type.includes("enhanced primary care") ||
        type.includes("medicare")
      ) {
        return "EPC";
      }

      if (
        type.includes("workers comp") ||
        type.includes("workcover") ||
        type.includes("wc") ||
        type.includes("work injury") ||
        notes.includes("workers comp")
      ) {
        return "WC";
      }
    }

    return null;
  }

  async getAppointments(
    patientIds: string[],
    lastModified?: string
  ): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = [];

      for (const patientId of patientIds) {
        const appointments = await this.getPatientAppointments(patientId);
        const filteredAppointments = appointments.filter(
          (apt) =>
            this.isCompletedAppointment(apt) &&
            (!lastModified || apt.lastModified > lastModified)
        );

        allAppointments.push(...filteredAppointments);
      }

      console.log(
        `[NOOKAL] Total completed appointments across all patients: ${allAppointments.length}`
      );
      return allAppointments;
    } catch (error) {
      console.error("Error fetching Nookal appointments:", error);
      throw error;
    }
  }

  async getPatientAppointments(
    patientId: string,
    lastModified?: Date
  ): Promise<PMSAppointment[]> {
    try {
      const params: Record<string, string> = {
        patient_id: patientId,
      };

      if (lastModified) {
        params.modified_since = lastModified.toISOString().split("T")[0];
      }

      const response = await this.makeRequest("/getAppointments", params);

      const appointments =
        response.data?.results?.appointments ||
        response.data?.appointments ||
        response.appointments ||
        [];

      return appointments.map((apt: any) => ({
        id: apt.ID || apt.id,
        patientId: apt.patientID || apt.patient_id || patientId,
        date:
          apt.appointmentDate && apt.appointmentStartTime
            ? `${apt.appointmentDate} ${apt.appointmentStartTime}`
            : apt.Date
              ? `${apt.Date} ${apt.StartTime || apt.start_time || ""}`.trim()
              : apt.date,
        type:
          apt.appointmentType || apt.AppointmentType || apt.appointment_type,
        status: this.mapAppointmentStatus(apt.status || apt.Status, apt),
        physioName: apt.Practitioner || apt.practitioner,
        durationMinutes:
          this.calculateDuration(
            apt.appointmentStartTime,
            apt.appointmentEndTime
          ) ||
          Number.parseInt(apt.Duration || apt.duration) ||
          0,
        notes: apt.Notes || apt.notes,
        lastModified: apt.lastModified || apt.LastModified || apt.last_modified,
        cancelled_at:
          apt.cancelled === "1"
            ? apt.cancellationDate || apt.cancelled_at
            : null,
        did_not_arrive:
          apt.DNA === "1" || apt.DidNotArrive || apt.did_not_arrive || false,
        appointment_date:
          apt.appointmentDate && apt.appointmentStartTime
            ? `${apt.appointmentDate} ${apt.appointmentStartTime}`
            : apt.Date
              ? `${apt.Date} ${apt.StartTime || apt.start_time || ""}`.trim()
              : apt.date,
        appointment_type_id:
          apt.appointmentTypeID ||
          apt.AppointmentTypeID ||
          apt.appointment_type_id,
        appointment_type: apt.appointmentType
          ? { name: apt.appointmentType }
          : apt.AppointmentType
            ? { name: apt.AppointmentType }
            : null,
        practitioner: apt.Practitioner ? { name: apt.Practitioner } : null,
        duration:
          this.calculateDuration(
            apt.appointmentStartTime,
            apt.appointmentEndTime
          ) ||
          Number.parseInt(apt.Duration || apt.duration) ||
          0,
      }));
    } catch (error) {
      console.error(
        `Error fetching Nookal appointments for patient ${patientId}:`,
        error
      );
      return [];
    }
  }

  private mapAppointmentStatus(
    status: string,
    appointment: any
  ): "completed" | "cancelled" | "dna" | "scheduled" {
    if (appointment.cancelled === "1") {
      return "cancelled";
    }
    if (appointment.DNA === "1") {
      return "dna";
    }
    if (appointment.arrived === "1" && appointment.cancelled !== "1") {
      return "completed";
    }

    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("completed") || statusLower.includes("attended")) {
      return "completed";
    }
    if (statusLower.includes("cancelled")) {
      return "cancelled";
    }
    if (statusLower.includes("dna") || statusLower.includes("did not attend")) {
      return "dna";
    }

    return "scheduled";
  }

  private calculateDuration(startTime: string, endTime: string): number {
    if (!startTime || !endTime) return 0;

    try {
      const start = new Date(`1970-01-01T${startTime}`);
      const end = new Date(`1970-01-01T${endTime}`);
      const diffMs = end.getTime() - start.getTime();
      return Math.round(diffMs / (1000 * 60)); // Convert to minutes
    } catch {
      return 0;
    }
  }

  async getAppointmentTypes(): Promise<any[]> {
    try {
      console.log("🔍 Fetching appointment types from Nookal v2...");
      const response = await this.makeRequest("/getAppointmentTypes");
      const appointmentTypes =
        response.data?.results?.services ||
        response.data?.services ||
        response.services ||
        [];
      console.log(
        `✅ Found ${appointmentTypes.length} appointment types from Nookal v2`
      );
      console.log(
        `📋 Sample appointment type names:`,
        appointmentTypes.slice(0, 3).map((apt: any) => apt.Name || apt.name)
      );
      return appointmentTypes;
    } catch (error) {
      console.error("❌ Error fetching Nookal appointment types:", error);
      return [];
    }
  }

  processAppointmentTypes(appointmentTypes: any[]): Array<{
    appointment_id: string;
    appointment_name: string;
    code: string;
  }> {
    const processedTypes: Array<{
      appointment_id: string;
      appointment_name: string;
      code: string;
    }> = [];

    for (const appointmentType of appointmentTypes) {
      const name = appointmentType.Name || appointmentType.name;
      const id = appointmentType.ID || appointmentType.id;
      const code = this.extractCodeFromName(name);

      if (code && name && id) {
        processedTypes.push({
          appointment_id: id.toString(),
          appointment_name: name,
          code: code,
        });

        console.log(`📝 Processed appointment type: ${name} -> ${code}`);
      }
    }

    console.log(
      `✅ Filtered ${processedTypes.length} EPC/WC appointment types from ${appointmentTypes.length} total`
    );
    return processedTypes;
  }

  private extractCodeFromName(name: string): string | null {
    const nameLower = name.toLowerCase();

    if (
      nameLower.includes("epc") ||
      nameLower.includes("enhanced primary care") ||
      nameLower.includes("medicare")
    ) {
      return "EPC";
    }

    if (
      nameLower.includes("w/c") ||
      nameLower.includes("wc") ||
      nameLower.includes("workers comp") ||
      nameLower.includes("workcover") ||
      nameLower.includes("work cover") ||
      nameLower.includes("work injury") ||
      nameLower.includes("workers compensation")
    ) {
      return "WC";
    }

    return null;
  }
}
