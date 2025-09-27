import { createContext, useContext, useReducer, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  twoFactorRequired: false,
  emailVerificationRequired: false,
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
      };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "REQUIRE_TWO_FACTOR":
      return { ...state, twoFactorRequired: true, isLoading: false };
    case "REQUIRE_EMAIL_VERIFICATION":
      return { ...state, emailVerificationRequired: true, isLoading: false };
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

  // ✅ define validateToken with useCallback to prevent re-renders
  const validateToken = useCallback(async (token) => {
    try {
      const response = await fetch("/api/auth/validate", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const user = await response.json();
        dispatch({ type: "SET_USER", payload: user });
      } else {
        localStorage.removeItem("token");
        dispatch({ type: "LOGOUT" });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Authentication failed" });
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      validateToken(token);
    } else {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [validateToken]);

  const login = async (credentials) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requiresTwoFactor) {
          dispatch({ type: "REQUIRE_TWO_FACTOR" });
        } else {
          localStorage.setItem("token", data.token);
          dispatch({ type: "SET_USER", payload: data.user });
        }
      } else {
        dispatch({ type: "SET_ERROR", payload: data.message || "Login failed" });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Login failed" });
    }
  };

  const register = async (userData) => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (response.ok) {
        dispatch({ type: "REQUIRE_EMAIL_VERIFICATION" });
      } else {
        dispatch({ type: "SET_ERROR", payload: data.message || "Registration failed" });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Registration failed" });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    dispatch({ type: "LOGOUT" });
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
