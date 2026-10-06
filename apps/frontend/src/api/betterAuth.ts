const API_URL = "";

export interface User {
  createdAt: string | number | Date;
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified?: boolean;
}

interface Session {
  id: string;
  expiresAt: string;
  token: string;
}

export interface SessionData {
  user: User;
  session: Session;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}

interface SignInData {
  email: string;
  password: string;
}

interface SignUpData {
  name: string;
  email: string;
  password: string;
}

interface UpdateUserData {
  name?: string;
  image?: string | null;
}

const request = async <T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> => {
  try {
    const response = await fetch(`${API_URL}/api/auth${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error:
          result?.message || result?.error?.message || "Error en la solicitud",
      };
    }

    return {
      success: true,
      data: result,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : "Error de conexión",
    };
  }
};

export const apiSignIn = async (
  data: SignInData,
): Promise<ApiResponse<SessionData>> => {
  return request<SessionData>("/sign-in/email", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const apiSignUp = async (
  data: SignUpData,
): Promise<ApiResponse<User>> => {
  return request<User>("/sign-up/email", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const apiLogout = async (): Promise<ApiResponse<null>> => {
  return request<null>("/sign-out", {
    method: "POST",
  });
};

export const apiGetSession = async (): Promise<ApiResponse<SessionData>> => {
  return request<SessionData>("/get-session", {
    method: "GET",
  });
};

export const apiUpdateUser = async (
  data: UpdateUserData,
): Promise<ApiResponse<User>> => {
  return request<User>("/update-user", {
    method: "POST",
    body: JSON.stringify(data),
  });
};
