import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { PMSFactory } from "@/lib/pms/factory"
import { config } from "@/lib/config"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${config.cron.secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("=== Starting Scheduled Patient Sync ===")

    const supabase = createServerClient(config.supabase.url, config.supabase.serviceRoleKey, {
      cookies: {
        get() {
          return undefined
        },
      },
    })

    const { data: credentials, error: credentialsError } = await supabase
      .from("pms_credentials")
      .select("*")
      .eq("is_active", true)

    if (credentialsError) {
      console.error("Error fetching credentials:", credentialsError)
      return NextResponse.json({ error: "Database error" }, { status: 500 })
    }

    const syncResults = []

    for (const credential of credentials || []) {
      try {
        console.log(`Syncing for user ${credential.user_id} (${credential.pms_type})`)

        const { data: user } = await supabase.from("users").select("last_sync_at").eq("id", credential.user_id).single()

        const lastSyncAt = user?.last_sync_at ? new Date(user.last_sync_at) : new Date(0)

        const pmsClient = PMSFactory.createClient(credential.pms_type, credential.api_key)

        const result = await performIncrementalSync(
          supabase,
          credential.user_id,
          pmsClient,
          credential.pms_type,
          lastSyncAt,
        )

        syncResults.push({
          userId: credential.user_id,
          pmsType: credential.pms_type,
          ...result,
        })

        await supabase.from("sync_logs").insert({
          user_id: credential.user_id,
          pms_type: credential.pms_type,
          sync_type: "incremental",
          status: result.success ? "completed" : "failed",
          patients_synced: result.patientsUpdated || 0,
          appointments_synced: result.appointmentsUpdated || 0,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          details: result.details || {},
          error_message: result.error,
        })
      } catch (error) {
        console.error(`Sync failed for user ${credential.user_id}:`, error)

        await supabase.from("sync_logs").insert({
          user_id: credential.user_id,
          pms_type: credential.pms_type,
          sync_type: "incremental",
          status: "failed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          error_message: error instanceof Error ? error.message : "Unknown error",
        })

        syncResults.push({
          userId: credential.user_id,
          pmsType: credential.pms_type,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    }

    console.log("=== Scheduled Sync Complete ===")
    console.log(`Processed ${syncResults.length} users`)

    return NextResponse.json({
      success: true,
      processedUsers: syncResults.length,
      results: syncResults,
    })
  } catch (error) {
    console.error("Cron sync error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function performIncrementalSync(
  supabase: any,
  userId: string,
  pmsClient: any,
  pmsType: string,
  lastSyncAt: Date,
) {
  try {
    let patientsUpdated = 0
    let appointmentsUpdated = 0
    const issues: string[] = []

    const modifiedPatients = await pmsClient.getModifiedPatients(lastSyncAt)
    console.log(`Found ${modifiedPatients.length} modified patients for user ${userId}`)

    for (const patient of modifiedPatients) {
      const isEPC = pmsClient.isEPCPatient(patient)
      const isWC = pmsClient.isWCPatient(patient)

      if (isEPC || isWC) {
        const { error: patientError } = await supabase.from("patients").upsert({
          user_id: userId,
          pms_patient_id: patient.id,
          pms_type: pmsType,
          first_name: patient.first_name,
          last_name: patient.last_name,
          email: patient.email,
          phone: patient.phone,
          date_of_birth: patient.date_of_birth,
          patient_type: isEPC ? "epc" : "wc",
          raw_data: patient,
          updated_at: new Date().toISOString(),
        })

        if (!patientError) {
          patientsUpdated++

          try {
            const appointments = await pmsClient.getPatientAppointments(patient.id, lastSyncAt)
            const completedAppointments = appointments.filter((apt: any) => pmsClient.isCompletedAppointment(apt))

            for (const appointment of completedAppointments) {
              const { error: appointmentError } = await supabase.from("appointments").upsert({
                user_id: userId,
                patient_id: patient.id,
                pms_appointment_id: appointment.id,
                pms_type: pmsType,
                appointment_date: appointment.appointment_start,
                appointment_type: appointment.appointment_type?.name,
                practitioner_name: appointment.practitioner?.name,
                status: appointment.status,
                duration_minutes: appointment.duration,
                raw_data: appointment,
                updated_at: new Date().toISOString(),
              })

              if (!appointmentError) {
                appointmentsUpdated++
              }
            }
          } catch (appointmentError) {
            issues.push(`Could not sync appointments for patient ${patient.id}`)
          }
        } else {
          issues.push(`Could not update patient ${patient.id}`)
        }
      }
    }

    await supabase.from("users").update({ last_sync_at: new Date().toISOString() }).eq("id", userId)

    return {
      success: true,
      patientsUpdated,
      appointmentsUpdated,
      details: { issues: issues.length > 0 ? issues : undefined },
    }
  } catch (error) {
    console.error("Incremental sync error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
