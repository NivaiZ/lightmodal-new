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

	const getScrollableParent = (node, boundary) => {
		while (node && node !== boundary) {
			const ov = window.getComputedStyle(node).overflowY;
			if ((ov === 'auto' || ov === 'scroll') && node.scrollHeight > node.clientHeight + 1) return node;
			node = node.parentElement;
		}
		return null;
	};

	/** Клон содержимого <template> (importNode — корректный контекст документа, MDN). */
	const cloneTemplateContent = (tpl) => {
		const frag = document.importNode(tpl.content, true);
		const elements = [...frag.children];
		if (elements.length === 1) return elements[0];
		const wrap = document.createElement('div');
		wrap.className = 'inline-content';
		wrap.appendChild(frag);
		return wrap;
	};

	/**
	 * Разрешает inline-источник #id:
	 * 1) живой DOM-узел — перенос (move) в модалку и возврат при закрытии;
	 * 2) <template id="…"> — клон при каждом открытии;
	 * 3) #id внутри любого template.content — клон узла.
	 */
	const resolveInlineSource = (src) => {
		const id = src.startsWith('#') ? src.slice(1) : src;
		if (!id) return null;

		const node = document.getElementById(id);
		if (node instanceof HTMLTemplateElement) {
			return { el: cloneTemplateContent(node), cloned: true };
		}
		if (node) return { el: node, cloned: false };

		for (const tpl of document.querySelectorAll('template')) {
			const inner = tpl.content.querySelector(`#${CSS.escape(id)}`);
			if (inner) return { el: document.importNode(inner, true), cloned: true };
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
		_handlers: null,

		_calcScrollbarWidth() {
			// как Fancybox: innerWidth − ширина documentElement
			return Math.max(0, window.innerWidth - document.documentElement.getBoundingClientRect().width);
		},

		_isInModal(target) {
			return !!(target && target.closest?.('.lm-container, dialog.lm-container'));
		},

		_allowScrollInModal(target) {
			const modal = target?.closest?.('.lm-container, dialog.lm-container');
			if (!modal) return false;
			// разрешаем только реальный overflow-скролл внутри модалки (inline/AJAX),
			// не «протекание» wheel на страницу под lightbox
			return !!getScrollableParent(target, modal);
		},

		lock() {
			this.lockCount++;
			if (this.lockCount > 1) return;

			const html = document.documentElement;
			const body = document.body;

			this.scrollbarWidth = this._calcScrollbarWidth();
			this.savedScrollY = lenisAdapter.getScrollY();
			this.lenisWasActive = lenisAdapter.stop();

			const existingMargin = parseFloat(window.getComputedStyle(body).marginRight) || 0;
			html.style.setProperty('--lm-scrollbar-compensate', `${this.scrollbarWidth}px`);
			if (existingMargin) {
				body.style.setProperty('--lm-body-margin', `${existingMargin}px`);
			}

			html.classList.add('lm-scroll-locked');
			body.classList.add('lm-hide-scrollbar', 'lm-scroll-locked-body');

			const onWheel = (e) => {
				if (this._allowScrollInModal(e.target)) return;
				e.preventDefault();
			};

			const onTouchMove = (e) => {
				if (this._allowScrollInModal(e.target)) return;
				e.preventDefault();
			};

			const onScroll = () => {
				if (window.scrollY !== this.savedScrollY) {
					window.scrollTo(0, this.savedScrollY);
				}
			};

			const onKeyDown = (e) => {
				const keys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
				if (!keys.has(e.key)) return;
				if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
				if (this._allowScrollInModal(e.target)) return;
				e.preventDefault();
			};

			window.addEventListener('wheel', onWheel, { passive: false });
			window.addEventListener('touchmove', onTouchMove, { passive: false });
			window.addEventListener('scroll', onScroll, { passive: true });
			document.addEventListener('keydown', onKeyDown, { passive: false });

			this._handlers = { onWheel, onTouchMove, onScroll, onKeyDown };
		},

		unlock() {
			this.lockCount = Math.max(0, this.lockCount - 1);
			if (this.lockCount > 0) return;

			const html = document.documentElement;
			const body = document.body;
			body.classList.remove('lm-hide-scrollbar', 'lm-scroll-locked-body');
			html.classList.remove('lm-scroll-locked');
			html.style.setProperty('--lm-scrollbar-compensate', '');
			body.style.setProperty('--lm-body-margin', '');

			if (this._handlers) {
				const { onWheel, onTouchMove, onScroll, onKeyDown } = this._handlers;
				window.removeEventListener('wheel', onWheel);
				window.removeEventListener('touchmove', onTouchMove);
				window.removeEventListener('scroll', onScroll);
				document.removeEventListener('keydown', onKeyDown);
				this._handlers = null;
			}

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
			// static | absolute | fixed | null (auto: static — inline, absolute — media)
			closePosition: null,
			closeOnBackdrop: true,
			closeOnEsc: true,
			closeExisting: false,

			openSpeed: 366,
			closeSpeed: 366,

			dragToClose: true,
			autoFocus: true,
			restoreFocus: true,
			hideScrollbar: true,

			idle: 3000,

			// i18n
			closeLabel: 'Закрыть',

			spinnerTpl: '<div class="lm-spinner"></div>',
			errorTpl: '<div class="lm-error">{{message}}</div>',
			closeBtnTpl: null,

			width: null,
			height: null,

			// AJAX
			fetchOptions: null,
			ajaxSelector: null,
			ajaxSuccess: null,

			// Bottom sheet
			bottomSheet: false,
			// Teleport tap-bar into sheet: true | CSS selector
			tapBarMove: false,

			// Custom background (CSS color value)
			customBackground: null,

			// Auto-reset form on successful AJAX submit
			formAutoReset: true,

			// Keyboard mapping — key → action name
			keyboard: {
				Escape: 'close',
			},

			// Plugin system
			plugins: [],

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
			this.options = merge({}, LightModal.defaults, options);
			this.items = items.map((i) => {
				const item = typeof i === 'string' ? { src: i } : { ...i };
				// type из options (LightModal.open(src, { type: 'json' })) или авто по расширению
				if (!item.type && options.type) item.type = options.type;
				if (!item.type && item.src && /\.json(\?|#|$)/i.test(item.src)) {
					item.type = 'json';
				}
				return item;
			});
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
			this.useDialog = false;

			this.isIdle = false;
			this.idleTimer = null;
			this.previousFocus = null;
			this.removeFocusTrap = null;
			this.movedElement = null;
			this._tapBarEl = null;
			this._tapBarParent = null;
			this._tapBarNext = null;
			this._tapBarClickHandler = null;

			this._prevSrcAdd = null;
			this._loadToken = null;
			this._justDraggedTimer = null;
			this._justDragged = false;
			this._ajaxController = null;

			this._pluginCleanups = [];

			this.events = new Map();
			this.init();
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
			// каждая следующая модалка выше предыдущей (stack)
			this.container.style.zIndex = String(
				(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--lm-z-index'), 10) || 1050)
				+ LightModal.instances.size
			);

			if (this.options.bottomSheet) {
				this.container.classList.add('is-bottom-sheet');
				if (this.options.tapBarMove) this.container.classList.add('has-tap-bar-move');
			}

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

			if (this.options.bottomSheet) {
				const drag = h('div', 'lm-drag-indicator');
				drag.setAttribute('aria-hidden', 'true');
				this.contentWrapper.appendChild(drag);
				this.contentWrapper.classList.add('has-drag-handle');
			} else if (isTouchDevice() && this.options.dragToClose) {
				const drag = h('div', 'lm-drag-indicator');
				this.contentWrapper.appendChild(drag);
			}

			if (isTouchDevice() && this.options.dragToClose) {
				this.container.classList.add('is-touch');
			}

			if (this.options.closeButton) {
				this.closeBtn = this._createCloseButton();
				this.contentWrapper.appendChild(this.closeBtn);
				this._applyClosePosition();
			}

			this.content = h('div', 'lm-content');
			this.contentWrapper.appendChild(this.content);

			if (this.options.bottomSheet) {
				const dragBottom = h('div', 'lm-drag-indicator lm-drag-indicator--bottom');
				dragBottom.setAttribute('aria-hidden', 'true');
				this.contentWrapper.appendChild(dragBottom);
			}

			this.container.appendChild(this.backdrop);
			this.container.appendChild(this.contentWrapper);

			if (this.options.mainClass) this.container.classList.add(this.options.mainClass);

			this._applySizeVars();

			document.body.appendChild(this.container);
			this.attachEvents();
		}

		_applySizeVars() {
			const root = getComputedStyle(document.documentElement);
			let w = this.options.width
				? (typeof this.options.width === 'number' ? `${this.options.width}px` : this.options.width)
				: root.getPropertyValue('--lm-max-width').trim() || 'min(90vw, 1200px)';
			let h = this.options.height
				? (typeof this.options.height === 'number' ? `${this.options.height}px` : this.options.height)
				: root.getPropertyValue('--lm-max-height').trim() || 'none';

			for (const el of [this.contentWrapper, this.content]) {
				if (!el) continue;
				el.style.setProperty('--lm-max-width', w);
				el.style.setProperty('--lm-max-height', h);
			}

			if (!this.contentWrapper) return;

			const isHtmlSlide = this.contentWrapper.classList.contains('has-html');

			// В has-html width/height задают карточку через CSS-переменные, не сам viewport-слайд
			if (isHtmlSlide) {
				this.contentWrapper.style.removeProperty('max-width');
				this.contentWrapper.style.removeProperty('max-height');
				return;
			}

			if (this.options.width) {
				this.contentWrapper.style.maxWidth = w;
			} else {
				this.contentWrapper.style.removeProperty('max-width');
			}

			// `none` нельзя ставить inline — иначе сносит CSS max-height: 90vh у media lightbox
			if (this.options.height && h && h !== 'none') {
				this.contentWrapper.style.maxHeight = h;
			} else {
				this.contentWrapper.style.removeProperty('max-height');
			}
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

		attachEvents() {
			if (this.options.closeOnBackdrop) {
				this.backdrop.addEventListener('click', () => {
					if (this._justDragged) return;
					this.close();
				});

				// has-html: слайд на весь экран перекрывает backdrop — закрываем по клику вне карточки
				this._wrapperClickHandler = (e) => {
					if (this._justDragged) return;
					if (!this.contentWrapper.classList.contains('has-html')) return;
					if (this.content.contains(e.target)) return;
					if (this.contentWrapper.querySelector('.lm-caption')?.contains(e.target)) return;
					if (e.target.closest('.lm-drag-indicator, .lm-tap-bar-moved')) return;
					this.close();
				};
				this.contentWrapper.addEventListener('click', this._wrapperClickHandler);
			}

			if (this.closeBtn) {
				this.closeBtn.addEventListener('click', (e) => {
					e.stopPropagation();
					this.close();
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
		}

		handleKeydown(e) {
			if (this.state !== States.Ready) return;
			if (LightModal.currentInstance !== this) return;

			const map = this.options.keyboard;
			if (!map) return;
			const action = map[e.key];
			if (!action) return;

			if (action === 'close') {
				if (!this.options.closeOnEsc) return;
				e.preventDefault();
				this.close();
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
				scrollableAncestor = getScrollableParent(e.target, this.contentWrapper);
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
					if (this.options.bottomSheet && Math.abs(dy) >= Math.abs(dx)) {
						// Bottom sheet: вверх — ничего; вниз — закрытие, когда контент наверху
						if (dy < 0) return;
						if (scrollableAncestor && scrollableAncestor.scrollTop > 1) return;
					} else if (scrollableAncestor && Math.abs(dy) >= Math.abs(dx)) {
						const atTop = scrollableAncestor.scrollTop <= 1;
						const atBottom = scrollableAncestor.scrollTop + scrollableAncestor.clientHeight
							>= scrollableAncestor.scrollHeight - 1;
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
					const effectiveDy = this.options.bottomSheet
						? Math.max(0, dy)
						: dy;
					const p = Math.min(Math.abs(effectiveDy) / 200, 1);
					this.contentWrapper.style.transform = `translateY(${effectiveDy}px)`;
					this.contentWrapper.style.opacity = 1 - p * 0.3;
					this.backdrop.style.opacity = 1 - p * 0.5;
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

				const dy = currentY - startY;
				this.contentWrapper.classList.remove('is-dragging', 'is-draggable');

				// Bottom sheet вниз не тянется — закрытие только backdrop / API
				const closeThreshold = 100;
				const closeVertical = dragAxis === 'y' && dy > closeThreshold;

				if (closeVertical) {
					this.contentWrapper.classList.add('lm-throw-out-down');
					setTimeout(() => this.close(), 200);
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

		_getClosePosition() {
			const p = this.options.closePosition;
			if (p === 'static' || p === 'absolute' || p === 'fixed') return p;

			if (this.content?.classList.contains('has-iframe')) return 'absolute';

			const el = this.content?.firstElementChild;
			if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) return 'absolute';

			return 'static';
		}

		_applyClosePosition() {
			if (!this.closeBtn) return;

			const pos = this._getClosePosition();
			this.closeBtn.classList.remove('lm-close-btn--static', 'lm-close-btn--absolute', 'lm-close-btn--fixed');
			this.closeBtn.classList.add(`lm-close-btn--${pos}`);

			if (pos === 'fixed') {
				if (this.closeBtn.parentElement !== this.container) {
					this.container.appendChild(this.closeBtn);
				}
				return;
			}

			if (this.contentWrapper?.classList.contains('has-html')) {
				if (this.closeBtn.parentElement !== this.content) {
					this.content.insertBefore(this.closeBtn, this.content.firstChild);
				} else if (this.closeBtn !== this.content.firstElementChild) {
					this.content.insertBefore(this.closeBtn, this.content.firstChild);
				}
			} else if (this.closeBtn.parentElement !== this.contentWrapper) {
				this.contentWrapper.insertBefore(this.closeBtn, this.content);
			}
		}

		_setHtmlMode(isHtml) {
			// has-html — только inline/AJAX; media использует классический lightbox
			const enable = isHtml && !this.options.bottomSheet;
			this.contentWrapper?.classList.toggle('has-html', enable);
			this.container?.classList.toggle('has-html-content', enable);

			if (!this.contentWrapper) return;
			if (enable) {
				this.contentWrapper.style.removeProperty('max-width');
				this.contentWrapper.style.removeProperty('max-height');
			}

			this._applySizeVars();
			this._applyClosePosition();
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

			this._setHtmlMode(false);
			this.content.classList.remove('has-inline-content', 'has-iframe', 'has-ajax');
			this.showLoader();

			try {
				// Inline (#id, <template> или узел внутри template)
				if (src.startsWith('#')) {
					const resolved = resolveInlineSource(src);
					if (!resolved) throw new Error(`Элемент ${src} не найден`);

					const { el, cloned } = resolved;

					if (!cloned) {
						if (!el._lmOriginalParent) {
							el._lmOriginalParent = el.parentNode;
							el._lmOriginalNextSibling = el.nextSibling;
							el._lmOriginalStyleDisplay = el.style.display;
							el._lmOriginalClasses = el.className;
						}
						el.style.display = 'block';
					}

					if (this._loadToken !== token) return;
					this.setContent(el);
					this.content.classList.add('has-inline-content');
					this.movedElement = cloned ? null : el;
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

			this.content.replaceChildren();
			this.content.appendChild(element);
			// HTML slide — только для inline/AJAX; media (img/video/iframe) — классический lightbox
			const isMedia = !!element && /^(IMG|VIDEO|IFRAME)$/i.test(element.tagName);
			this._setHtmlMode(!this.options.bottomSheet && !isMedia);
			this._applyClosePosition();

			const item = this.items[this.currentIndex];
			if (item.caption) {
				const cap = h('div', 'lm-caption');
				cap.textContent = item.caption;
				this.contentWrapper.appendChild(cap);
			}

			if (this.removeFocusTrap) {
				this.removeFocusTrap();
				this.removeFocusTrap = null;
			}
			if (this.options.autoFocus) {
				this.removeFocusTrap = trapFocus(this.container);
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
			this.content.innerHTML = '';
			const tmp = h('div');
			tmp.innerHTML = this.options.errorTpl.replace('{{message}}', message);
			this.content.appendChild(tmp.firstElementChild);
			this._setHtmlMode(!this.options.bottomSheet);
			this._applyClosePosition();
		}

		_getTapBarSelector() {
			const opt = this.options.tapBarMove;
			if (!opt) return null;
			if (opt === true) return '[data-lm-tap-bar], .demo-tapbar';
			return typeof opt === 'string' ? opt : null;
		}

		_teleportTapBar() {
			if (!this.options.bottomSheet || !this.options.tapBarMove) return;

			const selector = this._getTapBarSelector();
			const el = selector ? document.querySelector(selector) : null;
			if (!el || !this.contentWrapper) return;

			this._tapBarEl = el;
			this._tapBarParent = el.parentNode;
			this._tapBarNext = el.nextSibling;

			const height = el.getBoundingClientRect().height;
			this.contentWrapper.style.setProperty('--lm-tap-bar-height', `${height}px`);

			el.classList.add('lm-tap-bar-moved');
			this.contentWrapper.appendChild(el);
			document.body.classList.add('lm-tap-bar-teleported');

			requestAnimationFrame(() => {
				if (!this._tapBarEl) return;
				const h = this._tapBarEl.getBoundingClientRect().height;
				this.contentWrapper?.style.setProperty('--lm-tap-bar-height', `${h}px`);
			});

			this._tapBarClickHandler = (e) => {
				const link = e.target.closest('a[href^="#"]');
				if (!link || !el.contains(link)) return;
				const id = link.getAttribute('href');
				e.preventDefault();
				e.stopPropagation();
				this.close().then(() => {
					const target = id ? document.querySelector(id) : null;
					if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
					if (id) history.replaceState(null, '', id);
				});
			};
			el.addEventListener('click', this._tapBarClickHandler, true);
		}

		_restoreTapBar() {
			const el = this._tapBarEl;
			if (!el) return;

			if (this._tapBarClickHandler) {
				el.removeEventListener('click', this._tapBarClickHandler, true);
				this._tapBarClickHandler = null;
			}

			el.classList.remove('lm-tap-bar-moved');
			this.contentWrapper?.style.removeProperty('--lm-tap-bar-height');
			document.body.classList.remove('lm-tap-bar-teleported');

			if (this._tapBarParent && document.contains(this._tapBarParent)) {
				try {
					if (this._tapBarNext && document.contains(this._tapBarNext)) {
						this._tapBarParent.insertBefore(el, this._tapBarNext);
					} else {
						this._tapBarParent.appendChild(el);
					}
				} catch (_) {
					this._tapBarParent.appendChild(el);
				}
			}

			this._tapBarEl = null;
			this._tapBarParent = null;
			this._tapBarNext = null;
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

			this._teleportTapBar();

			requestAnimationFrame(() => {
				this.container.classList.add('is-open');
				clearTimeout(this._readyTimer);
				this._readyTimer = setTimeout(() => {
					this.container?.classList.add('is-ready');
					this._readyTimer = null;
				}, this.options.openSpeed);
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
			clearTimeout(this._readyTimer);
			this._readyTimer = null;
			this.container.classList.remove('is-open', 'is-ready');
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

			this.stopMedia();
			this._restoreTapBar();

			if (this.contentWrapper) {
				this.contentWrapper.className = 'lm-content-wrapper';
				this.container?.classList.remove('has-html-content', 'has-tap-bar-move');
			}
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
			if (this._wrapperClickHandler && this.contentWrapper) {
				this.contentWrapper.removeEventListener('click', this._wrapperClickHandler);
				this._wrapperClickHandler = null;
			}
			if (this._justDraggedTimer) {
				clearTimeout(this._justDraggedTimer);
				this._justDraggedTimer = null;
			}
			if (this._readyTimer) {
				clearTimeout(this._readyTimer);
				this._readyTimer = null;
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

				const items = [{
					src: trigger.getAttribute('href') || trigger.dataset.src,
					type: trigger.dataset.type,
					caption: trigger.dataset.caption || trigger.getAttribute('title'),
					alt: trigger.dataset.alt,
					dataSrcAdd: trigger.dataset.srcAdd
				}];

				const options = {};
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
				if (trigger.dataset.tapBarMove != null && trigger.dataset.tapBarMove !== '') {
					const v = trigger.dataset.tapBarMove;
					options.tapBarMove = v === 'true' ? true : v === 'false' ? false : v;
				}

				LightModal.open(items, options);
			});
		}
	}

	// ─── Экспорт ─────────────────────────────────────────────────────────────────
	window.LightModal = LightModal;
	window.openModal = (id, options = {}) => LightModal.open(`#${id}`, options);
	window.closeModal = () => LightModal.close();

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', () => LightModal.bind());
	} else {
		LightModal.bind();
	}

	LightModal.version = '4.3.0';
	console.log('🚀 LightModal 4.3.0 initialized');

})();