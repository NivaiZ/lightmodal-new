class DemoShowcaseApp {
  constructor() {
    this.lenis = null;
    this.lenisBadge = null;
  }

  init() {
    this.initLenis();
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
      });
    });

    const openStackBtn = document.getElementById("js-open-stack");
    openStackBtn?.addEventListener("click", async () => {
      await LightModal.open("#inline-simple", { theme: "light", width: 520 });
      await LightModal.open("assets/nasa/PIA25691.jpg", { theme: "dark" });
    });

    const openReplaceBtn = document.getElementById("js-open-replace");
    openReplaceBtn?.addEventListener("click", async () => {
      await LightModal.open("#inline-form", { theme: "light", width: 560 });
      await LightModal.open("assets/nasa/PIA17283.jpg", {
        closeExisting: true,
        theme: "dark",
        mainClass: "lm-fade",
      });
    });

    const openJsonBtn = document.getElementById("js-open-json");
    openJsonBtn?.addEventListener("click", async () => {
      await LightModal.open("demo/product.json", {
        type: "json",
        width: 720,
        theme: "light",
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

