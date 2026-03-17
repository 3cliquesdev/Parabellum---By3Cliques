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
    try {
      // Clear local state first so UI updates imediatamente
      setUser(null);
      setProfile(null);
      setSession(null);

      // Tenta encerrar a sessão local (sem depender do /logout do servidor)
      await supabase.auth.signOut({ scope: "local" });
    } catch (error: any) {
      console.error("useAuth: Logout error (ignored)", error);
    } finally {
      // Garantir remoção do token de autenticação do navegador
      try {
        // Derive storage key from environment variable instead of hardcoding
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 
          new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0];
        const storageKey = `sb-${projectId}-auth-token`;
        window.localStorage.removeItem(storageKey);
        window.sessionStorage.removeItem(storageKey);
      } catch (storageError) {
        console.error("useAuth: Erro ao limpar storage de sessão", storageError);
      }
    }
  };

  const refetchProfile = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    
    setProfile(data);
  };

  return {
    user,
    profile,
    session,
    loading,
    signOut,
    refetchProfile,
    isAuthenticated: !!user,
    department: profile?.department || null,
  };
}
