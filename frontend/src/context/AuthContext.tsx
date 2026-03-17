import { createContext, useContext } from 'react';

type AuthContextValue = {
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue>({ isAdmin: false });

export function AuthProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return <AuthContext.Provider value={{ isAdmin }}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
