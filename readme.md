# 🚀 LightModal v4.3

<div align="center">
  <p>
    <strong>Легковесная, современная и полнофункциональная библиотека модальных окон</strong>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-4.3.0-blue.svg" alt="Version">
    <img src="https://img.shields.io/badge/size-~15kb-green.svg" alt="Size">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
    <img src="https://img.shields.io/badge/dependencies-0-orange.svg" alt="Dependencies">
  </p>
</div>

## ✨ Особенности

- 🎯 **Нулевые зависимости** — чистый JavaScript, никаких внешних библиотек
- 🌊 **Lenis auto-detect** — автоматически определяет наличие Lenis и адаптирует scroll lock
- 📱 **Полная адаптивность** — отлично работает на всех устройствах
- 🎨 **Темы** — поддержка светлой/тёмной темы с auto-detect
- 🖱️ **Drag-to-close** — закрытие свайпом вверх или вниз (мышь + touch)
- 🖼️ **Универсальность** — изображения, видео, YouTube, Vimeo, Rutube, VK Video, iframe, inline-контент
- ♿ **Доступность** — полная поддержка клавиатуры, screen readers, ARIA
- 🎭 **Анимации** — плавные и настраиваемые эффекты
- 🔒 **Focus trap** — обновляется после каждой загрузки контента
- 💤 **Idle режим** — автоскрытие элементов управления (mouse + touch + keyboard)
- 🌐 **Dialog API** — нативный `<dialog>` где поддерживается, `<div>` как fallback
- 📡 **DOM-события** — `lightmodal:open` / `lightmodal:close` для интеграции с внешними модулями

## 📦 Установка

### Прямое подключение

```html
<link rel="stylesheet" href="lightmodal.css">
<script src="lightmodal.min.js"></script>
```

## 🧪 Демо / витрина

- **Онлайн:** [https://nivaiz.github.io/lightmodal-new/](https://nivaiz.github.io/lightmodal-new/) — та же витрина на GitHub Pages.
- **`index.html`** — витринная страница со всеми типами контента и примерами опций/событий.
- **`demo/ajax.html`** и **`demo/product.json`** — локальные фикстуры для проверки `type: 'ajax'` / `type: 'json'`.

Запуск локально (любой статический сервер). Например:

```bash
python -m http.server 4173
```

Открой `http://127.0.0.1:4173/index.html`.

## 🚀 Быстрый старт

```html
<!-- Изображение -->
<a href="image.jpg" data-lightmodal>Открыть изображение</a>

<!-- YouTube видео -->
<a href="https://www.youtube.com/watch?v=VIDEO_ID" data-lightmodal>Смотреть видео</a>

<!-- Inline контент -->
<a href="#my-modal" data-lightmodal>Показать модалку</a>
<div id="my-modal" class="inline-content">
  <h2>Заголовок</h2>
  <p>Контент модалки...</p>
</div>
```

### JavaScript API

```javascript
// Простое открытие
LightModal.open('image.jpg');

// С опциями
LightModal.open('#contact-form', {
  width: 500,
  theme: 'dark',
  closeOnBackdrop: false
});

// async/await — open() возвращает Promise<LightModal>
const modal = await LightModal.open('video.mp4', { theme: 'dark' });
```

## 📖 Документация

### data-атрибуты

```html
<a href="image.jpg"
   data-lightmodal
   data-caption="Описание"
   data-type="image"
   data-src-add="my-extra-class"
   data-gallery="group-1"
   data-alt="Alt text"
   data-lm-theme="dark"
   data-lm-main-class="lm-zoom-in"
   data-lm-width="800"
   data-lm-height="600"
   data-lm-close-on-backdrop="true"
   data-lm-drag-to-close="true"
   data-lm-close-existing="false"
   data-lm-loop="false"
   data-lm-gallery-nav="true"
   data-lm-gallery-swipe="true"
   data-lm-ajax-selector=".selector"
   data-lm-idle="3000">
  Открыть
</a>
```

| Атрибут | Описание | По умолчанию |
|---------|----------|--------------|
| `data-lightmodal` | Активирует автобиндинг | — |
| `data-src` | Источник контента (альтернатива href) | — |
| `data-type` | Тип: `image`, `video`, `iframe`, `ajax`, `json` | auto |
| `data-caption` | Подпись под контентом | — |
| `data-src-add` | CSS-класс, добавляемый к обёртке | — |
| `data-gallery` | Имя галереи (группировка) | — |
| `data-alt` | Alt для изображений | — |
| `data-lm-theme` | Тема: `dark`, `light`, `auto` | `dark` |
| `data-lm-main-class` | Доп. CSS-класс контейнера | `''` |
| `data-lm-width` | Ширина окна | auto |
| `data-lm-height` | Высота окна | auto |
| `data-lm-drag-to-close` | Закрытие перетаскиванием | `true` |
| `data-lm-close-on-backdrop` | Закрытие по клику на фон | `true` |
| `data-lm-close-on-esc` | Закрытие по Escape | `true` |
| `data-lm-close-existing` | Закрыть предыдущие модалки перед открытием | `false` |
| `data-lm-loop` | Зацикливание галереи | `false` |
| `data-lm-gallery-nav` | Кнопки prev/next в галерее | `true` |
| `data-lm-gallery-swipe` | Свайп влево/вправо в галерее | `true` |
| `data-lm-ajax-selector` | CSS-селектор для извлечения части HTML-ответа (AJAX) | `null` |
| `data-lm-idle` | Время до idle-режима (мс) | `3000` |

> Примечание: все `data-lm-*` автоматически мапятся в опции. Например, `data-lm-close-on-backdrop` → `closeOnBackdrop`.

### Опции

```javascript
LightModal.open('content', {
  // Внешний вид
  mainClass: '',          // Дополнительный CSS-класс контейнера
  theme: 'dark',          // 'dark' | 'light' | 'auto'

  // Управление
  closeButton: true,      // Кнопка закрытия
  closeOnBackdrop: true,  // Клик по фону закрывает
  closeOnEsc: true,       // Escape закрывает
  closeExisting: false,   // Закрыть другие модалки перед открытием

  // Галерея
  galleryNav: true,       // Кнопки prev/next
  gallerySwipe: true,     // Swipe влево/вправо в галерее
  loop: false,            // Зацикливание галереи

  // Анимация
  closeSpeed: 366,        // Скорость закрытия (мс)

  // Функциональность
  dragToClose: true,      // Свайп вверх/вниз для закрытия
  autoFocus: true,        // Фокус на первом интерактивном элементе
  restoreFocus: true,     // Вернуть фокус после закрытия
  hideScrollbar: true,    // Блокировать скролл страницы

  // Idle режим
  idle: 3000,             // Мс до скрытия UI (false — отключить)

  // Размеры
  width: null,            // число (px) или строка ('80vw')
  height: null,

  // Шаблоны (HTML-строки)
  spinnerTpl: '<div class="lm-spinner"></div>',
  errorTpl: '<div class="lm-error">{{message}}</div>', // {{message}} — плейсхолдер
  closeBtnTpl: '<button class="lm-close-btn" type="button" aria-label="Close">…</button>',
  prevBtnTpl: '<button class="lm-nav-btn lm-nav-prev" type="button" aria-label="Prev">…</button>',
  nextBtnTpl: '<button class="lm-nav-btn lm-nav-next" type="button" aria-label="Next">…</button>',

  // Callbacks (см. раздел «События»)
  on: {}
});
```

### Статические методы

```javascript
// Открыть — возвращает Promise<LightModal>
const modal = await LightModal.open(src, options);

// Закрыть текущую модалку
LightModal.close();

// Закрыть все открытые модалки (await поддерживается)
await LightModal.closeAll();

// Получить текущий экземпляр
const current = LightModal.getInstance();

// Получить по ID
const modal = LightModal.getInstance('lm-1');
```

### Методы экземпляра

```javascript
const modal = await LightModal.open('#form', { closeOnBackdrop: false });

// Закрыть — возвращает Promise
await modal.close();

// Подписка на события
modal.on('contentReady', (instance, item) => { … });
modal.off('contentReady', handler);
```

### События

| Событие | Аргументы | Описание |
|---------|-----------|----------|
| `init` | `instance` | После создания DOM |
| `open` | `instance` | После открытия |
| `beforeClose` | `instance` | Перед закрытием — `return false` отменяет |
| `close` | `instance` | Начало закрытия |
| `destroy` | `instance` | После уничтожения |
| `contentReady` | `instance, item` | Контент загружен и добавлен в DOM |

```javascript
const modal = await LightModal.open('#form', {
  on: {
    // Отмена закрытия если форма не сохранена
    beforeClose(instance) {
      if (formHasChanges()) return false;
    },
    contentReady(instance, item) {
      console.log('Загружен:', item.src);
    }
  }
});
```

### DOM-события

LightModal диспатчит кастомные события на `document` — любой модуль проекта
может подписаться без прямой зависимости от LightModal:

```javascript
document.addEventListener('lightmodal:open', (e) => {
  console.log('Открылась модалка', e.detail.id);
  // e.detail.instance — экземпляр LightModal
});

document.addEventListener('lightmodal:close', (e) => {
  console.log('Закрылась модалка', e.detail.id);
});
```

## 🌊 Интеграция с Lenis

LightModal **автоматически** определяет наличие Lenis:

- Lenis должен добавлять класс **`lenis`** на `<html>` (так делает Lenis по умолчанию).
- Затем LightModal ищет инстанс в типичных местах: `window.lenis`, `window.lenisInstance`, `window.__lenis`, `window.__lenis__`, `window.smoothScroll`, `window.app?.lenis`, `window.App?.lenis`.

- **С Lenis:** `lenis.stop()` при открытии → `lenis.scrollTo(immediate)` + `lenis.start()` при закрытии
- **Без Lenis:** нативный `window.scrollTo({ behavior: 'instant' })`

Дополнительной настройки не требуется.

```javascript
// Если Lenis хранится под нестандартным именем:
window.lenis = myLenisInstance; // или
window.lenisInstance = myLenisInstance;
```

## 🎨 CSS-переменные

```css
:root {
  /* Backdrop */
  --lm-backdrop-bg: transparent;
  --lm-backdrop-blur: 8px;

  /* Анимация */
  --lm-duration: 366ms;

  /* Окно */
  --lm-bg: #fff;
  --lm-color: #222;
  --lm-border-color: rgba(0, 0, 0, 0.1);
  --lm-border-radius: 12px;
  --lm-shadow-large: 0 24px 80px rgba(0, 0, 0, 0.25);

  /* Кнопка закрытия */
  --lm-close-bg: rgba(255, 255, 255, 0.9);
  --lm-close-hover-bg: rgba(255, 255, 255, 1);
  --lm-close-color: #444;
  --lm-close-size: 36px;
  --lm-close-border-radius: 50%;

  /* Контент */
  --lm-content-padding: 2rem;

  /* Caption */
  --lm-caption-color: #666;
  --lm-caption-bg: rgba(255, 255, 255, 0.95);

  /* Спиннер */
  --lm-spinner-color-1: rgba(0, 0, 0, 0.1);
  --lm-spinner-color-2: rgba(0, 0, 0, 0.8);

  /* z-index */
  --lm-z-index: 1050;
}
```

### Кастомная тема

```css
[data-theme="brand"] {
  --lm-bg: #1a1a2e;
  --lm-color: #eee;
  --lm-close-bg: rgba(255, 255, 255, 0.1);
  --lm-close-color: #fff;
  --lm-border-color: rgba(255, 255, 255, 0.1);
}
```

```javascript
LightModal.open('#content', { theme: 'brand' });
```

## 🎮 Примеры

### AJAX

LightModal автоматически определяет тип ответа по `Content-Type` заголовку.
`<script>` теги и `on*` атрибуты из ответа удаляются автоматически.

#### HTML-ответ

```javascript
// Весь ответ
LightModal.open('/modal/product/123', { type: 'ajax' });

// Только нужный кусок страницы
LightModal.open('/product/123', {
  type: 'ajax',
  ajaxSelector: '.product-modal'
});

// POST-запрос с данными
LightModal.open('/api/preview', {
  type: 'ajax',
  fetchOptions: {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 123 })
  }
});
```

#### JSON-ответ

Используй `ajaxSuccess(data, instance)` — функция получает распарсенный объект
и должна вернуть HTML-строку или DOM-элемент для рендера:

```javascript
LightModal.open('/api/product/123', {
  type: 'json',
  ajaxSuccess(data, modal) {
    // data — уже распарсенный объект
    return `
      <div class="product-card">
        <img src="${data.image}" alt="${data.name}">
        <h2>${data.name}</h2>
        <p>${data.description}</p>
        <span class="price">${data.price} ₽</span>
      </div>
    `;
  }
});

// Можно вернуть и DOM-элемент
LightModal.open('/api/user/42', {
  type: 'json',
  ajaxSuccess(data) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.textContent = data.name; // безопасно — не innerHTML
    return card;
  }
});
```

Если `ajaxSuccess` не указан — JSON отображается как форматированный текст (`<pre>`).

#### Опции AJAX

| Опция | Тип | Описание |
|-------|-----|----------|
| `type` | `'ajax'` \| `'json'` | Явное указание типа |
| `fetchOptions` | `object` | Опции для `fetch()` (method, headers, body…) |
| `ajaxSelector` | `string` | CSS-селектор для извлечения части HTML-ответа |
| `ajaxSuccess` | `function` | Колбэк для рендера JSON → HTML или Element |

### Формы с AJAX

```javascript
let formDirty = false;

const modal = await LightModal.open('#contact-form', {
  width: 500,
  closeOnBackdrop: false,
  on: {
    beforeClose() {
      if (formDirty && !confirm('Данные не сохранены. Закрыть?')) {
        return false; // отменяем закрытие
      }
    }
  }
});

modal.container.querySelector('input').addEventListener('input', () => {
  formDirty = true;
});
```

### Подтверждение удаления

```javascript
async function confirmDelete(itemId) {
  const modal = await LightModal.open('#confirm-dialog', {
    width: 400,
    closeOnBackdrop: false,
    closeOnEsc: false,
    closeButton: false
  });

  modal.content.querySelector('.btn-confirm').onclick = async () => {
    await deleteItem(itemId);
    modal.close();
  };

  modal.content.querySelector('.btn-cancel').onclick = () => modal.close();
}
```

### Видео

```javascript
// YouTube
LightModal.open('https://www.youtube.com/watch?v=VIDEO_ID', {
  theme: 'dark'
});

// Vimeo
LightModal.open('https://vimeo.com/VIDEO_ID');

// Rutube
LightModal.open('https://rutube.ru/video/VIDEO_ID/');

// VK Video
LightModal.open('https://vk.com/video-123456_789');

// Локальное видео
LightModal.open('video.mp4', { type: 'video' });
```

### Кастомный размер iframe/видео

В текущих стилях размер для iframe задаётся опциями `width`/`height` (или `data-lm-width`/`data-lm-height`).
Для YouTube/Vimeo/Rutube/VK рекомендуется задавать их явно, например:

```javascript
LightModal.open('https://www.youtube.com/watch?v=VIDEO_ID', {
  width: '95vw',
  height: '70vh'
});
```

### Несколько модалок

```javascript
// closeExisting: true — закрывает предыдущие перед открытием (ждёт анимацию)
LightModal.open('#second-modal', { closeExisting: true });

// closeExisting: false (по умолчанию) — открывает поверх
// scroll lock учитывает все открытые модалки через lockCount
LightModal.open('#overlay-modal');
```

### Интеграция со сторонними модулями

```javascript
// Пример: блокировка фонового эффекта при открытой модалке
document.addEventListener('lightmodal:open', () => {
  myBackgroundEffect.pause();
});

document.addEventListener('lightmodal:close', () => {
  myBackgroundEffect.resume();
});
```

## 🖱️ Drag-to-close

- **Вниз** — свайп вниз закрывает (классика мобильных bottom-sheet)
- **Вверх** — свайп вверх закрывает
- **Горизонталь** — не закрывает, не мешает скроллу
- **Рабочая зона** — весь контейнер включая backdrop (удобно для видео/изображений)
- **Мышь** — работает drag на десктопе, cursor: grab на backdrop

```javascript
LightModal.open('image.jpg', {
  dragToClose: true  // по умолчанию включено
});
```

## ♿ Доступность

- Нативный `<dialog>` с `aria-modal="true"` и `role="dialog"`
- Focus trap обновляется после каждой загрузки контента
- Восстановление фокуса на триггере после закрытия
- `prefers-reduced-motion` — анимации отключаются
- `prefers-contrast: high` — усиленные границы и контраст
- Keyboard: `Escape` — закрытие, `Tab`/`Shift+Tab` — навигация внутри

## 📋 Поддерживаемые типы контента

| Тип | Определение | Пример |
|-----|-------------|--------|
| Изображение | по расширению или `type: 'image'` | `image.jpg`, `photo.webp` |
| HTML5 видео | по расширению или `type: 'video'` | `video.mp4`, `clip.webm` |
| YouTube | по URL | `youtube.com/watch?v=…` |
| Vimeo | по URL | `vimeo.com/…` |
| Rutube | по URL | `rutube.ru/video/…` |
| VK Video | по URL | `vk.com/video…` |
| Inline | `#id` | `#my-modal` |
| AJAX HTML | `type: 'ajax'` | `/modal/product/123` |
| AJAX JSON | `type: 'json'` или `Content-Type: application/json` | `/api/product/123` |
| iframe | любой другой URL | `https://example.com` |
