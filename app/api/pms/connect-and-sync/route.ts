import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { PMSFactory } from "@/lib/pms/factory";
import {
  storeEncryptedApiKey,
  createAdminClient,
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

    const cookieStore = cookies();

    console.log("=== Session Debug Info ===");
    console.log(
      "Available cookies:",
      cookieStore.getAll().map((c) => c.name)
    );

    const supabase = createServerClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        cookies: {
          get(name: string) {
            const value = cookieStore.get(name)?.value;
            console.log(
              `Getting cookie ${name}:`,
              value ? "present" : "missing"
            );
            return value;
          },
          set(name: string, value: string, options: any) {
            console.log(`Setting cookie ${name}`);
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            console.log(`Removing cookie ${name}`);
            cookieStore.set({ name, value: "", ...options });
          },
        },
      }
    );

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    console.log("Session data:", sessionData.session ? "present" : "missing");
    console.log("Session error:", sessionError?.message || "none");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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
    } else {
      console.log("User record exists:", existingUser);
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

    console.log("Creating PMS client...");
    let pmsClient;
    try {
      pmsClient = PMSFactory.createClient(pmsType, apiKey);
      if (!pmsClient) {
        throw new Error("PMS client creation returned null");
      }
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
        console.error(`❌ Connection test failed for ${pmsType}`);
        return NextResponse.json(
          {
            error: `Failed to connect to ${pmsType}. Please verify your API key is correct.`,
          },
          { status: 400 }
        );
      }
      console.log("✅ Connection test successful!");
    } catch (connectionError) {
      console.error("❌ Connection test error:", connectionError);
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
    let userRecord: any;
    try {
      const region =
        pmsType === "cliniko" ? apiKey.split("-").pop() : undefined;
      const apiUrl =
        pmsType === "cliniko"
          ? `https://api.${region}.cliniko.com/v1`
          : undefined;

      // Get the user record from the users table to get the correct user_id
      const { data: userRecordData, error: userError } = await adminSupabase
        .from("users")
        .select("id")
        .eq("auth_user_id", userId)
        .single();
      console.log("userRecordData", userRecordData);

      if (userError || !userRecordData) {
        console.error("❌ User record not found:", userError);
        return NextResponse.json(
          { error: "User record not found in database" },
          { status: 500 }
        );
      }

      userRecord = userRecordData;
      await storeEncryptedApiKey(userRecord.id, pmsType, apiKey, apiUrl);
      console.log("✅ Credentials stored successfully in database!");
    } catch (credentialsError) {
      console.error("❌ Error storing credentials:", credentialsError);
      return NextResponse.json(
        { error: "Failed to store credentials in database" },
        { status: 500 }
      );
    }

    console.log("Connection successful, starting initial sync...");
    const syncResults = await performInitialSync(
      adminSupabase,
      userRecord.id, // Use the user ID from users table, not auth_user_id
      pmsClient,
      pmsType
    );

    await adminSupabase.from("sync_logs").insert({
      user_id: userRecord.id, // Use the user ID from users table, not auth_user_id
      pms_type: pmsType,
      sync_type: "initial",
      status: "completed",
      patients_synced: syncResults.wcPatients + syncResults.epcPatients,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(syncResults);
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

    const patients = await pmsClient.getPatients();
    console.log(`[SERVER] Fetched ${patients.length} patients from ${pmsType}`);

    if (!patients || patients.length === 0) {
      console.log("[SERVER] No patients found, skipping sync");
      return {
        wcPatients: 0,
        epcPatients: 0,
        totalAppointments: 0,
        issues: ["No patients found in PMS"],
      };
    }

    for (const patient of patients) {
      console.log(
        `[SERVER] Processing patient: ${patient.firstName} ${patient.lastName} (Type: ${patient.patientType})`
      );
      const patientType = patient.patientType;

      if (patientType === "EPC" || patientType === "WC") {
        console.log(`[SERVER] Storing ${patientType} patient in database...`);

        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .upsert({
            user_id: userId,
            pms_patient_id: patient.id,
            pms_type: pmsType,
            first_name: patient.firstName,
            last_name: patient.lastName,
            email: patient.email,
            phone: patient.phone,
            date_of_birth: patient.dateOfBirth,
            patient_type: patientType,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (patientError) {
          console.error("[SERVER] Error storing patient:", patientError);
          issues.push(
            `Failed to store patient: ${patient.firstName} ${patient.lastName}`
          );
        } else {
          console.log(
            `[SERVER] Successfully stored ${patientType} patient:`,
            patientData
          );
          if (patientType === "EPC") epcPatients++;
          if (patientType === "WC") wcPatients++;
        }

        try {
          console.log(
            `[SERVER] Fetching appointments for patient: ${patient.id}`
          );
          const appointments = await pmsClient.getPatientAppointments(
            patient.id
          );
          const completedAppointments = appointments.filter(
            (apt: any) => apt.status === "completed"
          );

          console.log(
            `[SERVER] Found ${appointments.length} total appointments, ${completedAppointments.length} completed`
          );

          for (const appointment of completedAppointments) {
            const { data: appointmentData, error: appointmentError } =
              await supabase.from("appointments").upsert({
                user_id: userId,
                patient_id: patient.id,
                pms_appointment_id: appointment.id,
                pms_type: pmsType,
                appointment_date: appointment.date,
                appointment_end_date: appointment.date, // Using same date for now
                appointment_type: appointment.type,
                status: appointment.status,
                notes: appointment.notes,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

            if (appointmentError) {
              console.error(
                "[SERVER] Error storing appointment:",
                appointmentError
              );
            } else {
              console.log(
                "[SERVER] Successfully stored appointment:",
                appointmentData
              );
              totalAppointments++;
            }
          }
        } catch (appointmentError) {
          console.error(
            "[SERVER] Error fetching appointments for patient:",
            patient.id,
            appointmentError
          );
          issues.push(
            `Could not fetch appointments for ${patient.firstName} ${patient.lastName}`
          );
        }
      } else {
        console.log(
          `[SERVER] Skipping patient with type: ${patientType} (not EPC or WC)`
        );
      }
    }

    console.log("[SERVER] User profile update skipped - pms_type field not in users table");

    console.log("[SERVER] Sync completed successfully!");
    console.log(
      `[SERVER] Final counts - WC: ${wcPatients}, EPC: ${epcPatients}, Appointments: ${totalAppointments}`
    );
  } catch (error) {
    console.error("[SERVER] Sync error:", error);
    issues.push("Some data could not be synchronized");
  }

  return {
    wcPatients,
    epcPatients,
    totalAppointments,
    issues: issues.length > 0 ? issues : undefined,
  };
}
