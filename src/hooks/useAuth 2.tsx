
// Authentication functionality has been removed due to persistent parsing errors.
// This file is kept to prevent build errors from potential lingering imports,
// but it should ideally be deleted if no longer imported anywhere.
// For user context, please use useUserProfile.ts.

export const PREDEFINED_AGENTS: never[] = [];

export const useAuth = () => {
  console.warn("useAuth hook is deprecated and authentication has been removed. Use useUserProfile instead for profile switching.");
  return {
    loggedInAgent: null,
    login: async () => {
      console.warn("Login functionality is disabled.");
      return false;
    },
    logout: () => {
      console.warn("Logout functionality is disabled.");
    },
    isLoading: false,
  };
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  console.warn("AuthProvider is deprecated and has no effect. UserProfileProvider should be used if profile context is needed.");
  return <>{children}</>;
};
