// Home hero: cycles the HUD recreation through five stages. Pauses off-screen, on hover/focus and
// on request (WCAG 2.2.2). With reduced motion it never auto-advances; the tabs still work.
import { reducedMotion } from "./core.js";

const demo = document.querySelector("[data-hud-demo]");
if (demo) {
  const scene = demo.querySelector(".hud-scene");
  const tabs = [...demo.querySelectorAll("[data-stage-btn]")];
  const caption = demo.querySelector("[data-hud-caption]");
  const pause = demo.querySelector("[data-hud-pause]");
  const ability = demo.querySelector("[data-hud-ability]");
  const health = demo.querySelector("[data-hud-health]"), healthText = demo.querySelector("[data-hud-health-text]");
  const mana = demo.querySelector("[data-hud-mana]"), xp = demo.querySelector("[data-hud-xp]");
  const INTERVAL = 4800;
  const CAPTIONS = {
    tracker: ["Dungeon Tracker.", "Runs, chests, profit estimates and Catacombs XP per hour, with how far you are from your target level."],
    bars: ["Status bars, ability timer, skill XP.", "Separate health, mana, defense and speed bars around the hotbar, a held-item cooldown and XP progress."],
    bazaar: ["Bazaar Assistant.", "The next step in words, and a highlight only when exactly one button matches. You do the clicking."],
    party: ["Party Finder Matcher.", "Listings that do not fit your class or PB limit are marked. Nothing is hidden or clicked for you."],
    menu: ["The /sm menu.", "Six areas, search across every setting, and a switch for each feature."],
  };
  let index = 0, timer = 0, userPaused = reducedMotion(), hovering = false, visible = true, cooldown = 4, tick = 0;
  demo.style.setProperty("--hud-interval", `${INTERVAL}ms`);

  function show(i, focusTab = false) {
    index = (i + tabs.length) % tabs.length;
    const stage = tabs[index].dataset.stageBtn;
    scene.dataset.stage = stage;
    tabs.forEach((tab, n) => { tab.setAttribute("aria-selected", String(n === index)); tab.tabIndex = n === index ? 0 : -1; });
    // Restart the progress animation on the selected tab.
    const bar = tabs[index].querySelector(".progress"); bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
    caption.replaceChildren(Object.assign(document.createElement("strong"), { textContent: CAPTIONS[stage][0] }), " " + CAPTIONS[stage][1]);
    if (focusTab) tabs[index].focus();
    if (stage === "bars") { cooldown = 4; animateBars(); }
    schedule();
  }
  function animateBars() {
    health.style.setProperty("--fill", ".9"); mana.style.setProperty("--fill", ".77"); xp.style.setProperty("--xp", ".86");
    ability.textContent = "Cooldown: 4s"; ability.className = "r";
  }
  const running = () => !userPaused && !hovering && visible;
  function schedule() {
    clearTimeout(timer);
    demo.classList.toggle("is-paused", !running());
    if (running()) timer = setTimeout(() => show(index + 1), INTERVAL);
  }
  // A one-second tick drives the cooldown and the small bar changes while the "bars" stage is visible.
  setInterval(() => {
    if (!running() || scene.dataset.stage !== "bars") return;
    tick++;
    cooldown = Math.max(0, cooldown - 1);
    ability.textContent = cooldown ? `Cooldown: ${cooldown}s` : "Ability Ready!";
    ability.className = cooldown ? "r" : "g";
    health.style.setProperty("--fill", tick % 2 ? ".74" : ".9");
    healthText.textContent = tick % 2 ? "❤ 3,140 / 4,250" : "❤ 3,820 / 4,250";
  }, 1000);

  tabs.forEach((tab, n) => {
    tab.addEventListener("click", () => show(n));
    tab.addEventListener("keydown", event => {
      const move = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: tabs.length - 1 - n }[event.key];
      if (move !== undefined) { event.preventDefault(); show(n + move, true); }
    });
  });
  const setPaused = paused => {
    userPaused = paused;
    pause.setAttribute("aria-label", paused ? "Play the tour" : "Pause the tour");
    pause.innerHTML = paused ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z"/></svg>'
      : '<svg viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>';
    schedule();
  };
  pause.addEventListener("click", () => setPaused(!userPaused));
  demo.addEventListener("pointerenter", () => { hovering = true; schedule(); });
  demo.addEventListener("pointerleave", () => { hovering = false; schedule(); });
  demo.addEventListener("focusin", () => { hovering = true; schedule(); });
  demo.addEventListener("focusout", event => { if (!demo.contains(event.relatedTarget)) { hovering = false; schedule(); } });
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }, { threshold: .25 }).observe(scene);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; schedule(); });
  setPaused(userPaused);
  show(0);
}
