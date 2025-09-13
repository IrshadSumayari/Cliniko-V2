import type {
  PMSApiInterface,
  PMSPatient,
  PMSAppointment,
  PMSApiCredentials,
  PMSPractitioner,
} from './types';

export class ClinikoAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials;
  private baseUrl: string;
  private region: string;

  constructor(credentials: PMSApiCredentials) {
    this.credentials = credentials;
    this.region = credentials.apiKey.split('-').pop() || 'au2';
    this.baseUrl = `https://api.${this.region}.cliniko.com/v1`;

    console.log(`🔧 Cliniko API initialized:`);
    console.log(`   Region: ${this.region}`);
    console.log(`   Base URL: ${this.baseUrl}`);
    console.log(`   API Key: ${credentials.apiKey.substring(0, 20)}...`);

    // Verify zone consistency
    this.verifyZoneConsistency();
  }

  private verifyZoneConsistency() {
    console.log(
      `🔍 Zone consistency check: API Key zone: ${this.region} Base URL: ${this.baseUrl}`
    );
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>) {
    let urlString = `${this.baseUrl}${endpoint}`;

    if (params) {
      // Manually build the query string to handle q[] parameter correctly
      const queryParams = Object.entries(params)
        .map(([key, value]) => {
          if (key === 'q[]') {
            // Don't encode the q[] parameter value, let it be as-is
            return `${key}=${value}`;
          }
          return `${key}=${encodeURIComponent(value)}`;
        })
        .join('&');

      if (queryParams) {
        urlString += `?${queryParams}`;
      }
    }

    console.log(`🔍 Final URL: ${urlString}`);

    const basicKey = Buffer.from(this.credentials.apiKey).toString('base64');
    console.log(`🔑 Authorization: Basic ${basicKey.substring(0, 20)}...`);

    const response = await fetch(urlString, {
      headers: {
        Authorization: `Basic ${basicKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'MyPhysioFlow/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Cliniko API error: ${response.status} ${response.statusText}`, errorText);
      console.error(`   Failed URL: ${urlString}`);
      console.error(`   Zone: ${this.region}`);
      throw new Error(`Cliniko API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log(`✅ API call successful:`);
    // console.log(`   Response status: ${response.status}`);
    // console.log(
    //   `   Response data keys: ${Object.keys(responseData).join(", ")}`
    // );

    // Log specific data counts if available
    if (responseData.bookings) {
      console.log(`   Bookings count: ${responseData.bookings.length}`);
    }
    if (responseData.patients) {
      console.log(`   Patients count: ${responseData.patients.length}`);
    }
    if (responseData.appointment_types) {
      console.log(`   Appointment types count: ${responseData.appointment_types.length}`);
    }

    return responseData;
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🔍 Testing Cliniko connection...');
      console.log('   Region:', this.region);
      console.log('   Base URL:', this.baseUrl);
      console.log(
        '   API Key format:',
        this.credentials.apiKey ? `${this.credentials.apiKey.substring(0, 10)}...` : 'missing'
      );

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout after 10 seconds')), 10000);
      });

      const connectionPromise = this.makeRequest('/businesses', {
        per_page: '1',
      });

      const response = await Promise.race([connectionPromise, timeoutPromise]);
      console.log(
        '✅ Connection test successful - found businesses:',
        response.businesses?.length || 0
      );
      return true;
    } catch (error) {
      console.error('❌ Cliniko connection test failed:', error);
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          throw new Error('Connection test timed out - please check your internet connection');
        } else if (error.message.includes('401')) {
          throw new Error('Invalid API key - please check your Cliniko API key is correct');
        } else if (error.message.includes('403')) {
          throw new Error('API key does not have sufficient permissions');
        } else if (error.message.includes('404')) {
          throw new Error('Cliniko API endpoint not found - please check your region');
        } else {
          throw new Error(`Cliniko API error: ${error.message}`);
        }
      }
      throw new Error('Unknown error connecting to Cliniko');
    }
  }

  // Simple method to just fetch patients (if you only need patients)
  async syncPatientsOnly(): Promise<PMSPatient[]> {
    try {
      console.log('👥 Fetching patients only from Cliniko...');
      const patients = await this.getFirst200Patients();
      console.log(`✅ Patients fetched: ${patients.length} patients`);
      return patients;
    } catch (error) {
      console.error('❌ Error fetching patients from Cliniko:', error);
      throw error;
    }
  }

  // Complete sync method that fetches everything: appointment types, patients, AND appointments
  async syncComplete(): Promise<{
    appointmentTypes: any[];
    patients: PMSPatient[];
    appointments: PMSAppointment[];
  }> {
    try {
      console.log(
        '🚀 Starting complete Cliniko sync: Appointment Types + Patients + Appointments...'
      );

      // Step 1: Fetch all appointment types
      console.log('📋 Step 1: Fetching appointment types...');
      const appointmentTypes = await this.getAppointmentTypes();
      console.log(`✅ Step 1 completed: Found ${appointmentTypes.length} appointment types`);

      // Step 2: Fetch first 200 patients
      console.log('👥 Step 2: Fetching first 200 patients...');
      const patients = await this.getFirst200Patients();
      console.log(`✅ Step 2 completed: Found ${patients.length} patients`);

      // Step 3: Fetch all appointments for these patients
      console.log('📅 Step 3: Fetching all appointments for patients...');
      const patientIds = patients.map((p) => p.id.toString());
      const appointments = await this.getAppointmentsForPatients(patientIds);
      console.log(`✅ Step 3 completed: Found ${appointments.length} appointments`);

      console.log(
        `🎯 Complete sync finished: ${appointmentTypes.length} appointment types + ${patients.length} patients + ${appointments.length} appointments`
      );

      return {
        appointmentTypes,
        patients,
        appointments,
      };
    } catch (error) {
      console.error('❌ Error in complete Cliniko sync:', error);
      throw error;
    }
  }

  // Remove the syncCompleteWithCounts method - counts are calculated in the route file like Nookal

  // New method to get first 200 patients directly from /patients endpoint (same as Nookal flow)
  async getFirst200Patients(appointmentTypeIds?: string[]): Promise<PMSPatient[]> {
    try {
      console.log('🔍 Fetching first 200 patients directly from Cliniko /patients endpoint...');
      console.log('   Appointment type IDs:', appointmentTypeIds || 'not specified');

      const allPatients: PMSPatient[] = [];
      const patientsPerPage = 100; // Cliniko supports 1-100 per page
      const targetTotal = 200; // We want 200 patients total
      let currentPage = 1;

      console.log(`🚀 Starting to fetch patients in batches of ${patientsPerPage}...`);

      while (allPatients.length < targetTotal) {
        console.log(
          `📄 Fetching page ${currentPage} (target: ${targetTotal} patients, current: ${allPatients.length})`
        );

        const params: Record<string, string> = {
          per_page: patientsPerPage.toString(), // Use 100 per page (Cliniko's limit)
          page: currentPage.toString(),
        };

        try {
          // Call the /patients endpoint directly (not /bookings)
          const response = await this.makeRequest('/patients', params);
          const patients = response.patients || [];

          if (patients.length === 0) {
            console.log(`📄 Page ${currentPage}: No more patients found, stopping`);
            break;
          }

          console.log(`📋 Page ${currentPage}: Found ${patients.length} patients`);

          // Process each patient and add to our collection
          for (const patient of patients) {
            if (allPatients.length >= targetTotal) {
              console.log(`🎯 Reached target of ${targetTotal} patients`);
              break;
            }
            console.log(patients, 'allPatients');
            // Map Cliniko patient data to our standard format
            const mappedPatient: PMSPatient = {
              id: patient.id,
              firstName: patient.first_name || '',
              lastName: patient.last_name || '',
              email: patient.email,
              phone: patient.phone_number,
              dateOfBirth: patient.date_of_birth,
              gender: patient.gender,
              address: {
                line1: patient.address_1,
                line2: patient.address_2,
                suburb: patient.city,
                state: patient.state,
                postcode: patient.post_code,
                country: patient.country,
              },
              patientType: null, // Will be determined by appointment types during case population
              physioName: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
              lastModified: patient.updated_at,
            };

            allPatients.push(mappedPatient);
          }

          console.log(
            `✅ Page ${currentPage}: Added ${patients.length} patients, total now: ${allPatients.length}`
          );

          // Check if there are more pages
          const hasMore = response.links?.next !== undefined;
          if (!hasMore) {
            console.log(`📄 No more pages available, stopping`);
            break;
          }

          currentPage++;

          // Safety check to prevent infinite loops
          if (currentPage > 50) {
            console.log(`⚠️ Reached maximum page limit (50), stopping`);
            break;
          }
        } catch (error) {
          console.error(`❌ Error fetching page ${currentPage}:`, error);
          break;
        }
      }

      console.log(`✅ Total patients fetched: ${allPatients.length} from ${currentPage - 1} pages`);
      return allPatients;
    } catch (error) {
      console.error('❌ Error fetching first 200 patients from Cliniko:', error);
      throw error;
    }
  }

  // Remove the old methods that are no longer needed with the new Nookal-style flow:
  // - processBookingsForPatients (no longer needed - we fetch patients directly)
  // - determinePatientTypeFromBooking (no longer needed - we fetch patients directly)
  // - getAppointmentsForPatients (will implement later when we discuss booking flow)

  // Modified method to match Nookal flow - get patients and appointments together
  async getPatientsWithAppointments(
    lastModified?: string,
    appointmentTypeIds?: string[] // Optional: filter patients by appointment types (not used in new flow)
  ): Promise<{ patients: PMSPatient[]; appointments: PMSAppointment[] }> {
    try {
      console.log('🔍 Fetching patients and appointments from Cliniko (same as Nookal flow)...');
      console.log('   Last modified:', lastModified || 'not specified');
      console.log(
        '   Appointment type IDs:',
        appointmentTypeIds || 'not specified (not used in new flow)'
      );

      // Step 1: Get first 200 patients directly from /patients endpoint
      const patients = await this.getFirst200Patients(appointmentTypeIds);
      console.log(`✅ Step 1 completed: Found ${patients.length} patients`);

      if (patients.length === 0) {
        console.log('⚠️ No patients found, returning empty result');
        return { patients: [], appointments: [] };
      }

      // Step 2: Get all appointments for these 200 patients
      const patientIds = patients.map((p) => p.id.toString());
      const appointments = await this.getAppointmentsForPatients(patientIds, lastModified);
      console.log(`✅ Step 2 completed: Found ${appointments.length} appointments`);

      console.log(
        `🎯 Nookal-style sync complete: ${patients.length} patients + ${appointments.length} appointments`
      );
      return { patients, appointments };
    } catch (error) {
      console.error('❌ Error in Nookal-style sync from Cliniko:', error);
      throw error;
    }
  }

  // Legacy method - now calls the new Nookal-style method
  async getPatients(lastModified?: string, appointmentTypeIds?: string[]): Promise<PMSPatient[]> {
    try {
      console.log('🔍 Fetching patients from Cliniko (legacy method - now uses Nookal flow)...');

      // For Cliniko, we now use the Nookal-style flow that directly fetches from /patients endpoint
      // We get the first 200 patients in batches of 100 (appointment type IDs not used in new flow)
      const { patients } = await this.getPatientsWithAppointments(lastModified, appointmentTypeIds);
      return patients;
    } catch (error) {
      console.error('❌ Error fetching patients from Cliniko:', error);
      throw error;
    }
  }

  // Legacy method - now calls the new Nookal-style method
  async getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]> {
    try {
      console.log(
        '🔍 Fetching appointments from Cliniko (legacy method - now uses Nookal flow)...'
      );

      // Use the new method to get appointments for specific patients
      const appointments = await this.getAppointmentsForPatients(patientIds, lastModified);
      return appointments;
    } catch (error) {
      console.error('❌ Error fetching appointments from Cliniko:', error);
      throw error;
    }
  }

  // Legacy method - now calls the new Nookal-style method
  async getPatientAppointments(patientId: string): Promise<PMSAppointment[]> {
    try {
      console.log(`🔍 Fetching appointments for patient ${patientId} from Cliniko...`);

      // Use the new method to get appointments for a single patient
      const appointments = await this.getAppointmentsForPatients([patientId]);
      return appointments;
    } catch (error) {
      console.error(`❌ Error fetching appointments for patient ${patientId} from Cliniko:`, error);
      return [];
    }
  }

  // Required interface methods
  async getAllPatients(): Promise<PMSPatient[]> {
    try {
      console.log('🔍 Fetching all patients from Cliniko...');
      const { patients } = await this.getPatientsWithAppointments();
      return patients;
    } catch (error) {
      console.error('❌ Error fetching all patients from Cliniko:', error);
      return [];
    }
  }

  async getModifiedPatients(lastModified: Date): Promise<PMSPatient[]> {
    try {
      console.log('🔍 Fetching modified patients from Cliniko...');
      const { patients } = await this.getPatientsWithAppointments(lastModified.toISOString());
      return patients;
    } catch (error) {
      console.error('❌ Error fetching modified patients from Cliniko:', error);
      return [];
    }
  }

  isEPCPatient(patient: any): boolean {
    // For Cliniko, we'll default to EPC since we don't have appointment type filtering yet
    return true;
  }

  isWCPatient(patient: any): boolean {
    // For Cliniko, we'll default to false since we don't have appointment type filtering yet
    return false;
  }

  isCompletedAppointment(appointment: any): boolean {
    // Check if appointment is completed based on Cliniko's status
    return appointment.status === 'completed' || appointment.status === 'Completed';
  }

  // Keep existing helper methods
  private async getPatientDetails(patientId: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/patients/${patientId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching patient details for ${patientId}:`, error);
      return null;
    }
  }

  private async getAppointmentTypeDetails(appointmentTypeUrl: string): Promise<any> {
    try {
      const appointmentTypeId = appointmentTypeUrl.split('/').pop();
      const response = await this.makeRequest(`/appointment_types/${appointmentTypeId}`);
      return response;
    } catch (error) {
      console.error(`Error fetching appointment type details:`, error);
      return null;
    }
  }

  private mapBookingToAppointment(booking: any): PMSAppointment | null {

    if (!booking) {
      return null;
    }

    if (!booking.patient) {
      return null;
    }

    if (!booking.patient.links || !booking.patient.links.self) {
      return null;
    }

    const patientId = booking.patient.links.self.split('/').pop();

    if (!patientId) {
      return null;
    }

    const appointmentTypeId = booking.appointment_type?.links?.self?.split('/').pop() || '';

    // Extract practitioner name and ID from Cliniko API
    let practitionerName = 'Unknown Practitioner';
    let practitionerId = null;
    
    // Extract practitioner ID
    if (booking.practitioner?.id) {
      practitionerId = booking.practitioner.id.toString();
    } else if (booking.practitioner?.links?.self) {
      practitionerId = booking.practitioner.links.self.split('/').pop();
    } else if (booking.practitioner_id) {
      practitionerId = booking.practitioner_id.toString();
    }
    
    // Extract practitioner name
    if (booking.practitioner?.display_name) {
      practitionerName = booking.practitioner.display_name;
    } else if (booking.practitioner?.name) {
      practitionerName = booking.practitioner.name;
    } else if (booking.practitioner_name) {
      practitionerName = booking.practitioner_name;
    } else if (booking.user?.display_name) {
      practitionerName = booking.user.display_name;
    } else if (booking.user?.name) {
      practitionerName = booking.user.name;
    } else if (booking.therapist?.name) {
      practitionerName = booking.therapist.name;
    }



    const appointmentData = {
      id: parseInt(booking.id),
      patientId: patientId,
      date: booking.starts_at,
      type: appointmentTypeId,
      status: 'completed',
      physioName: practitionerName, // Now correctly extracted from practitioner fields
      practitioner_id: practitionerId, // Add practitioner ID for proper linking
      durationMinutes: this.calculateDuration(booking.starts_at, booking.ends_at),
      notes: booking.notes,
      lastModified: booking.updated_at,
      // Add additional fields needed for filtering
      cancelled_at: booking.cancelled_at,
      did_not_arrive: booking.did_not_arrive,
      appointment_date: booking.starts_at,
      appointment_type_id: appointmentTypeId,
    };
    
    // Log the final appointment data for debugging
    console.log(`🔍 [CLINIKO DEBUG] Final appointment data for booking ${booking.id}:`, {
      id: appointmentData.id,
      patientId: appointmentData.patientId,
      practitioner_id: appointmentData.practitioner_id,
      physioName: appointmentData.physioName,
      practitionerName: practitionerName,
      practitionerId: practitionerId
    });
    
    return appointmentData;
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  async getPractitioners(): Promise<PMSPractitioner[]> {
    try {
      console.log('🔍 Fetching practitioners from Cliniko...');

      const allPractitioners: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        console.log(`📄 Fetching practitioners page ${page}...`);

        const response = await this.makeRequest('/practitioners', {
          page: page.toString(),
          per_page: '50',
        });

        if (!response || !response.practitioners) {
          console.warn(`⚠️ No practitioners found on page ${page}`);
          break;
        }

        const practitioners = response.practitioners;
        console.log(`✅ Page ${page}: Found ${practitioners.length} practitioners`);

        // Map practitioners to our standardized format based on actual Cliniko response
        const mappedPractitioners = practitioners.map((practitioner: any) => ({
          id: practitioner.id,
          first_name: practitioner.first_name,
          last_name: practitioner.last_name,
          username: null, // Cliniko doesn't provide username in practitioners API
          display_name:
            practitioner.display_name ||
            practitioner.label ||
            `${practitioner.first_name || ''} ${practitioner.last_name || ''}`.trim(),
          email: null, // Email not provided in practitioners API
          is_active: practitioner.active === true,
          title: practitioner.title,
          designation: practitioner.designation,
          show_in_online_bookings: practitioner.show_in_online_bookings,
        }));

        allPractitioners.push(...mappedPractitioners);

        // Check for more pages
        hasMore = response.links?.next !== undefined;
        if (!hasMore) {
          console.log(`📄 No more practitioner pages available`);
          break;
        }

        page++;

        // Safety check
        if (page > 20) {
          console.warn(`⚠️ Safety limit reached for practitioners (20 pages), stopping`);
          break;
        }
      }

      console.log(
        `✅ Cliniko practitioners fetch completed: ${allPractitioners.length} total practitioners`
      );
      return allPractitioners;
    } catch (error) {
      console.error('❌ Error fetching practitioners from Cliniko:', error);
      throw error;
    }
  }

  async getAppointmentTypes(): Promise<any[]> {
    try {
      console.log('🔍 Fetching appointment types from Cliniko...');

      const allAppointmentTypes: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const params = {
          per_page: '50',
          page: page.toString(),
        };

        const response = await this.makeRequest('/appointment_types', params);
        const appointmentTypes = response.appointment_types || [];

        console.log(`📋 Found ${appointmentTypes.length} appointment types on page ${page}`);
        allAppointmentTypes.push(...appointmentTypes);

        hasMore = response.links?.next !== undefined;
        page++;
      }

      console.log(`✅ Total appointment types fetched: ${allAppointmentTypes.length}`);
      return allAppointmentTypes;
    } catch (error) {
      console.error('❌ Error fetching appointment types:', error);
      throw error;
    }
  }

  // Modified to process all appointment types with WC/EPC categorization like Nookal
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
      const name = appointmentType.name;
      const id = appointmentType.id;

      if (name && id) {
        // Determine if this is WC or EPC based on the appointment name (like Nookal)
        let code = 'Other'; // Default for non-WC/EPC types

        const nameLower = name.toLowerCase();
        if (
          nameLower.includes('wc') ||
          nameLower.includes('workcover') ||
          nameLower.includes('work cover') ||
          nameLower.includes('workers compensation')
        ) {
          code = 'WC';
        } else if (
          nameLower.includes('epc') ||
          nameLower.includes('enhanced primary care') ||
          nameLower.includes('care plan')
        ) {
          code = 'EPC';
        }

        processedTypes.push({
          appointment_id: id.toString(),
          appointment_name: name,
          code: code,
        });

        console.log(`📝 Processed appointment type: ${name} (ID: ${id}) -> ${code}`);
      }
    }

    console.log(
      `✅ Processed ${processedTypes.length} appointment types from ${appointmentTypes.length} total`
    );
    return processedTypes;
  }

  // Remove getAppointmentCounts method - counts are calculated in the route file like Nookal

  // Method to get all appointments for specific patients using /bookings endpoint
  async getAppointmentsForPatients(
    patientIds: string[],
    lastModified?: string
  ): Promise<PMSAppointment[]> {
    try {
      console.log(`🔍 Fetching all appointments for ${patientIds.length} patients from Cliniko...`);
      console.log('   Last modified:', lastModified || 'not specified');

      const allAppointments: PMSAppointment[] = [];

      // Fetch appointments for each patient using Cliniko's API format
      for (const patientId of patientIds) {
        try {
          console.log(`🔍 Fetching appointments for patient ${patientId}...`);

          const params: Record<string, string> = {
            'q[]': `patient_ids:~${patientId}`, // Format: patient_ids:~PATIENT_ID (as per curl example)
            per_page: '100', // Use Cliniko's per_page parameter
          };

          if (lastModified) {
            params.updated_since = lastModified; // Use Cliniko's updated_since parameter
          }

          let currentPage = 1;
          let hasMore = true;

          while (hasMore) {
            params.page = currentPage.toString(); // Use Cliniko's page parameter

            try {
              const response = await this.makeRequest('/bookings', params);
              const bookings = response.bookings || [];

              if (bookings.length === 0) {
                hasMore = false;
                break;
              }

              // Filter valid bookings (same as Nookal flow logic, but using Cliniko data structure)
              const validBookings = bookings.filter((booking: any) => {
                const today = new Date();
                const createdDate = new Date(booking.created_at);

                // Check the 3 conditions (same as Nookal):
                // 1. cancelled_at is null
                // 2. did_not_arrive is false
                // 3. created_date <= today
                const isValid =
                  !booking.cancelled_at && // cancelled_at is null
                  !booking.did_not_arrive && // did_not_arrive is false
                  createdDate <= today; // created_date <= today

                return isValid;
              });

              // Convert valid bookings to appointments
              const patientAppointments = validBookings
                .map((booking: any) => this.mapBookingToAppointment(booking))
                .filter(
                  (appointment: PMSAppointment | null): appointment is PMSAppointment =>
                    appointment !== null
                );

              allAppointments.push(...patientAppointments);

              console.log(
                `📋 Patient ${patientId} page ${currentPage}: ${validBookings.length}/${bookings.length} valid bookings -> ${patientAppointments.length} appointments`
              );

              // Check if there are more pages using Cliniko's links format
              hasMore = response.links?.next !== undefined;
              currentPage++;

              // Safety check
              if (currentPage > 50) {
                console.warn(
                  `⚠️ Safety limit reached for patient ${patientId}, stopping pagination`
                );
                break;
              }
            } catch (error) {
              console.error(
                `❌ Error fetching page ${currentPage} for patient ${patientId}:`,
                error
              );
              hasMore = false;
            }
          }

          console.log(
            `✅ Patient ${patientId}: Total appointments: ${allAppointments.filter((apt) => apt.patientId.toString() === patientId).length}`
          );
        } catch (error) {
          console.error(`❌ Error fetching appointments for patient ${patientId}:`, error);
          // Continue with next patient
        }
      }

      console.log(
        `🎯 Total appointments fetched for ${patientIds.length} patients: ${allAppointments.length}`
      );
      return allAppointments;
    } catch (error) {
      console.error('❌ Error fetching appointments for patients from Cliniko:', error);
      throw error;
    }
  }
}
