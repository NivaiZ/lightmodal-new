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
- 📌 **Sticky-friendly scroll lock** — без `overflow: hidden` на html/body, `position: sticky` не ломается
- 📱 **Полная адаптивность** — отлично работает на всех устройствах
- 🎨 **Темы** — поддержка светлой/тёмной темы с auto-detect
- 🖱️ **Drag-to-close** — закрытие свайпом вверх или вниз (мышь + touch)
- 📱 **Bottom Sheet** — нижняя шторка со spring-анимацией, нативный скролл внутри
- 🧭 **Tap-bar teleport** — перенос нижней навигации внутрь sheet (как Vue `<Teleport>`)
- 📜 **HTML slide mode** — скролл на весь viewport, карточка растёт по контенту (inline, AJAX, media)
- 🖼️ **Универсальность** — изображения, видео, YouTube, Vimeo, Rutube, VK Video, iframe, inline-контент
- ♿ **Доступность** — полная поддержка клавиатуры, screen readers, ARIA
- 🎭 **Анимации** — `mainClass`: `lm-zoom-in`, `lm-slide-up`, `lm-fade` (анимируется карточка, не слайд)
- 🔒 **Focus trap** — обновляется после каждой загрузки контента
- 💤 **Idle режим** — автоскрытие UI после бездействия (mouse + touch + keyboard)
- 🌐 **Dialog API** — нативный `<dialog>` где поддерживается, `<div>` как fallback
- 📡 **DOM-события** — `lightmodal:open` / `lightmodal:close` для интеграции с внешними модулями

## 🛠️ Разработка

> **Правки вносить только в `lightmodal.js` и `lightmodal.css`.**
> Файлы `lightmodal.min.js` и `lightmodal.min.css` — минифицированные версии, пересобираются через `npm run build`.

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

Запуск локально:

```bash
npm install
npm run dev
```

Открой `http://localhost:3000/`. Сборка минифицированных файлов: `npm run build`.

Альтернатива — любой статический сервер (`python -m http.server 4173` и т.п.).

## 🚀 Быстрый старт

```html
<!-- Изображение -->
<a href="image.jpg" data-lightmodal>Открыть изображение</a>

<!-- YouTube видео -->
<a href="https://www.youtube.com/watch?v=VIDEO_ID" data-lightmodal>Смотреть видео</a>

<!-- Inline контент -->
<a href="#my-modal" data-lightmodal>Показать модалку</a>

<template id="my-modal">
  <div class="inline-content">
    <h2>Заголовок</h2>
    <p>Контент модалки...</p>
  </div>
</template>
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

### Inline: `<template>` (рекомендуется)

Контент внутри `<template>` **не рендерится** на странице — вёрстка не «болтается» в DOM. При открытии `#id` библиотека клонирует содержимое через `document.importNode()` (как рекомендует [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/template)).

```html
<a href="#contact-form" data-lightmodal>Форма</a>

<template id="contact-form">
  <div class="inline-content">
    <h2>Обратная связь</h2>
    <form>...</form>
  </div>
</template>
```

Разрешение `#id` (в порядке приоритета):

1. **`<template id="…">`** — клон при каждом открытии (шаблон остаётся на месте)
2. **Живой DOM-узел** с `id` — перенос в модалку и возврат при закрытии (legacy)
3. **`#id` внутри `template.content`** — клон найденного узла

AJAX/JSON **не затрагиваются**: ответ по-прежнему парсится через временный `<template>` внутри библиотеки и вставляется как DOM.

```javascript
// Template и обычный inline — одинаковый API
LightModal.open('#contact-form');
LightModal.open('/api/modal.html', { type: 'ajax' });
```

## 📖 Документация

### data-атрибуты

```html
<a href="image.jpg"
   data-lightmodal
   data-caption="Описание"
   data-type="image"
   data-src-add="my-extra-class"
   data-alt="Alt text"
   data-lm-theme="dark"
   data-lm-main-class="lm-zoom-in"
   data-lm-width="800"
   data-lm-height="600"
   data-lm-close-on-backdrop="true"
   data-lm-drag-to-close="true"
   data-lm-close-existing="false"
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
| `data-alt` | Alt для изображений | — |
| `data-lm-theme` | Тема: `dark`, `light`, `auto` | `dark` |
| `data-lm-main-class` | Доп. CSS-класс контейнера (`lm-zoom-in`, `lm-slide-up`, `lm-fade`) | `''` |
| `data-lm-width` | Ширина окна | auto |
| `data-lm-height` | Высота окна | auto |
| `data-lm-drag-to-close` | Закрытие перетаскиванием | `true` |
| `data-lm-close-on-backdrop` | Закрытие по клику на фон | `true` |
| `data-lm-close-on-esc` | Закрытие по Escape | `true` |
| `data-lm-close-existing` | Закрыть предыдущие модалки перед открытием | `false` |
| `data-lm-ajax-selector` | CSS-селектор для извлечения части HTML-ответа (AJAX) | `null` |
| `data-lm-idle` | Время до idle-режима (мс) | `3000` |
| `data-lm-close-position` | Позиция кнопки закрытия: `static`, `absolute`, `fixed` | auto |
| `data-spring-bottom-sheet` | Открыть как bottom sheet снизу экрана со spring-анимацией | `false` |
| `data-tap-bar-move` | Телепортировать tap-bar внутрь bottom sheet: `true` или CSS-селектор | `false` |
| `data-custom-background` | CSS-цвет фона окна (`#fff`, `rgba(...)`, etc.) | — |

> Примечание: все `data-lm-*` автоматически мапятся в опции. Например, `data-lm-close-on-backdrop` → `closeOnBackdrop`.

### Опции

```javascript
LightModal.open('content', {
  // Внешний вид
  mainClass: '',          // Дополнительный CSS-класс контейнера
  theme: 'dark',          // 'dark' | 'light' | 'auto'

  // Управление
  closeButton: true,      // Кнопка закрытия
  closePosition: null,    // static | absolute | fixed | null (auto)
  closeOnBackdrop: true,  // Клик по фону закрывает
  closeOnEsc: true,       // Escape закрывает
  closeExisting: false,   // Закрыть другие модалки перед открытием

  // Анимация
  openSpeed: 366,         // Скорость открытия (мс); после неё включается скролл слайда
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

  // Bottom sheet
  bottomSheet: false,      // открыть как нижний лист (аналог data-spring-bottom-sheet)
  tapBarMove: false,       // true | CSS-селектор — телепорт tap-bar в sheet (только с bottomSheet)

  // Кастомный фон
  customBackground: null,  // CSS-цвет, напр. '#1a1a2e' или 'rgba(0,0,0,0.8)'

  // Форма: авто-сброс при успешной AJAX-отправке
  formAutoReset: true,     // false — отключить

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
  --lm-backdrop-bg: rgba(182, 187, 198, 0.8);
  --lm-backdrop-blur: 4px;

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
  --lm-max-width: min(90vw, 1200px);
  --lm-max-height: none;

  /* Caption */
  --lm-caption-color: #666;
  --lm-caption-bg: rgba(255, 255, 255, 0.95);

  /* Спиннер */
  --lm-spinner-color-1: rgba(0, 0, 0, 0.1);
  --lm-spinner-color-2: rgba(0, 0, 0, 0.8);

  /* z-index */
  --lm-z-index: 1050;

  /* Bottom sheet + tapBarMove (задаётся автоматически при телепорте) */
  --lm-tap-bar-height: 0px;
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

### Bottom Sheet

Нижняя шторка с spring-анимацией. Контент скроллится внутри панели. Свайп **вниз** закрывает (когда контент докручен до верха); свайп вверх не двигает sheet. Также закрытие — backdrop, Escape или API.

```html
<a href="#my-sheet" data-lightmodal data-spring-bottom-sheet="true">
  Открыть sheet
</a>

<template id="my-sheet">
  <div class="inline-content">
    <h2>Заголовок</h2>
    <p>Длинный контент…</p>
  </div>
</template>
```

```javascript
LightModal.open('#my-sheet', { bottomSheet: true });
```

#### Tap-bar teleport (`tapBarMove`)

Если на странице есть фиксированная нижняя навигация (мобильный tab-bar), её можно перенести **внутрь** открытого sheet — панель остаётся закреплённой внизу шторки, контент скроллится над ней. При закрытии элемент возвращается на исходное место в DOM.

По умолчанию при `tapBarMove: true` ищется `[data-lm-tap-bar]` или `.demo-tapbar`. Можно передать свой селектор.

```html
<!-- Навигация на странице -->
<nav class="app-tabbar" data-lm-tap-bar>
  <a href="#section-a">A</a>
  <a href="#section-b">B</a>
</nav>

<!-- Sheet с телепортом tap-bar -->
<a href="#sheet-content"
   data-lightmodal
   data-spring-bottom-sheet="true"
   data-tap-bar-move="true">
  Открыть
</a>
```

```javascript
LightModal.open('#sheet-content', {
  bottomSheet: true,
  tapBarMove: true          // или '.app-tabbar'
});
```

Поведение:

- tap-bar добавляется в конец `.lm-content-wrapper` с классом `lm-tap-bar-moved`
- высота панели записывается в CSS-переменную `--lm-tap-bar-height` (отступ у скроллируемого контента)
- на `body` вешается класс `lm-tap-bar-teleported` (удобно для сброса `padding-bottom` страницы)
- клик по якорной ссылке внутри tap-bar закрывает sheet и плавно скроллит к секции

> **Важно:** у переносимого элемента должны быть свои стили для состояния `.lm-tap-bar-moved` (в демо — отдельный блок в `index.html`). Библиотека задаёт позиционирование внутри sheet; внешний вид — на стороне проекта.

### Темы / анимации (`mainClass`)

Готовые классы анимации карточки:

| Класс | Эффект |
|-------|--------|
| `lm-zoom-in` | масштаб от `0.3` |
| `lm-slide-up` | выезд снизу |
| `lm-fade` | только fade (без transform) |

```html
<a href="photo.jpg"
   data-lightmodal
   data-lm-theme="dark"
   data-lm-main-class="lm-zoom-in">
  Dark + zoom-in
</a>
```

```javascript
LightModal.open('photo.jpg', {
  theme: 'light',
  mainClass: 'lm-slide-up',
});
```

В режиме `has-html` анимируется карточка `.lm-content`, а не весь viewport-слайд — скроллбар не мелькает во время transition.

### HTML slide mode

Для всего контента, кроме bottom sheet, LightModal включает режим **HTML slide**:

- `.lm-content-wrapper.has-html` — прозрачный слайд на весь viewport
- `.lm-content` — карточка (для inline/AJAX — `.has-inline-content`, растёт по высоте)
- анимация открытия/закрытия — только у карточки
- во время анимации `overflow: hidden`; после `openSpeed` контейнер получает `.is-ready` и слайд становится прокручиваемым (`overflow: auto`) — удобно при маленькой высоте окна
- клик по backdrop (вне карточки) закрывает модалку

Bottom sheet использует **отдельный** layout со скроллом внутри шторки, без `has-html`.

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

- **Вниз** — свайп вниз закрывает обычную модалку
- **Вверх** — свайп вверх закрывает
- **Горизонталь** — не закрывает, не мешает скроллу
- **Рабочая зона** — весь контейнер включая backdrop (удобно для видео/изображений)
- **Мышь** — работает drag на десктопе, cursor: grab на backdrop
- **Bottom sheet** — свайп **вниз** закрывает (когда контент наверху); свайп вверх не двигает sheet. Spring snap-back при незакрывающем жесте

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
- Keyboard: `Escape` — закрытие, `Tab`/`Shift+Tab` — фокус внутри

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
