"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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

  const fetchUserData = async (authUser: User): Promise<AuthUser> => {
    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("is_onboarded")
        .eq("id", authUser.id)
        .single();

      if (error) {
        console.error("Error fetching user data:", error);
        // If user doesn't exist in database, they need to be created
        if (error.code === "PGRST116") {
          console.log("User not found in database, will be created");
          return { ...authUser, isOnboarded: false };
        }
        return { ...authUser, isOnboarded: false };
      }

      console.log("User data fetched:", userData);
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
    if (!user) {
      return;
    }

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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      try {
        if (session?.user) {
          const userRecordCreated = await ensureUserRecord(session.user);
          if (userRecordCreated) {
            const userWithData = await fetchUserData(session.user);
            setUser(userWithData);
          } else {
            console.error("Failed to create/verify user record");
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Error handling auth state change:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const ensureUserRecord = async (user: User): Promise<boolean> => {
    try {
      console.log("Ensuring user record for:", user.id);

      // First check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (existingUser) {
        console.log("User already exists in database");
        return true;
      }

      if (checkError && checkError.code !== "PGRST116") {
        console.error("Error checking existing user:", checkError);
        return false;
      }

      // User doesn't exist, create them
      const firstName =
        user.user_metadata?.full_name?.split(" ")[0] ||
        user.user_metadata?.name?.split(" ")[0] ||
        user.user_metadata?.first_name ||
        user.user_metadata?.given_name ||
        "User";

      const lastName =
        user.user_metadata?.full_name?.split(" ").slice(1).join(" ") ||
        user.user_metadata?.name?.split(" ").slice(1).join(" ") ||
        user.user_metadata?.last_name ||
        user.user_metadata?.family_name ||
        "Name";

      const clinicName = user.user_metadata?.clinic_name || "My Clinic";

      const userData = {
        id: user.id,
        email: user.email || "",
        first_name: firstName,
        last_name: lastName,
        clinic_name: clinicName,
        is_onboarded: false,
      };

      console.log("Creating new user record:", userData);

      const { error: insertError } = await supabase
        .from("users")
        .insert(userData);

      if (insertError) {
        console.error("Error creating user record:", insertError);

        // If it's a duplicate key error, check if user exists now
        if (insertError.code === "23505") {
          const { data: recheckUser } = await supabase
            .from("users")
            .select("id")
            .eq("id", user.id)
            .single();

          if (recheckUser) {
            console.log("User exists after duplicate key error");
            return true;
          }
        }

        return false;
      } else {
        console.log("User record created successfully");
        return true;
      }
    } catch (error) {
      console.error("Error ensuring user record:", error);
      return false;
    }
  };

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
        .eq("id", user.id)
        .select("is_onboarded");

      if (error) {
        console.error("Error updating onboarding status:", error);
        return false;
      }

      console.log("Database update successful:", data);

      // Update local user state immediately
      setUser((prev) => (prev ? { ...prev, isOnboarded } : null));

      console.log(`Onboarding status updated to: ${isOnboarded}`);
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
      const { data: existingUser } = await supabase
        .from("users")
        .select("email")
        .eq("email", email)
        .single();

      if (existingUser) {
        return {
          success: false,
          error:
            "An account with this email already exists. Please sign in instead.",
        };
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/auth/callback`,
          data: {
            first_name: firstName,
            last_name: lastName,
            clinic_name: clinicName,
          },
        },
      });

      if (error) {
        console.error("Sign up error:", error);
        return { success: false, error: getErrorMessage(error) };
      }

      return { success: true };
    } catch (error) {
      console.error("Sign up error:", error);
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

      if (error) {
        console.error("Sign in error:", error);
        return { success: false, error: getErrorMessage(error) };
      }

      return { success: true };
    } catch (error) {
      console.error("Sign in error:", error);
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
          redirectTo: `${
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
          }/auth/callback`,
        },
      });

      if (error) {
        console.error("Google sign in error:", error);
        return { success: false, error: getErrorMessage(error) };
      }

      return { success: true };
    } catch (error) {
      console.error("Google sign in error:", error);
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
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
