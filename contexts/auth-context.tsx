"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const fetchUserData = async (authUser: User): Promise<AuthUser> => {
    try {
      console.log("Fetching user data for:", authUser.id);
      const { data: userData, error } = await supabase
        .from("users")
        .select("is_onboarded")
        .eq("auth_user_id", authUser.id)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        // If user doesn't exist in database, default to not onboarded
        // Don't sign them out - they are still authenticated
        if (error.code === "PGRST116") {
          console.log(
            "User not found in database, defaulting to not onboarded"
          );
          return { ...authUser, isOnboarded: false };
        }
        // For other errors, also default to not onboarded but keep them authenticated
        console.log("Database error, defaulting to not onboarded");
        return { ...authUser, isOnboarded: false };
      }

      console.log("User data fetched successfully:", userData);
      return {
        ...authUser,
        isOnboarded: userData?.is_onboarded || false,
      };
    } catch (error) {
      console.error("Error fetching user data:", error);
      return { ...authUser, isOnboarded: false };
    }
  };

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const updatedUser = await fetchUserData(user);
      setUser(updatedUser);
    } catch (error) {
      console.error("Error refreshing user data:", error);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("Initializing auth...");
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user && mounted) {
          console.log("Session found, fetching user data...");
          const userWithData = await fetchUserData(session.user);
          setUser(userWithData);
        } else if (mounted) {
          console.log("No session found");
          setUser(null);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return;

      try {
        if (session?.user) {
          const userWithData = await fetchUserData(session.user);
          setUser(userWithData);
        } else {
          console.log("No authenticated user");
          setUser(null);
        }
      } catch (error) {
        console.error("Error handling auth state change:", error);
        if (session?.user) {
          setUser({ ...session.user, isOnboarded: false });
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const updateUserOnboardingStatus = async (
    isOnboarded: boolean
  ): Promise<boolean> => {
    if (!user) {
      console.error("No user found to update onboarding status");
      return false;
    }

    setIsLoading(true);
    try {
      console.log(
        "Updating onboarding status to:",
        isOnboarded,
        "for user:",
        user.id
      );

      const { data, error } = await supabase
        .from("users")
        .update({ is_onboarded: isOnboarded })
        .eq("auth_user_id", user.id)
        .select("is_onboarded");

      if (error) {
        console.error("Error updating onboarding status:", error);
        return false;
      }

      // Update local state directly without calling refreshUserData to prevent loops
      setUser((prev) => (prev ? { ...prev, isOnboarded } : null));

      return true;
    } catch (error) {
      console.error("Error updating onboarding status:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return "An unknown error occurred";

    // Handle Supabase auth errors
    switch (error.message) {
      case "Invalid login credentials":
        return "Invalid email or password. Please check your credentials and try again.";
      case "Email not confirmed":
        return "Please check your email and click the confirmation link before signing in.";
      case "User not found":
        return "No account found with this email address. Please sign up first.";
      case "Invalid email":
        return "Please enter a valid email address.";
      case "Password should be at least 6 characters":
        return "Password must be at least 6 characters long.";
      case "User already registered":
        return "An account with this email already exists. Please sign in instead.";
      case "Signup requires a valid password":
        return "Please enter a valid password.";
      case "Only an email address is required to sign up":
        return "Please enter a valid email address.";
      case "Email rate limit exceeded":
        return "Too many requests. Please wait a moment before trying again.";
      case "User already registered":
        return "An account with this email already exists. Please sign in instead.";
      case "A user with this email address has already been registered":
        return "An account with this email already exists. Please sign in instead.";
      default:
        // Handle other common error patterns
        if (error.message?.includes("password")) {
          return "Password is incorrect. Please try again.";
        }
        if (error.message?.includes("email")) {
          return "There was an issue with the email address provided.";
        }
        if (error.message?.includes("network")) {
          return "Network error. Please check your connection and try again.";
        }
        if (error.message?.includes("already been registered")) {
          return "An account with this email already exists. Please sign in instead.";
        }
        return (
          error.message || "An unexpected error occurred. Please try again."
        );
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

  const signIn = async (
    email: string,
    password: string
  ): Promise<AuthResult> => {
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
        provider: "google",
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
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
