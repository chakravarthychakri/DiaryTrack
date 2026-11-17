import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  shopId: string;
  setShopId: (shopId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('dairytrack_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dairytrack_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [shopId, setShopIdState] = useState<string>(() => {
    return localStorage.getItem('dairytrack_shop_id') || 'shop-main-001';
  });

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('dairytrack_token', newToken);
    localStorage.setItem('dairytrack_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('dairytrack_token');
    localStorage.removeItem('dairytrack_user');
  };

  const setShopId = (id: string) => {
    setShopIdState(id);
    localStorage.setItem('dairytrack_shop_id', id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        login,
        logout,
        shopId,
        setShopId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
