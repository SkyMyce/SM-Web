// Home hero: the HUD recreation is pinned and its five stages follow the scroll position. The tour
// buttons are real tabs: with motion they scroll to a stage, with reduced motion they switch it
// directly and the scene starts as one static composition. Nothing auto-advances (WCAG 2.2.2).
import { reducedMotion } from "./core.js";

const hero = document.querySelector("[data-hero]");
if (hero) {
  const scene = hero.querySelector(".hud-scene");
  const tabs = [...hero.querySelectorAll("[data-stage-btn]")];
  const caption = hero.querySelector("[data-hud-caption]");
  const hint = hero.querySelector("[data-hud-hint]");
  const ability = hero.querySelector("[data-hud-ability]");
  const health = hero.querySelector("[data-hud-health]"), mana = hero.querySelector("[data-hud-mana]"), xp = hero.querySelector("[data-hud-xp]");
  const CAPTIONS = {
    all: ["The HUD, as the mod draws it.", "Tracker, status bars, XP and the Bazaar Assistant, each a widget you can move in /sm hud."],
    tracker: ["Dungeon Tracker.", "Runs, chests, profit estimates and Catacombs XP per hour, with how far you are from your target level."],
    bars: ["Status bars, ability timer, skill XP.", "Separate health, mana, defense and speed bars around the hotbar, a held-item cooldown and XP progress."],
    bazaar: ["Bazaar Assistant.", "The next step in words, and a highlight only when exactly one button matches. You do the clicking."],
    party: ["Party Finder Matcher.", "Listings that do not fit your class or PB limit are marked. Nothing is hidden or clicked for you."],
    menu: ["The /sm menu.", "Six areas, search across every setting, and a switch for each feature."],
  };
  const motion = !reducedMotion();
  let index = -1, cooldownTimer = 0;

  function setStage(i) {
    index = i;
    const stage = i < 0 ? "all" : tabs[i].dataset.stageBtn;
    scene.dataset.stage = stage;
    tabs.forEach((tab, n) => { tab.setAttribute("aria-selected", String(n === i)); tab.tabIndex = n === i || (i < 0 && n === 0) ? 0 : -1; });
    caption.replaceChildren(Object.assign(document.createElement("strong"), { textContent: CAPTIONS[stage][0] }), " " + CAPTIONS[stage][1]);
    clearInterval(cooldownTimer);
    if (stage === "bars" || stage === "all") {
      health.style.setProperty("--fill", ".9"); mana.style.setProperty("--fill", ".77"); xp.style.setProperty("--xp", ".86");
      let cooldown = 4;
      ability.textContent = "Cooldown: 4s"; ability.className = "r";
      // A finite countdown: four ticks, then "Ability Ready!" and it stops.
      if (motion) cooldownTimer = setInterval(() => {
        cooldown--;
        ability.textContent = cooldown > 0 ? `Cooldown: ${cooldown}s` : "Ability Ready!";
        ability.className = cooldown > 0 ? "r" : "g";
        if (cooldown <= 0) clearInterval(cooldownTimer);
      }, 1000);
    }
  }

  // Scroll binding: progress through the pinned hero picks the stage.
  const span = () => Math.max(1, hero.offsetHeight - innerHeight);
  let ticking = false;
  function frame() {
    ticking = false;
    const p = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / span()));
    const i = Math.min(tabs.length - 1, Math.floor(p * tabs.length));
    if (i !== index) setStage(i);
    hint.hidden = p > .02;
  }
  if (motion) {
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
    addEventListener("resize", frame, { passive: true });
    frame();
  } else {
    hint.hidden = true;
    setStage(-1);
  }

  const go = (i, focus = false) => {
    i = (i + tabs.length) % tabs.length;
    if (motion) scrollTo({ top: hero.offsetTop + ((i + .5) / tabs.length) * span(), behavior: "smooth" });
    else setStage(i);
    if (focus) tabs[i].focus();
  };
  tabs.forEach((tab, n) => {
    tab.addEventListener("click", () => go(n));
    tab.addEventListener("keydown", event => {
      const target = { ArrowRight: n + 1, ArrowDown: n + 1, ArrowLeft: n - 1, ArrowUp: n - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (target !== undefined) { event.preventDefault(); go(target, true); }
    });
  });
}
