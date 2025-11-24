import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("useAuth: Initializing auth listener");
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("useAuth: Auth state changed", { event, hasSession: !!session, hasUser: !!session?.user });
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile when session changes
        if (session?.user) {
          setTimeout(() => {
            supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .maybeSingle()
              .then(({ data }) => {
                setProfile(data);
              });
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("useAuth: Initial session check", { hasSession: !!session, hasUser: !!session?.user });
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch profile on initial load
      if (session?.user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setProfile(profileData);
      }
      
      setLoading(false);
    });

    return () => {
      console.log("useAuth: Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    profile,
    session,
    loading,
    signOut,
    isAuthenticated: !!user,
    department: profile?.department || null,
  };
}
