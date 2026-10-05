import { useState, useEffect, useCallback, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  apiGetSession,
  apiLogout,
  apiSignIn,
  type User,
} from "../api/betterAuth";
import { UserContext } from "../context/UserContext";
import type { LoginData } from "../context/UserContext";

interface UserProviderProps {
  children?: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const initializeUser = async () => {
      try {
        const { success, data, error } = await apiGetSession();

        if (!mounted) {
          return;
        }

        if (success && data) {
          setUser(data.user);
        } else {
          setUser(null);

          if (error) {
            console.error("Error al obtener usuario:", error);
          }
        }
      } catch (error) {
        if (!mounted) {
          return;
        }

        setUser(null);
        console.error("Error al obtener sesión:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeUser();

    return () => {
      mounted = false;
    };
  }, []);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const { success, data, error } = await apiGetSession();

      if (success && data) {
        setUser(data.user);
      } else {
        setUser(null);

        if (error) {
          console.error("Error al obtener usuario:", error);
        }
      }
    } catch (error) {
      setUser(null);
      console.error("Error al actualizar sesión:", error);
    }
  }, []);

  // Cambio «en vivo» al estado sin sesión (RF-10, plan D13): al volver a la
  // pestaña y, como máximo, una vez por minuto mientras esté visible.
  useEffect(() => {
    const revalidate = () => {
      if (document.visibilityState === "visible") {
        void refreshUser();
      }
    };

    document.addEventListener("visibilitychange", revalidate);
    const intervalId = setInterval(revalidate, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", revalidate);
      clearInterval(intervalId);
    };
  }, [refreshUser]);

  const login = async (data: LoginData): Promise<boolean> => {
    setLoading(true);

    try {
      const response = await apiSignIn(data);

      if (!response.success || !response.data) {
        setUser(null);
        return false;
      }

      setUser(response.data.user);
      return true;
    } catch (error) {
      setUser(null);
      console.error("Error al iniciar sesión:", error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await apiLogout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setUser(null);
      navigate("/");
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children ?? <Outlet />}
    </UserContext.Provider>
  );
}
