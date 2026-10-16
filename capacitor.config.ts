import type { CapacitorConfig } from "@capacitor/cli";

/**
 * ID приложения (package name). Перед публикацией в Google Play замените его
 * здесь и в android/app/build.gradle (namespace и applicationId).
 */
export const APP_ID = "com.example.myhabits";

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: "Мои привычки",
  // `npm run build` writes the static app into dist/client (dist/server is unused on Android).
  webDir: "dist/client",
  android: {
    adjustMarginsForEdgeToEdge: "auto",
    allowMixedContent: false,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#111827",
    },
    LocalNotifications: {
      smallIcon: "ic_stat_habit",
      iconColor: "#2F7A5B",
    },
  },
};

export default config;
