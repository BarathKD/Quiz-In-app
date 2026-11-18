// Single data-access layer for the whole app.
//
// Screens import from "utils/api" and never talk to AsyncStorage directly.
// Today this re-exports the local storage implementation. In Phase 2 the
// functions are swapped for calls to the ASP.NET Core backend, with no
// changes needed in the screens.
export * from "./storage";
