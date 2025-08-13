import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { config } from "@/lib/config";

export function createAdminClient() {
  const supabaseUrl = config.supabase.url;
  const supabaseServiceKey = config.supabase.serviceRoleKey;

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function encryptApiKey(apiKey: string): string {
  const algorithm = "aes-256-ctr";
  const secretKey = config.encryption.secret;

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash("sha256").update(secretKey).digest();
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  return `${iv.toString("hex")}:${encrypted}`;
}

function decryptApiKey(encryptedData: string): string {
  const algorithm = "aes-256-ctr";
  const secretKey = config.encryption.secret;

  // Create a hash of the secret key to ensure it's 32 bytes
  const key = crypto.createHash("sha256").update(secretKey).digest();

  const [ivHex, encrypted] = encryptedData.split(":");
  if (!ivHex || !encrypted) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(ivHex, "hex");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export async function storeEncryptedApiKey(
  userId: string,
  pmsType: "cliniko" | "halaxy" | "nookal",
  apiKey: string,
  apiUrl?: string,
  clinicId?: string
) {
  try {
    console.log("[SERVER] Starting API key encryption...");
    console.log("[SERVER] User ID:", userId);
    console.log("[SERVER] PMS Type:", pmsType);
    console.log("[SERVER] API URL:", apiUrl);
    console.log("[SERVER] Clinic ID:", clinicId);
    
    const supabase = createAdminClient();
    console.log("[SERVER] Admin client created successfully");

    const encryptedKey = encryptApiKey(apiKey);
    console.log("[SERVER] API key encrypted successfully");

    // Now let's check if the pms_api_keys table exists and test a simple query
    console.log("[SERVER] Testing pms_api_keys table access...");
    const { data: testData, error: testError } = await supabase
      .from("pms_api_keys")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("[SERVER] Table access test failed:", testError);
      throw new Error(`Table access failed: ${testError.message}`);
    }
    console.log("[SERVER] Table access test successful");

    console.log("[SERVER] Attempting to insert/update API key with data:", {
      user_id: userId,
      pms_type: pmsType,
      api_key_encrypted: encryptedKey ? `${encryptedKey.substring(0, 20)}...` : "missing",
      api_url: apiUrl,
      clinic_id: clinicId,
      is_active: true,
    });

    const { data, error } = await supabase
      .from("pms_api_keys")
      .upsert(
        {
          user_id: userId, // This is now the correct user ID from the users table
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
        }
      )
      .select();

    if (error) {
      console.error("[SERVER] Database error storing API key:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("[SERVER] API key stored successfully in database:", data);
    return true;
  } catch (error) {
    console.error("[SERVER] Error in storeEncryptedApiKey:", error);
    throw new Error(
      `Failed to encrypt and store API key: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function getDecryptedApiKey(userId: string, pmsType: string) {
  try {
    const supabase = createAdminClient();

    const { data: keyData, error: fetchError } = await supabase
      .from("pms_api_keys")
      .select("api_key_encrypted, api_url, clinic_id")
      .eq("user_id", userId)
      .eq("pms_type", pmsType)
      .eq("is_active", true)
      .single();

    if (fetchError || !keyData) {
      return null;
    }

    const decryptedKey = decryptApiKey(keyData.api_key_encrypted);

    return {
      apiKey: decryptedKey,
      apiUrl: keyData.api_url,
      clinicId: keyData.clinic_id,
    };
  } catch (error) {
    console.error("Error in getDecryptedApiKey:", error);
    return null;
  }
}
