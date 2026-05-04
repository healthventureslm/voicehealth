import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * VoiceHealth segue o brand system Health Ventures: dark-only.
 * Mantemos o contexto pra compatibilidade com componentes existentes,
 * mas as funções viram no-op — o tema é sempre "dark".
 */
type Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "dark", toggleTheme: () => undefined }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
