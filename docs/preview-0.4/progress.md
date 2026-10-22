# SDD ledger — plan: docs/preview-0.4/plan.md
Spec: docs/preview-0.4/spec.md (ред. 3)
Branch: preview-0.4 (from main f8a75f8). Push запрещён до «публикуй».

## Preflight scan
| Pair / task | Produces → consumes | Finding |
|---|---|---|
| T1 → T2..T10 | window.Learn (state, key, setStatus, grade, checkNumber, progress, save, reset, touch) | ok; `last` добавлен через touch |
| T2 → all tests | init-script onboarded:true во всех прочих контекстах | ok, последующие тесты обязаны его сохранять |
| T3 ↔ T5 | T3 «вердикт и Оспорить как в Task 5» ← T5 создаёт вердикт UI | CONFLICT: T3 идёт раньше T5 |
| T4 ↔ T5 | T4 `[data-fa=check]` открывает проверку T5 | T4 скрывает до T5; T5 должен включить |
| T4 → T5 | T4 ставит helped на действия ИИ; T5 тест «Объяснить проще → разобрался с помощью» | ok при порядке T4<T5 |
| T4 → T7 | vtabs; T7 выносит LearnUI.versionTabs при необходимости | ok |
| T4 → T9 | CCDemoAI формат (simple, rewrite, example, chat); EXAMPLE_ROUTE | ok |
| T6 → T7/T8 | CCPhysics sections/source/problems | ok |
| T3/T5/T7/T8 → T10 | Learn.touch из лабы/разделов/задач | T10 дописывает touch в learn-ui/physics; T3 сам вызывает touch | ok |
| T3, T7 | оба правят app.js renderSide | последовательно, ok |
| T1 self | тесты = интерфейс | ok |
| T2 self | ok |
| T3 self | числа 2/1/3 не прогнаны — Step 3 велит сверить с buildSteps | ok |
| T4 self | ok |
| T5 self | ok |
| T6 self | Step 1 требует веб (openstax.org) — WebFetch | ok |
| T7 self | ok |
| T8 self | ok |
| T9 self | платный прогон < $0.10 — в утверждённом плане | ok |
| T10 self | ok |
| T11 self | ok |

Ruling: порядок исполнения 1,2,4,5,3,6,7,8,9,10,11 — T3 переиспользует вердикт/«Оспорить» из T5, а T4 должен предшествовать T5 (helped, меню) — если неправ: лишняя перестановка, без переделки кода.
Ruling: T5 включает `[data-fa=check]` в меню фрагмента (скрытый в T4) — иначе пункт меню мёртв — цена: мелкая правка custom.js в T5.

## Progress
Task 1: dispatched (BASE f8a75f8, implementer sonnet aa0aa5a6d2261e2d7)
Task 1: report file не создан исполнителем (заявил, но нет) — ⚠️ ревьюера закрыт моим прогоном: learning-flow.py PASS learn_unit + 3×0.3.
Task 1: minor (deferred): stem max(4,len-2) для коротких синонимов («сил» ловит «сильный»)
Task 1: minor (deferred): cache не перечитывается между вкладками
Task 1: minor (deferred): внутренние значения state не валидируются
Task 1: minor (deferred): не проверены cc:learn, reset(), save()
Task 1: complete (commits f8a75f8..3b7026e, review clean)
Task 2: dispatched (BASE 3b7026e)
Task 2: Ruling: init-script условный (ставит onboarded только если ключа нет) — безусловный затирал состояние при reload и ломал learn_unit — цена: тест не ловит регресс, где onboarded теряется
Task 2: review 1 — Approved; ⚠️ «О прототипе» не обновлён (подтвердил: текст 0.3) → в fix-раунд вместе с Review Focus 4 тестом и drawer на 390
Task 2: minor (deferred): Tab-check в ux-smoke косвенный; ONBOARDED init-script дублирован в двух тестах; комментарий onboarding.js:115 убрать в Task 7
Task 2: fix round 1/5 (3 addressed, 0 open; commits 0a90e0d..2204d80)
Task 2: minor (deferred): ux-smoke.py:84 tuple-в-тернарнике, переписать if/else; README 0.3 → Task 11
Task 2: complete (commits 3b7026e..2204d80, review clean)
Task 4: dispatched (BASE 2204d80)
Task 4: Ruling: EXAMPLE_ROUTE {3: codevideo, 4: lab, 11: code} принят — соответствует #example-route 0.3 — цена: «Показать на примере» в §11 ведёт в код, а не в пример-карточку
Task 4: review 1 — Needs fixes: vtabs без клавиатурной навигации (Important); +дубли карточек транскрипта (minor, взят в раунд). ⚠️ draft-simple ссылок нет — проверил grep.
Task 4: minor (deferred): rewrite fallback AI().rewrite[4] захардкожен; vtab-origin для physics orig должен быть «из источника» (Task 7); "[черновик]" конкатенация в demo-ai.js; перекрытие CSS .frag.editing; example-карточка не сохраняется при перерисовке
Task 4: fix round 1/5 (2 addressed, 0 open; commits 1dfe9bf..7b7bf3d); ux-smoke exit 0 проверен мной
Task 4: minor (deferred): aria-controls только на активной вкладке
Task 4: complete (commits 2204d80..7b7bf3d, review clean)
Task 5: Ruling: LearnUI экспортирует `renderVerdict(container, result, {onDispute})` для переиспользования в Task 3 (лаба) — иначе дублирование вердикта/«Оспорить» — цена: лишний публичный метод
Task 5: dispatched (BASE 7b7bf3d)
Task 5: review 1 — Needs fixes: вердикт скрывается сразу при ok/dispute (Important); прогресс в библиотеке не сделан (spec gap); pagehide leak; визуальная проверка
Task 5: Ruling: подсказка «Слишком коротко, раскрой: …» продолжает перечислять понятия — формулировка задана Global Constraints — цена: проверка подсказывает ответ
Task 5: minor (deferred): openCheck через setTimeout(450) хрупкий; §6/§10 понятия слишком мягкие
Task 5: fix round 1/5 (4 addressed, 0 open; commits a42a02e..a25ea92); визуал 1024/390-dark не перепроверен → Task 11
Task 5: minor (deferred): lib-progress гейт по c.token, но ШАД захардкожен; debounce-таймер не чистится в dispose (последние 400 мс ввода)
Task 5: complete (commits 7b7bf3d..a25ea92, review clean)
Task 3: dispatched (BASE a25ea92)
Task 3: implementer DONE 2b4addd; симуляция подтвердила 2/1 и 3/1
Task 3: review 1 — Needs fixes: cv-ask таймер переживает pause / двойной tick (Important); сохранение прогресса check-mode (взято: нужно Task 10); guard u[LK], aria-hidden
Task 3: minor (deferred): маскировка слабая (.now-step и журнал видны во время прогона); .masked глобальный класс; тесты dispute/draft-restore в лабе; cv-ask тест на 9-с окне
Task 3: fix round 1/5 (3 addressed, 0 open; commits 2b4addd..99183b8)
Task 3: minor (deferred): restored pred/actual без проверки типа; .cv-ask остаётся видимым после ухода из раздела
Task 3: complete (commits a25ea92..99183b8, review clean)
Handoff: дальше ChatGPT по docs/preview-0.4/HANDOFF.md с Task 6.

Task 6: Ruling: проверенный веб-раздел § вместо непроверенного PDF page — официальный PDF недоступен — цена: требование пагинации PDF отложено.
Task 6: content and source links prepared (pending original Playwright tests and screenshots).
Task 7–8: local overlay implementation prepared; tests/preview04_extra.py added, browser integration tests pending repository checkout.
Task 9: waiting for Petr's run — tools/gen_demo_ai.py must not be executed by agent; red test expected.
Task 10–11: local overlay prepared; full project test and visual review not verified, no false PASS claimed.
Ruling: изменение подготовлено локально из-за отсутствия checkout и полных интеграционных тестов — цена: для просмотра в preview-0.4 требуется применить overlay в рабочем checkout.

## Codex: проверка загруженного cf440da, 22.10.2026

Task 6: complete — источник заменён на редакцию LibreTexts University Physics, CC BY 4.0;
цитаты сверены, атрибуция видна. Ruling: web § вместо PDF pages — неподтверждённые страницы не заявляем.
Task 7–8: complete — фактический прогон, исправлены вердикты, самостоятельность, обновление прогресса,
переход к задачам, схемы третьего закона и термин «сила тяжести».
Task 10: complete — заметки и незавершённая проверка восстанавливаются через карточку;
черновик проверки сохраняется сразу, сброс очищает оба хранилища.
Task 11: UI checks complete — learning-flow 17 PASS / ux-smoke 109 PASS / offline generator 3 PASS;
скриншоты просмотрены на 390 dark, 1024 и 1440 light. README обновлён.
Task 9: partial, waiting for budget decision — 23/52 заготовок; подтверждено $0.05792325,
с резервом на остановленный запрос до $0.066711. Оценка полного набора выше $0.10.
Task 9 check остаётся красной; это не основание объявлять всё превью завершённым.
Подробности и разбор deferred: docs/preview-0.4/verification.md. Push/merge/main ещё не выполнены.

## Завершение после разрешения Петра на $0.25 и публикацию

Task 9: complete — 52/52 первых успешных ответов, 23 прежних не изменены;
полнота и совпадение raw проверены. Known $0.13840725 + reserve $0.00878775 = upper $0.147195.
Остановленный вызов учтён резервом, его явное повторение после решения не было автоматическим.
Ссылки источника и выделения в заготовках безопасно отображаются без ручной правки ответов.
Тест полноты переименован в tests/demo-ai.py и включён в learning-flow.py.
Финал: learning-flow 18 PASS / ux-smoke 109 PASS / offline generator 3 PASS; отдельная проверка 52 ответов PASS. Публикация разрешена; выполняется сверка Pages.
