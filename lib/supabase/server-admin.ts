import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

export function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables for admin client")
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function encryptApiKey(apiKey: string): string {
  const algorithm = "aes-256-ctr"
  const secretKey = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production"

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash("sha256").update(secretKey).digest()
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(algorithm, key, iv)
  let encrypted = cipher.update(apiKey, "utf8", "hex")
  encrypted += cipher.final("hex")

  return `${iv.toString("hex")}:${encrypted}`
}

function decryptApiKey(encryptedData: string): string {
  const algorithm = "aes-256-ctr"
  const secretKey = process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production"

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash("sha256").update(secretKey).digest()

  const [ivHex, encrypted] = encryptedData.split(":")
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted data format")
  }

  const iv = Buffer.from(ivHex, "hex")

  const decipher = crypto.createDecipheriv(algorithm, key, iv)
  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

export async function storeEncryptedApiKey(
  userId: string,
  pmsType: "cliniko" | "halaxy" | "nookal",
  apiKey: string,
  apiUrl?: string,
  clinicId?: string,
) {
  try {
    console.log("[SERVER] Starting API key encryption...")
    const supabase = createAdminClient()

    const encryptedKey = encryptApiKey(apiKey)
    console.log("[SERVER] API key encrypted successfully")

    const { data, error } = await supabase
      .from("pms_api_keys")
      .upsert(
        {
          user_id: userId,
          pms_type: pmsType,
          api_key_encrypted: encryptedKey,
          api_url: apiUrl,
          clinic_id: clinicId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,pms_type",
        },
      )
      .select()

    if (error) {
      console.error("[SERVER] Database error storing API key:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      throw new Error(`Database error: ${error.message}`)
    }

    console.log("[SERVER] API key stored successfully in database:", data)
    return true
  } catch (error) {
    console.error("[SERVER] Error in storeEncryptedApiKey:", error)
    throw new Error(`Failed to encrypt and store API key: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

export async function getDecryptedApiKey(userId: string, pmsType: string) {
  try {
    const supabase = createAdminClient()

    const { data: keyData, error: fetchError } = await supabase
      .from("pms_api_keys")
      .select("api_key_encrypted, api_url, clinic_id")
      .eq("user_id", userId)
      .eq("pms_type", pmsType)
      .eq("is_active", true)
      .single()

    if (fetchError || !keyData) {
      return null
    }

    const decryptedKey = decryptApiKey(keyData.api_key_encrypted)

    return {
      apiKey: decryptedKey,
      apiUrl: keyData.api_url,
      clinicId: keyData.clinic_id,
    }
  } catch (error) {
    console.error("Error in getDecryptedApiKey:", error)
    return null
  }
}
