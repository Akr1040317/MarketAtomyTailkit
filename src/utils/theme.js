import { useEffect, useState } from "react";

const THEME_KEY = "ma-theme";
const REDUCE_MOTION_KEY = "ma-reduce-motion";
const TEXT_SCALE_KEY = "ma-text-scale";

export function getStoredTheme() {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function getStoredReduceMotion() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(REDUCE_MOTION_KEY) === "1";
}

export function getStoredTextScale() {
  if (typeof window === "undefined") return "normal";
  return window.localStorage.getItem(TEXT_SCALE_KEY) === "large" ? "large" : "normal";
}

function applyDocumentPrefs({ theme, reduceMotion, textScale }) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-ma-theme", theme);
  document.documentElement.setAttribute("data-ma-text-scale", textScale);
  document.documentElement.classList.toggle("ma-reduce-motion", reduceMotion);
}

export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme);
  const [reduceMotion, setReduceMotion] = useState(getStoredReduceMotion);
  const [textScale, setTextScale] = useState(getStoredTextScale);
  const [a11yOpen, setA11yOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, theme);
    window.localStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? "1" : "0");
    window.localStorage.setItem(TEXT_SCALE_KEY, textScale);
    applyDocumentPrefs({ theme, reduceMotion, textScale });
  }, [theme, reduceMotion, textScale]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));
  const toggleReduceMotion = () => setReduceMotion((current) => !current);
  const cycleTextScale = () => setTextScale((current) => (current === "large" ? "normal" : "large"));

  return {
    theme,
    toggleTheme,
    reduceMotion,
    toggleReduceMotion,
    textScale,
    cycleTextScale,
    a11yOpen,
    setA11yOpen,
  };
}
