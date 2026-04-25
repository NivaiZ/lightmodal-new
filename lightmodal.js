(function () {
	'use strict';

	// ─── Utilities ───────────────────────────────────────────────────────────────
	const h = (tag, cls = '') => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		return n;
	};

	const merge = (target, ...sources) => {
		for (const source of sources) {
			if (!source) continue;
			for (const key in source) {
				const val = source[key];
				if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Element)) {
					target[key] = target[key] || {};
					merge(target[key], val);
				} else {
					target[key] = val;
				}
			}
		}
		return target;
	};

	// ─── Regexes ─────────────────────────────────────────────────────────────────
	const IMG_RE = /\.(png|jpe?g|webp|avif|gif|svg)(\?.*)?$/i;
	const VIDEO_RE = /\.(mp4|webm|ogg|m4v)(\?.*)?$/i;
	const YOUTUBE_RE = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&#?]{11})/;
	const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;
	const RUTUBE_RE = /rutube\.ru\/(?:video\/|play\/embed\/)([a-zA-Z0-9]+)/;
	const VK_RE = /vk\.com\/(?:video_ext\.php\?oid=(-?\d+)&id=(\d+)|video(-?\d+)_(\d+))/;

	const isImg = (type, src) => type === 'image' || (!type && IMG_RE.test(src));
	const isVideo = (type, src) => type === 'video' || (!type && VIDEO_RE.test(src));
	const getYouTubeId = url => (url.match(YOUTUBE_RE) || [])[1];
	const getVimeoId = url => (url.match(VIMEO_RE) || [])[1];
	const getRutubeId = url => (url.match(RUTUBE_RE) || [])[1];
	const getVkVideoId = url => {
		const m = url.match(VK_RE);
		if (!m) return null;
		return m[1] && m[2]
			? { oid: m[1], id: m[2] }
			: m[3] && m[4]
				? { oid: m[3], id: m[4] }
				: null;
	};

	const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

	// Cross-browser Fullscreen API (handles webkit/moz/ms prefixes, Safari, etc.)
	const fsAPI = (() => {
		const candidates = [
			{ req: 'requestFullscreen',       exit: 'exitFullscreen',       elem: 'fullscreenElement',       enabled: 'fullscreenEnabled',       change: 'fullscreenchange',       error: 'fullscreenerror'       },
			{ req: 'webkitRequestFullscreen',  exit: 'webkitExitFullscreen',  elem: 'webkitFullscreenElement',  enabled: 'webkitFullscreenEnabled',  change: 'webkitfullscreenchange',  error: 'webkitfullscreenerror'  },
			{ req: 'mozRequestFullScreen',     exit: 'mozCancelFullScreen',   elem: 'mozFullScreenElement',     enabled: 'mozFullScreenEnabled',     change: 'mozfullscreenchange',     error: 'mozfullscreenerror'     },
			{ req: 'msRequestFullscreen',      exit: 'msExitFullscreen',      elem: 'msFullscreenElement',      enabled: 'msFullscreenEnabled',      change: 'MSFullscreenChange',      error: 'MSFullscreenError'      },
		];
		const api = candidates.find(v => v.req in document.documentElement);
		if (!api) return null;
		return {
			request: (el, opts) => {
				const fn = el[api.req];
				if (!fn) return Promise.reject(new Error('not supported'));
				// webkit doesn't support the options argument
				try { return fn.call(el, api.req.startsWith('webkit') ? undefined : opts) || Promise.resolve(); }
				catch (e) { return Promise.reject(e); }
			},
			exit: () => {
				const fn = document[api.exit];
				if (!fn) return Promise.resolve();
				try { return fn.call(document) || Promise.resolve(); }
				catch (e) { return Promise.reject(e); }
			},
			get element() { return document[api.elem]; },
			get enabled() { return !!document[api.enabled]; },
			change: api.change,
			error: api.error,
		};
	})();

	const getScrollableParent = (node, boundary) => {
		while (node && node !== boundary) {
			const ov = window.getComputedStyle(node).overflowY;
			if ((ov === 'auto' || ov === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
			node = node.parentElement;
		}
		return null;
	};

	const LOAD_TIMEOUT = 10_000;
	const AJAX_TIMEOUT = 30_000;
	const States = { Init: 0, Ready: 1, Closing: 2, Destroyed: 3 };

	// ─── HTML Sanitizer ──────────────────────────────────────────────────────────
	// Базовая защита AJAX-ответа: удаляет <script>, <style>, on*-атрибуты
	// и javascript:-ссылки. Это не замена DOMPurify — для недоверенных источников
	// используйте DOMPurify вручную в ajaxSuccess.
	const sanitizeAjaxHtml = (html) => {
		const tmp = document.createElement('template');
		tmp.innerHTML = html;
		const frag = tmp.content;

		frag.querySelectorAll('script, style').forEach(el => el.remove());

		const walker = document.createTreeWalker(frag, NodeFilter.SHOW_ELEMENT);
		let node;
		while ((node = walker.nextNode())) {
			for (const attr of [...node.attributes]) {
				const name = attr.name.toLowerCase();
				if (name.startsWith('on')) {
					node.removeAttribute(attr.name);
				} else if ((name === 'href' || name === 'src') &&
					/^\s*javascript:/i.test(attr.value)) {
					node.removeAttribute(attr.name);
				}
			}
		}
		return frag;
	};

	// ─── Lenis Adapter ───────────────────────────────────────────────────────────
	// Автоматически обнаруживает Lenis по классу .lenis на <html> (Lenis сам
	// его добавляет) и ищет инстанс в типичных местах размещения.
	const lenisAdapter = {
		_cached: null,
		_cacheTime: 0,
		CACHE_TTL: 1000,

		detect() {
			const now = Date.now();
			if (this._cached && now - this._cacheTime < this.CACHE_TTL) {
				return this._cached;
			}

			if (!document.documentElement.classList.contains('lenis')) {
				this._cached = null;
				this._cacheTime = now;
				return null;
			}

			const candidates = [
				window.lenis,
				window.lenisInstance,
				window.__lenis,
				window.__lenis__,
				window.smoothScroll,
				window.app?.lenis,
				window.App?.lenis
			];

			for (const inst of candidates) {
				if (this._isValidInstance(inst)) {
					this._cached = inst;
					this._cacheTime = now;
					return inst;
				}
			}

			this._cached = null;
			this._cacheTime = now;
			return null;
		},

		_isValidInstance(obj) {
			return (
				obj &&
				typeof obj === 'object' &&
				typeof obj.stop === 'function' &&
				typeof obj.start === 'function' &&
				'isStopped' in obj
			);
		},

		stop() {
			const lenis = this.detect();
			if (lenis && !lenis.isStopped) {
				lenis.stop();
				return true;
			}
			return false;
		},

		start() {
			const lenis = this.detect();
			if (lenis && lenis.isStopped) {
				lenis.start();
				return true;
			}
			return false;
		},

		getScrollY() {
			const lenis = this.detect();
			if (lenis && typeof lenis.scroll === 'number') return lenis.scroll;
			return window.scrollY || window.pageYOffset || 0;
		},

		scrollTo(y) {
			const lenis = this.detect();
			if (lenis && typeof lenis.scrollTo === 'function') {
				lenis.scrollTo(y, { immediate: true, force: true });
			} else {
				window.scrollTo({ top: y, behavior: 'instant' });
			}
		},

		invalidate() {
			this._cached = null;
			this._cacheTime = 0;
		}
	};

	// ─── Scroll Lock ─────────────────────────────────────────────────────────────
	const scrollLock = {
		lockCount: 0,
		scrollbarWidth: 0,
		savedScrollY: 0,
		lenisWasActive: false,

		_calcScrollbarWidth() {
			return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
		},

		lock() {
			this.lockCount++;
			if (this.lockCount > 1) return;

			this.scrollbarWidth = this._calcScrollbarWidth();
			this.savedScrollY = lenisAdapter.getScrollY();
			this.lenisWasActive = lenisAdapter.stop();

			const body = document.body;
			const html = document.documentElement;
			const sbw = this.scrollbarWidth;

			html.style.setProperty('--lm-scrollbar-compensate', `${sbw}px`);
			html.classList.add('lm-scroll-locked');

			const origMargin = parseFloat(window.getComputedStyle(body).marginRight) || 0;
			html.style.setProperty('--lm-body-margin', `${origMargin}px`);

			// Fancybox-like: don't fix the body; lock scroll via overflow + scrollbar compensation.
			body.classList.add('lm-scroll-locked-body');
		},

		unlock() {
			this.lockCount = Math.max(0, this.lockCount - 1);
			if (this.lockCount > 0) return;

			const body = document.body;
			const html = document.documentElement;

			body.classList.remove('lm-scroll-locked-body');

			html.classList.remove('lm-scroll-locked');
			html.style.removeProperty('--lm-scrollbar-compensate');
			html.style.removeProperty('--lm-body-margin');

			// Keep behavior consistent with Lenis adapter (and restore potential minor jumps).
			lenisAdapter.scrollTo(this.savedScrollY);

			if (this.lenisWasActive) {
				lenisAdapter.start();
				this.lenisWasActive = false;
			}

			this.savedScrollY = 0;
			this.scrollbarWidth = 0;
		}
	};

	// ─── Focus trap ──────────────────────────────────────────────────────────────
	const trapFocus = (container) => {
		const sel = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

		const getFocusables = () => Array.from(container.querySelectorAll(sel))
			.filter(el => !el.disabled && el.offsetParent !== null);

		const onTab = (e) => {
			if (e.key !== 'Tab') return;
			const els = getFocusables();
			if (!els.length) return;
			const first = els[0];
			const last = els[els.length - 1];

			if (e.shiftKey) {
				if (document.activeElement === first || !container.contains(document.activeElement)) {
					last.focus();
					e.preventDefault();
				}
			} else {
				if (document.activeElement === last) {
					first.focus();
					e.preventDefault();
				}
			}
		};

		container.addEventListener('keydown', onTab);
		const focusables = getFocusables();
		focusables[0]?.focus();
		return () => container.removeEventListener('keydown', onTab);
	};

	// ─── Главный класс ───────────────────────────────────────────────────────────
	class LightModal {
		static instances = new Map();
		static instanceCounter = 0;
		static currentInstance = null;
		static _globalPlugins = [];

		static defaults = {
			mainClass: '',
			theme: 'dark',

			closeButton: true,
			closeOnBackdrop: true,
			closeOnEsc: true,
			closeExisting: false,

			// Галерея
			galleryNav: true,
			gallerySwipe: true,
			loop: false,

			openSpeed: 366,
			closeSpeed: 366,

			dragToClose: true,
			autoFocus: true,
			restoreFocus: true,
			hideScrollbar: true,

			idle: 3000,

			// i18n
			closeLabel: 'Закрыть',
			prevLabel: 'Назад',
			nextLabel: 'Вперёд',

			spinnerTpl: '<div class="lm-spinner"></div>',
			errorTpl: '<div class="lm-error">{{message}}</div>',
			closeBtnTpl: null,
			prevBtnTpl: null,
			nextBtnTpl: null,

			width: null,
			height: null,

			// AJAX
			fetchOptions: null,
			ajaxSelector: null,
			ajaxSuccess: null,

			// Bottom sheet
			bottomSheet: false,

			// Custom background (CSS color value)
			customBackground: null,

			// Auto-reset form on successful AJAX submit
			formAutoReset: true,

			// Keyboard mapping — key → action name
			keyboard: {
				Escape: 'close',
				ArrowLeft: 'prev',
				ArrowRight: 'next',
				f: 'fullscreen',
				'+': 'zoomIn',
				'=': 'zoomIn',
				'-': 'zoomOut',
				'0': 'zoomReset',
			},

			// Plugin system
			plugins: [],

			// Toolbar
			toolbar: false,
			toolbarItems: ['prev', 'counter', 'next', 'zoom', 'fullscreen', 'close'],
			fullscreenLabel: 'Fullscreen',
			exitFullscreenLabel: 'Exit fullscreen',

			// Fullscreen
			fullscreen: false,

			// Zoom for images (double-click, wheel, pinch)
			zoom: false,
			zoomMin: 1,
			zoomMax: 4,
			zoomStep: 0.5,

			// AJAX
			sanitize: true,        // true | false | (html) => DocumentFragment
			ajaxTransform: null,   // (text, instance) => string | Element | null
			ajaxError: null,       // (err, instance) => Element | string | null
			ajaxTimeout: 30_000,
			loadTimeout: 10_000,

			on: {}
		};

		constructor(items, options = {}) {
			if (!Array.isArray(items)) items = [items];
			this.items = items.map(i => typeof i === 'string' ? { src: i } : i);
			this.options = merge({}, LightModal.defaults, options);
			this.state = States.Init;
			this.id = `lm-${++LightModal.instanceCounter}`;
			this.currentIndex = Math.min(
				Math.max(0, this.options.startIndex || 0),
				Math.max(0, this.items.length - 1)
			);

			this.container = null;
			this.backdrop = null;
			this.contentWrapper = null;
			this.content = null;
			this.closeBtn = null;
			this.prevBtn = null;
			this.nextBtn = null;
			this.useDialog = false;

			this.isIdle = false;
			this.idleTimer = null;
			this.previousFocus = null;
			this.removeFocusTrap = null;
			this.movedElement = null;

			this._prevSrcAdd = null;
			this._loadToken = null;
			this._justDraggedTimer = null;
			this._justDragged = false;
			this._ajaxController = null;

			this.toolbar = null;
			this.toolbarCounter = null;
			this._fullscreenBtn = null;
			this._zoomBtn = null;
			this._fullscreenHandler = null;
			this._isFullscreen = false;
			this._pluginCleanups = [];
			this._zoomCleanup = null;
			this._zoomActive = false;

			this.events = new Map();
			this.init();
		}

		get isGallery() {
			return this.items.length > 1;
		}

		init() {
			LightModal.instances.set(this.id, this);
			LightModal.currentInstance = this;
			this._setupPlugins();
			this.createDOM();
			this.loadContent(this.items[this.currentIndex]);
			this.open();
			this.emit('init');
		}

		createDOM() {
			this.useDialog = 'HTMLDialogElement' in window;
			this.container = this.useDialog ? document.createElement('dialog') : h('div');
			this.container.className = 'lm-container';
			this.container.setAttribute('id', this.id);
			this.container.setAttribute('role', 'dialog');
			this.container.setAttribute('aria-modal', 'true');

			if (this.isGallery) this.container.classList.add('is-gallery');
			if (this.options.bottomSheet) this.container.classList.add('is-bottom-sheet');

			const theme = this.options.theme;
			this.container.setAttribute('data-theme',
				theme === 'auto'
					? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
					: theme
			);

			this.backdrop = h('div', 'lm-backdrop');
			this.contentWrapper = h('div', 'lm-content-wrapper');
			// data-lenis-prevent разрешает нативный скролл внутри модалки при активном Lenis
			this.contentWrapper.setAttribute('data-lenis-prevent', '');

			if (this.options.customBackground) {
				this.contentWrapper.style.setProperty('--lm-bg', this.options.customBackground);
			}

			if ((isTouchDevice() || this.options.bottomSheet) && this.options.dragToClose) {
				const drag = h('div', 'lm-drag-indicator');
				this.contentWrapper.appendChild(drag);
				if (isTouchDevice()) this.container.classList.add('is-touch');
			}

			if (this.options.toolbar) {
				this._createToolbar();
				this.contentWrapper.appendChild(this.toolbar);
				this.container.classList.add('has-toolbar');
			} else {
				if (this.options.closeButton) {
					this.closeBtn = this._createCloseButton();
					this.contentWrapper.appendChild(this.closeBtn);
				}
			}

			this.content = h('div', 'lm-content');
			this.contentWrapper.appendChild(this.content);

			if (!this.options.toolbar) {
				if (this.isGallery && this.options.galleryNav) {
					this.prevBtn = this._createNavButton('prev');
					this.nextBtn = this._createNavButton('next');
					this.container.appendChild(this.prevBtn);
					this.container.appendChild(this.nextBtn);
				}
			}

			this.container.appendChild(this.backdrop);
			this.container.appendChild(this.contentWrapper);

			if (this.options.mainClass) this.container.classList.add(this.options.mainClass);

			if (this.options.width) {
				this.contentWrapper.style.maxWidth =
					typeof this.options.width === 'number' ? `${this.options.width}px` : this.options.width;
			}
			if (this.options.height) {
				this.contentWrapper.style.maxHeight =
					typeof this.options.height === 'number' ? `${this.options.height}px` : this.options.height;
			}

			document.body.appendChild(this.container);
			this.attachEvents();
			this._updateNavButtons();
		}

		_createCloseButton() {
			if (this.options.closeBtnTpl) {
				const tmp = h('div');
				tmp.innerHTML = this.options.closeBtnTpl;
				return tmp.firstElementChild;
			}
			const btn = h('button', 'lm-close-btn');
			btn.type = 'button';
			btn.setAttribute('aria-label', this.options.closeLabel);
			btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
			return btn;
		}

		_createNavButton(direction) {
			const tplKey = direction === 'prev' ? 'prevBtnTpl' : 'nextBtnTpl';
			const labelKey = direction === 'prev' ? 'prevLabel' : 'nextLabel';

			if (this.options[tplKey]) {
				const tmp = h('div');
				tmp.innerHTML = this.options[tplKey];
				return tmp.firstElementChild;
			}
			const btn = h('button', `lm-nav-btn lm-nav-${direction}`);
			btn.type = 'button';
			btn.setAttribute('aria-label', this.options[labelKey]);
			const path = direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6';
			btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
			return btn;
		}

		_createToolbar() {
			this.toolbar = h('div', 'lm-toolbar');

			for (const item of this.options.toolbarItems) {
				switch (item) {
					case 'close':
						if (this.options.closeButton) {
							this.closeBtn = this._createCloseButton();
							this.toolbar.appendChild(this.closeBtn);
						}
						break;
					case 'prev':
						if (this.isGallery && this.options.galleryNav) {
							this.prevBtn = this._createNavButton('prev');
							this.toolbar.appendChild(this.prevBtn);
						}
						break;
					case 'counter':
						if (this.isGallery) {
							this.toolbarCounter = h('span', 'lm-toolbar-counter');
							this.toolbarCounter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
							this.toolbar.appendChild(this.toolbarCounter);
						}
						break;
					case 'next':
						if (this.isGallery && this.options.galleryNav) {
							this.nextBtn = this._createNavButton('next');
							this.toolbar.appendChild(this.nextBtn);
						}
						break;
					case 'fullscreen':
						if (this.options.fullscreen) {
							this._fullscreenBtn = this._createFullscreenButton();
							this.toolbar.appendChild(this._fullscreenBtn);
						}
						break;
					case 'zoom':
						if (this.options.zoom) {
							this._zoomBtn = this._createZoomButton();
							this._zoomBtn.style.display = 'none';
							this.toolbar.appendChild(this._zoomBtn);
						}
						break;
				}
			}
		}

		_createFullscreenButton() {
			const btn = h('button', 'lm-toolbar-btn lm-fullscreen-btn');
			btn.type = 'button';
			btn.setAttribute('aria-label', this.options.fullscreenLabel);
			btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
				<path class="lm-icon-expand" d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/>
				<path class="lm-icon-shrink" style="display:none" d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M8 21v-3a2 2 0 00-2-2H3M21 16h-3a2 2 0 00-2 2v3"/>
			</svg>`;
			btn.addEventListener('click', () => this._toggleFullscreen());
			return btn;
		}

		_createZoomButton() {
			const btn = h('button', 'lm-toolbar-btn lm-zoom-btn');
			btn.type = 'button';
			btn.setAttribute('aria-label', 'Zoom');
			btn.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">
				<circle cx="11" cy="11" r="8"/>
				<path class="lm-icon-zoom-in" d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
				<path class="lm-icon-zoom-out" style="display:none" d="M21 21l-4.35-4.35M8 11h6"/>
			</svg>`;
			btn.addEventListener('click', () => {
				if (this._zoomActive) this._zoomReset?.();
				else this._zoomBy?.(this.options.zoomStep * 2);
			});
			return btn;
		}

		_updateNavButtons() {
			if (!this.isGallery || !this.options.galleryNav) return;
			if (this.options.loop) {
				this.prevBtn?.removeAttribute('disabled');
				this.nextBtn?.removeAttribute('disabled');
			} else {
				if (this.currentIndex === 0) this.prevBtn?.setAttribute('disabled', '');
				else this.prevBtn?.removeAttribute('disabled');
				if (this.currentIndex === this.items.length - 1) this.nextBtn?.setAttribute('disabled', '');
				else this.nextBtn?.removeAttribute('disabled');
			}
			if (this.toolbarCounter) {
				this.toolbarCounter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
			}
		}

		attachEvents() {
			if (this.options.closeOnBackdrop) {
				this.backdrop.addEventListener('click', () => {
					if (this._justDragged) return;
					this.close();
				});
			}

			if (this.closeBtn) {
				this.closeBtn.addEventListener('click', () => this.close());
			}

			if (this.prevBtn) {
				this.prevBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.prev();
				});
			}
			if (this.nextBtn) {
				this.nextBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.next();
				});
			}

			this._keydownHandler = this.handleKeydown.bind(this);
			document.addEventListener('keydown', this._keydownHandler);

			if (this.useDialog) {
				this._cancelHandler = (e) => {
					e.preventDefault();
					if (this.options.closeOnEsc) this.close();
				};
				this.container.addEventListener('cancel', this._cancelHandler);
			}

			if (this.options.dragToClose) this.setupDragToClose();
			if (this.options.idle) this.setupIdleMode();

			if (this.options.fullscreen && fsAPI) {
				this._fullscreenHandler = () => {
					const isFs = !!fsAPI.element;
					this._isFullscreen = isFs;
					this.container.classList.toggle('is-fullscreen', isFs);
					if (this._fullscreenBtn) {
						this._fullscreenBtn.setAttribute('aria-label',
							isFs ? this.options.exitFullscreenLabel : this.options.fullscreenLabel);
						this._fullscreenBtn.querySelector('.lm-icon-expand')?.style.setProperty('display', isFs ? 'none' : '');
						this._fullscreenBtn.querySelector('.lm-icon-shrink')?.style.setProperty('display', isFs ? '' : 'none');
					}
				};
				document.addEventListener(fsAPI.change, this._fullscreenHandler);
			}
		}

		handleKeydown(e) {
			if (this.state !== States.Ready) return;
			if (LightModal.currentInstance !== this) return;

			const map = this.options.keyboard;
			if (!map) return;
			const action = map[e.key];
			if (!action) return;

			switch (action) {
				case 'close':
					if (!this.options.closeOnEsc) return;
					e.preventDefault();
					this.close();
					break;
				case 'prev':
					if (!this.isGallery) return;
					e.preventDefault();
					this.prev();
					break;
				case 'next':
					if (!this.isGallery) return;
					e.preventDefault();
					this.next();
					break;
				case 'fullscreen':
					if (!this.options.fullscreen) return;
					e.preventDefault();
					this._toggleFullscreen();
					break;
				case 'zoomIn':
					e.preventDefault();
					this._zoomBy?.(this.options.zoomStep);
					break;
				case 'zoomOut':
					e.preventDefault();
					this._zoomBy?.(-this.options.zoomStep);
					break;
				case 'zoomReset':
					e.preventDefault();
					this._zoomReset?.();
					break;
			}
		}

		setupDragToClose() {
			let startY = 0, currentY = 0, startX = 0, currentX = 0;
			let isDragging = false, dragAxis = null, isMouseDown = false;
			let scrollableAncestor = null;

			const coords = (e) => {
				if (e.touches?.[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
				if (e.changedTouches?.[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
				return { x: e.clientX, y: e.clientY };
			};

			const onStart = (e) => {
				if (e.target.closest('button, a, input, textarea, select, [contenteditable], iframe, video')) return;
				const c = coords(e);
				startX = currentX = c.x;
				startY = currentY = c.y;
				isDragging = false;
				dragAxis = null;
				scrollableAncestor = null;
				if (e.type === 'touchstart') {
					scrollableAncestor = getScrollableParent(e.target, this.contentWrapper);
				}
				if (e.type === 'mousedown') {
					e.preventDefault();
					isMouseDown = true;
					this.contentWrapper.style.cursor = 'grabbing';
				}
			};

			const onMove = (e) => {
				if (e.type === 'mousemove' && !isMouseDown) return;
				if (!startY && !startX) return;
				const c = coords(e);
				currentX = c.x;
				currentY = c.y;
				const dx = currentX - startX, dy = currentY - startY;

				if (!isDragging && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
					// Мобилка: уступаем нативному скроллу если внутри скроллируемого элемента
					if (scrollableAncestor && Math.abs(dy) >= Math.abs(dx)) {
						const atTop = scrollableAncestor.scrollTop <= 1;
						const atBottom = scrollableAncestor.scrollTop + scrollableAncestor.clientHeight >= scrollableAncestor.scrollHeight - 1;
						if (dy > 0 && !atTop) return;
						if (dy < 0 && !atBottom) return;
					}
					isDragging = true;
					dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
					this.contentWrapper.classList.add('is-dragging');
					if (e.type === 'mousemove') {
						e.preventDefault();
						document.body.style.userSelect = 'none';
					}
				}

				if (!isDragging) return;

				// Блокируем нативный скролл страницы пока drag-to-close активен
				if (dragAxis === 'y' && e.cancelable) e.preventDefault();

				if (dragAxis === 'y') {
					// Для bottom sheet — сопротивление при свайпе вверх
					const effectiveDy = this.options.bottomSheet ? Math.max(-24, dy) : dy;
					const p = Math.min(Math.abs(effectiveDy) / 200, 1);
					this.contentWrapper.style.transform = `translateY(${effectiveDy}px)`;
					this.contentWrapper.style.opacity = 1 - p * 0.3;
					this.backdrop.style.opacity = 1 - p * 0.5;
				} else if (dragAxis === 'x' && this.isGallery && this.options.gallerySwipe) {
					// Горизонталь в галерее — превью переключения
					const p = Math.min(Math.abs(dx) / 300, 1);
					this.contentWrapper.style.transform = `translateX(${dx * 0.3}px)`;
					this.contentWrapper.style.opacity = 1 - p * 0.2;
				}
			};

			const onEnd = (e) => {
				if ((e.type === 'mouseup' || e.type === 'mouseleave') && !isMouseDown) return;
				isMouseDown = false;
				this.contentWrapper.style.cursor = '';
				document.body.style.userSelect = '';

				if (!isDragging) {
					startX = startY = currentX = currentY = 0;
					return;
				}

				this._justDragged = true;
				clearTimeout(this._justDraggedTimer);
				this._justDraggedTimer = setTimeout(() => {
					this._justDragged = false;
					this._justDraggedTimer = null;
				}, 300);

				const dx = currentX - startX;
				const dy = currentY - startY;
				this.contentWrapper.classList.remove('is-dragging', 'is-draggable');

				const closeThreshold = this.options.bottomSheet ? 150 : 100;
				const closeVertical = dragAxis === 'y' && dy > closeThreshold;
				const swipeHorizontal = dragAxis === 'x'
					&& this.isGallery
					&& this.options.gallerySwipe
					&& Math.abs(dx) > 80;

				if (closeVertical) {
					this.contentWrapper.classList.add('lm-throw-out-down');
					setTimeout(() => this.close(), 200);
				} else if (swipeHorizontal) {
					this.contentWrapper.style.transition = 'all 0.2s ease-out';
					this.contentWrapper.style.transform = '';
					this.contentWrapper.style.opacity = '';
					setTimeout(() => {
						if (this.contentWrapper) this.contentWrapper.style.transition = '';
					}, 200);
					if (dx > 0) this.prev();
					else this.next();
				} else {
					// Spring snap back — для bottom sheet используем spring cubic-bezier
					const easing = this.options.bottomSheet
						? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
						: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
					const dur = this.options.bottomSheet ? '0.5s' : '0.3s';
					this.contentWrapper.style.transition = `all ${dur} ${easing}`;
					this.contentWrapper.style.transform = '';
					this.contentWrapper.style.opacity = '';
					this.backdrop.style.opacity = '';
					setTimeout(() => {
						if (this.contentWrapper) this.contentWrapper.style.transition = '';
					}, this.options.bottomSheet ? 500 : 300);
				}

				startX = startY = currentX = currentY = 0;
				isDragging = false;
				dragAxis = null;
			};

			this.contentWrapper.addEventListener('touchstart', onStart, { passive: false });
			this.contentWrapper.addEventListener('touchmove', onMove, { passive: false });
			this.contentWrapper.addEventListener('touchend', onEnd, { passive: true });
			this.contentWrapper.addEventListener('touchcancel', onEnd, { passive: true });
			this.contentWrapper.addEventListener('mousedown', onStart);
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onEnd);
			document.addEventListener('mouseleave', onEnd);

			this._dragCleanup = () => {
				this.contentWrapper.removeEventListener('touchstart', onStart);
				this.contentWrapper.removeEventListener('touchmove', onMove);
				this.contentWrapper.removeEventListener('touchend', onEnd);
				this.contentWrapper.removeEventListener('touchcancel', onEnd);
				this.contentWrapper.removeEventListener('mousedown', onStart);
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onEnd);
				document.removeEventListener('mouseleave', onEnd);
			};
		}

		setupIdleMode() {
			const resetIdle = () => {
				clearTimeout(this.idleTimer);
				if (this.isIdle) {
					this.isIdle = false;
					this.container.classList.remove('is-idle');
				}
				this.idleTimer = setTimeout(() => {
					this.isIdle = true;
					this.container.classList.add('is-idle');
				}, this.options.idle);
			};

			const evts = ['mousemove', 'touchstart', 'keydown', 'pointerdown'];
			evts.forEach(ev => document.addEventListener(ev, resetIdle, { passive: true }));
			resetIdle();

			this._idleCleanup = () => {
				evts.forEach(ev => document.removeEventListener(ev, resetIdle));
				clearTimeout(this.idleTimer);
			};
		}

		async _fetchAjax(src, item) {
			if (this._ajaxController) {
				try { this._ajaxController.abort(); } catch (_) { /* noop */ }
			}
			this._ajaxController = new AbortController();

			const timeout = item.ajaxTimeout ?? this.options.ajaxTimeout ?? AJAX_TIMEOUT;
			const timeoutId = setTimeout(() => {
				try { this._ajaxController.abort(); } catch (_) { /* noop */ }
			}, timeout);

			const fetchOpts = {
				...(this.options.fetchOptions || {}),
				...(item.fetchOptions || {}),
				signal: this._ajaxController.signal
			};

			try {
				const res = await fetch(src, fetchOpts);
				clearTimeout(timeoutId);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);

				const contentType = res.headers.get('content-type') || '';
				const isJson = item.type === 'json' || contentType.includes('application/json');

				if (isJson) {
					const data = await res.json();
					const handler = item.ajaxSuccess || this.options.ajaxSuccess;
					if (handler) {
						const result = handler(data, this);
						if (result instanceof Element) return result;
						if (typeof result === 'string') {
							const wrap = h('div', 'lm-ajax-content');
							wrap.appendChild(this._sanitize(result));
							return wrap;
						}
					}
					const pre = h('pre', 'lm-json-content');
					pre.textContent = JSON.stringify(data, null, 2);
					return pre;
				}

				let text = await res.text();

				// ajaxTransform — нормализация HTML до вставки
				const transform = item.ajaxTransform ?? this.options.ajaxTransform;
				if (transform) {
					const r = transform(text, this);
					if (r instanceof Element || r instanceof DocumentFragment) return r;
					if (typeof r === 'string') text = r;
				}

				const selector = item.ajaxSelector || this.options.ajaxSelector;
				const frag = this._sanitize(text);

				if (selector) {
					const found = frag.querySelector(selector);
					if (!found) throw new Error(`Selector "${selector}" not found`);
					return found;
				}
				const wrap = h('div', 'lm-ajax-content');
				wrap.appendChild(frag);
				return wrap;

			} catch (err) {
				clearTimeout(timeoutId);
				if (err.name === 'AbortError') return null;

				// ajaxError — кастомный обработчик ошибок
				const errHandler = item.ajaxError ?? this.options.ajaxError;
				if (errHandler) {
					const r = errHandler(err, this);
					if (r instanceof Element) return r;
					if (typeof r === 'string') {
						const wrap = h('div', 'lm-ajax-content');
						wrap.textContent = r;
						return wrap;
					}
				}
				throw err;
			}
		}

		async loadContent(item) {
			const token = Symbol();
			this._loadToken = token;

			const { src, type } = item;

			if (this._prevSrcAdd) {
				this.contentWrapper.classList.remove(this._prevSrcAdd);
				this._prevSrcAdd = null;
			}
			if (item.dataSrcAdd) {
				this.contentWrapper.classList.add(item.dataSrcAdd);
				this._prevSrcAdd = item.dataSrcAdd;
			}

			this.content.classList.remove('has-inline-content', 'has-iframe', 'has-ajax');
			this.showLoader();

			try {
				// Inline
				if (src.startsWith('#')) {
					const el = document.querySelector(src);
					if (!el) throw new Error(`Элемент ${src} не найден`);

					if (!el._lmOriginalParent) {
						el._lmOriginalParent = el.parentNode;
						el._lmOriginalNextSibling = el.nextSibling;
						el._lmOriginalStyleDisplay = el.style.display;
						el._lmOriginalClasses = el.className;
					}
					el.style.display = 'block';
					if (this._loadToken !== token) return;
					this.setContent(el);
					this.content.classList.add('has-inline-content');
					this.movedElement = el;
					return;
				}

				// AJAX/JSON
				if (type === 'ajax' || type === 'json') {
					const el = await this._fetchAjax(src, item);
					if (this._loadToken !== token || !el) return;
					this.setContent(el);
					this.content.classList.add('has-ajax', 'has-inline-content');
					return;
				}

				// Image
				if (isImg(type, src)) {
					const img = new Image();
					await Promise.race([
						new Promise((res, rej) => {
							img.onload = res;
							img.onerror = () => rej(new Error('Ошибка загрузки изображения'));
							img.src = src;
						}),
						new Promise((_, rej) => setTimeout(() => rej(new Error('Превышено время ожидания')), LOAD_TIMEOUT))
					]);
					if (this._loadToken !== token) return;
					img.alt = item.alt || item.caption || '';
					this.setContent(img);
					return;
				}

				// YouTube
				const ytId = getYouTubeId(src);
				if (ytId) {
					const p = new URLSearchParams({ autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, fs: 1, enablejsapi: 1 });
					if (this._loadToken !== token) return;
					this.setContent(this.createIframe(`https://www.youtube.com/embed/${ytId}?${p}`));
					this.content.classList.add('has-iframe');
					return;
				}

				// Vimeo
				const vimeoId = getVimeoId(src);
				if (vimeoId) {
					const p = new URLSearchParams({ autoplay: 1, playsinline: 1, byline: 0, portrait: 0 });
					if (this._loadToken !== token) return;
					this.setContent(this.createIframe(`https://player.vimeo.com/video/${vimeoId}?${p}`));
					this.content.classList.add('has-iframe');
					return;
				}

				// Rutube
				const rutubeId = getRutubeId(src);
				if (rutubeId) {
					const p = new URLSearchParams({ autoplay: 1, playsinline: 1 });
					if (this._loadToken !== token) return;
					this.setContent(this.createIframe(`https://rutube.ru/play/embed/${rutubeId}?${p}`));
					this.content.classList.add('has-iframe');
					return;
				}

				// VK Video
				const vkId = getVkVideoId(src);
				if (vkId) {
					if (this._loadToken !== token) return;
					this.setContent(this.createIframe(`https://vk.com/video_ext.php?oid=${vkId.oid}&id=${vkId.id}&hd=2&autoplay=1`));
					this.content.classList.add('has-iframe');
					return;
				}

				// HTML5 video
				if (isVideo(type, src)) {
					const video = h('video');
					video.src = src;
					video.controls = true;
					video.autoplay = true;
					video.muted = true;
					if (this._loadToken !== token) return;
					this.setContent(video);
					return;
				}

				// Generic iframe
				if (this._loadToken !== token) return;
				this.setContent(this.createIframe(src));
				this.content.classList.add('has-iframe');

			} catch (err) {
				if (this._loadToken === token) this.showError(err.message);
			}
		}

		createIframe(src) {
			const f = h('iframe');
			f.src = src;
			f.allowFullscreen = true;
			f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
			f.frameBorder = '0';
			f.style.cssText = 'width:100%;height:100%';
			f.loading = 'lazy';
			return f;
		}

		stopMedia() {
			this.content.querySelectorAll('iframe').forEach(f => { f.src = ''; });
			this.content.querySelectorAll('video').forEach(v => {
				try { v.pause(); } catch (_) { /* noop */ }
				v.removeAttribute('src');
				try { v.load(); } catch (_) { /* noop */ }
			});
		}

		setContent(element) {
			this.hideLoader();
			this.stopMedia();

			this.contentWrapper.querySelector('.lm-caption')?.remove();
			this.container.querySelector('.lm-counter')?.remove();

			this.content.innerHTML = '';
			this.content.appendChild(element);

			const item = this.items[this.currentIndex];
			if (item.caption) {
				const cap = h('div', 'lm-caption');
				cap.textContent = item.caption;
				this.contentWrapper.appendChild(cap);
			}

			if (this.isGallery) {
				if (this.toolbarCounter) {
					this.toolbarCounter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
				} else {
					this.container.querySelector('.lm-counter')?.remove();
					const counter = h('div', 'lm-counter');
					counter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
					this.container.appendChild(counter);
				}
			}

			if (this.removeFocusTrap) {
				this.removeFocusTrap();
				this.removeFocusTrap = null;
			}
			if (this.options.autoFocus) {
				this.removeFocusTrap = trapFocus(this.container);
			}

			this._updateNavButtons();

			// Zoom setup for images
			if (this._zoomCleanup) {
				this._zoomCleanup();
				this._zoomCleanup = null;
				this._zoomActive = false;
				this.content.classList.remove('is-zoomed', 'is-zoom-dragging');
			}
			const isImage = element instanceof HTMLImageElement;
			if (this.options.zoom && isImage) {
				this._zoomCleanup = this._setupZoom(element);
				if (this._zoomBtn) this._zoomBtn.style.display = '';
			} else if (this._zoomBtn) {
				this._zoomBtn.style.display = 'none';
			}

			this.emit('contentReady', item);
			if (this.options.formAutoReset) this._bindForms();
		}

		_bindForms() {
			this.content.querySelectorAll('form').forEach(form => {
				if (form._lmBound) return;
				form._lmBound = true;
				form.addEventListener('submit', (e) => {
					e.preventDefault();
					this._submitForm(form);
				});
			});
		}

		async _submitForm(form) {
			const action = form.action || window.location.href;
			const method = (form.method || 'GET').toUpperCase();
			try {
				const formData = new FormData(form);
				const url = method === 'GET' ? `${action}?${new URLSearchParams(formData)}` : action;
				const init = { method };
				if (method !== 'GET') init.body = formData;
				const res = await fetch(url, init);
				const contentType = res.headers.get('content-type') || '';
				let success = res.ok;
				if (success && contentType.includes('application/json')) {
					const data = await res.json();
					success = this._isSuccessData(data);
				}
				// Для HTML-ответов доверяем HTTP-статусу (res.ok)
				if (success) form.reset();
			} catch (_) { /* noop */ }
		}

		_isSuccessData(data) {
			if (typeof data === 'string') return this._isSuccessText(data);
			return data.status === true || data.status === 'success' || data.status === 'ok'
				|| data.ok === true || data.success === true;
		}

		_isSuccessText(text) {
			const t = text.trim().toLowerCase();
			return t === 'ok' || t === '1' || t === 'true';
		}

		_setupZoom(img) {
			let scale = 1, panX = 0, panY = 0;
			let isPanning = false, startPX = 0, startPY = 0;
			let isMouseDown = false;
			const MIN = this.options.zoomMin, MAX = this.options.zoomMax;
			const cw = this.content;

			img.classList.add('lm-zoomable');

			const clampPan = () => {
				const ww = cw.clientWidth, wh = cw.clientHeight;
				const maxX = Math.max(0, (img.naturalWidth * scale - ww) / (2 * scale));
				const maxY = Math.max(0, (img.naturalHeight * scale - wh) / (2 * scale));
				panX = Math.max(-maxX, Math.min(maxX, panX));
				panY = Math.max(-maxY, Math.min(maxY, panY));
			};

			const applyTransform = (animated) => {
				img.style.transition = animated ? 'transform 0.25s ease' : 'none';
				img.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
				this._zoomActive = scale > MIN;
				cw.classList.toggle('is-zoomed', this._zoomActive);
				if (this._zoomBtn) {
					this._zoomBtn.querySelector('.lm-icon-zoom-in')?.style.setProperty('display', this._zoomActive ? 'none' : '');
					this._zoomBtn.querySelector('.lm-icon-zoom-out')?.style.setProperty('display', this._zoomActive ? '' : 'none');
				}
			};

			const zoomTo = (newScale, pivotX, pivotY) => {
				const prev = scale;
				scale = Math.max(MIN, Math.min(MAX, newScale));
				if (pivotX !== undefined) {
					const rect = img.getBoundingClientRect();
					const rx = (pivotX - (rect.left + rect.width / 2)) / prev;
					const ry = (pivotY - (rect.top + rect.height / 2)) / prev;
					panX -= rx * (scale - prev) / scale;
					panY -= ry * (scale - prev) / scale;
				}
				clampPan();
				applyTransform(true);
			};

			// Double-click
			const onDblClick = (e) => {
				e.stopPropagation();
				if (scale > MIN) { scale = MIN; panX = 0; panY = 0; applyTransform(true); }
				else zoomTo(MIN + this.options.zoomStep * 2, e.clientX, e.clientY);
			};

			// Wheel
			const onWheel = (e) => {
				e.preventDefault();
				zoomTo(scale + (e.deltaY < 0 ? this.options.zoomStep : -this.options.zoomStep), e.clientX, e.clientY);
			};

			// Mouse drag pan
			const onMouseDown = (e) => {
				if (!this._zoomActive) return;
				isMouseDown = isPanning = true;
				startPX = e.clientX - panX * scale;
				startPY = e.clientY - panY * scale;
				img.style.transition = 'none';
				cw.classList.add('is-zoom-dragging');
				e.stopPropagation();
				e.preventDefault();
			};
			const onMouseMove = (e) => {
				if (!isMouseDown) return;
				panX = (e.clientX - startPX) / scale;
				panY = (e.clientY - startPY) / scale;
				clampPan();
				applyTransform(false);
			};
			const onMouseUp = () => {
				if (!isMouseDown) return;
				isMouseDown = isPanning = false;
				cw.classList.remove('is-zoom-dragging');
			};

			// Pinch
			let pinchDist = 0, pinchActive = false;
			const onTouchStart = (e) => {
				if (e.touches.length === 2) {
					pinchActive = true;
					pinchDist = Math.hypot(
						e.touches[0].clientX - e.touches[1].clientX,
						e.touches[0].clientY - e.touches[1].clientY
					);
					e.preventDefault();
				}
			};
			const onTouchMove = (e) => {
				if (!pinchActive || e.touches.length !== 2) return;
				const dist = Math.hypot(
					e.touches[0].clientX - e.touches[1].clientX,
					e.touches[0].clientY - e.touches[1].clientY
				);
				const pivot = {
					x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
					y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
				};
				zoomTo(scale * (dist / pinchDist), pivot.x, pivot.y);
				pinchDist = dist;
				e.preventDefault();
			};
			const onTouchEnd = () => { pinchActive = false; };

			cw.addEventListener('dblclick', onDblClick);
			cw.addEventListener('wheel', onWheel, { passive: false });
			cw.addEventListener('mousedown', onMouseDown);
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			cw.addEventListener('touchstart', onTouchStart, { passive: false });
			cw.addEventListener('touchmove', onTouchMove, { passive: false });
			cw.addEventListener('touchend', onTouchEnd, { passive: true });

			this._zoomBy = (delta) => zoomTo(scale + delta);
			this._zoomReset = () => { scale = MIN; panX = 0; panY = 0; applyTransform(true); };

			return () => {
				img.classList.remove('lm-zoomable');
				img.style.transform = '';
				cw.removeEventListener('dblclick', onDblClick);
				cw.removeEventListener('wheel', onWheel);
				cw.removeEventListener('mousedown', onMouseDown);
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				cw.removeEventListener('touchstart', onTouchStart);
				cw.removeEventListener('touchmove', onTouchMove);
				cw.removeEventListener('touchend', onTouchEnd);
				delete this._zoomBy;
				delete this._zoomReset;
			};
		}

		_toggleFullscreen() {
			if (!fsAPI) return;
			if (this._isFullscreen || fsAPI.element) {
				fsAPI.exit().catch(() => {});
			} else {
				// <dialog> is in the browser top layer, so requestFullscreen on it fails.
				// contentWrapper is a plain <div> child of the dialog — fullscreen works on it.
				// For div-based containers (no dialog) we target the container directly.
				const target = this.useDialog ? this.contentWrapper : this.container;
				fsAPI.request(target, { navigationUI: 'hide' }).catch(() => {});
			}
		}

		_sanitize(html) {
			const s = this.options.sanitize;
			if (s === false) {
				const d = document.createElement('div');
				d.innerHTML = html;
				return d;
			}
			if (typeof s === 'function') {
				const r = s(html);
				if (r instanceof DocumentFragment || r instanceof Element) return r;
				const d = document.createElement('div');
				d.innerHTML = String(r);
				return d;
			}
			return sanitizeAjaxHtml(html);
		}

		_setupPlugins() {
			const plugins = [...LightModal._globalPlugins, ...(this.options.plugins || [])];
			for (const plugin of plugins) {
				if (plugin.defaults) {
					for (const [k, v] of Object.entries(plugin.defaults)) {
						if (this.options[k] === LightModal.defaults[k]) this.options[k] = v;
					}
				}
				if (typeof plugin.setup === 'function') {
					const cleanup = plugin.setup(this);
					if (typeof cleanup === 'function') this._pluginCleanups.push(cleanup);
				}
			}
		}

		showLoader() {
			if (this.loader) return;
			const tmp = h('div');
			tmp.innerHTML = this.options.spinnerTpl;
			this.loader = tmp.firstElementChild;
			this.content.appendChild(this.loader);
			this.container.classList.add('is-loading');
		}

		hideLoader() {
			this.loader?.remove();
			this.loader = null;
			this.container.classList.remove('is-loading');
		}

		showError(message) {
			this.hideLoader();
			const tmp = h('div');
			tmp.innerHTML = this.options.errorTpl.replace('{{message}}', message);
			this.content.appendChild(tmp.firstElementChild);
		}

		open() {
			if (this.state !== States.Init) return;
			if (this.options.restoreFocus) this.previousFocus = document.activeElement;
			if (this.options.hideScrollbar) scrollLock.lock();

			if (this.useDialog) {
				try { this.container.showModal(); }
				catch (_) { this.container.style.display = 'flex'; }
			} else {
				this.container.style.display = 'flex';
			}

			requestAnimationFrame(() => {
				this.container.classList.add('is-open');
			});

			this.state = States.Ready;

			document.dispatchEvent(new CustomEvent('lightmodal:open', {
				detail: { id: this.id, instance: this }
			}));

			this.emit('open');
		}

		close() {
			if (this.state === States.Closing || this.state === States.Destroyed) {
				return Promise.resolve();
			}

			if (this.emit('beforeClose') === false) return Promise.resolve();

			this.state = States.Closing;
			this.container.classList.remove('is-open');
			this.container.classList.add('is-closing');

			if (this._ajaxController) {
				try { this._ajaxController.abort(); } catch (_) { /* noop */ }
				this._ajaxController = null;
			}

			this.emit('close');

			return new Promise(resolve => {
				setTimeout(() => {
					this.destroy();
					resolve();
				}, this.options.closeSpeed);
			});
		}

		destroy() {
			if (this.state === States.Destroyed) return;

			// Plugin cleanup
			for (const fn of this._pluginCleanups) try { fn(); } catch (_) {}
			this._pluginCleanups = [];

			// Zoom cleanup
			if (this._zoomCleanup) { this._zoomCleanup(); this._zoomCleanup = null; }

			// Fullscreen cleanup
			if (this._fullscreenHandler && fsAPI) {
				document.removeEventListener(fsAPI.change, this._fullscreenHandler);
				this._fullscreenHandler = null;
			}
			if (this._isFullscreen && fsAPI?.element) {
				fsAPI.exit().catch(() => {});
				this._isFullscreen = false;
			}

			this.stopMedia();

			if (this.contentWrapper) this.contentWrapper.className = 'lm-content-wrapper';
			if (this._dragCleanup) this._dragCleanup();
			if (this._idleCleanup) this._idleCleanup();
			if (this.removeFocusTrap) {
				this.removeFocusTrap();
				this.removeFocusTrap = null;
			}
			if (this._keydownHandler) {
				document.removeEventListener('keydown', this._keydownHandler);
				this._keydownHandler = null;
			}
			if (this._cancelHandler && this.container) {
				this.container.removeEventListener('cancel', this._cancelHandler);
				this._cancelHandler = null;
			}
			if (this._justDraggedTimer) {
				clearTimeout(this._justDraggedTimer);
				this._justDraggedTimer = null;
			}

			if (this.options.restoreFocus && this.previousFocus) {
				if (document.contains(this.previousFocus) && typeof this.previousFocus.focus === 'function') {
					this.previousFocus.focus();
				}
			}

			if (this.useDialog && this.container.open) {
				try { this.container.close(); } catch (_) { /* noop */ }
			}
			this.container.remove();

			if (this.options.hideScrollbar) scrollLock.unlock();

			if (this.movedElement?._lmOriginalParent) {
				const el = this.movedElement;
				if (document.contains(el._lmOriginalParent)) {
					el.style.display = el._lmOriginalStyleDisplay || 'none';
					el.className = el._lmOriginalClasses || '';
					try {
						if (el._lmOriginalNextSibling && document.contains(el._lmOriginalNextSibling)) {
							el._lmOriginalParent.insertBefore(el, el._lmOriginalNextSibling);
						} else {
							el._lmOriginalParent.appendChild(el);
						}
					} catch (_) { /* noop */ }
				}
				delete el._lmOriginalParent;
				delete el._lmOriginalNextSibling;
				delete el._lmOriginalStyleDisplay;
				delete el._lmOriginalClasses;
			}

			LightModal.instances.delete(this.id);

			if (LightModal.currentInstance === this) {
				const remaining = [...LightModal.instances.values()];
				LightModal.currentInstance = remaining[remaining.length - 1] || null;
			}

			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					document.dispatchEvent(new CustomEvent('lightmodal:close', {
						detail: { id: this.id }
					}));
				});
			});

			this.state = States.Destroyed;
			this.emit('destroy');
		}

		// ─── Gallery API ─────────────────────────────────────────────────────────
		next() {
			if (!this.isGallery) return;
			let idx = this.currentIndex + 1;
			if (idx >= this.items.length) {
				if (this.options.loop) idx = 0;
				else return;
			}
			this.goTo(idx);
		}

		prev() {
			if (!this.isGallery) return;
			let idx = this.currentIndex - 1;
			if (idx < 0) {
				if (this.options.loop) idx = this.items.length - 1;
				else return;
			}
			this.goTo(idx);
		}

		goTo(index) {
			if (index < 0 || index >= this.items.length) return;
			if (index === this.currentIndex) return;
			this.currentIndex = index;
			this.loadContent(this.items[index]);
			this.emit('change', index);
		}

		// ─── Events ──────────────────────────────────────────────────────────────
		emit(event, ...args) {
			let result;
			if (this.options.on[event]) {
				const r = this.options.on[event](this, ...args);
				if (r === false) result = false;
				else if (result === undefined) result = r;
			}
			const handlers = this.events.get(event);
			if (handlers) {
				handlers.forEach(h => {
					const r = h(this, ...args);
					if (r === false) result = false;
				});
			}
			return result;
		}

		on(event, handler) {
			if (!this.events.has(event)) this.events.set(event, []);
			this.events.get(event).push(handler);
			return this;
		}

		off(event, handler) {
			const handlers = this.events.get(event);
			if (handlers) {
				const i = handlers.indexOf(handler);
				if (i > -1) handlers.splice(i, 1);
			}
			return this;
		}

		// ─── Static API ──────────────────────────────────────────────────────────
		static async open(items, options = {}) {
			if (options.closeExisting) await LightModal.closeAll();
			return new LightModal(items, options);
		}

		static close() {
			return LightModal.currentInstance?.close() ?? Promise.resolve();
		}

		static async closeAll() {
			await Promise.all([...LightModal.instances.values()].map(i => i.close()));
		}

		static getInstance(id) {
			return id ? LightModal.instances.get(id) : LightModal.currentInstance;
		}

		static use(plugin) {
			if (!LightModal._globalPlugins.includes(plugin)) {
				LightModal._globalPlugins.push(plugin);
			}
			return LightModal;
		}

		static refreshLenis() {
			lenisAdapter.invalidate();
		}

		static bind(selector = '[data-lightmodal]') {
			document.addEventListener('click', (e) => {
				const trigger = e.target.closest(selector);
				if (!trigger) return;
				e.preventDefault();

				const galleryName = trigger.dataset.gallery;
				let items = [], startIndex = 0;

				if (galleryName) {
					document.querySelectorAll(`[data-gallery="${galleryName}"]`).forEach((el, i) => {
						if (el === trigger) startIndex = i;
						items.push({
							src: el.getAttribute('href') || el.dataset.src,
							type: el.dataset.type,
							caption: el.dataset.caption || el.getAttribute('title'),
							alt: el.dataset.alt,
							dataSrcAdd: el.dataset.srcAdd
						});
					});
				} else {
					items = [{
						src: trigger.getAttribute('href') || trigger.dataset.src,
						type: trigger.dataset.type,
						caption: trigger.dataset.caption || trigger.getAttribute('title'),
						alt: trigger.dataset.alt,
						dataSrcAdd: trigger.dataset.srcAdd
					}];
				}

				const options = { startIndex };
				for (const key in trigger.dataset) {
					if (key.startsWith('lm')) {
						let val = trigger.dataset[key];
						if (val === 'true') val = true;
						else if (val === 'false') val = false;
						else if (val !== '' && !isNaN(val)) val = +val;
						const optKey = key.replace(/^lm/, '');
						options[optKey.charAt(0).toLowerCase() + optKey.slice(1)] = val;
					}
				}

				if (trigger.dataset.springBottomSheet === 'true') options.bottomSheet = true;
				if (trigger.dataset.customBackground) options.customBackground = trigger.dataset.customBackground;

				LightModal.open(items, options);
			});
		}
	}

	// ─── Экспорт ─────────────────────────────────────────────────────────────────
	window.LightModal = LightModal;
	window.openModal = id => LightModal.open(`#${id}`);
	window.closeModal = () => LightModal.close();

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => LightModal.bind());
	} else {
		LightModal.bind();
	}

	LightModal.version = '4.3.0';
	console.log('🚀 LightModal 4.3.0 initialized');

})();