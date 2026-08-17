import { useEffect, useState } from "react";

const THEME_KEY = "ma-theme";

export function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

function applyDocumentTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ma-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    applyDocumentTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return {
    theme,
    toggleTheme,
  };
}
