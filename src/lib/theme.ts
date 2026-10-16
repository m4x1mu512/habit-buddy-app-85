import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { ThemeMode } from "./storage";

/** Status bar / top bar colours. Light theme: dark bar + light icons; dark theme: white bar + dark icons. */
export const BAR_COLORS = {
  light: { bar: "#111827", style: Style.Dark },
  dark: { bar: "#FFFFFF", style: Style.Light },
} as const;

export const resolveTheme = (mode: ThemeMode): "light" | "dark" =>
  mode === "system"
    ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : mode;

export async function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  const { bar, style } = BAR_COLORS[resolved];
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = bar;
  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setBackgroundColor({ color: bar });
      await StatusBar.setStyle({ style });
    } catch {
      /* the in-app top bar uses the same colours as a fallback */
    }
  }
  return resolved;
}
