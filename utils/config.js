/*
  config.js - App settings in one place.
  Exports: PRIVACY_POLICY_URL, API_BASE_URL, USE_SERVER, PLAY_STORE_URL.
  Used by: utils/server.js (API_BASE_URL), utils/api.js (USE_SERVER), settings/update screens (URLs).
  If the app cannot reach the server, check API_BASE_URL first.
*/

// App-wide settings you will fill in before the Play Store release.
// Host the privacy policy as a public web page (GitHub Pages works) and paste the URL here.
// PRIVACY_POLICY_URL: link to the public privacy policy page (needed by Google Play).
export const PRIVACY_POLICY_URL = "https://barathkd.github.io/Quiz-In-app/privacy.html";

// Backend server address, with no trailing slash. Examples:
//   Codespaces: "https://<codespace-name>-5080.app.github.dev"
//   Production: "https://quizin-api.azurewebsites.net"
// Leave it EMPTY to keep the old behaviour: everything stays on the phone (local mode).
// You can also set it without editing code: EXPO_PUBLIC_API_URL=https://... npx expo start
// API_BASE_URL: address of the ASP.NET backend. Used by utils/server.js for every request.
// The replace() removes trailing slashes so we can safely write BASE + "/path".
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || "").replace(/\/+$/, "");

// USE_SERVER: true when a backend address is set. utils/api.js checks this to choose
// server mode (utils/server.js) or local mode (utils/storage.js on the phone).
export const USE_SERVER = API_BASE_URL.length > 0;

// Where the "Update the app" screen sends players (works once the app is published).
// PLAY_STORE_URL: Play Store page opened by the "Update the app" screen.
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.barath78.Quizin";
