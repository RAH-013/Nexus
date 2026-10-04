import { createContext } from "react";
import type { User } from "../api/betterAuth";

export interface LoginData {
  email: string;
  password: string;
}

export interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (data: LoginData) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const UserContext = createContext<UserContextType | null>(null);
