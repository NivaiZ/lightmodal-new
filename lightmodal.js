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

			this.events = new Map();
			this.init();
		}

		get isGallery() {
			return this.items.length > 1;
		}

		init() {
			LightModal.instances.set(this.id, this);
			LightModal.currentInstance = this;
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

			if (isTouchDevice() && this.options.dragToClose) {
				const drag = h('div', 'lm-drag-indicator');
				this.contentWrapper.appendChild(drag);
				this.container.classList.add('is-touch');
			}

			if (this.options.closeButton) {
				this.closeBtn = this._createCloseButton();
				this.contentWrapper.appendChild(this.closeBtn);
			}

			this.content = h('div', 'lm-content');
			this.contentWrapper.appendChild(this.content);

			if (this.isGallery && this.options.galleryNav) {
				this.prevBtn = this._createNavButton('prev');
				this.nextBtn = this._createNavButton('next');
				this.container.appendChild(this.prevBtn);
				this.container.appendChild(this.nextBtn);
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
		}

		handleKeydown(e) {
			if (this.state !== States.Ready) return;
			if (LightModal.currentInstance !== this) return;

			if (e.key === 'Escape' && this.options.closeOnEsc) {
				e.preventDefault();
				this.close();
				return;
			}

			if (this.isGallery) {
				if (e.key === 'ArrowLeft') {
					e.preventDefault();
					this.prev();
				} else if (e.key === 'ArrowRight') {
					e.preventDefault();
					this.next();
				}
			}
		}

		setupDragToClose() {
			let startY = 0, currentY = 0, startX = 0, currentX = 0;
			let isDragging = false, dragAxis = null, isMouseDown = false;

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
					isDragging = true;
					dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
					this.contentWrapper.classList.add('is-dragging');
					if (e.type === 'mousemove') {
						e.preventDefault();
						document.body.style.userSelect = 'none';
					}
				}

				if (!isDragging) return;

				if (dragAxis === 'y') {
					// Вертикаль — drag-to-close
					const p = Math.min(Math.abs(dy) / 200, 1);
					this.contentWrapper.style.transform = `translateY(${dy}px)`;
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

				const closeVertical = dragAxis === 'y' && dy > 100;
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
					this.contentWrapper.style.transition = 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
					this.contentWrapper.style.transform = '';
					this.contentWrapper.style.opacity = '';
					this.backdrop.style.opacity = '';
					setTimeout(() => {
						if (this.contentWrapper) this.contentWrapper.style.transition = '';
					}, 300);
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

			const timeoutId = setTimeout(() => {
				try { this._ajaxController.abort(); } catch (_) { /* noop */ }
			}, AJAX_TIMEOUT);

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
							wrap.appendChild(sanitizeAjaxHtml(result));
							return wrap;
						}
					}
					const pre = h('pre', 'lm-json-content');
					pre.textContent = JSON.stringify(data, null, 2);
					return pre;
				}

				const text = await res.text();
				const selector = item.ajaxSelector || this.options.ajaxSelector;
				const frag = sanitizeAjaxHtml(text);

				if (selector) {
					const found = frag.querySelector(selector);
					if (!found) throw new Error(`Селектор "${selector}" не найден в ответе`);
					return found;
				}
				const wrap = h('div', 'lm-ajax-content');
				wrap.appendChild(frag);
				return wrap;

			} catch (err) {
				clearTimeout(timeoutId);
				if (err.name === 'AbortError') return null;
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
				const counter = h('div', 'lm-counter');
				counter.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
				this.container.appendChild(counter);
			}

			if (this.removeFocusTrap) {
				this.removeFocusTrap();
				this.removeFocusTrap = null;
			}
			if (this.options.autoFocus) {
				this.removeFocusTrap = trapFocus(this.container);
			}

			this._updateNavButtons();
			this.emit('contentReady', item);
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