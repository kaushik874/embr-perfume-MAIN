import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, type User } from "@/lib/api";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  requestOtp: (identifier: string) => Promise<{ demoOtp?: string; message: string }>;
  verifyOtp: (identifier: string, otp: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.me();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { user: u } = await api.login({ identifier: email, password });
    setUser(u);
  };

  const requestOtp = async (identifier: string) => {
    const result = await api.requestOtp({ identifier });
    return { demoOtp: result.demoOtp, message: result.message };
  };

  const verifyOtp = async (identifier: string, otp: string) => {
    const { user: u } = await api.verifyOtp({ identifier, otp });
    setUser(u);
  };

  const loginWithGoogle = async (credential: string) => {
    const { user: u } = await api.loginWithGoogle({ credential });
    setUser(u);
  };

  const register = async (name: string, email: string, password: string) => {
    const { user: u } = await api.register({ name, email, password });
    setUser(u);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, requestOtp, verifyOtp, loginWithGoogle, register, logout, refresh }}
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
