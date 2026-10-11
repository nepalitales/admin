"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getMe, login as apiLogin, logout as apiLogout, removeAdminToken, type Admin } from "@/lib/api";

interface AuthContextType {
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_KEY = "admin_profile";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = localStorage.getItem(PROFILE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const data = await getMe();
      setAdmin(data.admin);
      if (typeof window !== "undefined") {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(data.admin));
      }
    } catch (err: any) {
      if (err?.status === 401) {
        removeAdminToken();
        if (typeof window !== "undefined") {
          localStorage.removeItem(PROFILE_KEY);
        }
        setAdmin(null);
      } else {
        console.warn("[Auth] API temporarily unreachable, preserving active session:", err);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (identifier: string, password: string) => {
    const data = await apiLogin(identifier, password);
    setAdmin(data.admin);
    if (typeof window !== "undefined") {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(data.admin));
    }
  };

  const logout = async () => {
    await apiLogout();
    if (typeof window !== "undefined") {
      localStorage.removeItem(PROFILE_KEY);
    }
    setAdmin(null);
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        isLoading,
        isAuthenticated: !!admin,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
