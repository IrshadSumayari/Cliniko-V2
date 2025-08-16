import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Utility function to make authenticated API calls
 * Automatically includes the authorization header with the current user's token
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  try {
    // Get the current session and access token
    const { createClient } = await import("@supabase/supabase-js");
    const { config } = await import("@/lib/config");
    
    const supabase = createClient(config.supabase.url, config.supabase.anonKey);
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error("Session error:", sessionError);
      throw new Error("Failed to get authentication session. Please sign in again.");
    }
    
    if (!session?.access_token) {
      console.error("No session or access token found");
      throw new Error("No authentication token found. Please sign in again.");
    }

    console.log("Making authenticated request to:", url);
    console.log("Token available:", session.access_token ? "Yes" : "No");

    // Merge headers to include authorization
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      ...options.headers,
    };

    // Make the request with the authorization header
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      console.error("API request failed:", response.status, response.statusText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error("authenticatedFetch error:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to make authenticated request");
  }
}
