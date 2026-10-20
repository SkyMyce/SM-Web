// SkyMyce site configuration: the single source for URLs, endpoints, flags and fixed facts.
// Read by build.mjs (canonical URLs, sitemap, CSP) and shipped to the browser as assets/js/config.js.
// Values marked TODO are unknown and must be confirmed by the project owner. Never put secrets here.

const config = {
  // Absolute origin and path the site is served from. Confirmed: the SkyMyce/SM-Web project site,
  // https://skymyce.github.io/SM-Web/. For a custom domain or a repo renamed to skymyce.github.io,
  // set BASE_PATH to "/" (and SITE_ORIGIN to the domain). Leading and trailing slash required.
  SITE_ORIGIN: "https://skymyce.github.io",
  BASE_PATH: "/SM-Web/",

  // Relay (Cloudflare Worker). Public production endpoint from the mod's gradle.properties.
  API_BASE: "https://sky-myce-backend.skyblock-relay.workers.dev",

  github: {
    // The mod's source and releases. TODO: update these three if the mod repo moves to the SkyMyce org.
    repo: "https://github.com/cessna80808-star/Sky-Myce",
    releases: "https://github.com/cessna80808-star/Sky-Myce/releases/latest",
    issues: "https://github.com/cessna80808-star/Sky-Myce/issues",
    site: "https://github.com/SkyMyce/SM-Web", // this website's repository
  },
  discordInvite: "", // TODO: permanent Discord invite URL. Empty hides every invite button.
  social: [], // TODO: e.g. [{ label: "YouTube", url: "https://..." }]. Empty hides the list.

  features: {
    // The relay sends no CORS headers yet, so browsers cannot read it. Keep false until the
    // endpoints in docs/api-contract.md exist. While false, every live area shows "Preview data"
    // and makes no network request. When true, failures fall back to "Offline preview".
    liveApi: false,
    webLogin: false, // Discord login for the website (needs the NEW /community/web/* endpoints)
    webChatSend: false, // Web chat stays read-only unless this is true AND the relay supports sending
    adminPanel: true, // Show the /admin UI (always noindex; access is enforced by the relay)
    status: true, // Show /status
  },

  // Release signing trust root, copied from the mod's gradle.properties (skyMyceSigningKeyId / PublicKey).
  signing: {
    keyId: "production-20260927",
    publicKey: "MCowBQYDK2VwAyEAbI6SZNtcVbtbzRKs0PfoU8MXp0nW+w1VeT71gDKM5NA=",
  },

  // Fixed requirements from gradle.properties and fabric.mod.json. The release version itself
  // comes from the relay manifest when live, otherwise from the newest entry in data/changelog.json.
  // Fabric API and SkyblockPV are bundled inside the 2.7.29 JAR (jar-in-jar); Fabric Language Kotlin is not.
  requirements: {
    minecraft: "26.1.2",
    java: "25",
    fabricLoader: "0.19.3",
    fabricKotlin: "1.13.12+kotlin.2.4.0",
    fabricApi: "0.155.2+26.1.2",
    skyblockPv: "1.8.9",
  },

  // Optional custom domain (written to CNAME by the build when set). Also update SITE_ORIGIN.
  customDomain: "",
};

export default config;
