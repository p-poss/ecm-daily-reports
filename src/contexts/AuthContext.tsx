import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { db, generateId, now } from '@/db/database';
import type { Employee, AuthSession } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  foreman: Employee | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [foreman, setForeman] = useState<Employee | null>(null);

  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const sessions = await db.authSession.toArray();
      if (sessions.length > 0) {
        const session = sessions[0];
        // Check if session is expired
        if (new Date(session.expiresAt) > new Date()) {
          const employee = await db.employees.get(session.foremanId);
          if (employee) {
            setForeman(employee);
            document.title = 'Jobs | ECM';
          } else {
            // Session exists but employee not found, clear session
            await db.authSession.clear();
          }
        } else {
          // Session expired, clear it
          await db.authSession.clear();
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find employee by email
      const employee = await db.employees
        .where('loginEmail')
        .equalsIgnoreCase(email)
        .first();

      if (!employee) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if employee is a foreman
      if (!employee.isForeman) {
        return { success: false, error: 'Only foremen can log in' };
      }

      // Simple password check (in production, use proper hashing comparison)
      // For now, we'll use a simple comparison. In production, use bcrypt or similar.
      if (employee.passwordHash !== password) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Clear any existing sessions
      await db.authSession.clear();

      // Create new session (expires in 30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const session: AuthSession = {
        id: generateId(),
        foremanId: employee.id,
        foremanName: employee.name,
        token: generateId(), // Simple token
        createdAt: now(),
        expiresAt: expiresAt.toISOString(),
      };

      await db.authSession.add(session);
      setForeman(employee);
      document.title = 'Jobs | ECM';

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An error occurred during login' };
    }
  }

  async function logout(): Promise<void> {
    try {
      await db.authSession.clear();
      setForeman(null);
      document.title = 'Login | ECM';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: foreman !== null,
        isLoading,
        foreman,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
