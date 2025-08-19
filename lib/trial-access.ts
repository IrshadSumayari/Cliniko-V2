import { supabase } from '@/integrations/supabase/client';

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  subscriptionStatus: string;
}

export async function checkTrialStatus(clinicId: string): Promise<TrialStatus> {
  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('trial_expires_at, subscription_status')
      .eq('id', clinicId)
      .single();

    if (error) {
      console.error('Supabase error in checkTrialStatus:', error);
      throw new Error('Could not fetch trial status');
    }

    if (!clinic) {
      throw new Error('Clinic not found');
    }

    const now = new Date();
    const expiresAt = new Date(clinic.trial_expires_at || now);
    const daysRemaining = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    const isActive =
      clinic.subscription_status === 'active' ||
      (clinic.subscription_status === 'trial' && daysRemaining > 0);
    const isExpired = clinic.subscription_status === 'trial' && daysRemaining === 0;

    return {
      isActive,
      daysRemaining,
      isExpired,
      subscriptionStatus: clinic.subscription_status || 'trial',
    };
  } catch (error) {
    console.error('Error in checkTrialStatus:', error);
    throw error;
  }
}

export async function lockoutCheck(clinicId: string): Promise<boolean> {
  try {
    const trialStatus = await checkTrialStatus(clinicId);

    // Allow access if subscription is active
    if (trialStatus.subscriptionStatus === 'active') return true;

    // Allow access if trial is active and has days remaining
    if (trialStatus.subscriptionStatus === 'trial' && trialStatus.daysRemaining > 0) return true;

    // Block access for expired trials without subscription
    return false;
  } catch (error) {
    console.error('Error in lockoutCheck:', error);
    // In case of error, allow access to prevent false lockouts
    return true;
  }
}

export async function extendTrial(clinicId: string, days: number) {
  try {
    const { error } = await supabase
      .from('clinics')
      .update({
        trial_expires_at: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', clinicId);

    if (error) {
      console.error('Error extending trial:', error);
      throw new Error('Could not extend trial');
    }
  } catch (error) {
    console.error('Error in extendTrial:', error);
    throw error;
  }
}

export async function activateSubscription(clinicId: string, subscriptionData: any) {
  try {
    const { error } = await supabase
      .from('clinics')
      .update({
        subscription_status: 'active',
        stripe_customer_id: subscriptionData.customer,
      })
      .eq('id', clinicId);

    if (error) {
      console.error('Error activating subscription:', error);
      throw new Error('Could not activate subscription');
    }
  } catch (error) {
    console.error('Error in activateSubscription:', error);
    throw error;
  }
}
