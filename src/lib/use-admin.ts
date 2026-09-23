import * as React from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin } from "@/lib/auth.functions";

type AdminState = {
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
};

/** Current Supabase session and whether it belongs to the admin (verified server-side). */
export function useAdmin(): AdminState {
  const [state, setState] = React.useState<AdminState>({
    session: null,
    isAdmin: false,
    loading: true,
  });

  React.useEffect(() => {
    let cancelled = false;

    const update = async (session: Session | null) => {
      const admin = session
        ? await checkIsAdmin({ data: { accessToken: session.access_token } }).catch(() => false)
        : false;
      if (!cancelled) setState({ session, isAdmin: admin, loading: false });
    };

    // If the browser Supabase client isn't configured (missing VITE_* at build
    // time), treat everyone as signed out rather than breaking every page.
    let unsubscribe = () => {};
    try {
      supabase.auth
        .getSession()
        .then(({ data }) => update(data.session))
        .catch(() => update(null));
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        update(session);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    } catch (err) {
      console.error("[useAdmin] Sign-in unavailable:", err);
      update(null);
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
