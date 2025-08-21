import { type NextRequest, NextResponse } from "next/server"
import { storeEncryptedApiKey } from "@/lib/supabase/server-admin"
import { PMSApiFactory } from "@/lib/pms/factory"
import type { PMSType } from "@/lib/pms/types"

export async function POST(request: NextRequest) {
  try {
    const { userId, pmsType, apiKey, apiUrl, clinicId } = await request.json()

    if (!userId || !pmsType || !apiKey) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate PMS type
    if (!PMSApiFactory.getSupportedPMSTypes().includes(pmsType)) {
      return NextResponse.json({ error: "Unsupported PMS type" }, { status: 400 })
    }

    // Validate credentials format
    if (!PMSApiFactory.validateCredentials(pmsType as PMSType, { apiKey, apiUrl, clinicId })) {
      return NextResponse.json({ error: "Invalid credentials format" }, { status: 400 })
    }

    // Test connection before storing
    const api = PMSApiFactory.createApi(pmsType as PMSType, { apiKey, apiUrl, clinicId })
    const isConnected = await api.testConnection()

    if (!isConnected) {
      return NextResponse.json({ error: "Connection test failed. Please check your credentials." }, { status: 400 })
    }

    // Store encrypted API key
    await storeEncryptedApiKey(userId, pmsType as PMSType, apiKey, apiUrl, clinicId)

    return NextResponse.json({
      success: true,
      message: "API credentials stored successfully",
    })
  } catch (error) {
    console.error("Store credentials error:", error)
    return NextResponse.json({ error: "Failed to store credentials" }, { status: 500 })
  }
}
