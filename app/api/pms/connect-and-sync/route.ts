import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PMSFactory } from "@/lib/pms/factory";
import {
  storeEncryptedApiKey,
  createAdminClient,
  storeAppointmentTypes,
  storeAppointment,
} from "@/lib/supabase/server-admin";
import { config } from "@/lib/config";

export async function POST(request: NextRequest) {
  try {
    const { pmsType, apiKey } = await request.json();

    if (!pmsType || !apiKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get the authorization header
    const authHeader = request.headers.get("authorization");
    console.log("=== Auth Header Debug ===");
    console.log("Authorization header:", authHeader ? "present" : "missing");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Missing or invalid authorization header");
      return NextResponse.json(
        { error: "Authentication required. Please provide a valid token." },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    console.log(
      "Token extracted:",
      token ? `${token.substring(0, 20)}...` : "missing"
    );

    // Create Supabase client with cookies (required by createServerClient)
    const cookieStore = cookies();
    const supabase = createServerClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        cookies: {
          get(name: string) {
            const value = cookieStore.get(name)?.value;
            return value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    // Set the auth token in the client
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    console.log("User data:", user ? `${user.email} (${user.id})` : "missing");
    console.log("Auth error:", authError?.message || "none");

    if (authError || !user) {
      console.error("Authentication failed - no valid session found");
      console.log(
        "This usually means the client-side session hasn't been established on the server"
      );
      return NextResponse.json(
        {
          error:
            "Authentication required. Please refresh the page and try again.",
        },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log("=== PMS Connect & Sync ===");
    console.log("PMS Type:", pmsType);
    console.log("Authenticated User ID:", userId);
    console.log("User Email:", user.email);
    console.log(
      "API Key format:",
      apiKey ? `${apiKey.substring(0, 10)}...` : "missing"
    );

    const adminSupabase = createAdminClient();
    console.log("Ensuring user record exists...");

    const { data: existingUser, error: userCheckError } = await adminSupabase
      .from("users")
      .select("id, auth_user_id")
      .eq("auth_user_id", userId)
      .single();

    let userRecordData: any;

    if (userCheckError || !existingUser) {
      console.log("User record not found, creating...");
      const { data: newUser, error: createUserError } = await adminSupabase
        .from("users")
        .insert({
          auth_user_id: userId,
          email: user.email,
          is_onboarded: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createUserError) {
        console.error("Error creating user record:", createUserError);
        return NextResponse.json(
          { error: "Failed to create user record" },
          { status: 500 }
        );
      }
      console.log("User record created successfully:", newUser);
      userRecordData = newUser;
    } else {
      console.log("User record exists:", existingUser);
      userRecordData = existingUser;
    }

    if (!PMSFactory.validateCredentials(pmsType, { apiKey })) {
      console.log("❌ API key validation failed for:", pmsType);
      return NextResponse.json(
        {
          error: `Invalid API key format for ${pmsType}. Please check your API key.`,
        },
        { status: 400 }
      );
    }

    console.log("✅ API key validation passed!");

    // Create PMS client
    console.log("Creating PMS client...");
    let pmsClient;
    try {
      pmsClient = PMSFactory.createClient(pmsType, apiKey);
    } catch (factoryError) {
      console.error("Error creating PMS client:", factoryError);
      return NextResponse.json(
        {
          error: `Failed to create ${pmsType} client: ${
            factoryError instanceof Error
              ? factoryError.message
              : "Unknown error"
          }`,
        },
        { status: 400 }
      );
    }

    console.log("Testing PMS connection...");
    try {
      const isConnected = await pmsClient.testConnection();
      if (!isConnected) {
        return NextResponse.json(
          {
            error: `Failed to connect to ${pmsType}. Please verify your API key is correct.`,
          },
          { status: 400 }
        );
      }
      console.log("Connection test successful!");
    } catch (connectionError) {
      console.error("Connection test error:", connectionError);
      const errorMessage =
        connectionError instanceof Error
          ? connectionError.message
          : "Unknown connection error";
      return NextResponse.json(
        {
          error: `Connection to ${pmsType} failed: ${errorMessage}`,
        },
        { status: 400 }
      );
    }

    console.log("Storing encrypted credentials...");
    try {
      const region =
        pmsType === "cliniko" ? apiKey.split("-").pop() : undefined;
      const apiUrl =
        pmsType === "cliniko"
          ? `https://api.${region}.cliniko.com/v1`
          : undefined;

      await storeEncryptedApiKey(userRecordData.id, pmsType, apiKey, apiUrl);
      console.log("✅ Credentials stored successfully in database!");
    } catch (credentialsError) {
      console.error("❌ Error storing credentials:", credentialsError);
      return NextResponse.json(
        { error: "Failed to store credentials in database" },
        { status: 500 }
      );
    }

    console.log("Fetching and storing appointment types...");
    try {
      const appointmentTypes = await pmsClient.getAppointmentTypes();
      const processedTypes =
        pmsClient.processAppointmentTypes(appointmentTypes);

      if (processedTypes.length > 0) {
        await storeAppointmentTypes(userRecordData.id, pmsType, processedTypes);
        console.log(
          `✅ Stored ${processedTypes.length} appointment types successfully!`
        );
      } else {
        console.log("⚠️ No EPC/WC appointment types found");
      }
    } catch (appointmentTypesError) {
      console.error("❌ Error with appointment types:", appointmentTypesError);
      // Don't fail the entire process, just log the error
    }

    console.log("Connection successful, starting initial sync...");

    const syncResults = await performInitialSync(
      adminSupabase,
      userRecordData.id,
      pmsClient,
      pmsType
    );

    const appointmentTypesCount = await getAppointmentTypesCount(
      adminSupabase,
      userRecordData.id,
      pmsType
    );

    // Log sync completion
    await adminSupabase.from("sync_logs").insert({
      user_id: userRecordData.id,
      pms_type: pmsType,
      sync_type: "initial",
      status: "completed",
      patients_processed: syncResults.wcPatients + syncResults.epcPatients,
      patients_added: syncResults.wcPatients + syncResults.epcPatients,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      last_modified_sync: new Date().toISOString(),
    });

    return NextResponse.json({
      ...syncResults,
      appointmentTypesCount,
    });
  } catch (error) {
    console.error("PMS connect & sync error:", error);
    return NextResponse.json(
      {
        error: `Internal server error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      },
      { status: 500 }
    );
  }
}

async function getAppointmentTypesCount(
  supabase: any,
  userId: string,
  pmsType: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("appointment_types")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("pms_type", pmsType);

    if (error) {
      console.error("Error getting appointment types count:", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error("Error in getAppointmentTypesCount:", error);
    return 0;
  }
}

async function performInitialSync(
  supabase: any,
  userId: string,
  pmsClient: any,
  pmsType: string
) {
  const issues: string[] = [];
  let wcPatients = 0;
  let epcPatients = 0;
  let totalAppointments = 0;

  try {
    console.log("[SERVER] Starting initial sync for user:", userId);
    console.log("[SERVER] PMS Type:", pmsType);

    // First, get the stored appointment type IDs for this user and PMS
    const { data: userAppointmentTypes, error: typesError } = await supabase
      .from("appointment_types")
      .select("appointment_id")
      .eq("user_id", userId)
      .eq("pms_type", pmsType);

    if (typesError) {
      console.error("[SERVER] Error fetching appointment types:", typesError);
      issues.push("Could not fetch stored appointment types");
    }

    const appointmentTypeIds =
      userAppointmentTypes?.map((t: any) => t.appointment_id) || [];
    console.log(
      `[SERVER] Found ${appointmentTypeIds.length} stored appointment types:`,
      appointmentTypeIds
    );

    let patients: any[] = [];
    let allAppointments: any[] = [];

    if (pmsType === "cliniko") {
      // For Cliniko, use the new efficient method
      const result = await pmsClient.getPatientsWithAppointments(
        undefined,
        appointmentTypeIds
      );
      patients = result.patients;
      allAppointments = result.appointments;
      console.log(
        `[SERVER] ✅ API call completed: ${patients.length} patients and ${allAppointments.length} appointments from Cliniko`
      );
    } else {
      // For other PMS systems, fall back to old approach
      patients = await pmsClient.getPatients(undefined, appointmentTypeIds);
      console.log(
        `[SERVER] Fetched ${patients.length} patients from ${pmsType}`
      );
    }

    for (const patient of patients) {
      const patientType = patient.patientType;

      if (patientType === "EPC" || patientType === "WC") {
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .upsert(
            {
              user_id: userId,
              pms_patient_id: patient.id,
              pms_type: pmsType,
              first_name: patient.firstName,
              last_name: patient.lastName,
              email: patient.email,
              phone: patient.phone,
              date_of_birth: patient.dateOfBirth,
              patient_type: patientType,
              physio_name: patient.physioName,
              pms_last_modified: patient.lastModified,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "user_id,pms_patient_id,pms_type",
            }
          )
          .select(); // Add this to return the inserted/updated data

        if (patientError) {
          console.error("[SERVER] Error storing patient:", patientError);
          issues.push(
            `Failed to store patient: ${patient.firstName} ${patient.lastName}`
          );
          continue; // Skip to next patient if there's an error
        }

        if (!patientData || patientData.length === 0) {
          console.error("[SERVER] No patient data returned from upsert");
          issues.push(
            `No data returned for patient: ${patient.firstName} ${patient.lastName}`
          );
          continue; // Skip to next patient if no data returned
        }

        if (patientType === "EPC") epcPatients++;
        if (patientType === "WC") wcPatients++;
      } else {
        console.log(
          `[SERVER] Skipping patient with type: ${patientType} (not EPC or WC)`
        );
      }
    }

    // Now process ALL appointments that meet the 3 conditions (outside patient loop)
    let appointmentsToProcess: any[] = [];

    if (pmsType === "cliniko") {
      // Use all appointments from the Cliniko API call
      appointmentsToProcess = allAppointments;
    } else {
      // For other PMS systems, fetch appointments for each patient
      for (const patient of patients) {
        if (patient.patientType === "EPC" || patient.patientType === "WC") {
          const patientAppointments = await pmsClient.getPatientAppointments(
            patient.id
          );
          appointmentsToProcess.push(...patientAppointments);
        }
      }
    }

    // Apply the 3 conditions to ALL appointments
    const validCompletedAppointments = appointmentsToProcess.filter(
      (apt: any) => {
        const today = new Date();
        const appointmentDate = new Date(apt.appointment_date || apt.date);

        return (
          // apt.status === "completed" &&
          apt.cancelled_at === null && // cancelled_at = null
          apt.did_not_arrive === false && // did_not_arrive = false
          appointmentDate <= today // appointment_date <= today
        );
      }
    );

    // Store all valid appointments
    for (const appointment of validCompletedAppointments) {
      // Try to find the patient in our database by PMS patient ID
      let patientIdForAppointment = null;

      const appointmentPatientId =
        appointment.patientId || appointment.patient_id;
      if (appointmentPatientId) {
        // Look up the patient in our database
        const { data: patientLookup } = await supabase
          .from("patients")
          .select("id")
          .eq("user_id", userId)
          .eq("pms_patient_id", appointmentPatientId)
          .eq("pms_type", pmsType)
          .single();

        if (patientLookup) {
          patientIdForAppointment = patientLookup.id;
        }
      }

      // Prepare appointment data - matching exact database schema
      const appointmentData = {
        user_id: userId,
        patient_id: patientIdForAppointment, // May be null if patient not found
        pms_appointment_id: appointment.id,
        pms_type: pmsType,
        appointment_date: appointment.date,
        appointment_type: appointment.type,
        status: appointment.status,
        practitioner_name: appointment.physioName,
        notes: appointment.notes,
        is_completed: appointment.status === "completed",
      };

      try {
        const storedAppointment = await storeAppointment(appointmentData);

        totalAppointments++;
      } catch (appointmentError) {
        console.error("[SERVER] Error storing appointment:", appointmentError);
      }
    }

    // Add summary for verification
    const totalSyncedRecords = wcPatients + epcPatients + totalAppointments;
    console.log(`[SERVER] 🎯 TOTAL SYNCED RECORDS: ${totalSyncedRecords}`);
    console.log(
      `[SERVER] 📊 Breakdown: ${wcPatients} WC patients + ${epcPatients} EPC patients + ${totalAppointments} appointments = ${totalSyncedRecords} total records`
    );

    return {
      wcPatients,
      epcPatients,
      totalAppointments,
      issues: issues.length > 0 ? issues : undefined,
    };
  } catch (error) {
    console.error("[SERVER] Sync error:", error);
    return {
      wcPatients: 0,
      epcPatients: 0,
      totalAppointments: 0,
      issues: [
        `Sync failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}
