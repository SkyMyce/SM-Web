// Site-wide behaviour: nav, motion, copy buttons, media slots, lightbox, session chip.
import { copyText, h, reducedMotion } from "./core.js";
import { renderSessionSlot } from "./auth.js";

const root = document.documentElement;
const sda = CSS.supports("animation-timeline: view()");
// Elements already on screen are marked visible before .js hides the rest, so nothing above the fold flashes.
const inView = node => { const r = node.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
document.querySelectorAll(".reveal").forEach(node => { if (inView(node)) node.classList.add("is-in"); });
root.classList.replace("no-js", "js");
if (sda) root.classList.add("sda");

// ---------- Header: condense on scroll, mobile menu ----------
const header = document.querySelector("[data-header]");
if (header) {
  const toggle = header.querySelector("[data-nav-toggle]"), nav = header.querySelector("#site-nav");
  const setOpen = open => { toggle.setAttribute("aria-expanded", String(open)); nav.classList.toggle("is-open", open); document.body.style.overflow = open ? "hidden" : ""; };
  toggle?.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") { setOpen(false); toggle.focus(); } });
  matchMedia("(min-width: 921px)").addEventListener("change", event => { if (event.matches) setOpen(false); });
}

// ---------- Scroll progress chip in the pill ----------
const progress = document.querySelector("[data-progress]");
if (progress) {
  let busy = false;
  const update = () => { busy = false; const max = document.documentElement.scrollHeight - innerHeight; progress.textContent = `${max > 0 ? Math.round(scrollY / max * 100) : 0}%`; };
  addEventListener("scroll", () => { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

// ---------- Copy buttons ----------
function addCopy(target, getText, label = "Copy") {
  const button = target.querySelector(".copy-btn") ?? target.appendChild(h("button", { class: "copy-btn", type: "button" }, "Copy"));
  button.setAttribute("aria-label", `${label}: ${getText().slice(0, 60)}`);
  button.addEventListener("click", async () => {
    const ok = await copyText(getText());
    button.textContent = ok ? "Copied" : "Press Ctrl+C"; button.dataset.state = ok ? "done" : "";
    setTimeout(() => { button.textContent = "Copy"; delete button.dataset.state; }, 1600);
  });
}
document.querySelectorAll(".code").forEach(block => addCopy(block, () => block.querySelector("pre").textContent.trim(), "Copy code"));
document.querySelectorAll(".cmd[data-copy]").forEach(chip => addCopy(chip, () => chip.dataset.copy, "Copy command"));

// ---------- Reveal fallback (no scroll-driven animations) ----------
const reveals = [...document.querySelectorAll(".reveal")];
document.querySelectorAll("[data-stagger]").forEach(group => [...group.children].forEach((child, i) => child.style.setProperty("--stagger", i)));
if (!sda && reveals.length) {
  if (reducedMotion()) reveals.forEach(node => node.classList.add("is-in"));
  else {
    const io = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); } }), { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(node => io.observe(node));
  }
}

// ---------- Scroll-scrubbed pins + parallax fallback (one rAF loop, transform/opacity only) ----------
const pins = [...document.querySelectorAll("[data-pin]")];
const parallax = sda ? [] : [...document.querySelectorAll(".parallax")];
let ticking = false;
function frame() {
  ticking = false;
  const vh = innerHeight;
  for (const pin of pins) {
    const rect = pin.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > vh) continue;
    const span = Math.max(1, rect.height - vh);
    const p = Math.min(1, Math.max(0, -rect.top / (span * .8)));
    pin.style.setProperty("--p", p.toFixed(4));
  }
  for (const node of parallax) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < -200 || rect.top > vh + 200) continue;
    const t = (rect.top + rect.height / 2 - vh / 2) / vh;
    node.style.setProperty("--parallax-y", `${(-t * 60).toFixed(1)}px`);
  }
}
if (!reducedMotion() && (pins.length || parallax.length)) {
  pins.forEach(pin => pin.style.setProperty("--p", "0"));
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  addEventListener("resize", frame, { passive: true });
  frame();
}

// ---------- Count-ups (only real, sourced numbers carry data-count) ----------
const counters = document.querySelectorAll("[data-count]");
if (counters.length) {
  const io = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    io.unobserve(entry.target);
    const node = entry.target, end = Number(node.dataset.count);
    if (reducedMotion() || !end) { node.textContent = node.dataset.count; return; }
    const start = performance.now(), dur = 1100;
    const step = now => { const k = Math.min(1, (now - start) / dur); node.textContent = String(Math.round(end * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), { threshold: .6 });
  counters.forEach(node => io.observe(node));
}

// ---------- Magnetic buttons (fine pointers only) ----------
if (!reducedMotion() && matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll(".btn--magnetic").forEach(button => {
    button.addEventListener("pointermove", event => {
      const r = button.getBoundingClientRect();
      button.style.transform = `translate(${((event.clientX - r.left) / r.width - .5) * 8}px, ${((event.clientY - r.top) / r.height - .5) * 6}px)`;
    });
    button.addEventListener("pointerleave", () => { button.style.transform = ""; });
  });
}

// ---------- Media slots: autoplay clips in view, lightbox ----------
const videos = document.querySelectorAll("video[data-autoplay]");
if (videos.length && !reducedMotion()) {
  const io = new IntersectionObserver(entries => entries.forEach(entry => { const v = entry.target; if (entry.isIntersecting) v.play().catch(() => {}); else v.pause(); }), { threshold: .4 });
  videos.forEach(v => io.observe(v));
}
const lightbox = document.querySelector("[data-lightbox-root]");
let lastFocus = null;
function closeLightbox() { lightbox.hidden = true; lightbox.replaceChildren(); document.body.style.overflow = ""; lastFocus?.focus(); }
document.addEventListener("click", event => {
  const trigger = event.target.closest("[data-lightbox]");
  if (!trigger || !lightbox) return;
  const media = trigger.querySelector("img, video");
  if (!media) return;
  lastFocus = trigger;
  const copy = media.cloneNode(true);
  copy.removeAttribute("loading");
  if (copy.tagName === "VIDEO") { copy.controls = true; copy.preload = "metadata"; }
  const close = h("button", { class: "btn btn--sm lightbox__close", type: "button" }, "Close");
  close.addEventListener("click", closeLightbox);
  lightbox.replaceChildren(close, copy);
  lightbox.setAttribute("role", "dialog"); lightbox.setAttribute("aria-modal", "true"); lightbox.setAttribute("aria-label", media.getAttribute("alt") ?? media.getAttribute("aria-label") ?? "Media");
  lightbox.hidden = false; document.body.style.overflow = "hidden"; close.focus();
});
lightbox?.addEventListener("click", event => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener("keydown", event => {
  if (!lightbox || lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "Tab") { event.preventDefault(); lightbox.querySelector("button")?.focus(); }
});

// ---------- Session chip + docs ----------
renderSessionSlot(document.querySelector("[data-session-slot]"));
if (document.querySelector(".docs-layout")) import("./docs.js");
