// OAuth return page: the relay redirects here with #code=…&state=… (NEW flow, docs/api-contract.md section 2).
import { config, siteUrl } from "./core.js";
import { completeLogin } from "./auth.js";

const status = document.querySelector("[data-connect-status]");
const MESSAGES = { invalid_state: "This sign-in link expired or was opened in another tab. Start again.", access_denied: "Discord sign-in was cancelled.",
  identity_blacklisted: "This Discord account can't use SkyMyce community services.", invalid_grant: "This sign-in code was already used or expired. Start again." };
if (!config.features.webLogin) {
  history.replaceState(null, "", location.pathname);
  status.textContent = "Website sign-in is not enabled yet. Nothing was changed.";
} else {
  try {
    const back = await completeLogin();
    status.textContent = "Signed in. Taking you back…";
    location.replace(back && back.startsWith(new URL(siteUrl("")).pathname) ? back : siteUrl("community/"));
  } catch (error) {
    status.textContent = MESSAGES[error.message] ?? "Sign-in could not be completed. Try again later.";
  }
}
