import { createContext, useContext, useReducer, useEffect } from "react";

const AuthContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  twoFactorRequired: false,
  pendingUserId: null,
  emailVerificationRequired: false,
  pendingEmail: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_USER":
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
        error: null,
        twoFactorRequired: false,
        emailVerificationRequired: false,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "REQUIRE_TWO_FACTOR":
      return { 
        ...state, 
        twoFactorRequired: true, 
        isLoading: false, 
        pendingUserId: action.payload || state.pendingUserId 
      };
    case "REQUIRE_EMAIL_VERIFICATION":
      return { 
        ...state, 
        emailVerificationRequired: true, 
        isLoading: false,
        pendingEmail: action.payload 
      };
    case "LOGOUT":
      return { ...initialState, isLoading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        dispatch({ type: "SET_USER", payload: user });
      } catch (error) {
        console.error("Failed to parse user data:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const register = async (userData) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    
    try {
      const response = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (!response.ok) {
        dispatch({ type: "SET_ERROR", payload: result.message || "Registration failed" });
        return { success: false, error: result.message };
      }

      dispatch({ type: "SET_LOADING", payload: false });
      return { success: true, message: result.message || "Registration successful" };
      
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error. Please try again." });
      return { success: false, error: "Network error" };
    }
  };

  const login = async (credentials) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    
    try {
      const response = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (!response.ok) {
        dispatch({ type: "SET_ERROR", payload: result.message || "Login failed" });
        return { success: false };
      }

      // 2FA required
      if (result.requiresTwoFactor) {
        dispatch({ type: "REQUIRE_TWO_FACTOR", payload: result.data?.user?.id });
        return { success: true, requiresTwoFactor: true };
      }

      // Email OTP required
      if (result.requiresEmailOTP) {
        dispatch({ type: "REQUIRE_EMAIL_VERIFICATION", payload: credentials.email });
        return { success: true, requiresEmailOTP: true, email: credentials.email };
      }

      // Normal login success
      if (result.success && result.data) {
        const { accessToken, user } = result.data;
        
        if (accessToken && user) {
          localStorage.setItem("token", accessToken);
          localStorage.setItem("user", JSON.stringify(user));
          dispatch({ type: "SET_USER", payload: user });
          return { success: true };
        } else {
          dispatch({ type: "SET_ERROR", payload: "Unexpected login response" });
          return { success: false };
        }
      }

      dispatch({ type: "SET_ERROR", payload: "Unexpected login response" });
      return { success: false };

    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Network error. Please try again." });
      return { success: false };
    }
  };

  const verifyTwoFactor = async (code) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    
    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: state.pendingUserId, token: code }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        dispatch({ type: "SET_ERROR", payload: result.message || "Invalid 2FA code" });
        return { success: false };
      }

      const { accessToken, user } = result.data;
      localStorage.setItem("token", accessToken);
      localStorage.setItem("user", JSON.stringify(user));
      dispatch({ type: "SET_USER", payload: user });
      return { success: true };

    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "2FA verification failed" });
      return { success: false };
    }
  };

  const verifyEmailOTP = async (email, otp) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });
    
    try {
      const response = await fetch("http://localhost:5000/api/auth/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        dispatch({ type: "SET_ERROR", payload: result.message || "OTP verification failed" });
        return { success: false };
      }

      // Email OTP verified, you can auto-login or prompt password reset
      return { success: true };

    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "OTP verification failed" });
      return { success: false };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch("http://localhost:5000/api/auth/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      dispatch({ type: "LOGOUT" });
    }
  };

  const clearError = () => dispatch({ type: "CLEAR_ERROR" });

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        clearError,
        verifyTwoFactor,
        verifyEmailOTP,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
