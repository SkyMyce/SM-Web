// Cosmetics gallery. Profiles follow CosmeticProfile v5 (relay/src/cosmetics.ts); the public list
// endpoint is NEW (docs/api-contract.md 4.3). Names are rendered from the inert text-component subset.
import { apiUrl, fetchJSON, fmt, h, liveOrPreview, setBadge, siteUrl } from "./core.js";
import { previewCosmetics } from "./preview-data.js";

// Minecraft's named colours (cosmetic-style.ts allows these or #RRGGBB).
const COLORS = { black: "#000000", dark_blue: "#0000aa", dark_green: "#00aa00", dark_aqua: "#00aaaa", dark_red: "#aa0000", dark_purple: "#aa00aa",
  gold: "#ffaa00", gray: "#aaaaaa", dark_gray: "#555555", blue: "#5555ff", green: "#55ff55", aqua: "#55ffff", red: "#ff5555",
  light_purple: "#ff55ff", yellow: "#ffff55", white: "#ffffff" };
const PRESETS = { "sky-myce": "SkyMyce", forest: "Forest", sunset: "Sunset", void: "Void" };

/** Renders a CosmeticText tree with inherited styles. Depth and node count are bounded like the relay's parser. */
export function renderName(component, inherited = {}, budget = { nodes: 64 }, depth = 0) {
  const frag = document.createDocumentFragment();
  if (!component || typeof component !== "object" || depth > 8 || --budget.nodes < 0) return frag;
  const style = { ...inherited };
  if (typeof component.color === "string") style.color = COLORS[component.color] ?? (/^#[0-9a-f]{6}$/i.test(component.color) ? component.color : style.color);
  for (const key of ["bold", "italic", "underlined", "strikethrough"]) if (typeof component[key] === "boolean") style[key] = component[key];
  const span = h("span", { class: ["bold", "italic", "underlined", "strikethrough"].filter(k => style[k]).map(k => `mc-${k}`).join(" ") }, String(component.text ?? ""));
  if (style.color) span.style.color = style.color;
  frag.append(span);
  if (Array.isArray(component.extra)) component.extra.slice(0, 64).forEach(child => frag.append(renderName(child, style, budget, depth + 1)));
  return frag;
}

function card(profile) {
  const figure = h("div", { class: "cos-figure", "aria-hidden": "true" },
    h("div", { class: "cos-figure__cape" }), h("div", { class: "cos-figure__head" }), h("div", { class: "cos-figure__body" }), h("div", { class: "cos-figure__legs" }));
  const clamp = v => Math.max(.1, Math.min(3, Number(v) || 1));
  // Display scale is compressed so a 3.0 player still fits the card; the real values are listed below.
  figure.style.setProperty("--sx", String(.55 + clamp(profile.scaleX) * .3));
  figure.style.setProperty("--sy", String(.55 + clamp(profile.scaleY) * .3));
  const cape = figure.querySelector(".cos-figure__cape");
  if (profile.capePreset && PRESETS[profile.capePreset]) cape.style.backgroundImage = `url("${siteUrl(`assets/img/capes/${profile.capePreset}.png`)}")`;
  else if (profile.capeAsset?.id && /^[a-f0-9]{32}$/.test(profile.capeAsset.id)) cape.style.backgroundImage = `url("${apiUrl(`/community/cosmetics/assets/${profile.capeAsset.id}?uuid=${profile.uuid}`)}")`;
  else cape.hidden = true;
  figure.classList.toggle("cos-figure--caped", !cape.hidden);
  const name = h("span", { class: "cos-name" }, renderName(profile.nameStyle ?? { text: profile.name ?? "Player" }));
  name.style.setProperty("--ns", String(Math.max(.5, Math.min(2, Number(profile.nametagScale) || 1)) * .9));
  const label = profile.name ?? "Unnamed";
  return h("li", { class: "cos-card" },
    h("div", { class: "cos-card__stage" }, name, figure),
    h("div", { class: "cos-card__body" }, h("strong", {}, label),
      h("span", {}, `Size ${[profile.scaleX, profile.scaleY, profile.scaleZ].map(v => fmt.number(v, 2)).join(" × ")} · nametag ${fmt.number(profile.nametagScale, 2)}×`),
      h("span", {}, `Cape: ${profile.capePreset ? PRESETS[profile.capePreset] ?? "Preset" : profile.capeAsset ? "Custom" : "None"}`)));
}

const grid = document.querySelector("[data-cos-grid]");
if (grid) {
  const { data, state } = await liveOrPreview(() => fetchJSON(apiUrl("/community/public/cosmetics?page=1&limit=24")).then(r => r.profiles), previewCosmetics);
  setBadge(document.querySelector("[data-cos-badge]"), state);
  grid.replaceChildren(...(data.length ? data.map(card) : [h("li", { class: "empty" }, "No shared cosmetics yet.")]));
}
