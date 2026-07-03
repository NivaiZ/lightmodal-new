class DemoShowcaseApp {
  constructor() {
    this.lenis = null;
    this.lenisBadge = null;
  }

  init() {
    this.initLenis();
    this.initTapbar();
    this.initGlobalEvents();
    this.initButtons();
    this.initFormDemo();
  }

  initLenis() {
    if (typeof Lenis !== "function") return;

    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      smoothTouch: false,
    });

    window.lenisInstance = lenis;
    this.lenis = lenis;

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    this.lenisBadge = document.createElement("div");
    this.lenisBadge.style.cssText =
      "position:fixed;right:12px;bottom:12px;z-index:9999;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.55);color:#fff;font:12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;backdrop-filter:blur(10px)";
    document.body.appendChild(this.lenisBadge);

    window.setInterval(() => {
      this.lenisBadge.textContent = `Lenis: ${lenis.isStopped ? "stopped" : "running"}`;
    }, 150);

    this.lenisBadge.style.bottom = window.matchMedia("(max-width: 767px)").matches
      ? "calc(4.5rem + env(safe-area-inset-bottom, 0px))"
      : "12px";
  }

  initTapbar() {
    const tapbar = document.querySelector(".demo-tapbar");
    if (!tapbar) return;

    const links = [...tapbar.querySelectorAll(".demo-tapbar__link")];
    const sections = links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    const scrollToSection = (target) => {
      if (!target) return;
      if (this.lenis) {
        this.lenis.scrollTo(target, { offset: -12, duration: 0.9 });
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const id = link.getAttribute("href");
        const target = id ? document.querySelector(id) : null;
        if (!target) return;
        e.preventDefault();
        scrollToSection(target);
        history.replaceState(null, "", id);
      });
    });

    if (!sections.length || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;

        links.forEach((link) => {
          const active = link.getAttribute("href") === `#${visible.target.id}`;
          link.classList.toggle("is-active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      },
      {
        root: null,
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));
  }

  initGlobalEvents() {
    document.addEventListener("lightmodal:open", (e) => {
      // eslint-disable-next-line no-console
      console.log("[event] lightmodal:open", e.detail?.id);
    });

    document.addEventListener("lightmodal:close", (e) => {
      // eslint-disable-next-line no-console
      console.log("[event] lightmodal:close", e.detail?.id);
    });
  }

  initButtons() {
    const openImageBtn = document.getElementById("js-open-image");
    openImageBtn?.addEventListener("click", async () => {
      await LightModal.open("assets/nasa/PIA01341.jpg", {
        theme: "dark",
        width: "92vw",
        height: "80vh",
        closePosition: "absolute",
      });
    });

    const openStackBtn = document.getElementById("js-open-stack");
    openStackBtn?.addEventListener("click", async () => {
      await LightModal.open("#inline-simple", { theme: "light", width: 520, closePosition: "static" });
      await LightModal.open("assets/nasa/PIA25691.jpg", { theme: "dark", closePosition: "absolute" });
    });

    const openReplaceBtn = document.getElementById("js-open-replace");
    openReplaceBtn?.addEventListener("click", async () => {
      await LightModal.open("#inline-form", { theme: "light", width: 560, closePosition: "static" });
      await LightModal.open("assets/nasa/PIA17283.jpg", {
        closeExisting: true,
        theme: "dark",
        mainClass: "lm-fade",
        closePosition: "absolute",
      });
    });

    const openJsonBtn = document.getElementById("js-open-json");
    openJsonBtn?.addEventListener("click", async () => {
      await LightModal.open("demo/product.json", {
        type: "json",
        width: 720,
        theme: "light",
        closePosition: "static",
        ajaxSuccess(data) {
          const price = new Intl.NumberFormat("ru-RU").format(data.price);
          return `
            <div style="display:grid; gap:14px">
              <div style="display:grid; grid-template-columns: 140px 1fr; gap:14px; align-items:start">
                <img src="${data.image}" alt="${data.name}" style="width:140px;height:92px;object-fit:cover;border-radius:12px;border:1px solid rgba(0,0,0,.08)" />
                <div style="display:grid; gap:8px">
                  <div style="font-size:18px;font-weight:700">${data.name}</div>
                  <div style="opacity:.75">${data.description}</div>
                  <div style="font-weight:700">${price} ${data.currency}</div>
                </div>
              </div>
              <div style="border-top:1px solid rgba(0,0,0,.08); padding-top:12px">
                <div style="font-weight:650; margin-bottom:8px">Фичи</div>
                <ul style="margin:0; padding-left:18px; display:grid; gap:6px">
                  ${(data.features || []).map((f) => `<li>${f}</li>`).join("")}
                </ul>
              </div>
            </div>
          `;
        },
      });
    });
  }

  initFormDemo() {
    document.addEventListener("submit", async (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (!form.matches("[data-demo-form]")) return;

      e.preventDefault();
      e.stopPropagation();

      await LightModal.open("#inline-form-sent", {
        closeExisting: true,
        theme: "light",
        width: 520,
        closeOnBackdrop: false,
        closePosition: "static",
      });
    });
  }
}

// Bootstrap (works in plain <script> usage)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new DemoShowcaseApp().init());
} else {
  new DemoShowcaseApp().init();
}

