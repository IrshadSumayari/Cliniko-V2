import { type NextRequest, NextResponse } from "next/server"
import { supabase } from "@/integrations/supabase/client"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const clinicId = searchParams.get("clinicId")

    if (!clinicId) {
      return NextResponse.json({ error: "Clinic ID required" }, { status: 400 })
    }

    // Get unmatched physios from API data
    const { data: unmatchedPhysios, error } = await supabase
      .from("physio_matching")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("matched", false)

    if (error) throw error

    return NextResponse.json({ physios: unmatchedPhysios || [] })
  } catch (error: any) {
    console.error("Physio matching error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clinicId, externalPhysioId, userId } = await req.json()

    if (!clinicId || !externalPhysioId || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Update physio matching
    const { error } = await supabase
      .from("physio_matching")
      .update({
        user_id: userId,
        matched: true,
      })
      .eq("clinic_id", clinicId)
      .eq("external_physio_id", externalPhysioId)

    if (error) throw error

    // Update user with external physio ID
    await supabase.from("users").update({ external_physio_id: externalPhysioId }).eq("id", userId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Physio matching error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
