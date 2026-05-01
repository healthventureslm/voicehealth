import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Enums } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type AppRole = Enums<"app_role">;

interface UserRoleRow {
  hospital_id: string | null;
  role: AppRole;
}

interface WardAssignmentRow {
  ward_id: string;
  ward: { hospital_id: string; name: string; ward_type: string } | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRoleRow[];
  wardIds: string[];
  hospitalIds: string[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  isHospitalAdminOf: (hospitalId: string) => boolean;
  hasRole: (role: AppRole) => boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [wardIds, setWardIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) console.error("Error fetching profile:", error);
    setProfile(data ?? null);
  }, []);

  const fetchRolesAndWards = useCallback(async (userId: string) => {
    const [rolesRes, wardsRes] = await Promise.all([
      supabase.from("user_roles").select("hospital_id, role").eq("user_id", userId),
      supabase
        .from("ward_assignments")
        .select("ward_id")
        .eq("user_id", userId)
        .is("ended_at", null),
    ]);

    if (rolesRes.error) console.error("Error fetching roles:", rolesRes.error);
    if (wardsRes.error) console.error("Error fetching wards:", wardsRes.error);

    setRoles((rolesRes.data ?? []) as UserRoleRow[]);
    setWardIds((wardsRes.data ?? []).map((r: { ward_id: string }) => r.ward_id));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await Promise.all([fetchProfile(user.id), fetchRolesAndWards(user.id)]);
  }, [user, fetchProfile, fetchRolesAndWards]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRolesAndWards(session.user.id),
        ]).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "INITIAL_SESSION") return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        Promise.all([
          fetchProfile(session.user.id),
          fetchRolesAndWards(session.user.id),
        ]).finally(() => {
          if (mounted) setIsLoading(false);
        });
      } else {
        setProfile(null);
        setRoles([]);
        setWardIds([]);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchRolesAndWards]);

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setWardIds([]);
  };

  const isSuperAdmin = useMemo(() => roles.some((r) => r.role === "super_admin"), [roles]);

  const hospitalIds = useMemo(
    () =>
      Array.from(
        new Set(
          roles
            .filter((r) => r.hospital_id !== null)
            .map((r) => r.hospital_id as string),
        ),
      ),
    [roles],
  );

  const isHospitalAdminOf = useCallback(
    (hospitalId: string) =>
      roles.some((r) => r.role === "hospital_admin" && r.hospital_id === hospitalId),
    [roles],
  );

  const hasRole = useCallback((role: AppRole) => roles.some((r) => r.role === role), [roles]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        wardIds,
        hospitalIds,
        isLoading,
        isSuperAdmin,
        isHospitalAdminOf,
        hasRole,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
