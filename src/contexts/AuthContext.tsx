import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type AppRole = Enums<"app_role">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("Error fetching profile:", error);
      }
      setProfile(data);
    } catch (err) {
      console.error("Profile fetch failed:", err);
    }
  }, []);

  const fetchRoles = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) {
        console.error("Error fetching roles:", error);
      }
      setRoles(data?.map((r) => r.role) ?? []);
    } catch (err) {
      console.error("Roles fetch failed:", err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id)]);
    }
  }, [user, fetchProfile, fetchRoles]);

  const acceptPendingInvitation = useCallback(async (userId: string, userEmail: string) => {
    try {
      const invitationToken = new URLSearchParams(window.location.search).get("token");
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const metaToken = currentUser?.user_metadata?.invitation_token;
      const isAdminWhitelist = currentUser?.user_metadata?.admin_whitelist === "true";
      const token = invitationToken || metaToken;

      if (!token && !isAdminWhitelist) return;

      const body: Record<string, any> = {};
      if (token) body.invitation_token = token;
      if (isAdminWhitelist) body.admin_whitelist = true;

      await supabase.functions.invoke("accept-invitation", { body });
      await Promise.all([fetchProfile(userId), fetchRoles(userId)]);
    } catch (err) {
      console.error("Failed to accept invitation:", err);
    }
  }, [fetchProfile, fetchRoles]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRoles(session.user.id),
        ]).then(() => {
          acceptPendingInvitation(session.user.id, session.user.email || "");
        }).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "INITIAL_SESSION") return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          Promise.all([
            fetchProfile(session.user.id),
            fetchRoles(session.user.id),
          ]).then(() => {
            if (event === "SIGNED_IN") {
              acceptPendingInvitation(session.user.id, session.user.email || "");
            }
          }).finally(() => {
            if (mounted) setIsLoading(false);
          });
        } else {
          setProfile(null);
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRoles, acceptPendingInvitation]);

  const signInWithGoogle = async () => {
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
  };

  const isAdmin = roles.includes("admin");

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, isLoading, isAdmin, signInWithGoogle, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
