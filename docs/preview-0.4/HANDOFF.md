> **Статус 22.10.2026:** задачи реализации завершены, включая 52 демоответа Task 9.
> Этот файл ниже — исходная инструкция продолжения, сохранённая для истории.
> Актуальная проверка и публикация: [verification.md](verification.md), журнал: [progress.md](progress.md).

# Превью 0.4 — продолжение реализации (для ChatGPT / Codex)

Дата: 22.10.2026. Передаёт Орио (Claude Code) по просьбе Петра. Файл самодостаточен.

## Где что

Корень этого репозитория = папка `prototype/` из плана. Путь `prototype/js/app.js` в плане —
это `js/app.js` здесь.

- `docs/preview-0.4/plan.md` — план, источник требований. Каждая задача: Files / Interfaces / Steps.
  Значения из Global Constraints переносить дословно.
- `docs/preview-0.4/spec.md` — спек ред. 3, главнее плана при конфликте.
- `docs/preview-0.4/mvp-design.md` — контекст механик (разделы 6.x).
- `docs/preview-0.4/gpt-ui-advice.md` — основание для Task 10.
- `docs/preview-0.4/progress.md` — журнал: решения (`Ruling:`), отложенные мелочи
  (`minor (deferred)`), статус задач. **Прочитать перед стартом и дописывать по ходу.**
- Ветка **`preview-0.4`** (от `main` f8a75f8). `main` = GitHub Pages, репозиторий публичный:
  **в `main` не мержить и PR в `main` не открывать.** Работать в `preview-0.4` или в своей ветке
  от неё с PR в `preview-0.4`.

## Статус

- Готовы и прошли ревью: Task 1, 2, 4, 5, 3 (HEAD `99183b8`). Начинать с **Task 6**.
- Осталось: **6 → 7 → 8 → 9 → 10 → 11**, затем ревью всей ветки.

## Что уже есть (интерфейсы)

- `js/learn.js` → `window.Learn`: `state()`, `key(lecture, unit)`, `setStatus` (не понижает),
  `grade`, `checkNumber`, `progress`, `save`, `reset`, `touch(place)` (пишет `state().last`).
  Ключ хранения `cc-preview-0.4`, событие `cc:learn` на `window`.
- `js/onboarding.js` — онбординг. `[data-onb=physics]` пока только ставит `#physics` (маршрута нет
  до Task 7; комментарий в `onboarding.js:115` убрать в Task 7).
- `js/custom.js` — вкладки версий `.vtabs`, меню фрагмента (simple / example / check + «Ещё»),
  `EXAMPLE_ROUTE = {3: codevideo, 4: lab, 11: code}`. `data/demo-ai.js` — `CCDemoAI` с
  плейсхолдерами «[черновик]» до Task 9.
- `js/learn-ui.js` → `window.LearnUI`: `mountSection`, `observeSeen`,
  `renderVerdict(container, result, {onDispute})`, `dispose()`. `data/checks.js` — правила проверки ШАД 1–10.
- `js/lab.js` — L01, режимы `explore`/`check`. Прогресс — `Learn.state().lab["shad:L01"]`
  (`mode, pred, revealed, actual, explainOk, transferOk`), черновик — `understood["shad:L01:draft"]`,
  вывод — `understood["shad:L01"]`, `Learn.touch` при входе в лабу и смене режима (опора для Task 10).
- Тесты: в обоих файлах условный init-script `ONBOARDED`; новые контексты — только с ним.
  Проверять `to_be_visible()`, а не только `to_contain_text`.

## Как вести каждую задачу

1. Прочитать задачу в плане и строки о ней в журнале.
2. TDD: сначала падающий тест, показать FAIL, потом реализация, потом PASS.
3. Прогон (из корня репозитория):
   ```
   python3 -m http.server 8765 &
   CC_BASE_URL=http://127.0.0.1:8765/ uv run --with playwright python tests/learning-flow.py
   CC_BASE_URL=http://127.0.0.1:8765/ uv run --with playwright python tests/ux-smoke.py; echo $?
   ```
   Без `uv`: `pip install playwright && playwright install chromium`, затем `python tests/…`.
   Оба файла проходят полностью, у ux-smoke код выхода 0.
4. Скриншот нового экрана (390 dark или 1440 light, `CC_SCREENSHOTS=<dir>`), открыть, починить видимое.
5. Коммит в ветку с сообщением из плана.
6. Самопроверка диффа против задачи и Global Constraints. В `docs/preview-0.4/progress.md`:
   `Task N: minor (deferred): …`, `Task N: Ruling: <что> — <почему> — <цена ошибки>`,
   в конце `Task N: complete (commits <base>..<head>)`.

## Отличия от плана для этой среды

- **Task 6.** Источник — реальная глава OpenStax *Physics* (high school) о законах Ньютона на
  openstax.org. Цитаты, номера страниц и текст лицензии — только с сайта. Если сайт недоступен
  или лицензия не CC BY — **остановиться и сообщить**, цитаты не сочинять. `provenance/` в git
  не попадает (`.gitignore`); URL, редакцию и дату записать также в `meta` в `data/physics.js`.
- **Task 9.** Внешнего ключа API здесь нет. Написать `tools/gen_demo_ai.py`, который вызывает
  OpenRouter напрямую (HTTP, ключ из `OPENROUTER_API_KEY`, модель `google/gemini-3.7-flash`,
  temperature 0.3, стоимость из ответа API в `run.json`), с флагом `--only <раздел>` для
  пробного прогона. **Не запускать.** Тест Task 9 написать, но оставить красным и
  отметить в журнале `Task 9: waiting for Petr's run`. Пётр прогонит скрипт локально.
  Остальные задачи от Task 9 не зависят, кроме проверки текстов «[черновик]» в Task 11.
- Task 11, Step 4: вместо «отправить Петру» — итог в описании PR (см. ниже).

## Стоп-условия

- Нет доступа к OpenStax или лицензия не CC BY (Task 6).
- Любой merge в `main` или публикация на Pages — только после «публикуй» Петра.
- Конфликт спека и плана, который не решается по правилу «спек главнее».

## Финал (после Task 11)

- Ревью всей ветки: `git diff f8a75f8..HEAD` против спека ред. 3 и плана. Разобрать все строки
  `minor (deferred)` из журнала: что чинить до показа Петру — починить, остальное оставить списком.
- Визуал 1024 light и 390 dark для раздела ШАД с открытой проверкой (после Task 5 не смотрели).
- В описании PR в `preview-0.4`: что видно в превью, как открыть локально, вывод тестов,
  чек-лист решения из spec §6 (пп. 1–7), список `Ruling:` с ценой ошибки, статус Task 9.
