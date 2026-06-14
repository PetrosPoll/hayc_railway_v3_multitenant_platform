
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { shouldSkipAuthCheck } from '@/lib/skip-auth-check-routes';

interface User {
  email: string;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const skipAuthCheck = shouldSkipAuthCheck(location.pathname);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => !shouldSkipAuthCheck(window.location.pathname));

  useEffect(() => {
    if (skipAuthCheck) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchUserData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/user', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setUser(data.user ?? null);
        } else if (!cancelled) {
          setUser(null);
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchUserData();

    return () => {
      cancelled = true;
    };
  }, [skipAuthCheck]);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
