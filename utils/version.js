/*
  version.js - Small helper to compare app version numbers.
  Exports: compareVersions.
  Used by the force-update check (see api.js / the update screen).
*/

// Compares dotted versions: "1.2.0" vs "1.10". Returns -1, 0 or 1.
// compareVersions(a, b): returns -1 if a is older than b, 0 if same, 1 if a is newer.
// Compares number by number, so "1.10" is newer than "1.2". Missing or bad parts count as 0.
// Used for the "update required" check (app version vs minimum version from the server/admin).
export const compareVersions = (a, b) => {
  // Split "1.2.0" into numbers. Bad text becomes 0.
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  // Compare part by part; the first difference decides the result.
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
};
