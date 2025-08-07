"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    clinicName?: string
  ) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === "SIGNED_IN" && session?.user) {
        await ensureUserRecord(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureUserRecord = async (user: User) => {
    try {
      // Check if user record exists by ID first
      const { data: existingUserById, error: fetchByIdError } = await supabase
        .from("users")
        .select("id, email")
        .eq("id", user.id)
        .maybeSingle();

      if (fetchByIdError) {
        console.error("Error checking user record by ID:", fetchByIdError);
        return;
      }

      // If user exists by ID, we're done
      if (existingUserById) {
        console.log("User record already exists by ID");
        return;
      }

      // Check if user exists by email
      const { data: existingUserByEmail, error: fetchByEmailError } =
        await supabase
          .from("users")
          .select("id, email")
          .eq("email", user.email || "")
          .maybeSingle();

      if (fetchByEmailError) {
        console.error(
          "Error checking user record by email:",
          fetchByEmailError
        );
        return;
      }

      // If user exists by email but different ID, update the ID
      if (existingUserByEmail && existingUserByEmail.id !== user.id) {
        console.log("Updating existing user record with new auth ID");
        const { error: updateError } = await supabase
          .from("users")
          .update({ id: user.id })
          .eq("email", user.email || "");

        if (updateError) {
          console.error("Error updating user record:", updateError);
        }
        return;
      }

      // If no user exists, create one
      if (!existingUserByEmail) {
        // Extract user data from metadata
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

        // Only insert columns that exist in the current schema
        const userData = {
          id: user.id,
          email: user.email || "",
          first_name: firstName,
          last_name: lastName,
          clinic_name: clinicName,
          is_onboarded: false,
        };

        const { error: insertError } = await supabase
          .from("users")
          .insert([userData]);

        if (insertError) {
          // If it's a duplicate key error, just log it and continue
          if (insertError.code === "23505") {
            console.log(
              "User record already exists (duplicate key), continuing..."
            );
          } else {
            console.error("Error creating user record:", insertError);
          }
        } else {
          console.log("User record created successfully");
        }
      }
    } catch (error) {
      console.error("Error ensuring user record:", error);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    clinicName?: string
  ) => {
    setIsLoading(true);
    try {
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
        return false;
      }

      return true;
    } catch (error) {
      console.error("Sign up error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Sign in error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithGoogle = async () => {
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
        return false;
      }

      return true;
    } catch (error) {
      console.error("Google sign in error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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

        isLoading,
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
