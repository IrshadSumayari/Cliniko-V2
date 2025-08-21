'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useRouter } from 'next/navigation';
import { config } from '@/lib/config';

interface AuthUser extends User {
  isOnboarded?: boolean;
}

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    clinicName?: string
  ) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateUserOnboardingStatus: (isOnboarded: boolean) => Promise<boolean>;
  isLoading: boolean;
  refreshUserData: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchUserData = async (authUser: User): Promise<AuthUser> => {
    try {
      console.log('Fetching user data for:', authUser.id);
      
      // Add timeout protection for database queries
      const queryPromise = supabase
        .from('users')
        .select('is_onboarded')
        .eq('auth_user_id', authUser.id)
        .single();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 8000); // 8 second timeout
      });

      const { data: userData, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.error('Error fetching user data:', error);
        
        // If user doesn't exist in database, default to not onboarded
        // Don't sign them out - they are still authenticated
        if (error.code === 'PGRST116') {
          console.log('User not found in database, defaulting to not onboarded');
          return { ...authUser, isOnboarded: false };
        }
        
        // For other database errors, also default to not onboarded but keep them authenticated
        console.log('Database error, defaulting to not onboarded. Error:', error.message);
        
        // Try to get onboarding status from localStorage as fallback
        try {
          const storedStatus = localStorage.getItem('user_onboarding_status');
          if (storedStatus) {
            const isOnboarded = storedStatus === 'true';
            console.log('Using localStorage fallback for onboarding status:', isOnboarded);
            return { ...authUser, isOnboarded };
          }
        } catch (localStorageError) {
          console.warn('Failed to read from localStorage:', localStorageError);
        }
        
        return { ...authUser, isOnboarded: false };
      }

      console.log('User data fetched successfully:', userData);
      return {
        ...authUser,
        isOnboarded: userData?.is_onboarded || false,
      };
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      
      // If it's a timeout or connection error, default to not onboarded
      if (error instanceof Error && error.message.includes('timeout')) {
        console.log('Database query timed out, defaulting to not onboarded');
        
        // Try to get onboarding status from localStorage as fallback
        try {
          const storedStatus = localStorage.getItem('user_onboarding_status');
          if (storedStatus) {
            const isOnboarded = storedStatus === 'true';
            console.log('Using localStorage fallback for onboarding status:', isOnboarded);
            return { ...authUser, isOnboarded };
          }
        } catch (localStorageError) {
          console.warn('Failed to read from localStorage:', localStorageError);
        }
        
        return { ...authUser, isOnboarded: false };
      }
      
      // For any other errors, default to not onboarded but keep them authenticated
      console.log('Unexpected error in fetchUserData, defaulting to not onboarded');
      return { ...authUser, isOnboarded: false };
    }
  };

  const refreshUserData = async () => {
    if (!user) return;

    // Prevent recursive calls
    if (isLoading) return;

    try {
      setIsLoading(true);
      const updatedUser = await fetchUserData(user);
      setUser(updatedUser);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getAccessToken = (): string | null => {
    try {
      const supabaseToken = localStorage.getItem('sb-ddsbasqzslznczvqwjph-auth-token');
      if (supabaseToken) {
        const parsed = JSON.parse(supabaseToken);
        return parsed.access_token || null;
      }

      return localStorage.getItem('supabase.auth.token');
    } catch (error) {
      console.warn('Error getting access token:', error);
      return null;
    }
  };

  const validateTokenAndGetUser = async (): Promise<User | null> => {
    try {
      const token = getAccessToken();
      if (!token) {
        return null;
      }

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.warn('Token validation failed:', error);
        return null;
      }

      return user;
    } catch (error) {
      console.error('Error validating token:', error);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;
    let authTimeoutId: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        console.log('Initializing token-based auth...');
        
        // Add timeout protection for auth initialization
        const authPromise = validateTokenAndGetUser();
        const timeoutPromise = new Promise<never>((_, reject) => {
          authTimeoutId = setTimeout(() => reject(new Error('Auth timeout')), 10000); // 10 second timeout
        });

        const authUser = await Promise.race([authPromise, timeoutPromise]);

        if (authUser && mounted) {
          console.log('Valid token found, fetching user data...');
          try {
            const userWithData = await fetchUserData(authUser);
            if (mounted) {
              setUser(userWithData);
            }
          } catch (dbError) {
            console.error('Database query failed, but user is authenticated:', dbError);
            // Even if database fails, we know the user is authenticated
            // Set them as not onboarded and let them proceed
            if (mounted) {
              setUser({ ...authUser, isOnboarded: false });
            }
          }
        } else if (mounted) {
          console.log('No valid token found');
          setUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          // Add a small delay to prevent rapid state changes
          timeoutId = setTimeout(() => {
            if (mounted) {
              setLoading(false);
            }
          }, 100);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          try {
            const userWithData = await fetchUserData(session.user);
            if (mounted) {
              setUser(userWithData);
            }
          } catch (dbError) {
            console.error('Database query failed during sign in, but user is authenticated:', dbError);
            // Even if database fails, we know the user is authenticated
            if (mounted) {
              setUser({ ...session.user, isOnboarded: false });
            }
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          try {
            const userWithData = await fetchUserData(session.user);
            if (mounted) {
              setUser(userWithData);
            }
          } catch (dbError) {
            console.error('Database query failed during token refresh, but user is authenticated:', dbError);
            // Even if database fails, we know the user is authenticated
            if (mounted) {
              setUser({ ...session.user, isOnboarded: false });
            }
          }
        }
      } catch (error) {
        console.error('Error handling auth state change:', error);
        if (session?.user && mounted) {
          setUser({ ...session.user, isOnboarded: false });
        } else if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          // Add a small delay to prevent rapid state changes
          timeoutId = setTimeout(() => {
            if (mounted) {
              setLoading(false);
            }
          }, 100);
        }
      }
    });

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (authTimeoutId) {
        clearTimeout(authTimeoutId);
      }
      subscription.unsubscribe();
    };
  }, []);

  const updateUserOnboardingStatus = async (isOnboarded: boolean): Promise<boolean> => {
    if (!user) {
      console.error('No user found to update onboarding status');
      return false;
    }

    console.log('updateUserOnboardingStatus called with:', { isOnboarded, userId: user.id, userEmail: user.email });
    setIsLoading(true);
    
    try {
      console.log('Updating onboarding status to:', isOnboarded, 'for user:', user.id);

      // Add timeout protection for database operations
      const dbTimeout = 10000; // 10 seconds
      
      // First, let's check if the user exists in the database
      const checkPromise = supabase
        .from('users')
        .select('id, auth_user_id, is_onboarded')
        .eq('auth_user_id', user.id)
        .single();
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timeout')), dbTimeout);
      });

      const { data: existingUser, error: checkError } = await Promise.race([checkPromise, timeoutPromise]);

      if (checkError) {
        console.error('Error checking existing user:', checkError);
        if (checkError.code === 'PGRST116') {
          console.log('User not found in database, creating new user record...');
          
          // Create a new user record with timeout
          const createPromise = supabase
            .from('users')
            .insert({
              auth_user_id: user.id,
              email: user.email || '',
              is_onboarded: isOnboarded,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select('id, is_onboarded')
            .single();

          const { data: newUser, error: createError } = await Promise.race([createPromise, timeoutPromise]);

          if (createError) {
            console.error('Error creating new user record:', createError);
            return false;
          }

          console.log('New user record created:', newUser);
        } else {
          return false;
        }
      } else {
        console.log('Existing user found:', existingUser);
        
        // Update existing user with timeout
        const updatePromise = supabase
          .from('users')
          .update({ 
            is_onboarded: isOnboarded,
            updated_at: new Date().toISOString()
          })
          .eq('auth_user_id', user.id)
          .select('is_onboarded');

        const { data, error } = await Promise.race([updatePromise, timeoutPromise]);

        if (error) {
          console.error('Error updating onboarding status:', error);
          return false;
        }

        console.log('User updated successfully:', data);
      }

      // Update local state directly without calling refreshUserData to prevent loops
      setUser((prev) => (prev ? { ...prev, isOnboarded } : null));
      console.log('Local user state updated successfully');
      
      // Also store in localStorage as a fallback
      try {
        localStorage.setItem('user_onboarding_status', isOnboarded.toString());
        console.log('Onboarding status stored in localStorage');
      } catch (localStorageError) {
        console.warn('Failed to store in localStorage:', localStorageError);
      }

      return true;
    } catch (error) {
      console.error('Error updating onboarding status:', error);
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('Database operation timed out');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return 'An unknown error occurred';

    // Handle Supabase auth errors
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'Email not confirmed':
        return 'Please check your email and click the confirmation link before signing in.';
      case 'User not found':
        return 'No account found with this email address. Please sign up first.';
      case 'Invalid email':
        return 'Please enter a valid email address.';
      case 'Password should be at least 6 characters':
        return 'Password must be at least 6 characters long.';
      case 'User already registered':
        return 'An account with this email already exists. Please sign in instead.';
      case 'Signup requires a valid password':
        return 'Please enter a valid password.';
      case 'Only an email address is required to sign up':
        return 'Please enter a valid email address.';
      case 'Email rate limit exceeded':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'User already registered':
        return 'An account with this email already exists. Please sign in instead.';
      case 'A user with this email address has already been registered':
        return 'An account with this email already exists. Please sign in instead.';
      default:
        // Handle other common error patterns
        if (error.message?.includes('password')) {
          return 'Password is incorrect. Please try again.';
        }
        if (error.message?.includes('email')) {
          return 'There was an issue with the email address provided.';
        }
        if (error.message?.includes('network')) {
          return 'Network error. Please check your connection and try again.';
        }
        if (error.message?.includes('already been registered')) {
          return 'An account with this email already exists. Please sign in instead.';
        }
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    clinicName?: string
  ): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      // Let Supabase handle duplicate email checks automatically
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${config.app.url}/auth/callback`,
          data: {
            first_name: firstName,
            last_name: lastName,
            clinic_name: clinicName,
          },
        },
      });

      if (error) return { success: false, error: getErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) return { success: false, error: getErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${config.app.url}/auth/callback`,
        },
      });

      if (error) return { success: false, error: getErrorMessage(error) };
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      // Don't set loading to true during signout to prevent infinite loops
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
        updateUserOnboardingStatus,
        isLoading,
        refreshUserData,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
