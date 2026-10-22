# Превью 0.4 — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** превратить прототип 0.3 в превью 0.4: онбординг-окно с пометкой демо, механики понимания
(два слоя, вкладки версий, статусы, проверка-заглушка) в лекции ШАД, режим «Проверить себя» в лабе L01, новая лекция «Законы Ньютона»
без видео с источником-учебником и задачами с лестницей подсказок, карточка возвращения «Продолжить
разбор» и три главных действия фрагмента.

**Architecture:** статический сайт без сборки, как 0.3. Новая логика в отдельных IIFE-модулях с
глобалом `window.X` по образцу `js/ui.js`: `Learn` (состояние и правила, без DOM), `LearnUI`
(блоки механик для любой лекции), `Onboarding`, `Physics` (страница лекции и задачи). Контент —
в `data/*.js` (`window.CC…`). `app.js` и `custom.js` меняются точечно.

**Tech Stack:** vanilla JS, `marked` 12.0.2 (уже подключён), Playwright (Python, `uv run --with playwright`),
`delegate.py` (OpenRouter) для демо-ответов.

**Spec:** `docs/preview-0.4/spec.md` (ред. 3). Контекст механик —
`docs/preview-0.4/mvp-design.md` (ред. 2), разделы 6.x.

## Global Constraints

- Рабочая копия — `prototype/` (свой git, `main` = GitHub Pages). Коммиты локальные; **push только после «публикуй» Петра**.
- Запуск: `cd prototype && python3 -m http.server 8765`; тесты с `CC_BASE_URL=http://127.0.0.1:8765/`.
- Ширины проверки: 390 / 1024 / 1440, светлая и тёмная тема на 390. Нет горизонтального скролла, нет `pageerror`.
- Хранение — только `localStorage` этого браузера; новый ключ `cc-preview-0.4`, ключ 0.3 `cc-proto-0.2` не ломать. Каждый доступ в `try/catch`.
- Плашка онбординга дословно: «Это демо-превью. Ответы ИИ заготовлены заранее, проверка ответов — упрощённая заглушка. Сохраняется только в этом браузере».
- Placeholder «Как я понял» дословно: «Напиши 1–2 предложения своими словами. ИИ сюда не пишет — это твой след понимания».
- Пометки происхождения дословно: «из источника» / «объяснение ИИ» / «моя заметка».
- Статусы дословно: «видел» → «разобрался с помощью» → «воспроизвёл сам»; задача ещё «решено с решением». Статус не понижается.
- Тексты заглушки: короче 15 слов → «Слишком коротко, раскрой: …»; нет ключевых понятий → «Не хватает: …»; иначе «Зачтено». Плашка у вердикта: «Демо-проверка по ключевым словам, не ИИ». Оспаривание → «засчитано по оспариванию».
- Плашка архива дословно: «Уходит в архив, в MVP-0 нет».
- Метка версии в сайдбаре: «Превью 0.4 · демо».
- Меню фрагмента дословно: главные «Объяснить» · «Показать на примере» · «Проверить себя»; группа «Ещё»: «Переписать иначе», «Моя версия», «Спросить в чате».
- Кнопка возвращения дословно: «Продолжить разбор».
- Демо-ответы ИИ: модель `google/gemini-3.7-flash` через `delegate.py`, первый дубль без редактуры, temperature 0.3. Оценка стоимости < $0.10.
- Физика: OpenStax *Physics* (high school), CC BY 4.0; атрибуция на странице лекции. Цитаты оригинала — короткие фрагменты на английском.
- Комментарии и имена — в стиле окружающего кода (русские комментарии в JS, `const $ = …` хелперы).

## Review Focus

1. Повторный заход после частичного прохождения: статусы, «Как я понял», вкладки и шаг лестницы восстанавливаются после reload — тест в Task 5 и Task 8.
2. Пустой/пробельный ответ и ответ с ключевым словом в другой форме («инерцией» vs «инерция») — заглушка не падает и учитывает синонимы/основы — unit-проверки в Task 1.
3. Число с запятой («2,5») и с единицами («2.5 м/с²») в расчётной задаче принимается — unit-проверка в Task 1.
4. Онбординг не перекрывает прямую ссылку на лекцию повторно и не ломает старые сценарии 0.3 — init-script в тестах, отдельная проверка в Task 2.
5. Повреждённый JSON в `cc-preview-0.4` → чистое состояние без ошибки — unit-проверка в Task 1.
6. Карточка возвращения после reload ведёт на последнее место (раздел/лаба/задача) с черновиком и режимом лабы; в чистом состоянии — «Начать» — Task 10.

---

### Task 1: Ядро `Learn` — состояние, статусы, проверка-заглушка

**Files:**
- Create: `prototype/js/learn.js`
- Modify: `prototype/index.html` (подключить `js/learn.js` перед `js/custom.js`)
- Test: `prototype/tests/learning-flow.py` (новая функция `learn_unit(page)`, вызывается один раз до сценариев)

**Interfaces:**
- Produces (`window.Learn`):
  - `state()` → объект `{ onboarded: bool, status: {[key]: "seen"|"helped"|"self"|"solved"}, understood: {[key]: string}, disputed: {[key]: true}, versions: {[pid]: {active: "orig"|"simple"|"rewrite"|"mine"}}, problems: {[id]: {rung: number, revealed: number, solved: "self"|"with-solution"|null, similarSolved: bool}} }`
  - `key(lecture: "shad"|"physics", unit: string|number)` → `"shad:4"`
  - `setStatus(key, status)` — повышает, не понижает; порядок `seen < helped < solved < self`; сохраняет; диспатчит `cc:learn`
  - `grade(text: string, rule: {minWords: number, concepts: string[][]})` → `{ ok: bool, reason: "short"|"missing"|"ok", missing: string[] }`; понятие — массив синонимов, совпадение по основе (нижний регистр, `ё→е`, префикс длиной `max(4, len-2)` слова)
  - `checkNumber(input: string, expected: number, tol: number)` → bool; принимает запятую, игнорирует хвост с единицами
  - `progress(lecture, units: (string|number)[])` → `{ self: number, total: number }` (считает только `"self"`)
  - `save(patch)` / `reset()`
  - `touch(place: {lecture, unit, kind: "section"|"lab"|"problem", route: string, mode?: "explore"|"check"})` — запоминает последнее место в `state().last` (для Task 10)
- [ ] **Step 1: Write the failing test** — `learn_unit(page)` через `page.evaluate`:
  - `grade("", R).reason == "short"`; `grade("тело сохраняет скорость", R)` при `minWords: 15` → `"short"`;
  - 15+ слов без понятия → `reason == "missing"`, `missing == ["инерция"]` для `R = {minWords: 15, concepts: [["инерция","инертн"], ["равнодействующ","сумма сил"]]}`;
  - 15+ слов с «инерцией» и «равнодействующая» → `ok == True`;
  - `checkNumber("2,5", 2.5, 0.05)`, `checkNumber("2.5 м/с²", 2.5, 0.05)` → True; `checkNumber("3", 2.5, 0.05)`, `checkNumber("", 2.5, 0.05)` → False;
  - `setStatus("shad:1","self"); setStatus("shad:1","seen")` → статус остаётся `"self"`;
  - `touch({lecture:"shad",unit:4,kind:"section",route:"lecture-tools-mcp"})` + reload → `state().last.unit == 4`;
  - `localStorage["cc-preview-0.4"] = "{bad"` + reload → `Learn.state().status == {}` без `pageerror`.
- [ ] **Step 2: Run, verify FAIL** — `uv run --with playwright python tests/learning-flow.py` → `Learn is not defined`.
- [ ] **Step 3: Implement `js/learn.js`** по интерфейсу выше.
- [ ] **Step 4: Run, verify PASS** (unit-часть; сценарии 0.3 — без изменений).
- [ ] **Step 5: Commit** `feat(learn): state, statuses and keyword check stub (0.4)`.

### Task 2: Онбординг-окно и метка превью

**Files:**
- Create: `prototype/js/onboarding.js`
- Modify: `prototype/index.html` (модалка `#onb-modal`, пункт `[data-open-onboarding]` «Как это работает» в `.side-foot`, `.proto-pill` → «Превью 0.4 · демо», текст «О прототипе»), `prototype/styles.css`
- Test: `prototype/tests/ux-smoke.py`, `prototype/tests/learning-flow.py`

**Interfaces:**
- Consumes: `Learn.state().onboarded`, `Learn.save({onboarded: true})`, `CCUI.open/close`.
- Produces: `window.Onboarding.open()`; кнопки `[data-onb=shad]` → `#lecture-tools-mcp`, `[data-onb=physics]` → `#physics`; `[data-onb-close]`.
- Окно: заголовок, плашка (Global Constraints), три пункта из spec §2, две кнопки. Показывается при старте, если `!onboarded`; любое закрытие ставит `onboarded`.
- [ ] **Step 1: Write the failing test** — в `ux-smoke.py` новый блок на 390 и 1440 в чистом контексте: `#onb-modal` видим, содержит плашку дословно; Tab остаётся внутри; Escape закрывает; reload — окна нет; клик `[data-open-onboarding]` открывает снова; `[data-onb=physics]` меняет hash на `#physics`. Во всех остальных контекстах обоих файлов — `context.add_init_script("localStorage.setItem('cc-preview-0.4', JSON.stringify({onboarded: true}))")`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** `js/onboarding.js` + разметку/стили (паттерн диалога как `#add-modal`).
- [ ] **Step 4: Run both test files, verify PASS.**
- [ ] **Step 5: Commit** `feat(onboarding): single demo-labelled intro dialog (0.4)`.

### Task 3: Лаба L01 и code-video — режим «Проверить себя», заявки в архив

> **Ред. 22.10.2026 по отчёту GPT DR** (`docs/research/2026-10-22-gpt-dr-labs-report.md`, сверка —
> `…-verification.md`). Лабы и code-video **не сворачиваются**. Предсказание — перед содержательной
> развилкой, не перед каждым запуском; исследование без вопросов остаётся режимом по умолчанию.
> Согласовано: «согласен», TG 44562. Зависит от Task 1 (`Learn.grade`, `Learn.checkNumber`, `Learn.setStatus`).

**Files:**
- Modify: `prototype/js/lab.js` (переключатель режимов, поток проверки), `prototype/js/codevideo.js` (один необязательный вопрос), `prototype/js/app.js` (`renderSide`, `renderCourse`: заявки — в архив), `prototype/styles.css`
- Create: `prototype/data/lab-checks.js` — `window.CCLabChecks = { L01: {predict, explain: {question, minWords: 15, concepts}, transfer: {question, losses: 2, expected: 3}} }`
- Test: `prototype/tests/ux-smoke.py`, `prototype/tests/learning-flow.py`

**Interfaces:**
- Consumes: `Learn.key("shad","L01")`, `Learn.grade`, `Learn.checkNumber`, `Learn.setStatus`, `Learn.state().understood`, `Learn.save`.
- Produces:
  - В шапке `.lab` — `.seg-ctl[data-group=mode]`: «Исследовать» (`data-v=explore`, по умолчанию, текущее поведение 0.3 без изменений) и «Проверить себя» (`data-v=check`). Переключение обратно не теряет введённое.
  - Режим `check` (`.lab.checking`): ставит сценарий «Ответ потерян», сравнение вкл, потерь 1; счётчики и `.lab-comparison` скрыты (`.masked`) до ответа.
    1. **Предсказание** `.lab-predict`: «Сколько возвратов получит Jane Doe без ключа и с ключом?» — варианты `[data-pred]` «1 и 1» / «2 и 1» / «2 и 2»; кнопка «Запуск» доступна только после выбора. После прогона — снять маску, показать «Ваш прогноз: … · вышло: 2 и 1».
    2. **Объяснение** `.lab-explain`: «Что объясняет расхождение между прогонами?», `textarea`, `Learn.grade` с понятиями `[["ключ","идемпотент"],["повтор","повторн"],["выполн","эффект","возврат"]]`; вердикт и «Оспорить» — как в Task 5 (та же плашка «Демо-проверка по ключевым словам, не ИИ»).
    3. **Новое условие** `.lab-transfer`: «Без ключа потеряно 2 ответа подряд. Сколько возвратов?» — `Learn.checkNumber(input, 3, 0)`; затем кнопка «Проверить запуском» ставит потерь 2 и проигрывает.
    4. Успех шагов 2 и 3 → `Learn.setStatus("shad:L01","self")`; текст объяснения сохраняется в `understood["shad:L01"]` и показывается под лабой блоком «Мой вывод · моя заметка».
    5. Вход в лабу и смена режима → `Learn.touch({lecture:"shad", unit:"L01", kind:"lab", route:"tools-mcp-lab", mode})`; черновик объяснения сохраняется по `input` (для Task 10).
  - code-video: перед шагом «Выполнение» — необязательная карточка `.cv-ask` «Где выполняется cancel_booking?» (`в модели` / `в узле tools` / `у провайдера модели`), ролик не блокирует: «Пропустить» и автопродолжение воспроизведения. Ответ показывает пояснение и продолжает с шага «Выполнение». Повторно в той же сессии не показывается.
  - Заявки на генерацию: в сайдбаре группа «Заявки на генерацию» и вкладка заявок на странице курса — внутри `<details class="side-archive">` с плашкой «Уходит в архив, в MVP-0 нет». Группа «Лаборатории», `.localnav [data-sec=lab|codevideo]` и `#example-route` — видимы, как в 0.3.
- [ ] **Step 1: Write the failing test** — `learning-flow.py`: на `#tools-mcp-lab` режим по умолчанию `explore`, счётчики видны; «Проверить себя» → счётчики `.masked`, «Запуск» disabled; выбор «2 и 1» → запуск → маска снята, в `.lab-predict` «вышло: 2 и 1»; объяснение из 3 слов → «Слишком коротко»; из 15+ слов с ключом/повтором/выполнением → «Зачтено»; новое условие «3» → верно; бейдж/статус `shad:L01 == "self"`; reload → «Мой вывод» на месте. `ux-smoke.py`: `.localnav [data-sec=lab]` видна на `#tools-mcp-notes`; группа заявок внутри закрытого `.side-archive`; code-video: на шаге 4 `.cv-ask` видна, «Пропустить» → воспроизведение идёт дальше; 390 px — без горизонтального скролла в режиме `check`.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement.** Числа ответов (2 и 1; 3) сверить с `buildSteps` при `losses` 1 и 2 — если симуляция даёт иное, править ожидания, а не модель.
- [ ] **Step 4: Run both files, verify PASS** (сценарии L01/L02 0.3 в режиме `explore` не изменились).
- [ ] **Step 5: Commit** `feat(lab): check-yourself mode in L01, optional question in code-video, requests to archive (0.4)`.

### Task 4: Вкладки версий абзаца

**Files:**
- Modify: `prototype/js/custom.js` (`applyEdit`, `showMenu`, `doAction`, обработчики `data-mine`, `SIMPLE` → чтение из `window.CCDemoAI`)
- Create: `prototype/data/demo-ai.js` — `window.CCDemoAI = { meta: {model, date, prompt}, shad: { simple: {[sec]: string}, rewrite: {[sec]: string}, example: {[sec]: string}, chat: {...} }, physics: {simple: {}, rewrite: {}, example: {}} }`; `example` до Task 9 — «[черновик] Пример для §N»; до Task 9 — `shad.simple` = текущий `SIMPLE`, `rewrite` = те же тексты с префиксом «[черновик] », `meta.model = "заглушка до генерации"`
- Modify: `prototype/index.html`, `prototype/styles.css`
- Test: `prototype/tests/learning-flow.py`

**Interfaces:**
- Consumes: `Learn.state().versions`, `Learn.save`, `Learn.setStatus(key, "helped")`.
- Меню фрагмента (`showMenu`) по Global Constraints: главные `[data-fa=simple]` «Объяснить», `[data-fa=example]` «Показать на примере», `[data-fa=check]` «Проверить себя» (открывает проверку раздела из Task 5; до Task 5 — скрыта); `<details class="fa-more">` «Ещё» с `airewrite`, `rewrite`, `ask`. `scene` («Создать объяснение») из меню убирается. `example`: если у раздела есть лаба/code-video (карта `EXAMPLE_ROUTE = {sec: route}` по `#example-route` 0.3) — переход туда; иначе карточка `.xcard--example` с `CCDemoAI.<lecture>.example[sec]` и пометкой «объяснение ИИ · демо», статус `helped`.
- Produces: над `.frag` с версиями — `.vtabs[role=tablist]` с кнопками `[data-vtab=orig|simple|rewrite|mine]`, показываются только существующие; меню фрагмента: `[data-fa=simple]` «Объяснить проще», `[data-fa=airewrite]` «Переписать иначе», `[data-fa=rewrite]` «Моя версия» (как в 0.3, редактор). Вкладки ИИ помечены «объяснение ИИ · демо», «Моя версия» — «моя заметка», «Оригинал» — «объяснение ИИ» для ШАД. Действия ИИ ставят статусу раздела `helped`. Карточка `.xcard--draft-simple` 0.3 удаляется; `[data-mine=reset]` удаляет вкладку «Моя версия».
- [ ] **Step 1: Write the failing test** — меню: первые три `[data-fa]` вне `.fa-more` — `simple`, `example`, `check` с дословными подписями; `[data-fa=scene]` count 0; `example` в разделе с лабой меняет hash на маршрут лабы, в разделе без — `.xcard--example`. Переписать блок «Editing» в `learning-flow.py`: `simple` → появляется `[data-vtab=simple][aria-selected=true]`, текст ≠ оригиналу; клик `[data-vtab=orig]` → видим `.frag-src`; `rewrite` + сохранение → `[data-vtab=mine]` с «Мой пример»; reload → активна `mine`, вкладка `simple` тоже есть; `[data-mine=reset]` → `[data-vtab=mine]` count 0.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both files, verify PASS.**
- [ ] **Step 5: Commit** `feat(notes): version tabs instead of replace (0.4)`.

### Task 5: Механики раздела в ШАД — два слоя, статусы, проверка

**Files:**
- Create: `prototype/js/learn-ui.js`, `prototype/data/checks.js` (`window.CCChecks = { shad: {[sec]: {question, minWords: 15, concepts: string[][]}} }` для разделов 1–10; 11–12 без проверки)
- Modify: `prototype/js/app.js` (`renderNotes`: вызвать `LearnUI.mountSection` после `X.decorateNotes`; `renderCourse`/`renderLibrary`: прогресс через `Learn.progress`), `prototype/index.html`, `prototype/styles.css`
- Test: `prototype/tests/learning-flow.py`

**Interfaces:**
- Consumes: `Learn.*`, `CCChecks`.
- Produces (`window.LearnUI`):
  - `mountSection(anchorEl: Element, opts: {lecture, unit, title, rule|null})` — вставляет перед следующим `h2` блок `.understand[data-unit]`: бейдж статуса `.ustatus`, пометка «моя заметка», `textarea.understood` с placeholder (Global Constraints), автосохранение по `input` (debounce 400 мс), кнопку `[data-check-open]` «Проверить себя» при наличии `rule`.
  - Проверка: `[data-check-open]` → у раздела класс `.checking` (справочный слой свёрнут), вопрос, `textarea.check-answer`, `[data-check-submit]`, вердикт `.verdict` с плашкой, кнопка `[data-check-dispute]` «Оспорить»; `ok` → `setStatus(…,"self")`, конспект разворачивается.
  - `observeSeen(sectionEnd: Element, key)` — IntersectionObserver ставит `seen`.
  - Справочный слой раздела получает пометку «объяснение ИИ».
- [ ] **Step 1: Write the failing test** — в `learning-flow.py`: §4 → `.understand[data-unit='4'] textarea` с нужным placeholder; ввод + reload → текст на месте; прокрутка §4 до конца → бейдж «видел»; «Объяснить проще» в §4 → «разобрался с помощью»; проверка: ответ из 3 слов → вердикт содержит «Слишком коротко» и плашку; ответ из 15+ слов с понятиями §4 → «Зачтено», бейдж «воспроизвёл сам», страница курса показывает `1 из 10` по «воспроизвёл сам»; §5: короткий ответ → «Оспорить» → бейдж «воспроизвёл сам» и текст «засчитано по оспариванию».
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement** `learn-ui.js`, `checks.js` (вопрос и 2–4 понятия с синонимами на раздел, взятые из `data/notes.md`), вызовы в `app.js`.
- [ ] **Step 4: Run both files, verify PASS.**
- [ ] **Step 5: Commit** `feat(shad): two layers, statuses and check stub per section (0.4)`.

### Task 6: Контент физики — источник OpenStax и конспект

**Files:**
- Create: `prototype/data/physics.js` — `window.CCPhysics = { meta: {book, chapter, url, license, retrieved}, source: [{id, page, heading, html}], sections: [{n, title, ref: markdown, quotes: [sourceId], figure: svg|null, check: {question, minWords: 15, concepts}}], problems: [...] }` (problems — Task 8)
- Create: `prototype/provenance/physics-source.md` (не в git: URL, лицензия, дата, страницы)
- Test: `prototype/tests/learning-flow.py` (`physics_data(page)`)

**Interfaces:**
- Produces: в `ref` ссылки на источник записываются как `[[src:<id>]]`; каждый `source.id` уникален и встречается хотя бы в одном `ref`; 5 разделов из spec §3 («Сила и равнодействующая», «Первый закон Ньютона», «Второй закон Ньютона», «Третий закон Ньютона», «Типичные ошибки»).
- [ ] **Step 1: Verify source** — открыть главу OpenStax *Physics* о законах Ньютона на openstax.org, записать в `provenance/physics-source.md` URL, редакцию, номера страниц PDF и формулировку лицензии с сайта. Если лицензия не CC BY — остановиться и сообщить Петру.
- [ ] **Step 2: Write the failing test** — `physics_data(page)`: `CCPhysics.sections.length == 5`; каждая ссылка `[[src:x]]` резолвится в `source`; у каждого раздела есть `check` с ≥2 понятиями; `meta.license` содержит «CC BY».
- [ ] **Step 3: Run, verify FAIL.**
- [ ] **Step 4: Write `data/physics.js`** — фрагменты оригинала (короткие, англ.) с номером страницы; конспект на русском уровня 9 класса со ссылками; одна SVG-схема сил на раздел 1–4 (`currentColor`, работает в тёмной теме).
- [ ] **Step 5: Run, verify PASS. Commit** `feat(physics): Newton's laws content from OpenStax (0.4)`.

### Task 7: Страница лекции по физике

**Files:**
- Create: `prototype/js/physics.js`
- Modify: `prototype/js/app.js` (`route`: `physics`, `physics-<n>` → `Physics.render(r)`; `renderSide`; `renderLibrary`: карточка «Законы Ньютона · школьная физика» вместо одной демо-карточки, с прогрессом), `prototype/index.html`, `prototype/styles.css`
- Test: `prototype/tests/learning-flow.py`, `prototype/tests/ux-smoke.py`

**Interfaces:**
- Consumes: `CCPhysics`, `CCDemoAI.physics`, `LearnUI.mountSection`, `LearnUI.observeSeen`, механика вкладок версий из Task 4 (вынести общую часть в `LearnUI.versionTabs(frag, texts, opts)`, если в Task 4 она осталась в `custom.js`).
- Produces: `window.Physics.render(route)`; разметка: `#phys-notes` (конспект) и `#phys-source` (страницы учебника; ≥1100 px — колонка справа со `position: sticky`, уже — сворачиваемая панель «Учебник» под разделом). Ссылка `[[src:x]]` → `button.src-link[data-src=x]` «стр. N»; клик прокручивает `#phys-source` к `#src-x` и ставит `.is-hit` на 2 с; у пересказа кнопка «Оригинал рядом» раскрывает цитату `blockquote.src-quote` (англ.) прямо под абзацем. Атрибуция CC BY внизу страницы. Чат на этой странице скрыт (как вне лекции ШАД).
- [ ] **Step 1: Write the failing test** — `learning-flow.py`: библиотека → карточка физики → `#physics`; 5 разделов `h2`; клик первой `.src-link` → `#src-…` в видимой области `#phys-source` и с `.is-hit`; «Оригинал рядом» показывает англ. цитату; механики Task 4–5 работают в §2 (вкладка «Проще», «Как я понял», проверка «Зачтено»). `ux-smoke.py`: `#physics` на всех 4 контекстах — без переполнения и ошибок, на 390 панель «Учебник» раскрывается.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both files, verify PASS.**
- [ ] **Step 5: Commit** `feat(physics): lecture page with textbook source pane (0.4)`.

### Task 8: Задачи с лестницей подсказок (только физика)

**Files:**
- Modify: `prototype/data/physics.js` (`problems`), `prototype/js/physics.js`, `prototype/styles.css`
- Test: `prototype/tests/learning-flow.py`

**Interfaces:**
- Data: `problems: [{id: "q1", kind: "concept", text, rule: {minWords: 15, concepts}, ladder: [hint, {link: sectionN}, leadingQuestion], steps: string[], solution}, {id: "r1", kind: "calc", text, answer: number, tol: number, unit: "м/с²", ladder, steps, solution, similar: {text, answer, tol}}]` — q1 «почему пассажира бросает вперёд при торможении», r1 — F = ma с трением.
- Produces: блок `#phys-problems` после разделов; `[data-rung-next]` «Подсказка» открывает следующую ступень (`rung` сохраняется); `[data-reveal]` «Показать решение» — первый клик показывает следующий шаг `steps[revealed]`, далее полное решение и статус задачи `solved` («решено с решением»); затем видна похожая задача `[data-similar]` без лестницы; верный ответ на неё → статус `self`. Верный ответ без раскрытия решения → сразу `self`. q1 проверяется `Learn.grade` с той же плашкой. Ступени и действия ставят разделу-ссылке `helped`. Прогресс физики: 5 разделов + 2 задачи.
- [ ] **Step 1: Write the failing test** — r1: подсказка ×3 → видны 3 ступени, reload → 3 ступени; «Показать решение» → 1 шаг, ещё раз → полное решение, статус «решено с решением»; похожая: ответ «0» → не зачтено, правильный с запятой → «воспроизвёл сам»; q1: ответ с понятиями → «Зачтено».
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both files, verify PASS.**
- [ ] **Step 5: Commit** `feat(physics): problems with hint ladder and similar task (0.4)`.

### Task 9: Демо-ответы ИИ реальной моделью

**Files:**
- Create: `prototype/tools/gen_demo_ai.py` — для каждого раздела ШАД (1–12) и физики (1–5) три вызова `delegate.py` (`--model google/gemini-3.7-flash --temperature 0.3`): «объясни проще», «перепиши иначе» и «покажи на конкретном примере» (только разделы без лабы); плюс ответы на заготовленные вопросы чата ШАД (`content.js` → `chat`). Пишет `data/demo-ai.js` и `provenance/demo-ai/{prompt.md,raw/*.txt,run.json}` (модель, дата, токены, стоимость из stderr).
- Modify: `prototype/js/custom.js` (ответы чата из `CCDemoAI.shad.chat`), `prototype/data/demo-ai.js`
- Test: `prototype/tests/learning-flow.py`

**Interfaces:**
- Consumes: формат `CCDemoAI` из Task 4.
- Скрипт: синхронный, `logging`, ANCHOR-блок; без ручной правки ответов — сохраняется сырой первый дубль; повтор только при ошибке API (не при «плохом» тексте), с записью в `run.json`.
- [ ] **Step 1: Write the failing test** — `CCDemoAI.meta.model == "google/gemini-3.7-flash"`; у всех разделов обеих лекций есть непустые `simple` и `rewrite`, у разделов без лабы — `example`; ни один текст не начинается с «[черновик]».
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement скрипт; прогнать на одном разделе, показать вывод и стоимость.**
- [ ] **Step 4: Полный прогон** (`run_in_background`, затем проверить `run.json`: число вызовов = ожидаемому, суммарная стоимость < $0.10).
- [ ] **Step 5: Run tests, verify PASS. Commit** `feat(demo): demo AI answers generated by target model (0.4)` (без `provenance/`).

### Task 10: Карточка возвращения «Продолжить разбор»

> Ред. 3 по советам GPT об интерфейсе (`docs/preview-0.4/gpt-ui-advice.md`). Зависит от Task 1, 3, 5, 7, 8.

**Files:**
- Modify: `prototype/js/app.js` (`renderLibrary`/главная: секция `.continue` строится из `Learn.state()` вместо `C.moments.idempotency`; `renderCourse`: `.course-resume` — то же), `prototype/js/learn-ui.js` (`touch` при фокусе/вводе в разделе), `prototype/js/physics.js` (`touch` для разделов и задач), `prototype/styles.css`
- Test: `prototype/tests/learning-flow.py`, `prototype/tests/ux-smoke.py`

**Interfaces:**
- Consumes: `Learn.state().last`, `understood`, `status`, `problems`; `CCChecks`, `CCPhysics.sections` (заголовки).
- Produces: `.continue[data-last]` — заголовок места (раздел, «Лаборатория L01», задача), строка «что делал» (`«Как я понял»` — первые ~120 знаков, или «Мой вывод», или «шаг подсказки N»), «Осталось:» — первый раздел той же лекции без `self` или незавершённая проверка; кнопка `[data-continue]` «Продолжить разбор» → `location.hash = last.route`, после рендера прокрутка к разделу `[data-unit]`, фокус в его `textarea`, для лабы — `mode` восстановлен. Пустое состояние (`!last`) → «Начать» с кнопками `[data-onb=shad|physics]`. Старый `pendingSeek` из 0.3 используется только при `last.kind == "section"` в ШАД с видео.
- [ ] **Step 1: Write the failing test** — чистый контекст: `.continue` содержит «Начать». Сценарий: ШАД §4 → ввод «Как я понял» → reload → главная: `.continue` содержит заголовок §4 и начало текста; «Продолжить разбор» → `#lecture-tools-mcp`, `.understand[data-unit='4'] textarea` в видимой области и с тем же текстом. Сценарий лабы: L01 «Проверить себя» → ввод объяснения без отправки → главная → «Продолжить разбор» → режим `check`, черновик на месте. Физика: подсказка ×2 в r1 → главная показывает «шаг подсказки 2». `ux-smoke.py`: `.continue` на 390/1440 без переполнения.
- [ ] **Step 2: Run, verify FAIL.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both files, verify PASS.**
- [ ] **Step 5: Commit** `feat(home): continue card from real learning state (0.4)`.

### Task 11: Финальная проверка и README

**Files:**
- Modify: `prototype/README.md` (раздел 0.4: что нового, маршруты `#physics`, таблица «реальное/демо» с физикой, моделью демо-ответов и заглушками), `prototype/index.html` (`meta description`)
- [ ] **Step 1:** полный прогон `tests/ux-smoke.py` и `tests/learning-flow.py` на свежем сервере — все PASS, вывод сохранить в отчёт.
- [ ] **Step 2:** ручной проход по чек-листу технической готовности spec §6 и сценарию демо (spec §6, п. 6 чек-листа решения) со снимками (`CC_SCREENSHOTS`), 390 dark и 1440 light.
- [ ] **Step 3:** обновить README; commit `docs: preview 0.4 readme`.
- [ ] **Step 4:** отправить Петру ссылку на локальные снимки и чек-лист решения spec §6; **не пушить** до «публикуй».
