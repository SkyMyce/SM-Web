// Docs: client-side search over data/search-index.json, active TOC entry, mobile nav toggle.
import { h, localJSON, siteUrl } from "./core.js";

const toggle = document.querySelector("[data-docs-nav-toggle]"), nav = document.getElementById("docs-nav");
toggle?.addEventListener("click", () => { const open = toggle.getAttribute("aria-expanded") !== "true"; toggle.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open); });

// Active section in the right-hand TOC.
const tocLinks = [...document.querySelectorAll(".docs-toc a")];
if (tocLinks.length) {
  const targets = tocLinks.map(a => document.getElementById(a.hash.slice(1))).filter(Boolean);
  const io = new IntersectionObserver(() => {
    const top = targets.filter(t => t.getBoundingClientRect().top < innerHeight * .35).at(-1) ?? targets[0];
    tocLinks.forEach(a => a.classList.toggle("is-active", a.hash === `#${top.id}`));
  }, { rootMargin: "0px 0px -60% 0px", threshold: [0, 1] });
  targets.forEach(t => io.observe(t));
}

// Search
const box = document.querySelector("[data-docs-search]");
if (box) {
  const input = box.querySelector("input"), results = box.querySelector(".docs-search__results");
  let index = null, active = -1, items = [];
  const load = async () => index ??= await localJSON("search-index.json").catch(() => []);
  const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
  function excerpt(text, terms) {
    const lower = text.toLowerCase(), at = Math.max(0, Math.min(...terms.map(t => lower.indexOf(t)).filter(i => i >= 0)) - 40);
    return (at ? "…" : "") + text.slice(at, at + 140) + "…";
  }
  function highlight(text, terms) {
    const frag = document.createDocumentFragment();
    const pattern = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
    text.split(pattern).forEach((part, i) => frag.append(i % 2 ? h("mark", {}, part) : part));
    return frag;
  }
  async function search() {
    const terms = words(input.value);
    if (!terms.length) { results.hidden = true; input.setAttribute("aria-expanded", "false"); return; }
    const docs = await load();
    const scored = [];
    for (const doc of docs) {
      const hay = `${doc.title} ${doc.text}`.toLowerCase();
      if (!terms.every(t => hay.includes(t))) continue;
      const heading = doc.headings.find(hd => terms.some(t => hd.text.toLowerCase().includes(t)));
      const score = terms.reduce((s, t) => s + (doc.title.toLowerCase().includes(t) ? 10 : 0) + (heading ? 4 : 0) + (hay.split(t).length - 1) * .1, 0);
      scored.push({ doc, heading, score });
    }
    scored.sort((a, b) => b.score - a.score);
    items = scored.slice(0, 8).map(({ doc, heading }, i) => {
      const link = h("a", { href: siteUrl(doc.url) + (heading ? `#${heading.id}` : ""), role: "option", id: `docs-opt-${i}`, "aria-selected": "false" },
        highlight(heading ? `${doc.title} › ${heading.text}` : doc.title, terms), h("small", {}, highlight(excerpt(doc.text, terms), terms)));
      return link;
    });
    results.replaceChildren(...(items.length ? items : [h("p", { class: "docs-search__empty" }, "No matches. Try a command like /sm bars or a feature name.")]));
    results.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1;
  }
  function select(next) {
    if (!items.length) return;
    active = (next + items.length) % items.length;
    items.forEach((item, i) => item.setAttribute("aria-selected", String(i === active)));
    input.setAttribute("aria-activedescendant", items[active].id);
    items[active].scrollIntoView({ block: "nearest" });
  }
  input.setAttribute("role", "combobox"); input.setAttribute("aria-expanded", "false");
  input.addEventListener("input", search);
  input.addEventListener("focus", load, { once: true });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") { event.preventDefault(); select(active + 1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); select(active - 1); }
    else if (event.key === "Enter" && items[active]) { event.preventDefault(); location.assign(items[active].href); }
    else if (event.key === "Escape") { input.value = ""; results.hidden = true; input.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("click", event => { if (!box.contains(event.target)) results.hidden = true; });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { event.preventDefault(); input.focus(); }
  });
}
