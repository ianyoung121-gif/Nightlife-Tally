import { type ReactNode } from "react";
export interface AuthUser {
    id: number;
    username: string;
    email: string;
    avatarUrl: string | null;
    createdAt: string;
}
interface AuthState {
    user: AuthUser | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: () => void;
    logout: () => void;
}
export declare function AuthProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useAuth(): AuthState;
export {};
//# sourceMappingURL=use-auth.d.ts.map