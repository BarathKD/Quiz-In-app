// App-wide settings you will fill in before the Play Store release.
// Host the privacy policy as a public web page (GitHub Pages works) and paste the URL here.
export const PRIVACY_POLICY_URL = "https://barathkd.github.io/Quiz-In-app/privacy.html";

// Backend server address, with no trailing slash. Examples:
//   Codespaces: "https://<codespace-name>-5080.app.github.dev"
//   Production: "https://quizin-api.azurewebsites.net"
// Leave it EMPTY to keep the old behaviour: everything stays on the phone (local mode).
// You can also set it without editing code: EXPO_PUBLIC_API_URL=https://... npx expo start
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");

export const USE_SERVER = API_BASE_URL.length > 0;

// Where the "Update the app" screen sends players (works once the app is published).
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.barath78.Quizin";
