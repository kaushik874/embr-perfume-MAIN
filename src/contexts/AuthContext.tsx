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
  requestOtp: (identifier: string) => Promise<{ message: string }>;
  verifyOtp: (identifier: string, otp: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  sendSignupOtp: (email: string) => Promise<{ message: string }>;
  register: (name: string, email: string, password: string, otp: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<{ message: string }>;
  resetPassword: (email: string, otp: string, password: string) => Promise<void>;
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
    return { message: result.message };
  };

  const verifyOtp = async (identifier: string, otp: string) => {
    const { user: u } = await api.verifyOtp({ identifier, otp });
    setUser(u);
  };

  const loginWithGoogle = async (credential: string) => {
    const { user: u } = await api.loginWithGoogle({ credential });
    setUser(u);
  };

  const sendSignupOtp = async (email: string) => {
    const result = await api.sendSignupOtp({ email });
    return { message: result.message };
  };

  const register = async (name: string, email: string, password: string, otp: string) => {
    const { user: u } = await api.register({ name, email, password, otp });
    setUser(u);
  };

  const forgotPassword = async (email: string) => {
    const result = await api.forgotPassword({ email });
    return { message: result.message };
  };

  const resetPassword = async (email: string, otp: string, password: string) => {
    await api.resetPassword({ email, otp, password });
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, requestOtp, verifyOtp, loginWithGoogle, sendSignupOtp, register, forgotPassword, resetPassword, logout, refresh }}
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
