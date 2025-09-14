import type {
  PMSApiInterface,
  PMSPatient,
  PMSAppointment,
  PMSApiCredentials,
  PMSPractitioner,
} from './types';

export class NookalAPI implements PMSApiInterface {
  private credentials: PMSApiCredentials;
  private baseUrl: string;
  private fetchPatientDetails: boolean; // Configurable option to fetch patient details
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 500; // Start with 100ms between requests (very conservative)
  private maxConcurrentRequests = 1; // Start with only 1 concurrent request
  private activeRequests = 0;
  private consecutiveSuccesses = 0;
  private consecutiveFailures = 0;

  constructor(credentials: PMSApiCredentials, options?: { fetchPatientDetails?: boolean }) {
    this.credentials = credentials;
    this.baseUrl = credentials.apiUrl || 'https://api.nookal.com/production/v2';
    this.fetchPatientDetails = options?.fetchPatientDetails ?? false; // Default to false to avoid rate limiting
  }

  private async makeRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
    // Queue the request to ensure proper rate limiting
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await this.executeRequest(endpoint, params);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      if (request) {
        this.activeRequests++;

        // Process request in background
        request().finally(() => {
          this.activeRequests--;
          this.processQueue(); // Continue processing queue
        });

        // Rate limiting: ensure minimum interval between requests
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
          const waitTime = this.minRequestInterval - timeSinceLastRequest;
          console.log(`[NOOKAL] Rate limiting: waiting ${waitTime}ms before next request...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();
      }
    }

    this.isProcessingQueue = false;
  }

  private async executeRequest(endpoint: string, params?: Record<string, string>): Promise<any> {
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
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      console.log(`[NOOKAL] Response status: ${response.status}`);

      // Update rate limiting based on response headers
      this.updateRateLimiting(response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NOOKAL] HTTP Error: ${response.status} ${response.statusText}`);
        console.error(`[NOOKAL] Error body: ${errorText}`);

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          this.handleRateLimitError();
          const retryAfter = this.parseRetryAfter(response.headers.get('Retry-After'));
          console.warn(`[NOOKAL] Rate limit reached, waiting ${retryAfter}ms before retry...`);
          await new Promise((resolve) => setTimeout(resolve, retryAfter));
          console.log('[NOOKAL] Retrying request after rate limit wait...');
          return this.executeRequest(endpoint, params); // Retry the request
        }

        throw new Error(
          `Nookal API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();

      if (data.status && data.status !== 'success') {
        console.error(`[NOOKAL] API returned error status: ${data.status}`);
        const errorMessage =
          data.details?.errorMessage || data.message || data.error || 'Unknown API error';
        throw new Error(`Nookal API error: ${errorMessage}`);
      }

      // Success - update our rate limiting strategy
      this.handleSuccessfulRequest();
      return data;
    } catch (error) {
      console.error(`[NOOKAL] Request failed:`, error);
      this.handleFailedRequest();
      throw error;
    }
  }

  private handleSuccessfulRequest() {
    this.consecutiveSuccesses++;
    this.consecutiveFailures = 0;

    // Gradually increase speed if we're having consistent success
    if (this.consecutiveSuccesses >= 5) {
      if (this.minRequestInterval > 500) {
        this.minRequestInterval = Math.max(500, this.minRequestInterval - 100);
        console.log(
          `[NOOKAL] ✅ Consistent success, increased speed to ${this.minRequestInterval}ms intervals`
        );
      }
      if (this.maxConcurrentRequests < 3) {
        this.maxConcurrentRequests++;
        console.log(`[NOOKAL] ✅ Increased concurrent requests to ${this.maxConcurrentRequests}`);
      }
      this.consecutiveSuccesses = 0; // Reset counter
    }
  }

  private handleFailedRequest() {
    this.consecutiveFailures++;
    this.consecutiveSuccesses = 0;

    // Slow down if we're having failures
    if (this.consecutiveFailures >= 2) {
      this.minRequestInterval = Math.min(5000, this.minRequestInterval + 500);
      this.maxConcurrentRequests = Math.max(1, this.maxConcurrentRequests - 1);
      console.log(
        `[NOOKAL] ⚠️ Failures detected, slowed down to ${this.minRequestInterval}ms intervals and ${this.maxConcurrentRequests} concurrent requests`
      );
      this.consecutiveFailures = 0; // Reset counter
    }
  }

  private handleRateLimitError() {
    // Aggressively slow down on rate limit errors
    this.minRequestInterval = Math.min(10000, this.minRequestInterval * 2);
    this.maxConcurrentRequests = 1;
    this.consecutiveFailures = 0;
    this.consecutiveSuccesses = 0;
    console.log(
      `[NOOKAL] 🚫 Rate limit hit, aggressively slowed down to ${this.minRequestInterval}ms intervals`
    );
  }

  private updateRateLimiting(headers: Headers) {
    // Check for rate limiting headers and adjust accordingly
    const rateLimitRemaining = headers.get('X-RateLimit-Remaining');
    const rateLimitReset = headers.get('X-RateLimit-Reset');

    if (rateLimitRemaining) {
      const remaining = parseInt(rateLimitRemaining);
      if (remaining < 10) {
        // If we're running low on rate limit, increase the interval
        this.minRequestInterval = Math.max(this.minRequestInterval, 3000);
        console.log(
          `[NOOKAL] Rate limit running low (${remaining} remaining), increased interval to ${this.minRequestInterval}ms`
        );
      }
    }
  }

  private parseRetryAfter(retryAfter: string | null): number {
    if (!retryAfter) return 60000; // Default to 60 seconds

    // Parse Retry-After header (can be seconds or HTTP date)
    const seconds = parseInt(retryAfter);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // If it's a date, calculate the difference
    try {
      const retryDate = new Date(retryAfter);
      const now = new Date();
      const diff = retryDate.getTime() - now.getTime();
      return Math.max(diff, 1000); // Minimum 1 second
    } catch {
      return 60000; // Default to 60 seconds
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('[NOOKAL] Testing connection with getAppointments endpoint...');
      const response = await this.makeRequest('/getAppointments', {
        appt_status: 'Completed',
        limit: '1',
      });
      console.log('[NOOKAL] ✅ Connection test successful!');
      return true;
    } catch (error) {
      console.error('[NOOKAL] ❌ Connection test failed:', error);
      return false;
    }
  }

  async getAllPatients(page: number = 1, pageLength: number = 200): Promise<PMSPatient[]> {
    try {
      console.log(`[NOOKAL] Fetching patients page ${page} with ${pageLength} per page`);

      const response = await this.makeRequest('/getpatients', {
        page: page.toString(),
        page_length: pageLength.toString(),
      });

      console.log(
        `[NOOKAL] Response structure for page ${page}:`,
        JSON.stringify(response, null, 2)
      );

      // Try different possible response structures for patients
      let patients = [];

      if (response.patients && Array.isArray(response.patients)) {
        patients = response.patients;
      } else if (response.data?.patients && Array.isArray(response.data.patients)) {
        patients = response.data.patients;
      } else if (
        response.data?.results?.patients &&
        Array.isArray(response.data.results.patients)
      ) {
        patients = response.data.results.patients;
      } else if (response.results?.patients && Array.isArray(response.results.patients)) {
        patients = response.results.patients;
      }

      if (!patients || patients.length === 0) {
        console.log(`[NOOKAL] No patients found on page ${page}`);
        return [];
      }

      console.log(`[NOOKAL] Found ${patients.length} patients on page ${page}`);

      // Map the patients to our standard format
      const mappedPatients = patients.map((patient: any) => ({
        id: patient.ID || patient.id,
        firstName: patient.FirstName || patient.firstName || patient.first_name || '',
        lastName: patient.LastName || patient.lastName || patient.last_name || '',
        email: patient.Email || patient.email || '',
        phone: patient.Phone || patient.phone || '',
        dateOfBirth: patient.DateOfBirth || patient.dateOfBirth || patient.date_of_birth || '',
        gender: patient.Gender || patient.gender || '',
        address: {
          line1: patient.Address || patient.address || '',
          suburb: patient.Suburb || patient.suburb || '',
          state: patient.State || patient.state || '',
          postcode: patient.Postcode || patient.postcode || '',
          country: patient.Country || patient.country || '',
        },
        patientType: 'EPC' as const, // Default to EPC as per requirements
        physioName: patient.Practitioner || patient.practitioner || '',
        lastModified: patient.LastModified || patient.lastModified || patient.last_modified || '',
      }));

      console.log(
        `[NOOKAL] Mapped patients sample:`,
        JSON.stringify(mappedPatients.slice(0, 2), null, 2)
      );
      return mappedPatients;
    } catch (error) {
      console.error(`[NOOKAL] Error fetching patients page ${page}:`, error);
      throw error;
    }
  }

  // New method for cron job to fetch patients in batches using page numbers
  async getPatientsBatchAfterId(
    lastSyncedId: number,
    pageLength: number = 200
  ): Promise<{
    patients: PMSPatient[];
    hasMore: boolean;
    totalItems: number;
    lastPatientId: number;
    nextPage: number;
  }> {
    try {
      console.log(
        `[NOOKAL] Fetching patients batch after ID ${lastSyncedId} with ${pageLength} items per page...`
      );

      // Calculate the next page number based on last synced ID
      // For simplicity, we'll use a page-based approach
      const currentPage = Math.floor(lastSyncedId / pageLength) + 1;
      const nextPage = currentPage + 1;

      console.log(`[NOOKAL] Fetching page ${nextPage} with ${pageLength} items...`);

      // Fetch patients using /getpatients endpoint with pagination
      const response = await this.makeRequest('/getpatients', {
        page: nextPage.toString(),
        page_length: pageLength.toString(),
      });

      const patients = response.data?.results?.patients || response.data?.patients || [];
      const details = response.data?.details || {};
      const totalItems = parseInt(details.totalItems) || 0;

      console.log(`[NOOKAL] Found ${patients.length} patients from page ${nextPage}`);

      // Process patients from the response
      const allPatients: PMSPatient[] = [];
      for (const patientData of patients) {
        if (patientData.ID || patientData.id) {
          const patientId = parseInt(patientData.ID || patientData.id);

          // Create patient object from patient data
          const patient: PMSPatient = {
            id: patientId,
            firstName:
              patientData.FirstName || patientData.firstName || patientData.first_name || '',
            lastName: patientData.LastName || patientData.lastName || patientData.last_name || '',
            email: patientData.Email || patientData.email || '',
            phone: patientData.Phone || patientData.phone || '',
            dateOfBirth:
              patientData.DOB || patientData.dateOfBirth || patientData.date_of_birth || '',
            gender: patientData.Gender || patientData.gender || '',
            address: {
              line1: patientData.Address || patientData.address || '',
              suburb: patientData.Suburb || patientData.suburb || '',
              state: patientData.State || patientData.state || '',
              postcode: patientData.Postcode || patientData.postcode || '',
              country: patientData.Country || patientData.country || '',
            },
            patientType: 'EPC', // Default to EPC as per requirements
            physioName: patientData.Practitioner || patientData.practitioner || '',
            lastModified:
              patientData.LastModified ||
              patientData.lastModified ||
              patientData.last_modified ||
              '',
          };

          allPatients.push(patient);
        }
      }

      // Determine if there are more patients to sync
      const lastPatientId =
        allPatients.length > 0 ? allPatients[allPatients.length - 1].id : lastSyncedId;
      const hasMore = allPatients.length >= pageLength; // If we got a full batch, there might be more

      console.log(
        `[NOOKAL] ✅ Batch completed: ${allPatients.length} patients from page ${nextPage}`
      );
      console.log(
        `[NOOKAL] Last patient ID in this batch: ${lastPatientId}, hasMore: ${hasMore}, nextPage: ${nextPage + 1}`
      );

      return {
        patients: allPatients,
        hasMore,
        totalItems,
        lastPatientId,
        nextPage: nextPage + 1,
      };
    } catch (error) {
      console.error(`Error fetching Nookal patients batch after ID ${lastSyncedId}:`, error);
      throw error;
    }
  }

  // Method to get total patient count for progress tracking
  async getTotalPatientCount(): Promise<number> {
    try {
      console.log('[NOOKAL] Getting total patient count...');

      const response = await this.makeRequest('/getpatients', {
        page: '1',
        page_length: '1', // Just get 1 item to get the total count
      });

      const details = response.data?.details || {};
      const totalItems = parseInt(details.totalItems) || 0;

      console.log(`[NOOKAL] Total patients available: ${totalItems}`);
      return totalItems;
    } catch (error) {
      console.error('Error getting total patient count:', error);
      return 0;
    }
  }

  // Method to get the highest patient ID for initial sync
  async getHighestPatientId(): Promise<number> {
    try {
      console.log('[NOOKAL] Getting highest patient ID from patients...');

      const response = await this.makeRequest('/getpatients', {
        page: '1',
        page_length: '1', // Just get 1 item to get the total count
      });

      const patients = response.data?.results?.patients || response.data?.patients || [];
      if (patients.length > 0 && (patients[0].ID || patients[0].id)) {
        const highestId = parseInt(patients[0].ID || patients[0].id);
        console.log(`[NOOKAL] Highest patient ID found: ${highestId}`);
        return highestId;
      }

      return 0;
    } catch (error) {
      console.error('Error getting highest patient ID:', error);
      return 0;
    }
  }

  // Method to check if manual sync has already been performed
  async checkManualSyncStatus(): Promise<{
    hasManualSync: boolean;
    totalFromAPI: number;
  }> {
    try {
      console.log('[NOOKAL] Checking if manual sync has already been performed...');

      const response = await this.makeRequest('/getpatients', {
        page: '1',
        page_length: '1',
      });

      const details = response.data?.details || {};
      const totalFromAPI = parseInt(details.totalItems) || 0;

      console.log(`[NOOKAL] Total patients from API: ${totalFromAPI}`);

      return {
        hasManualSync: false, // This will be determined by the calling code
        totalFromAPI,
      };
    } catch (error) {
      console.error('Error checking manual sync status:', error);
      return { hasManualSync: false, totalFromAPI: 0 };
    }
  }

  private resetRateLimiting() {
    console.log('[NOOKAL] 🔄 Resetting rate limiting for new sync operation');
    this.minRequestInterval = 2000; // Start conservative
    this.maxConcurrentRequests = 1; // Start with single request
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures = 0;
    this.activeRequests = 0;
    this.isProcessingQueue = false;
    this.requestQueue = []; // Clear any pending requests
    this.logRateLimitingStatus();
  }

  private logRateLimitingStatus() {
    console.log(
      `[NOOKAL] 📊 Rate limiting status: ${this.minRequestInterval}ms intervals, ${this.maxConcurrentRequests} concurrent requests, queue: ${this.requestQueue.length}`
    );
  }

  // Public method to get current rate limiting status (useful for debugging)
  getRateLimitingStatus() {
    return {
      minRequestInterval: this.minRequestInterval,
      maxConcurrentRequests: this.maxConcurrentRequests,
      activeRequests: this.activeRequests,
      queueLength: this.requestQueue.length,
      consecutiveSuccesses: this.consecutiveSuccesses,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  async getModifiedPatients(lastModified: Date): Promise<PMSPatient[]> {
    try {
      // For modified patients, we'll use getAppointments with appt_status=Completed
      // and filter by lastModified date
      console.log(
        `[NOOKAL] Fetching patients with completed appointments modified since: ${lastModified.toISOString().split('T')[0]}`
      );

      const allPatients = await this.getAllPatients();

      // Filter patients by lastModified date
      const modifiedPatients = allPatients.filter((patient) => {
        if (!patient.lastModified) return false;
        const patientLastModified = new Date(patient.lastModified);
        return patientLastModified >= lastModified;
      });

      console.log(
        `[NOOKAL] Found ${modifiedPatients.length} modified patients out of ${allPatients.length} total`
      );
      return modifiedPatients;
    } catch (error) {
      console.error('Error fetching modified Nookal patients:', error);
      throw error;
    }
  }

  async getPatients(lastModified?: string, appointmentTypeIds?: string[]): Promise<PMSPatient[]> {
    try {
      console.log('[NOOKAL] Fetching patients...');

      if (lastModified) {
        const lastModifiedDate = new Date(lastModified);
        return await this.getModifiedPatients(lastModifiedDate);
      }

      if (appointmentTypeIds && appointmentTypeIds.length > 0) {
        console.log(
          "⚠️ Nookal API doesn't support appointment type filtering, fetching all patients"
        );
      }

      return await this.getAllPatients();
    } catch (error) {
      console.error('Error fetching Nookal patients:', error);
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
      console.log(`[NOOKAL] Found ${patients.length} patients`);

      // Use efficient batch processing for appointments - single batch for all patients
      console.log(
        `[NOOKAL] Fetching appointments for ${patients.length} patients in single batch...`
      );
      const allAppointments = await this.getAppointmentsBatch(patients, lastModified);

      console.log(
        `[NOOKAL] 🎯 Batch sync complete: ${patients.length} patients + ${allAppointments.length} appointments`
      );
      return { patients, appointments: allAppointments };
    } catch (error) {
      console.error('Error fetching Nookal patients with appointments:', error);
      throw error;
    }
  }

  private async getAppointmentsBatch(
    patients: PMSPatient[],
    lastModified?: string
  ): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = [];
      const BATCH_SIZE = 100; // Increased batch size since we have proper rate limiting
      const totalBatches = Math.ceil(patients.length / BATCH_SIZE);

      console.log(`[NOOKAL] Processing appointments in ${totalBatches} batches of ${BATCH_SIZE}`);

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

            // Since we're already getting completed appointments from the API,
            // we just need to filter by date if needed
            const validAppointments = patientAppointments.filter((apt) => {
              const today = new Date();
              const appointmentDate = new Date(apt.appointment_date || apt.date);

              return (
                apt.cancelled_at === null && // cancelled_at = null
                apt.did_not_arrive === false && // did_not_arrive = false
                appointmentDate <= today // appointment_date <= today
              );
            });

            return validAppointments;
          } catch (error) {
            console.error(`[NOOKAL] Error fetching appointments for patient ${patient.id}:`, error);
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

        // No more arbitrary delays - rate limiting is handled by the request queue
      }

      console.log(
        `[NOOKAL] 🎯 Batch processing completed: ${allAppointments.length} total appointments from ${patients.length} patients`
      );

      return allAppointments;
    } catch (error) {
      console.error('[NOOKAL] Error in batch appointment processing:', error);
      throw error;
    }
  }

  // Remove the filterEPCWCPatients method as it's no longer needed

  isEPCPatient(patient: any): boolean {
    // Since we're not filtering by EPC/WC anymore, return true for all patients
    return true;
  }

  isWCPatient(patient: any): boolean {
    // Since we're not filtering by EPC/WC anymore, return true for all patients
    return true;
  }

  isCompletedAppointment(appointment: any): boolean {
    const status = (appointment.status || appointment.Status || '').toLowerCase();
    const cancelled = appointment.cancelled === '1' || appointment.cancelled === true;
    const dna = appointment.DNA === '1' || appointment.did_not_arrive === true;

    // Check if appointment is up to current date
    const appointmentDate = new Date(
      appointment.appointmentDate || appointment.Date || appointment.date
    );
    const currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); // Include today's appointments

    const isCompleted = status === 'completed';
    const isNotCancelled = !cancelled;
    const isNotDNA = !dna;
    const isUpToCurrentDate = appointmentDate <= currentDate;

    return isCompleted && isNotCancelled && isNotDNA && isUpToCurrentDate;
  }

  // Remove the determinePatientType method as it's no longer needed

  async getAppointments(patientIds: string[], lastModified?: string): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = [];
      const pageLength = 200; // Use pagination for appointments
      let currentPage = 1;

      for (const patientId of patientIds) {
        try {
          // Get appointments for this patient with pagination
          let hasMoreAppointments = true;
          let page = 1;

          while (hasMoreAppointments) {
            const params: Record<string, string> = {
              patient_id: patientId,
              appt_status: 'Completed',
              page: page.toString(),
              page_length: pageLength.toString(),
            };

            if (lastModified) {
              params.modified_since = lastModified;
            }

            const response = await this.makeRequest('/getAppointments', params);
            const appointments = response.data?.results?.appointments || [];

            if (appointments.length === 0 || appointments.length < pageLength) {
              hasMoreAppointments = false;
            }

            // Process appointments from this page
            for (const apt of appointments) {
              const filteredAppointment =
                this.isCompletedAppointment(apt) &&
                (!lastModified || apt.lastModified > lastModified);

              if (filteredAppointment) {
                allAppointments.push(apt);
              }
            }

            page++;

            // Safety check to prevent infinite loops
            if (page > 10) {
              console.warn(
                `[NOOKAL] Safety limit reached for patient ${patientId}, stopping pagination`
              );
              break;
            }
          }
        } catch (error) {
          console.error(`[NOOKAL] Error fetching appointments for patient ${patientId}:`, error);
          // Continue with next patient
        }
      }

      console.log(
        `[NOOKAL] Total completed appointments across all patients: ${allAppointments.length}`
      );
      return allAppointments;
    } catch (error) {
      console.error('Error fetching Nookal appointments:', error);
      throw error;
    }
  }

  async getPatientAppointments(patientId: string, lastModified?: Date): Promise<PMSAppointment[]> {
    try {
      const allAppointments: PMSAppointment[] = [];
      const pageLength = 200;
      let page = 1;
      let hasMoreAppointments = true;

      while (hasMoreAppointments) {
        const params: Record<string, string> = {
          patient_id: patientId,
          appt_status: 'Completed', // Always get completed appointments
          page: page.toString(),
          page_length: pageLength.toString(),
        };

        if (lastModified) {
          params.modified_since = lastModified.toISOString().split('T')[0];
        }

        console.log(
          `[NOOKAL] Fetching completed appointments for patient ${patientId}, page ${page}...`
        );

        const response = await this.makeRequest('/getAppointments', params);

        const appointments =
          response.data?.results?.appointments ||
          response.data?.appointments ||
          response.appointments ||
          [];

        console.log(
          `[NOOKAL] Found ${appointments.length} completed appointments for patient ${patientId} on page ${page}`
        );

        // If we got fewer appointments than requested, we've reached the end
        if (appointments.length === 0 || appointments.length < pageLength) {
          hasMoreAppointments = false;
        }

        // Process appointments from this page
        const processedAppointments = appointments.map((apt: any) => ({
          id: apt.ID || apt.id,
          patientId: apt.patientID || apt.patient_id || patientId,
          date:
            apt.appointmentDate && apt.appointmentStartTime
              ? `${apt.appointmentDate} ${apt.appointmentStartTime}`
              : apt.Date
                ? `${apt.Date} ${apt.StartTime || apt.start_time || ''}`.trim()
                : apt.date,
          type: apt.appointmentType || apt.AppointmentType || apt.appointment_type,
          appointment_type_id:
            apt.appointmentTypeID || apt.AppointmentTypeID || apt.appointment_type_id,
          status: this.mapAppointmentStatus(apt.status || apt.Status, apt),
          physioName: apt.Practitioner || apt.practitioner,
          practitioner_id: apt.practitionerID || apt.PractitionerID || apt.practitioner_id,
          durationMinutes:
            this.calculateDuration(apt.appointmentStartTime, apt.appointmentEndTime) ||
            Number.parseInt(apt.Duration || apt.duration) ||
            0,
          notes: apt.Notes || apt.notes,
          lastModified: apt.lastModified || apt.LastModified || apt.last_modified,
          cancelled_at: apt.cancelled === '1' ? apt.cancellationDate || apt.cancelled_at : null,
          did_not_arrive: apt.DNA === '1' || apt.DidNotArrive || apt.did_not_arrive || false,
          appointment_date:
            apt.appointmentDate && apt.appointmentStartTime
              ? `${apt.appointmentDate} ${apt.appointmentStartTime}`
              : apt.Date
                ? `${apt.Date} ${apt.StartTime || apt.start_time || ''}`.trim()
                : apt.date,
          appointment_type_id:
            apt.appointmentTypeID || apt.AppointmentTypeID || apt.appointment_type_id,
          appointment_type: apt.appointmentType
            ? { name: apt.appointmentType }
            : apt.AppointmentType
              ? { name: apt.AppointmentType }
              : null,
          practitioner: apt.Practitioner ? { name: apt.Practitioner } : null,
          duration:
            this.calculateDuration(apt.appointmentStartTime, apt.appointmentEndTime) ||
            Number.parseInt(apt.Duration || apt.duration) ||
            0,
        }));

        allAppointments.push(...processedAppointments);
        page++;

        // Safety check to prevent infinite loops
        if (page > 10) {
          console.warn(
            `[NOOKAL] Safety limit reached for patient ${patientId}, stopping pagination`
          );
          break;
        }
      }

      console.log(
        `[NOOKAL] Total appointments for patient ${patientId}: ${allAppointments.length}`
      );
      return allAppointments;
    } catch (error) {
      console.error(`[NOOKAL] Error fetching appointments for patient ${patientId}:`, error);

      // Return empty array instead of throwing to prevent sync failures
      // This allows the sync to continue with other patients
      return [];
    }
  }

  private mapAppointmentStatus(
    status: string,
    appointment: any
  ): 'completed' | 'cancelled' | 'dna' | 'scheduled' {
    if (appointment.cancelled === '1') {
      return 'cancelled';
    }
    if (appointment.DNA === '1') {
      return 'dna';
    }
    if (appointment.arrived === '1' && appointment.cancelled !== '1') {
      return 'completed';
    }

    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('completed') || statusLower.includes('attended')) {
      return 'completed';
    }
    if (statusLower.includes('cancelled')) {
      return 'cancelled';
    }
    if (statusLower.includes('dna') || statusLower.includes('did not attend')) {
      return 'dna';
    }

    return 'scheduled';
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

  async getPractitioners(): Promise<PMSPractitioner[]> {
    try {
      console.log('[NOOKAL] Fetching practitioners...');
      const response = await this.makeRequest('/getPractitioners');

      if (!response || response.status !== 'success') {
        throw new Error(`Failed to fetch practitioners: ${response?.details || 'Unknown error'}`);
      }

      // Check for correct Nookal response structure
      if (
        !response.data?.results?.practitioners ||
        !Array.isArray(response.data.results.practitioners)
      ) {
        console.warn('[NOOKAL] No practitioners data found in response');
        return [];
      }

      const practitioners = response.data.results.practitioners;
      console.log(`✅ [NOOKAL] Found ${practitioners.length} practitioners`);

      // Map practitioners to our standardized format based on actual Nookal response
      const mappedPractitioners = practitioners.map((practitioner: any) => ({
        id: practitioner.ID,
        first_name: practitioner.FirstName,
        last_name: practitioner.LastName,
        username: null, // Nookal doesn't provide username in this API
        display_name:
          `${practitioner.Title || ''} ${practitioner.FirstName || ''} ${practitioner.LastName || ''}`.trim(),
        email: practitioner.Email,
        is_active: practitioner.status === '1' && practitioner.ShowInDiary === '1', // Active if status=1 and shown in diary
        title: practitioner.Title,
        speciality: practitioner.Speciality,
        locations: practitioner.locations,
      }));

      console.log(
        `✅ [NOOKAL] Practitioners mapping completed: ${mappedPractitioners.length} practitioners`
      );
      return mappedPractitioners;
    } catch (error) {
      console.error('[NOOKAL] ❌ Error fetching practitioners:', error);
      throw error;
    }
  }

  async getAppointmentTypes(): Promise<any[]> {
    try {
      console.log('🔍 Fetching ALL appointment types from Nookal v2 with pagination...');

      const allAppointmentTypes: any[] = [];
      const pageLength = 200;
      let page = 1;
      let hasMoreTypes = true;

      while (hasMoreTypes) {
        console.log(`📄 Fetching appointment types page ${page} with ${pageLength} items...`);

        const response = await this.makeRequest('/getAppointmentTypes', {
          page: page.toString(),
          page_length: pageLength.toString(),
        });

        const appointmentTypes =
          response.data?.results?.services || response.data?.services || response.services || [];

        if (appointmentTypes.length === 0 || appointmentTypes.length < pageLength) {
          hasMoreTypes = false;
        }

        allAppointmentTypes.push(...appointmentTypes);
        page++;

        if (page > 50) {
          console.warn('⚠️ Safety limit reached for appointment types, stopping pagination');
          break;
        }
      }

      console.log(`✅ Found ${allAppointmentTypes.length} total appointment types from Nookal v2`);

      if (allAppointmentTypes.length > 0) {
        console.log(
          `📋 Sample appointment type names:`,
          allAppointmentTypes.slice(0, 5).map((apt: any) => apt.Name || apt.name)
        );
      }

      return allAppointmentTypes;
    } catch (error) {
      console.error('❌ Error fetching Nookal appointment types:', error);
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

      if (name && id) {
        // Determine if this is WC or EPC based on the appointment name
        let code = 'Other'; // Default for non-WC/EPC types

        const nameLower = name.toLowerCase();
        if (
          nameLower.includes('wc') ||
          nameLower.includes('workcover') ||
          nameLower.includes('work cover')
        ) {
          code = 'WC';
        } else if (nameLower.includes('epc') || nameLower.includes('enhanced primary care')) {
          code = 'EPC';
        }

        processedTypes.push({
          appointment_id: id.toString(),
          appointment_name: name,
          code: code,
        });

        console.log(`📝 Processed appointment type: ${name} -> ${code}`);
      }
    }

    console.log(
      `✅ Processed ${processedTypes.length} appointment types from ${appointmentTypes.length} total`
    );
    return processedTypes;
  }
}
