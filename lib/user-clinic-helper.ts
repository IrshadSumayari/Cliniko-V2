import { supabase } from '@/integrations/supabase/client'

export interface UserClinicData {
  userId: string
  clinicId: string | null
  clinicName: string
  subscriptionStatus: string
  trialStartedAt: string | null
  trialExpiresAt: string | null
  isTrialExpired: boolean
}

export async function getUserClinicData(userId: string): Promise<UserClinicData | null> {
  try {
    // For now, return mock data since we're working around database schema issues
    // TODO: Implement proper database queries once schema is fixed

    const mockTrialExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now

    return {
      userId,
      clinicId: `clinic_${userId}`,
      clinicName: "Default Clinic",
      subscriptionStatus: "trial",
      trialStartedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      trialExpiresAt: mockTrialExpiry.toISOString(),
      isTrialExpired: false,
    }
  } catch (error) {
    console.error("Error in getUserClinicData:", error)
    return null
  }
}

export async function ensureUserClinicRelationship(
  userId: string,
  userEmail: string,
  clinicName?: string,
): Promise<string | null> {
  try {
    // For now, just return a mock clinic ID
    // TODO: Implement proper clinic creation once database schema is ready
    return `clinic_${userId}`
  } catch (error) {
    console.error("Error in ensureUserClinicRelationship:", error)
    return null
  }
}

export async function checkUserAccess(userId: string): Promise<{
  hasAccess: boolean
  isTrialExpired: boolean
  trialExpiresAt: string | null
  subscriptionStatus: string
}> {
  try {
    // For now, always allow access since we're bypassing the trial system
    // TODO: Implement proper access checking once database schema is ready

    const mockTrialExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now

    return {
      hasAccess: true,
      isTrialExpired: false,
      trialExpiresAt: mockTrialExpiry.toISOString(),
      subscriptionStatus: "trial",
    }
  } catch (error) {
    console.error("Error checking user access:", error)
    // Fail open - allow access if we can't determine status
    return {
      hasAccess: true,
      isTrialExpired: false,
      trialExpiresAt: null,
      subscriptionStatus: "unknown",
    }
  }
}
