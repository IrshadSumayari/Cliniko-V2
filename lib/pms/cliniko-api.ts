import type { PMSApiInterface, PMSPatient, PMSAppointment, PMSApiCredentials } from './types';

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

  async getPatients(lastModified?: string, appointmentTypeIds?: string[]): Promise<PMSPatient[]> {
    try {
      console.log('🔍 Fetching patients from Cliniko with appointment type filtering...');
      console.log('   Last modified:', lastModified || 'not specified');
      console.log('   Appointment type IDs:', appointmentTypeIds || 'not specified');

      if (!appointmentTypeIds || appointmentTypeIds.length === 0) {
        console.log('⚠️ No appointment type IDs provided, cannot filter bookings');
        return [];
      }

      // Create the query parameter for appointment type filtering
      // Format: q[]=appointment_type_id:=ID1,ID2,ID3 (this is the exact format that works in Postman!)
      const appointmentTypeFilter = appointmentTypeIds.join(',');
      console.log(`🔍 Filtering bookings by appointment types: ${appointmentTypeFilter}`);

      const params: Record<string, string> = {
        per_page: '100', // Keep at 100 as per API limit
        'q[]': `appointment_type_id:=${appointmentTypeFilter}`, // Fixed: using the exact working Postman format
      };

      if (lastModified) {
        params.updated_since = lastModified;
      }

      const allBookings: any[] = [];
      const MAX_PARALLEL_PAGES = 5; // Don't overwhelm the API
      const DELAY_BETWEEN_BATCHES = 100; // 100ms delay between parallel batches

      console.log(`🚀 Starting parallel fetch for unlimited records...`);
      console.log(`⚡ Using ${MAX_PARALLEL_PAGES} parallel pages for optimal performance`);

      let currentPage = 1;
      let totalPagesFetched = 0;

      while (true) {
        // Calculate how many pages we need to fetch in this batch
        const pagesToFetch = MAX_PARALLEL_PAGES;

        console.log(
          `🔄 Fetching pages ${currentPage} to ${currentPage + pagesToFetch - 1} in parallel...`
        );
        console.log(`📊 Current total: ${allBookings.length} records`);

        // Create array of page promises to fetch in parallel
        const pagePromises = [];
        for (let i = 0; i < pagesToFetch; i++) {
          const pageNumber = currentPage + i;
          pagePromises.push(
            this.makeRequest('/bookings', {
              ...params,
              page: pageNumber.toString(),
            }).catch((error) => {
              console.error(`❌ Failed to fetch page ${pageNumber}:`, error);
              return { bookings: [] }; // Return empty on failure, don't break the entire process
            })
          );
        }

        // Execute all pages in parallel (this is the key performance improvement!)
        const responses = await Promise.all(pagePromises);
        totalPagesFetched += pagesToFetch;

        // Process all responses
        let batchTotalBookings = 0;
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const pageNumber = currentPage + i;
          const bookings = response.bookings || [];

          console.log(`📋 Page ${pageNumber}: Found ${bookings.length} bookings`);

          // Filter bookings by the 3 conditions you specified
          const validBookings = bookings.filter((booking: any) => {
            const today = new Date();
            const createdDate = new Date(booking.created_at);

            // Check the 3 conditions:
            // 1. cancelled_at is null
            // 2. did_not_arrive is false
            // 3. created_date <= today
            const isValid =
              !booking.cancelled_at && // cancelled_at is null
              !booking.did_not_arrive && // did_not_arrive is false
              createdDate <= today; // created_date <= today

            return isValid;
          });

          console.log(
            `✅ Page ${pageNumber}: ${validBookings.length}/${bookings.length} valid bookings`
          );

          // Add all valid bookings (no limit)
          allBookings.push(...validBookings);
          batchTotalBookings += validBookings.length;
        }

        console.log(`📈 Batch completed: Added ${batchTotalBookings} valid bookings`);
        console.log(`📊 Running total: ${allBookings.length} records`);

        // Check if we should continue (look for more pages)
        const lastResponse = responses[responses.length - 1];
        const hasMore = lastResponse.links?.next !== undefined;

        if (!hasMore) {
          console.log(`📄 No more pages available, stopping parallel fetch`);
          break;
        }

        // Move to next batch of pages
        currentPage += pagesToFetch;

        // Safety check to prevent infinite loops
        if (currentPage > 50) {
          console.log(`⚠️ Reached maximum page limit (50), stopping parallel fetch`);
          break;
        }

        // Small delay between batches to be respectful to the API
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next parallel batch...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }

      console.log(
        `✅ Total synced records: ${allBookings.length} valid bookings from ${totalPagesFetched} pages`
      );
      console.log(
        `🚀 Parallel fetch completed in ${totalPagesFetched} pages with ${MAX_PARALLEL_PAGES} parallel calls per batch`
      );

      // Process valid bookings to extract patients
      const patients = await this.processBookingsForPatients(allBookings);
      console.log(
        `✅ Processed ${allBookings.length} valid bookings, found ${patients.length} EPC/WC patients`
      );

      return patients;
    } catch (error) {
      console.error('❌ Error fetching patients from Cliniko:', error);
      throw error;
    }
  }

  private async processBookingsForPatients(bookings: any[]): Promise<PMSPatient[]> {
    const patientMap = new Map<string, PMSPatient>();

    console.log(`🔍 Processing ${bookings} ${patientMap}bookings for patients...`);

    for (const booking of bookings) {
      if (!booking.patient?.links?.self) {
        console.log(`⚠️ Skipping booking ${booking.id} - no patient links`);
        continue;
      }

      const patientId = booking.patient.links.self.split('/').pop();
      if (!patientId || patientMap.has(patientId)) {
        console.log(`⚠️ Skipping patient ${patientId} - already processed or invalid`);
        continue;
      }

      // Extract appointment type ID from the links.self URL
      const appointmentTypeId = booking.appointment_type?.links?.self?.split('/').pop();
      if (!appointmentTypeId) {
        console.log(`⚠️ Skipping booking ${booking.id} - no appointment type ID`);
        continue;
      }

      console.log(`🔍 Processing patient ${patientId} with appointment type ${appointmentTypeId}`);

      const patientData = await this.getPatientDetails(patientId);
      if (!patientData) {
        console.log(`⚠️ Could not fetch patient details for ${patientId}`);
        continue;
      }

      // Get appointment type details to check if it's EPC/WC
      const appointmentType = await this.getAppointmentTypeDetails(
        booking.appointment_type.links.self
      );
      if (!appointmentType) {
        console.log(`⚠️ Could not fetch appointment type details for ${appointmentTypeId}`);
        continue;
      }

      console.log(`📋 Appointment type: ${appointmentType.name} (ID: ${appointmentTypeId})`);

      const patientType = this.determinePatientTypeFromBooking(booking, appointmentType);
      console.log(`🏷️ Determined patient type: ${patientType}`);

      if (patientType) {
        console.log(
          `✅ Adding ${patientType} patient: ${patientData.first_name} ${patientData.last_name}`
        );

        patientMap.set(patientId, {
          id: patientId,
          firstName: patientData.first_name || '',
          lastName: patientData.last_name || '',
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
        });
      } else {
        console.log(`❌ Patient ${patientId} does not have EPC/WC appointment type`);
      }
    }

    const result = Array.from(patientMap.values());
    console.log(`✅ Processed ${bookings.length} bookings, found ${result.length} EPC/WC patients`);
    return result;
  }

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

  private determinePatientTypeFromBooking(booking: any, appointmentType: any): 'EPC' | 'WC' | null {
    const appointmentTypeName = appointmentType?.name?.toLowerCase() || '';
    const notes = booking.notes?.toLowerCase() || '';

    console.log(`🔍 Checking appointment type: "${appointmentTypeName}" and notes: "${notes}"`);

    if (
      appointmentTypeName.includes('epc') ||
      appointmentTypeName.includes('enhanced primary care') ||
      appointmentTypeName.includes('medicare') ||
      notes.includes('epc') ||
      notes.includes('enhanced primary care')
    ) {
      console.log(`✅ Matched EPC criteria for appointment type: "${appointmentTypeName}"`);
      return 'EPC';
    }

    if (
      appointmentTypeName.includes('workers comp') ||
      appointmentTypeName.includes('workcover') ||
      appointmentTypeName.includes('wc') ||
      appointmentTypeName.includes('work injury') ||
      notes.includes('workers comp') ||
      notes.includes('workcover') ||
      notes.includes('work injury')
    ) {
      console.log(`✅ Matched WC criteria for appointment type: "${appointmentTypeName}"`);
      return 'WC';
    }

    console.log(`❌ No EPC/WC match found for appointment type: "${appointmentTypeName}"`);
    return null;
  }

  async getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]> {
    try {
      const params: Record<string, string> = {
        per_page: '50',
      };

      if (lastModified) {
        params.updated_since = lastModified;
      }

      const allAppointments: PMSAppointment[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        params.page = page.toString();
        const response = await this.makeRequest('/bookings', params);

        const bookings = response.bookings || [];
        const completedBookings = bookings.filter(
          (booking: any) =>
            booking.patient &&
            booking.appointment_type &&
            !booking.unavailable_block_type &&
            !booking.cancelled_at &&
            !booking.did_not_arrive &&
            new Date(booking.ends_at) < new Date()
        );

        const appointments = completedBookings
          .filter((booking: any) => {
            const patientId = booking.patient.links.self.split('/').pop();
            return patientIds.includes(patientId);
          })
          .map((booking: any) => this.mapBookingToAppointment(booking));

        allAppointments.push(...appointments);

        hasMore = response.links?.next !== undefined;
        page++;

        if (page > 100) break;
      }

      return allAppointments;
    } catch (error) {
      console.error('Error fetching Cliniko appointments:', error);
      throw error;
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

    if (Math.random() < 0.1) {
      // Log only ~10% of successful mappings
      console.log(
        `🔍 Mapping booking ${booking.id} for patient ${patientId}, type: ${appointmentTypeId}`
      );
    }

    return {
      id: parseInt(booking.id),
      patientId: parseInt(patientId),
      date: booking.starts_at,
      type: appointmentTypeId,
      status: 'completed',
      physioName: booking.patient_name,
      durationMinutes: this.calculateDuration(booking.starts_at, booking.ends_at),
      notes: booking.notes,
      lastModified: booking.updated_at,
      // Add additional fields needed for filtering
      cancelled_at: booking.cancelled_at,
      did_not_arrive: booking.did_not_arrive,
      appointment_date: booking.starts_at,
      appointment_type_id: parseInt(appointmentTypeId),
    };
  }

  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  }

  async getPatientAppointments(patientId: string): Promise<PMSAppointment[]> {
    try {
      const bookings = await this.getPatientBookings(patientId);
      console.log(`🔍 Found ${bookings.length} bookings for patient ${patientId}`);

      const appointments: PMSAppointment[] = [];

      for (const booking of bookings) {
        const appointment = this.mapBookingToAppointment(booking);
        if (appointment) {
          appointments.push(appointment);
        }
        // Skip null appointments silently - no need to log every single one
      }

      console.log(
        `✅ Successfully mapped ${appointments.length} appointments from ${bookings.length} bookings for patient ${patientId}`
      );
      return appointments;
    } catch (error) {
      console.error(`❌ Error in getPatientAppointments for patient ${patientId}:`, error);
      return [];
    }
  }

  private async getPatientBookings(patientId: string): Promise<any[]> {
    try {
      console.log(`🔍 Fetching bookings for patient ${patientId}...`);

      const response = await this.makeRequest('/bookings', {
        patient_id: patientId,
        per_page: '50',
      });

      const bookings = response.bookings || [];
      console.log(`📋 Found ${bookings.length} bookings for patient ${patientId}`);

      // Log the first booking structure for debugging
      if (bookings.length > 0) {
        console.log(`🔍 First booking structure:`, JSON.stringify(bookings[0], null, 2));
      }

      return bookings;
    } catch (error) {
      console.error(`Error fetching bookings for patient ${patientId}:`, error);
      return [];
    }
  }

  private mapBookingStatus(status: string): 'completed' | 'cancelled' | 'dna' | 'scheduled' {
    const statusLower = status?.toLowerCase() || '';

    if (
      statusLower.includes('completed') ||
      statusLower.includes('arrived') ||
      statusLower.includes('confirmed')
    ) {
      return 'completed';
    }
    if (statusLower.includes('cancelled') || statusLower.includes('deleted')) {
      return 'cancelled';
    }
    if (
      statusLower.includes('dna') ||
      statusLower.includes('did not attend') ||
      statusLower.includes('no show')
    ) {
      return 'dna';
    }

    return 'scheduled';
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

  private extractCodeFromName(name: string): string | null {
    const nameLower = name.toLowerCase();

    if (
      nameLower.includes('epc') ||
      nameLower.includes('enhanced primary care') ||
      nameLower.includes('medicare')
    ) {
      return 'EPC';
    }

    if (
      nameLower.includes('wc') ||
      nameLower.includes('workers comp') ||
      nameLower.includes('workcover') ||
      nameLower.includes('work injury')
    ) {
      return 'WC';
    }

    return null;
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
      const code = this.extractCodeFromName(appointmentType.name);

      if (code) {
        processedTypes.push({
          appointment_id: appointmentType.id,
          appointment_name: appointmentType.name,
          code: code,
        });

        console.log(
          `📝 Processed appointment type: ${appointmentType.name} (ID: ${appointmentType.id}) -> ${code}`
        );
      }
    }

    console.log(
      `✅ Filtered ${processedTypes.length} EPC/WC appointment types from ${appointmentTypes.length} total`
    );
    return processedTypes;
  }

  async getPatientsWithAppointments(
    lastModified?: string,
    appointmentTypeIds?: string[]
  ): Promise<{ patients: PMSPatient[]; appointments: PMSAppointment[] }> {
    try {
      console.log(
        '🔍 Fetching patients and appointments from Cliniko with appointment type filtering...'
      );
      console.log('   Last modified:', lastModified || 'not specified');
      console.log('   Appointment type IDs:', appointmentTypeIds || 'not specified');

      if (!appointmentTypeIds || appointmentTypeIds.length === 0) {
        console.log('⚠️ No appointment type IDs provided, cannot filter bookings');
        return { patients: [], appointments: [] };
      }

      // Create the query parameter for appointment type filtering
      // Format: q[]=appointment_type_id:=ID1,ID2,ID3 (this is the exact format that works in Postman!)
      const appointmentTypeFilter = appointmentTypeIds.join(',');
      console.log(`🔍 Filtering bookings by appointment types: ${appointmentTypeFilter}`);

      const params: Record<string, string> = {
        per_page: '100', // Keep at 100 as per API limit
        'q[]': `appointment_type_id:=${appointmentTypeFilter}`, // Fixed: using the exact working Postman format
      };

      if (lastModified) {
        params.updated_since = lastModified;
      }

      const allBookings: any[] = [];
      const MAX_PARALLEL_PAGES = 5; // Don't overwhelm the API
      const DELAY_BETWEEN_BATCHES = 100; // 100ms delay between parallel batches

      console.log(`🚀 Starting parallel fetch for unlimited records...`);
      console.log(`⚡ Using ${MAX_PARALLEL_PAGES} parallel pages for optimal performance`);

      let currentPage = 1;
      let totalPagesFetched = 0;

      while (true) {
        // Calculate how many pages we need to fetch in this batch
        const pagesToFetch = MAX_PARALLEL_PAGES;

        console.log(
          `🔄 Fetching pages ${currentPage} to ${currentPage + pagesToFetch - 1} in parallel...`
        );
        console.log(`📊 Current total: ${allBookings.length} records`);

        // Create array of page promises to fetch in parallel
        const pagePromises = [];
        for (let i = 0; i < pagesToFetch; i++) {
          const pageNumber = currentPage + i;
          pagePromises.push(
            this.makeRequest('/bookings', {
              ...params,
              page: pageNumber.toString(),
            }).catch((error) => {
              console.error(`❌ Failed to fetch page ${pageNumber}:`, error);
              return { bookings: [] }; // Return empty on failure, don't break the entire process
            })
          );
        }

        // Execute all pages in parallel (this is the key performance improvement!)
        const responses = await Promise.all(pagePromises);
        totalPagesFetched += pagesToFetch;

        // Process all responses
        let batchTotalBookings = 0;
        for (let i = 0; i < responses.length; i++) {
          const response = responses[i];
          const pageNumber = currentPage + i;
          const bookings = response.bookings || [];

          console.log(`📋 Page ${pageNumber}: Found ${bookings.length} bookings`);

          // Filter bookings by the 3 conditions you specified
          const validBookings = bookings.filter((booking: any) => {
            const today = new Date();
            const createdDate = new Date(booking.created_at);

            // Check the 3 conditions:
            // 1. cancelled_at is null
            // 2. did_not_arrive is false
            // 3. created_date <= today
            const isValid =
              !booking.cancelled_at && // cancelled_at is null
              !booking.did_not_arrive && // did_not_arrive is false
              createdDate <= today; // created_date <= today

            return isValid;
          });

          console.log(
            `✅ Page ${pageNumber}: ${validBookings.length}/${bookings.length} valid bookings`
          );

          // Add all valid bookings (no limit)
          allBookings.push(...validBookings);
          batchTotalBookings += validBookings.length;
        }

        console.log(`📈 Batch completed: Added ${batchTotalBookings} valid bookings`);
        console.log(`📊 Running total: ${allBookings.length} records`);

        // Check if we should continue (look for more pages)
        const lastResponse = responses[responses.length - 1];
        const hasMore = lastResponse.links?.next !== undefined;

        if (!hasMore) {
          console.log(`📄 No more pages available, stopping parallel fetch`);
          break;
        }

        // Move to next batch of pages
        currentPage += pagesToFetch;

        // Safety check to prevent infinite loops
        if (currentPage > 50) {
          console.log(`⚠️ Reached maximum page limit (50), stopping parallel fetch`);
          break;
        }

        // Small delay between batches to be respectful to the API
        console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next parallel batch...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }

      console.log(
        `✅ Total synced records: ${allBookings.length} valid bookings from ${totalPagesFetched} pages`
      );
      console.log(
        `🚀 Parallel fetch completed in ${totalPagesFetched} pages with ${MAX_PARALLEL_PAGES} parallel calls per batch`
      );

      // Process valid bookings to extract patients
      const patients = await this.processBookingsForPatients(allBookings);
      console.log(
        `✅ Processed ${allBookings.length} valid bookings, found ${patients.length} EPC/WC patients`
      );

      // Convert valid bookings to appointments
      const appointments = allBookings
        .map((booking: any) => this.mapBookingToAppointment(booking))
        .filter((appointment): appointment is PMSAppointment => appointment !== null);
      const skippedBookings = allBookings.length - appointments.length;
      if (skippedBookings > 0) {
        console.log(
          `⚠️ Skipped ${skippedBookings} bookings due to incomplete data (missing patient info)`
        );
      }
      console.log(
        `✅ Converted ${allBookings.length} valid bookings to ${appointments.length} valid appointments`
      );

      return { patients, appointments };
    } catch (error) {
      console.error('❌ Error fetching patients and appointments from Cliniko:', error);
      throw error;
    }
  }
}
