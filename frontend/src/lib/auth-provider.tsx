"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { fetchCurrentUser, loginUser, logoutUser, registerCompany, registerUser } from "@/lib/api";
import type { CompanySummary, User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  // Returns the logged-in user so callers (e.g. the login page) can make an
  // immediate role-based redirect decision without waiting on a re-render.
  login: (email: string, password: string) => Promise<User>;
  signup: (name: string, email: string, password: string) => Promise<User>;
  // HR self-signup: creates a new (initially 'pending') company alongside
  // the account. See lib/api.ts registerCompany + the /signup/company page.
  signupCompany: (params: {
    name: string;
    email: string;
    password: string;
    companyName: string;
    companyDomain: string;
  }) => Promise<{ user: User; company: CompanySummary }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const loggedInUser = await loginUser({ email, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const newUser = await registerUser({ name, email, password });
    setUser(newUser);
    return newUser;
  }, []);

  const signupCompany = useCallback(
    async (params: { name: string; email: string; password: string; companyName: string; companyDomain: string }) => {
      const result = await registerCompany(params);
      setUser(result.user);
      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, signupCompany, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

