import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

type AuthStateSnapshot = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
};

const authState: AuthStateSnapshot = {
  user: null,
  profile: null,
  session: null,
  loading: true,
};

const authListeners = new Set<(snapshot: AuthStateSnapshot) => void>();
let authInitialized = false;
let activeProfileRequestForUserId: string | null = null;

function emitAuthState() {
  const snapshot = { ...authState };
  authListeners.forEach((listener) => listener(snapshot));
}

function setAuthState(patch: Partial<AuthStateSnapshot>) {
  Object.assign(authState, patch);
  emitAuthState();
}

async function loadProfile(user: User | null) {
  const userId = user?.id ?? null;
  activeProfileRequestForUserId = userId;

  if (!userId) {
    setAuthState({ profile: null });
    return;
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (activeProfileRequestForUserId === userId) {
    setAuthState({ profile: data ?? null });
  }
}

function syncSession(session: Session | null) {
  setAuthState({
    session,
    user: session?.user ?? null,
    loading: false,
  });

  void loadProfile(session?.user ?? null);
}

function ensureAuthInitialized() {
  if (authInitialized) return;
  authInitialized = true;

  console.log("useAuth: Initializing auth listener");

  supabase.auth.onAuthStateChange((event, session) => {
    console.log("useAuth: Auth state changed", { event, hasSession: !!session, hasUser: !!session?.user });
    syncSession(session);
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    console.log("useAuth: Initial session check", { hasSession: !!session, hasUser: !!session?.user });
    syncSession(session);
  }).catch((error) => {
    console.error("useAuth: Initial session check failed", error);
    setAuthState({ loading: false, user: null, profile: null, session: null });
  });
}

function subscribeAuth(listener: (snapshot: AuthStateSnapshot) => void) {
  authListeners.add(listener);
  listener({ ...authState });

  return () => {
    authListeners.delete(listener);
  };
}

export function useAuth() {
  const [state, setState] = useState<AuthStateSnapshot>({ ...authState });

  useEffect(() => {
    ensureAuthInitialized();
    return subscribeAuth(setState);
  }, []);

  const signOut = async () => {
    try {
      setAuthState({ user: null, profile: null, session: null, loading: false });
      await supabase.auth.signOut({ scope: "local" });
    } catch (error: any) {
      console.error("useAuth: Logout error (ignored)", error);
    } finally {
      try {
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
    if (!authState.user) return;
    await loadProfile(authState.user);
  };

  return {
    user: state.user,
    profile: state.profile,
    session: state.session,
    loading: state.loading,
    signOut,
    refetchProfile,
    isAuthenticated: !!state.user,
    department: state.profile?.department || null,
  };
}
