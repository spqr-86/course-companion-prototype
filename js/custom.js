/* Course Companion 0.2 — кастомизация лекции: действия с фрагментом («+» и выделение), личная версия абзаца
   поверх оригинала, карточки из чата и свои материалы, заявки на генерацию сцен с планом и подтверждением.
   Всё демо: состояние живёт в localStorage этого браузера, ничего не генерируется, сроки заявок ускорены. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const A = () => window.CCApp;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const clip = (s, n) => (s = String(s).replace(/\s+/g, " ").trim()).length > n ? s.slice(0, n - 1) + "…" : s;
  const fmt = t => { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
  const money = v => v.toFixed(2).replace(".", ",") + " $";
  const md = s => window.marked ? marked.parse(esc(s)) : `<p>${esc(s)}</p>`;
  const ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z"/></svg>';
  const touchUI = () => matchMedia("(max-width: 640px), (hover: none)").matches;

  const STATUS = { awaiting: "ждёт подтверждения", queued: "в очереди", building: "собирается", draft: "черновик", accepted: "принято", rejected: "отклонено" };
  const KIND = { lab: "Лаборатория", codevideo: "Code-video" };
  const STAGES = ["Разбираю фрагмент и источники", "Пишу сценарии", "Собираю сцену", "Проверяю на примере"];
  const BUDGET = 10;
  const VISUAL = new Set([3, 4, 7, 11]); // разделы, где уже есть схема, code-video или лаборатория

  // Пересказ «проще» по разделам конспекта: подготовлен вручную, в продукте его пишет агент.
  const SIMPLE = {
    1: "Без инструментов модель знает только то, что выучила, и считает «на глаз». Поэтому ошибается в подсчётах, не знает свежих фактов и ничего не может сделать сама. Инструменты закрывают все три пробела.",
    2: "Инструмент — обычная функция плюс описание для модели: что делает, какие аргументы принимает и что вернёт. Модель видит только описание, код функции ей не виден.",
    3: "Модель не нажимает кнопок. Она пишет записку: «вызови list_all_airports для Лондона». Код агента читает записку, вызывает функцию и отдаёт результат модели, а та отвечает человеку.",
    4: "Инструмент работает в ненадёжном мире: связь рвётся, вызов повторяется, шаг цепочки падает. Хороший инструмент к этому готов: откатывает начатое, не делает работу дважды при повторе, понятно объясняет ошибку и возвращает данные в машинной форме.",
    5: "Пока инструменты вшиты в каждого агента, одну и ту же интеграцию пишут и чинят много раз. С ростом числа агентов и API это становится дорого и хрупко.",
    6: "MCP — общий разъём между AI-приложениями и внешними системами. Сервис подключают через MCP один раз, и им пользуется любое приложение, которое понимает протокол.",
    7: "Host — само приложение с моделью и интерфейсом. Server даёт инструменты и данные. Client — провод между ними, по одному на каждый сервер.",
    8: "Сначала приложение опрашивает серверы и собирает общий список инструментов. Потом на каждый запрос модель выбирает инструмент, приложение вызывает его через нужный клиент и возвращает модели результат.",
    9: "MCP переносит заботу об интеграции к автору сервера: инструмент пишут один раз, обновляют в одном месте, а агенты узнают об изменениях при подключении.",
    10: "MCP не обязателен с первого дня. Пока инструменты не нужно делить между агентами, хватит простых функций или готовых наборов вроде Agent Skills.",
    11: "Практика повторяет теорию в коде: сначала цикл вызова вручную через JSON, затем описание из сигнатуры функции, затем то же самое средствами LangGraph.",
    12: "Раздел — вопросы для самопроверки по всей лекции. Удобно проходить после лаборатории."
  };

  const L02 = {
    lab: "L02", kind: "lab", title: "L02 · Частичный сбой транзакции", lecture: "1.2", sec: 4,
    example: "Оформление заказа из трёх шагов: charge → reserve → delivery. Строка «Handling Partial Failures» в таблице §4 и пример лектора на 5:44.",
    scenarios: ["Все три шага прошли", "Упала доставка: снять резерв и вернуть деньги", "Откат тоже упал: повтор компенсации по ключу", "Без компенсации: деньги списаны, заказа нет"],
    params: ["Где сбой: нигде / reserve / delivery", "Компенсация: включена / выключена"],
    sources: "Конспект §4 · слайд 7 · видео 5:44 · устройство как у L01",
    time: "≈ 25 мин", cost: 0.45
  };
  const SEED = [
    { id: "r1", seed: true, lab: "L01", kind: "lab", title: "L01 · Повтор вызова и идемпотентность", lecture: "1.2", sec: 4, origin: "Сборка лекции",
      status: "accepted", time: "≈ 30 мин", cost: 0.8, version: 1, example: "cancel_booking из ноутбука, ячейка 35",
      scenarios: ["Успешный вызов", "Неверные аргументы", "Потерянный ответ: повтор с ключом и без"], params: ["Ключ идемпотентности", "Сколько ответов теряется"],
      sources: "Ноутбук · конспект §4 · видео 6:19" },
    { id: "r2", seed: true, kind: "codevideo", title: "Code-video · §8 MCP Flow", lecture: "1.2", sec: 8, origin: "Меню фрагмента",
      status: "rejected", time: "≈ 15 мин", cost: 0.3, version: 1, example: "Sequence diagram из §8",
      scenarios: ["Инициализация", "Вызов инструмента"], params: [], sources: "Конспект §8 · слайд 14",
      reason: "Отклонено на черновике: повторяет схему архитектуры из §7" }
  ];

  /* ---------- Хранилище ---------- */
  const blank = () => ({ edits: {}, cards: [], reqs: SEED.map(r => ({ ...r })), hint: false, suggested: false, seq: 1, rseq: 3 });
  let st = (() => {
    try { const v = JSON.parse(localStorage.getItem("cc-proto-0.2")); if (v && v.reqs) return v; } catch (e) { }
    return blank();
  })();
  const save = () => { try { localStorage.setItem("cc-proto-0.2", JSON.stringify(st)); } catch (e) { } };
  const changed = () => { save(); document.dispatchEvent(new CustomEvent("cc:changed")); renderAllSecs(); };
  const reqById = id => st.reqs.find(r => r.id === id);
  const secTitle = n => { const h = $("#n-" + n); return h ? h.textContent.replace(/^\d+\.\s*/, "") : ""; };

  /* ---------- Тост и «уведомление в Telegram» ---------- */
  let toastT;
  function toast(html, opts = {}) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.className = "toast" + (opts.tg ? " toast--tg" : "");
    el.innerHTML = (opts.tg ? `<div class="toast-src">Орио → Telegram · демо-уведомление</div>` : "") + `<div>${html}</div>`;
    el.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.hidden = true; }, opts.tg ? 9000 : 4500);
  }

  /* ---------- Заявки ---------- */
  function newReq(plan, origin) {
    st.rseq = st.rseq || 3;
    const r = { scenarios: [], params: [], ...plan, id: "r" + st.rseq++, origin, status: "awaiting", version: 1, created: Date.now() };
    st.reqs.unshift(r);
    changed();
    return r;
  }
  const activeLab = code => st.reqs.find(r => r.lab === code && r.status !== "rejected");

  function planForLab(code, origin) {
    const ex = activeLab(code);
    if (ex) { openReq(ex); return; }
    if (code === "L02") { openPlan(newReq({ ...L02 }, origin)); return; }
    const lab = window.CC.course.labs.find(l => l.code === code);
    const real = lab.lecture === "1.2";
    openPlan(newReq({
      lab: code, kind: "lab", title: `${code} · ${lab.title}`, lecture: lab.lecture, sec: null, example: lab.text,
      scenarios: ["Основной сценарий", "Сбой и восстановление"], params: ["Агент предложит после разбора материалов"],
      sources: real ? "Конспект, видео и слайды лекции 1.2" : `Лекция ${lab.lecture}: есть только конспект, видео и слайдов нет`,
      time: "≈ 25 мин", cost: 0.45
    }, origin));
  }

  function planForMatrix(kind, lecCode) {
    const lec = window.CC.course.modules.flatMap(m => m.lectures).find(l => l.code === lecCode);
    openPlan(newReq({
      kind, title: `${KIND[kind]} · лекция ${lecCode} ${lec.title}`, lecture: lecCode, sec: null,
      example: "Агент выберет пример из конспекта и предложит его в плане",
      scenarios: ["Основной механизм лекции", "Типичная ошибка и её последствия"], params: ["Агент предложит после разбора конспекта"],
      sources: `Лекция ${lecCode}: есть только конспект, видео и слайдов нет`,
      time: kind === "lab" ? "≈ 25 мин" : "≈ 15 мин", cost: kind === "lab" ? 0.45 : 0.3
    }, "Матрица готовности"));
  }

  function planFromCtx(ctx, origin) {
    if (/charge|reserve|delivery|partial|частичн|откат|транзакц/i.test(ctx.quote)) {
      const ex = activeLab("L02");
      if (ex) { openReq(ex); return; }
      openPlan(newReq({ ...L02, quote: ctx.quote }, origin));
      return;
    }
    openPlan(newReq({
      kind: "codevideo", title: `Code-video · §${ctx.sec} ${secTitle(ctx.sec)}`, lecture: "1.2", sec: ctx.sec, quote: ctx.quote,
      example: "Пример возьмётся из выбранного фрагмента" + (ctx.t != null ? ` и момента видео ${fmt(ctx.t)}` : ""),
      scenarios: ["Основной ход по фрагменту", "Что меняется при ошибке или другом входе"],
      params: ["Агент предложит после разбора фрагмента"],
      sources: `Конспект §${ctx.sec}` + (ctx.t != null ? ` · видео ${fmt(ctx.t)}` : ""), time: "≈ 15 мин", cost: 0.3
    }, origin));
  }

  const spent = () => st.reqs.filter(r => ["building", "draft", "accepted"].includes(r.status)).reduce((s, r) => s + r.cost, 0);
  const reserved = () => st.reqs.filter(r => ["awaiting", "queued"].includes(r.status)).reduce((s, r) => s + r.cost, 0);

  const timers = {};
  function schedule(r) {
    clearTimeout(timers[r.id]);
    if (r.status === "queued") timers[r.id] = setTimeout(() => { r.status = "building"; r.stage = 0; changed(); schedule(r); }, 2500);
    else if (r.status === "building") timers[r.id] = setTimeout(() => {
      if (r.stage < STAGES.length - 1) { r.stage++; changed(); schedule(r); return; }
      r.status = "draft"; changed();
      toast(`Черновик готов: «${esc(r.title)}». Посмотреть и принять — ${r.sec ? `лекция ${r.lecture}, конспект §${r.sec}` : "вкладка «Заявки» курса"}. <button class="btn btn--small" type="button" data-req-open="${r.id}">Открыть</button>`, { tg: true });
    }, 1600);
  }
  st.reqs.forEach(schedule);

  function setStatus(r, status, extra = {}) { Object.assign(r, { status }, extra); changed(); schedule(r); }

  // Переход к заявке: на её место в конспекте или во вкладку «Заявки».
  function openReq(r) {
    if (r.status === "awaiting") { openPlan(r); return; }
    if (r.sec && r.lecture === "1.2" && !r.seed) {
      A().goLecture(() => { const c = $(`#req-${r.id}`); if (c) { c.scrollIntoView({ behavior: "smooth", block: "center" }); c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 1600); } });
    } else location.hash = "course-requests";
  }

  /* ---------- Карточка-план ---------- */
  let modal;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement("div");
    modal.className = "modal"; modal.id = "plan-modal"; modal.hidden = true;
    modal.innerHTML = `<div class="modal-card plan-card" role="dialog" aria-modal="true" aria-labelledby="plan-title"></div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) closePlan(); });
    return modal;
  }
  let planReq = null;
  function openPlan(r, editing = false) {
    ensureModal();
    planReq = r;
    renderPlan(editing);
    modal.hidden = false;
    setTimeout(() => { const f = $(editing ? "#pl-title" : "[data-plan-act='confirm']", modal); f && f.focus(); }, 30);
  }
  function closePlan() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (planReq && planReq.status === "awaiting") toast(`План сохранён: заявка #${planReq.id.slice(1)} ждёт подтверждения во вкладке «Заявки» курса.`);
    planReq = null;
  }
  function renderPlan(editing) {
    const r = planReq, card = $(".plan-card", modal);
    const left = BUDGET - spent() - reserved();
    const where = r.sec ? `Лекция ${r.lecture}, конспект §${r.sec}${r.lab ? " · каталог лабораторий" : ""}` : r.lab ? "Каталог лабораторий курса" : `Лекция ${r.lecture}`;
    const head = `<div class="modal-head"><div><div class="eyebrow">Заявка #${r.id.slice(1)} · ${KIND[r.kind]} · ${r.version > 1 ? `переделка, версия ${r.version} · ` : ""}${STATUS[r.status]}</div>
      <h2 id="plan-title">${esc(r.title)}</h2></div>
      <button class="icon-btn" type="button" data-plan-act="close" aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <span class="demo-tag">Демо: после подтверждения ничего не генерируется, сроки ускорены</span>
      ${r.quote ? `<blockquote class="plan-quote">«${esc(clip(r.quote, 220))}»<span>${r.origin}${r.sec ? ` · §${r.sec}` : ""}</span></blockquote>` : `<p class="hint plan-origin">Откуда: ${esc(r.origin)}</p>`}`;
    if (!editing) {
      card.innerHTML = head + `<dl class="plan-dl">
        <dt>Пример</dt><dd>${esc(r.example)}</dd>
        <dt>Сценарии</dt><dd><ol>${r.scenarios.map(s => `<li>${esc(s)}</li>`).join("")}</ol></dd>
        ${r.params.length ? `<dt>Параметры</dt><dd><ul>${r.params.map(s => `<li>${esc(s)}</li>`).join("")}</ul></dd>` : ""}
        <dt>Источники</dt><dd>${esc(r.sources)}</dd>
        <dt>Куда встанет</dt><dd>${esc(where)}</dd>
        <dt>Время и цена</dt><dd>${r.time} работы Орио · ≈ ${money(r.cost)} · свободно в бюджете курса ${money(Math.max(0, left))} из ${money(BUDGET)}</dd>
        ${r.wish ? `<dt>Пожелания</dt><dd>${esc(r.wish)}</dd>` : ""}
      </dl>
      <p class="hint">После подтверждения Орио собирает черновик в фоне и пишет в Telegram, когда он готов. До вашего «Принять» черновик не меняет материалы лекции.</p>
      <div class="modal-actions">
        <button class="btn" type="button" data-plan-act="cancel">${r.version > 1 ? "Оставить прошлый черновик" : "Отменить заявку"}</button>
        <button class="btn" type="button" data-plan-act="edit">Изменить</button>
        <button class="btn btn--primary" type="button" data-plan-act="confirm">Подтвердить</button>
      </div>`;
      return;
    }
    card.innerHTML = head + `<form class="add-form plan-form" id="plan-form">
      <label for="pl-title">Название</label><input id="pl-title" type="text" value="${esc(r.title)}">
      <label for="pl-kind">Формат</label>
      <select id="pl-kind" class="speed">${Object.entries(KIND).map(([k, v]) => `<option value="${k}" ${k === r.kind ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label for="pl-scen">Сценарии, по одному в строке</label><textarea id="pl-scen" rows="4">${esc(r.scenarios.join("\n"))}</textarea>
      <label for="pl-params">Параметры, по одному в строке</label><textarea id="pl-params" rows="3">${esc(r.params.join("\n"))}</textarea>
      <label for="pl-wish">Пожелания Орио</label><textarea id="pl-wish" rows="2" placeholder="${r.version > 1 ? "Что переделать в черновике" : "Например: только два сценария, без анимации"}">${esc(r.wish || "")}</textarea>
      <p class="hint">Время и цена в демо не пересчитываются.</p>
      <div class="modal-actions"><button class="btn" type="button" data-plan-act="view">Назад</button><button class="btn btn--primary" type="submit">Сохранить план</button></div>
    </form>`;
    $("#plan-form", card).addEventListener("submit", e => {
      e.preventDefault();
      const lines = id => $(id, card).value.split("\n").map(s => s.trim()).filter(Boolean);
      Object.assign(r, { title: $("#pl-title", card).value.trim() || r.title, kind: $("#pl-kind", card).value, scenarios: lines("#pl-scen"), params: lines("#pl-params"), wish: $("#pl-wish", card).value.trim() });
      changed();
      renderPlan(false);
    });
  }
  function planAct(act) {
    const r = planReq;
    if (act === "close") return closePlan();
    if (act === "edit") return renderPlan(true);
    if (act === "view") return renderPlan(false);
    if (act === "cancel") {
      if (r.version > 1) setStatus(r, "draft", { version: r.version - 1 });
      else { st.reqs = st.reqs.filter(x => x !== r); changed(); toast("Заявка отменена до подтверждения."); }
      planReq = null; modal.hidden = true;
      return;
    }
    if (act === "confirm") {
      setStatus(r, "queued");
      planReq = null; modal.hidden = true;
      toast(`Заявка #${r.id.slice(1)} в очереди у Орио. Статус — ${r.sec ? `в конспекте §${r.sec} и ` : ""}во вкладке «Заявки» курса.`);
    }
  }

  /* ---------- Черновики: мини-лаборатория L02 и раскадровка ---------- */
  function miniLab(r) {
    return `<div class="mini" data-mini-root="${r.id}">
      <div class="mini-ctl">
        <div class="ctl-group"><span class="eyebrow">Где сбой</span><div class="seg-ctl" data-mini="fail">
          <button type="button" data-v="-1" aria-pressed="false">нигде</button><button type="button" data-v="1" aria-pressed="false">reserve</button><button type="button" data-v="2" aria-pressed="true">delivery</button></div></div>
        <div class="ctl-group"><span class="eyebrow">Компенсация</span><div class="seg-ctl" data-mini="comp">
          <button type="button" data-v="1" aria-pressed="true">включена</button><button type="button" data-v="0" aria-pressed="false">выключена</button></div></div>
        <button class="btn btn--small btn--primary" type="button" data-mini-run>Запустить заказ</button>
      </div>
      <ol class="mini-steps">${[["charge", "списать 120 $"], ["reserve", "зарезервировать товар"], ["delivery", "создать доставку"]].map(([n, t]) =>
        `<li data-step="${n}"><b>${n}</b><span>${t}</span><em>—</em></li>`).join("")}</ol>
      <div class="verdict" data-mini-verdict>Выберите, где случится сбой, и запустите заказ.</div>
      <p class="hint">Черновик: собраны 2 сценария из 4 по плану. Учебная симуляция в браузере.</p>
    </div>`;
  }
  function runMini(root) {
    const fail = +$('[data-mini="fail"] [aria-pressed="true"]', root).dataset.v;
    const comp = $('[data-mini="comp"] [aria-pressed="true"]', root).dataset.v === "1";
    const steps = $$(".mini-steps li", root), out = $("[data-mini-verdict]", root);
    steps.forEach(li => { li.className = ""; $("em", li).textContent = "—"; });
    out.className = "verdict"; out.textContent = "Идёт заказ…";
    const seq = [];
    steps.forEach((li, i) => {
      if (fail < 0 || i < fail) seq.push(() => { li.className = "ok"; $("em", li).textContent = "выполнено"; });
      else if (i === fail) seq.push(() => { li.className = "bad"; $("em", li).textContent = "сбой"; });
      else seq.push(() => { li.className = "skip"; $("em", li).textContent = "не запускался"; });
    });
    if (fail >= 0 && comp) for (let i = fail - 1; i >= 0; i--) seq.push(() => { steps[i].className = "undo"; $("em", steps[i]).textContent = i === 0 ? "деньги возвращены" : "резерв снят"; });
    seq.push(() => {
      if (fail < 0) { out.className = "verdict good"; out.innerHTML = "<b>Заказ оформлен</b>Деньги списаны, товар в резерве, доставка создана."; }
      else if (comp) { out.className = "verdict good"; out.innerHTML = "<b>Откат выполнен</b>Деньги вернулись, резерв снят, операция помечена неуспешной. Агент честно сообщает о сбое."; }
      else { out.className = "verdict bad"; out.innerHTML = `<b>Несогласованное состояние</b>Списано 120 $${fail === 2 ? ", товар в резерве" : ""}, доставки нет. Агент сообщит об ошибке, а деньги клиента зависнут.`; }
    });
    (root._t || []).forEach(clearTimeout);
    root._t = seq.map((f, k) => setTimeout(f, 380 * (k + 1)));
  }
  const storyboard = r => `<ol class="frames">${r.scenarios.map((s, i) => `<li><span class="frame-art" aria-hidden="true"></span><b>Кадр ${i + 1}</b><span>${esc(s)}</span></li>`).join("")}</ol>
    <p class="hint">Черновик раскадровки: в продукте здесь будет сцена code-video.</p>`;
  const draftBody = r => r.lab === "L02" ? miniLab(r) : storyboard(r);

  /* ---------- Карточки внутри конспекта ---------- */
  function reqCard(r) {
    const pill = `<span class="rstate ${r.status}">${STATUS[r.status]}</span>`;
    const head = `<div class="xh"><span class="xtag xtag--req">Заявка #${r.id.slice(1)} · ${KIND[r.kind]}</span>${pill}</div><b class="xt">${esc(r.title)}</b>`;
    let body = "";
    if (r.status === "awaiting") body = `<p>План готов и ждёт вашего решения. Ничего не запущено.</p><div class="row"><button class="btn btn--small btn--primary" type="button" data-req-plan="${r.id}">Открыть план</button></div>`;
    if (r.status === "queued") body = `<p>Подтверждено. Заявка в очереди у Орио, ${r.time}. <span class="hint">Демо: сроки ускорены.</span></p>`;
    if (r.status === "building") body = `<ol class="stages">${STAGES.map((s, i) => `<li class="${i < r.stage ? "ok" : i === r.stage ? "on" : ""}"><i></i>${s}</li>`).join("")}</ol>`;
    if (r.status === "draft") body = `<p>Черновик${r.version > 1 ? ` версии ${r.version}` : ""} готов. Попробуйте его и решите: принять в лекцию, отправить на переделку или отклонить.</p>${draftBody(r)}
      <div class="row"><button class="btn btn--small btn--primary" type="button" data-req-act="accept" data-id="${r.id}">Принять</button>
      <button class="btn btn--small" type="button" data-req-act="redo" data-id="${r.id}">Переделать</button>
      <button class="btn btn--small" type="button" data-req-act="reject" data-id="${r.id}">Отклонить</button></div>`;
    if (r.status === "accepted") body = draftBody(r) + (r.lab ? `<p class="hint">Принято: ${r.lab} появилась в каталоге лабораторий курса.</p>` : "");
    if (r.status === "rejected") body = `<p class="hint">${esc(r.reason || "Черновик отклонён.")}</p><div class="row"><button class="btn btn--small" type="button" data-req-act="hide" data-id="${r.id}">Убрать из конспекта</button></div>`;
    return `<div class="xcard xcard--req" id="req-${r.id}">${head}${body}</div>`;
  }
  function noteCard(c) {
    const tag = { chat: "Из чата", simple: "Проще · моя заметка", material: "Мой материал" }[c.kind];
    let body = "";
    if (c.kind === "chat") body = `<b class="xt">${esc(c.q)}</b><p>${esc(c.a)}</p>`;
    if (c.kind === "simple") body = `<p>${esc(c.text)}</p>`;
    if (c.kind === "material") body = c.mtype === "link" ? `<p><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.text || c.url)}</a></p>`
      : c.mtype === "file" ? `<p>📎 ${esc(c.text)} <span class="hint">· в прототипе файл не загружается</span></p>` : `<p>${esc(c.text)}</p>`;
    const refs = (c.refs || []).map(x => x.t != null ? `<button class="chip" type="button" data-seek="${x.t}">${ICON_PLAY}<span class="tc">${fmt(x.t)}</span> ${esc(x.label || "момент видео")}</button>`
      : x.notes ? `<button class="chip" type="button" data-notes="${x.notes}">Конспект §${x.notes}</button>`
      : x.lab ? `<a class="chip" href="#tools-mcp-lab" data-lab-scen="${x.lab}">${esc(x.label)}</a>` : "").join("");
    return `<div class="xcard xcard--${c.kind}" data-card="${c.id}"><div class="xh"><span class="xtag">${tag}</span>
      <button class="xbtn" type="button" data-card-del="${c.id}">Убрать</button></div>${body}${refs ? `<div class="row">${refs}</div>` : ""}</div>`;
  }

  function renderSec(n) {
    const box = $(`.sec-extra[data-sec="${n}"]`);
    if (!box) return;
    const reqs = st.reqs.filter(r => r.sec === n && r.lecture === "1.2" && !r.seed && !r.hidden);
    const cards = st.cards.filter(c => c.sec === n && !c.pid);
    const vis = VISUAL.has(n) || reqs.some(r => r.status !== "rejected");
    box.innerHTML = reqs.map(reqCard).join("") + cards.map(noteCard).join("") + `
      <div class="sec-end">
        ${vis ? "" : `<span>В разделе нет визуализации.</span><button class="link-btn" type="button" data-order-sec="${n}">Заказать сцену</button><span aria-hidden="true">·</span>`}
        <button class="link-btn" type="button" data-mat-open="${n}">+ Свой материал</button>
      </div>
      <form class="mat-form" data-mat-form="${n}" hidden>
        <div class="seg-ctl" role="group" aria-label="Тип материала">
          <button type="button" data-mtype="link" aria-pressed="true">Ссылка</button><button type="button" data-mtype="note" aria-pressed="false">Заметка</button><button type="button" data-mtype="file" aria-pressed="false">Файл</button></div>
        <label class="sr" for="mat-in-${n}">Материал</label>
        <input id="mat-in-${n}" type="url" placeholder="https://…" data-mat-in>
        <input type="text" placeholder="Подпись, необязательно" data-mat-cap>
        <input type="file" data-mat-file hidden>
        <div class="row"><button class="btn btn--small" type="button" data-mat-cancel>Отмена</button><button class="btn btn--small btn--primary" type="submit">Добавить в §${n}</button></div>
      </form>`;
  }
  function renderPidCards() {
    $$(".frag-cards").forEach(b => { b.innerHTML = st.cards.filter(c => c.pid === b.dataset.for).map(noteCard).join(""); });
  }
  function renderAllSecs() {
    if (!$("#notes")) return;
    $$(".sec-extra").forEach(b => renderSec(+b.dataset.sec));
    renderPidCards();
  }

  /* ---------- Личная версия абзаца ---------- */
  function srcText(el) {
    if (el.tagName === "UL") return $$(":scope > li", el).map(li => "- " + li.innerText.trim()).join("\n");
    if (el.tagName === "OL") return $$(":scope > li", el).map((li, i) => `${i + 1}. ${li.innerText.trim()}`).join("\n");
    return el.innerText.trim();
  }
  function applyEdit(frag) {
    const pid = frag.dataset.pid, text = st.edits[pid], mine = $(".frag-mine", frag);
    frag.classList.toggle("is-mine", text != null);
    frag.classList.remove("show-orig");
    if (text == null) { mine.hidden = true; mine.innerHTML = ""; return; }
    mine.hidden = false;
    mine.innerHTML = `<div class="mine-bar"><span class="xtag">Моя версия</span>
      <button class="xbtn" type="button" data-mine="orig" aria-pressed="false">Показать оригинал</button>
      <button class="xbtn" type="button" data-mine="edit">Править</button>
      <button class="xbtn" type="button" data-mine="reset">Вернуть оригинал</button></div><div class="mine-body">${md(text)}</div>`;
  }
  function startEdit(frag) {
    hideMenu();
    const src = $(".frag-src", frag);
    $(".frag-edit", frag)?.remove();
    frag.classList.add("editing");
    src.insertAdjacentHTML("afterend", `<div class="frag-edit">
      <label class="sr" for="ed-${frag.dataset.pid}">Моя версия фрагмента</label>
      <textarea id="ed-${frag.dataset.pid}" rows="5">${esc(st.edits[frag.dataset.pid] ?? srcText(src))}</textarea>
      <div class="row"><span class="hint">Оригинал сохранится, к нему можно вернуться. Поддерживается Markdown.</span>
      <button class="btn btn--small" type="button" data-edit-cancel>Отмена</button><button class="btn btn--small btn--primary" type="button" data-edit-save>Сохранить мою версию</button></div></div>`);
    const ta = $(".frag-edit textarea", frag);
    ta.style.height = Math.max(120, ta.scrollHeight + 4) + "px";
    ta.focus();
  }

  /* ---------- Разметка конспекта и транскрипта ---------- */
  function decorateNotes(el) {
    let sec = 0, k = 0;
    const finish = (before, n) => { if (!n) return; const box = document.createElement("div"); box.className = "sec-extra"; box.dataset.sec = n; el.insertBefore(box, before); };
    [...el.children].forEach(node => {
      if (node.tagName === "H2" && node.id.startsWith("n-")) { finish(node, sec); sec = +node.id.slice(2); k = 0; return; }
      if (!sec) return;
      const ok = /^(P|UL|OL|BLOCKQUOTE|PRE)$/.test(node.tagName) || node.classList.contains("table-wrap");
      if (!ok) return;
      const pid = `n${sec}-${k++}`, frag = document.createElement("div");
      frag.className = "frag"; frag.dataset.pid = pid; frag.dataset.sec = sec;
      if (/^(P|UL|OL|BLOCKQUOTE)$/.test(node.tagName)) frag.dataset.rw = "1";
      node.replaceWith(frag);
      node.classList.add("frag-src");
      frag.innerHTML = `<button class="frag-plus" type="button" aria-label="Действия с фрагментом" aria-haspopup="menu">+</button>`;
      frag.appendChild(node);
      frag.insertAdjacentHTML("beforeend", `<div class="frag-mine" hidden></div><div class="frag-cards" data-for="${pid}"></div>`);
      applyEdit(frag);
    });
    finish(null, sec);
    if (!st.hint) {
      const first = $("h2[id^='n-']", el);
      first && first.insertAdjacentHTML("beforebegin", `<div class="tip" id="frag-tip"><span class="tip-new">Новое</span>
        <p>У каждого абзаца есть <b class="plus-demo">+</b>, а выделенный текст открывает то же меню: спросить в чате, объяснить проще, переписать по-своему, заказать сцену.</p>
        <button class="btn btn--small" type="button" data-tip-close>Понятно</button></div>`);
    }
    renderAllSecs();
  }
  function decorateTranscript(body) {
    $$(".tr-para", body).forEach(p => p.insertAdjacentHTML("beforeend", `<button class="frag-plus" type="button" aria-label="Действия с фрагментом транскрипта" aria-haspopup="menu">+</button>`));
  }

  /* ---------- Меню фрагмента ---------- */
  let menu, ctx = null, selT;
  function ensureMenu() {
    if (menu) return menu;
    menu = document.createElement("div");
    menu.className = "fmenu"; menu.id = "fmenu"; menu.hidden = true; menu.setAttribute("role", "menu");
    document.body.appendChild(menu);
    // Нажатие на пункт меню не должно сбрасывать выделение до клика.
    menu.addEventListener("mousedown", e => e.preventDefault());
    return menu;
  }
  function ctxFrom(node, quote) {
    const D = A().data(), el = node.nodeType === 1 ? node : node.parentElement;
    const frag = el.closest(".frag");
    if (frag) {
      const sec = +frag.dataset.sec, ch = D.chapters.find(c => c.notes_section === sec);
      return { src: "notes", sec, pid: frag.dataset.pid, frag, rw: !!frag.dataset.rw, t: ch ? ch.t : null, quote: quote || $(".frag-src", frag).innerText };
    }
    const para = el.closest(".tr-para"), seekEl = el.closest("[data-seek]") || (para && $("[data-seek]", para));
    const t = seekEl ? +seekEl.dataset.seek : A().now();
    const ch = D.chapters[A().chapterAt(t)];
    return { src: "transcript", sec: ch.notes_section || 1, t, para, rw: false, chapter: ch.title,
      quote: quote || (para ? $$(".seg", para).map(s => s.textContent).join(" ") : "") };
  }
  function showMenu(c, rect, mode) {
    ensureMenu();
    ctx = c;
    const src = c.src === "notes" ? `§${c.sec} ${esc(secTitle(c.sec))}` : `${fmt(c.t)} · ${esc(c.chapter)}`;
    menu.innerHTML = `<div class="fmenu-q"><span>${src}</span>«${esc(clip(c.quote, 90))}»</div>
      <button type="button" role="menuitem" data-fa="ask"><b>Спросить в чате</b><small>цитата уйдёт со ссылкой на ${c.src === "notes" ? `§${c.sec}` : `момент ${fmt(c.t)}`}</small></button>
      <button type="button" role="menuitem" data-fa="simple"><b>Объяснить проще</b><small>пересказ под фрагментом</small></button>
      ${c.rw ? `<button type="button" role="menuitem" data-fa="rewrite"><b>Переписать по-своему</b><small>личная версия, оригинал сохранится</small></button>` : ""}
      <button type="button" role="menuitem" data-fa="scene"><b>Сделать сцену по этому</b><small>сначала план и ваше подтверждение</small></button>`;
    menu.dataset.mode = mode;
    menu.hidden = false;
    menu.classList.toggle("sheet", touchUI());
    if (!touchUI()) {
      const w = menu.offsetWidth, h = menu.offsetHeight;
      let top = mode === "sel" ? rect.top - h - 10 : rect.bottom + 6;
      if (top < 8) top = rect.bottom + 10;
      if (top + h > innerHeight - 8) top = Math.max(8, rect.top - h - 6);
      menu.style.top = top + "px";
      menu.style.left = Math.min(Math.max(8, (mode === "sel" ? rect.left + rect.width / 2 - w / 2 : rect.left)), innerWidth - w - 8) + "px";
    } else { menu.style.top = ""; menu.style.left = ""; }
    if (mode === "plus") $("button", menu).focus({ preventScroll: true });
  }
  function hideMenu() { if (menu && !menu.hidden) { menu.hidden = true; ctx = null; } }

  function onSelection() {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) { if (menu && menu.dataset.mode === "sel") hideMenu(); return; }
    const txt = sel.toString().trim();
    if (txt.length < 3) return;
    const r = sel.getRangeAt(0);
    const host = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
    if (!host.closest("#notes, #panel-body") || host.closest(".frag-edit, .xcard, .frag-mine .mine-bar, form")) return;
    showMenu(ctxFrom(r.startContainer, txt), r.getBoundingClientRect(), "sel");
  }

  function doAction(a) {
    const c = ctx;
    hideMenu();
    if (!c) return;
    if (a === "ask") {
      quote = { text: clip(c.quote, 400), sec: c.sec, t: c.t, label: c.src === "notes" ? `Конспект §${c.sec}` : `Транскрипт ${fmt(c.t)}` };
      renderQuote();
      A().openChat();
      return;
    }
    if (a === "simple") {
      const anchor = c.src === "notes" ? $(".frag-cards", c.frag) : c.para;
      if (!anchor) return;
      $$(".xcard--draft-simple").forEach(x => x.remove());
      anchor.insertAdjacentHTML("afterend", `<div class="xcard xcard--simple xcard--draft-simple">
        <div class="xh"><span class="xtag">Проще · демо-текст подготовлен заранее</span><button class="xbtn" type="button" data-simple-drop>Убрать</button></div>
        <p>${esc(SIMPLE[c.sec] || SIMPLE[4])}</p>
        <div class="row"><button class="btn btn--small" type="button" data-simple-keep>${c.src === "notes" ? "Оставить под абзацем" : `Сохранить в конспект §${c.sec}`}</button></div></div>`);
      lastSimple = c;
      return;
    }
    if (a === "rewrite" && c.frag) { startEdit(c.frag); return; }
    if (a === "scene") planFromCtx(c, c.src === "notes" ? "Меню фрагмента" : "Меню транскрипта");
  }
  let lastSimple = null;

  /* ---------- Чат: цитата, закрепление, предложение агента ---------- */
  let quote = null;
  function renderQuote() {
    let el = $("#chat-quote");
    if (!el) { el = document.createElement("div"); el.id = "chat-quote"; el.className = "chat-quote"; $("#chat-form").before(el); }
    el.hidden = !quote;
    if (quote) el.innerHTML = `<div><span class="eyebrow">Вопрос о фрагменте · ${esc(quote.label)}</span><p>«${esc(clip(quote.text, 160))}»</p></div>
      <button class="icon-btn" type="button" data-quote-clear aria-label="Убрать цитату"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  }
  function takeQuote() { const q = quote; quote = null; renderQuote(); return q; }
  function quoteAnswer(q) { return `По фрагменту из ${q.label.toLowerCase().replace("конспект", "конспекта").replace("транскрипт", "транскрипта")}: ${SIMPLE[q.sec] || SIMPLE[4]}`; }

  function pinChat(m) {
    const sec = m.sec || 3;
    st.cards.push({ id: "c" + st.seq++, kind: "chat", sec, q: m.q, a: m.a, refs: m.refs || [] });
    changed();
    toast(`Ответ добавлен в конспект §${sec} — карточка «Из чата» в конце раздела.`);
    return sec;
  }
  // Предложение агента: не чаще одного раза за обсуждение.
  function suggestion() {
    if (st.suggested || activeLab("L02")) return "";
    st.suggested = true; save();
    return `<div class="bubble bot bubble--offer"><span class="demo-tag">Предложение агента · демо</span>
      <span>Могу собрать лабораторию <b>L02 «Частичный сбой транзакции»</b>: тот же подход, что в L01, но сбой посередине цепочки charge → reserve → delivery. Сначала покажу план — без вашего подтверждения ничего не запускается.</span>
      <div class="refs"><button class="chip chip--strong" type="button" data-order-lab="L02" data-origin="Предложение агента в чате">Показать план</button><button class="chip" type="button" data-offer-drop>Не сейчас</button></div></div>`;
  }
  const wantsScene = s => /сдела|собер|заказ|лаборатор|сцен|визуализ|code-?video|анимац/i.test(s);
  function sceneReply(text) {
    const l02 = /charge|reserve|delivery|частичн|откат|транзакц|сбой/i.test(text);
    return `<div class="bubble bot"><span class="demo-tag">Демо</span><span>Оформлю это как заявку: сначала план с примером, сценариями, временем и ценой, запуск — только после вашего подтверждения.</span>
      <div class="refs">${l02 ? `<button class="chip chip--strong" type="button" data-order-lab="L02" data-origin="Чат">План: L02 частичный сбой</button>`
        : `<button class="chip chip--strong" type="button" data-order-free="${esc(clip(text, 200))}">Показать план</button>`}</div></div>`;
  }

  /* ---------- Вкладка «Заявки» на странице курса ---------- */
  let filter = "all";
  function renderRequests() {
    const counts = st.reqs.reduce((m, r) => (m[r.status] = (m[r.status] || 0) + 1, m), {});
    const list = st.reqs.filter(r => filter === "all" || r.status === filter);
    const sp = spent(), rs = reserved();
    return `<div class="req-top">
      <div class="budget">
        <div class="eyebrow">Бюджет генерации · демо</div>
        <div class="budget-n"><b>${money(sp)}</b><span>потрачено из ${money(BUDGET)} на курс · ${money(rs)} зарезервировано заявками в очереди</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, sp / BUDGET * 100)}%"></div><div class="bar-res" style="width:${Math.min(100, rs / BUDGET * 100)}%"></div></div>
        <p class="hint">Сверх бюджета Орио не начинает: заявка остаётся в статусе «ждёт подтверждения».</p>
      </div>
      <div class="notify"><div class="eyebrow">Уведомления</div>
        <p>Орио пишет в Telegram, когда черновик готов или заявке нужно ваше решение. В сообщении — название, ссылка на место в лекции и кнопка «Открыть».</p>
        <p class="hint">В прототипе уведомление показано всплывающим сообщением.</p></div>
    </div>
    <div class="req-filters" role="group" aria-label="Фильтр по статусу">
      <button type="button" data-req-filter="all" aria-pressed="${filter === "all"}">Все · ${st.reqs.length}</button>
      ${Object.entries(STATUS).map(([k, v]) => `<button type="button" data-req-filter="${k}" aria-pressed="${filter === k}" ${counts[k] ? "" : "disabled"}>${v}${counts[k] ? ` · ${counts[k]}` : ""}</button>`).join("")}
    </div>
    ${list.length ? `<div class="reqs">${list.map(r => {
      const act = r.status === "awaiting" ? `<button class="btn btn--small btn--primary" type="button" data-req-plan="${r.id}">Открыть план</button>`
        : r.status === "draft" ? `<button class="btn btn--small btn--primary" type="button" data-req-open="${r.id}">Открыть черновик</button>`
        : r.status === "accepted" && r.lab === "L01" ? `<a class="btn btn--small" href="#tools-mcp-lab">Открыть L01</a>`
        : r.status === "accepted" || r.status === "queued" || r.status === "building" ? (r.sec && !r.seed ? `<button class="btn btn--small" type="button" data-req-open="${r.id}">В лекции</button>` : "") : "";
      const progress = r.status === "building" ? `<span class="hint">${STAGES[r.stage]} · ${r.stage + 1}/${STAGES.length}</span>` : r.status === "rejected" && r.reason ? `<span class="hint">${esc(r.reason)}</span>` : "";
      return `<div class="req-row"><span class="rid">#${r.id.slice(1)}</span>
        <div><div class="t">${esc(r.title)}</div>
          <div class="s">${KIND[r.kind]} · лекция ${r.lecture}${r.sec ? `, §${r.sec}` : ""} · откуда: ${esc(r.origin)}${r.version > 1 ? ` · версия ${r.version}` : ""}${r.seed ? " · демо-история" : ""}</div>
          <div class="s">${r.time} · ≈ ${money(r.cost)}</div>${progress}</div>
        <span class="rstate ${r.status}">${STATUS[r.status]}</span><div class="ract">${act}</div></div>`;
    }).join("")}</div>` : `<p class="empty">Заявок с этим статусом нет.</p>`}
    <p class="hint" style="margin-top:12px">Заявки рождаются из меню фрагмента, из чата и кнопками «Заказать» в каталоге и матрице готовности. Отдельного раздела «Генерация» нет.</p>`;
  }
  const activeCount = () => st.reqs.filter(r => ["awaiting", "queued", "building", "draft"].includes(r.status)).length;

  /* ---------- События ---------- */
  document.addEventListener("selectionchange", () => { clearTimeout(selT); selT = setTimeout(onSelection, 220); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { hideMenu(); closePlan(); } });
  addEventListener("scroll", () => { if (menu && !menu.hidden && !menu.classList.contains("sheet")) hideMenu(); }, { passive: true });
  document.addEventListener("scroll", e => { if (e.target.id === "panel-body" && menu && !menu.hidden && !menu.classList.contains("sheet")) hideMenu(); }, true);

  document.addEventListener("click", e => {
    const t = e.target;
    const on = s => t.closest(s);
    let el;
    const selecting = menu && menu.dataset.mode === "sel" && !getSelection().isCollapsed;
    if (menu && !menu.hidden && !on("#fmenu") && !on(".frag-plus") && !selecting) hideMenu();
    if ((el = on(".frag-plus"))) {
      if (menu && !menu.hidden && menu.dataset.mode === "plus" && ctx && (ctx.frag === el.parentElement || ctx.para === el.parentElement)) { hideMenu(); return; }
      showMenu(ctxFrom(el.parentElement.closest(".frag") ? $(".frag-src", el.parentElement) : el.parentElement), el.getBoundingClientRect(), "plus");
      return;
    }
    if ((el = on("[data-fa]"))) { doAction(el.dataset.fa); getSelection().removeAllRanges(); return; }
    if ((el = on("[data-plan-act]"))) { planAct(el.dataset.planAct); return; }
    if ((el = on("[data-tip-close]"))) { st.hint = true; save(); $("#frag-tip").remove(); return; }
    if ((el = on("[data-quote-clear]"))) { takeQuote(); return; }
    if ((el = on("[data-order-lab]"))) { if (window.innerWidth < 1100) A().closeChat(); planForLab(el.dataset.orderLab, el.dataset.origin || "Каталог лабораторий"); return; }
    if ((el = on("[data-order-mat]"))) { e.preventDefault(); planForMatrix(el.dataset.orderMat, el.dataset.lec); return; }
    if ((el = on("[data-order-sec]"))) { const n = +el.dataset.orderSec; planFromCtx({ sec: n, quote: secTitle(n), t: (A().data().chapters.find(c => c.notes_section === n) || {}).t ?? null }, "Раздел без визуализации"); return; }
    if ((el = on("[data-order-free]"))) { if (window.innerWidth < 1100) A().closeChat(); planFromCtx({ sec: 3, quote: el.dataset.orderFree, t: null }, "Чат"); return; }
    if ((el = on("[data-offer-drop]"))) { el.closest(".refs").innerHTML = `<span class="hint">Хорошо, больше не предлагаю в этом обсуждении.</span>`; return; }
    if ((el = on("[data-req-plan]"))) { openPlan(reqById(el.dataset.reqPlan)); return; }
    if ((el = on("[data-req-open]"))) { const r = reqById(el.dataset.reqOpen); $("#toast") && ($("#toast").hidden = true); r && openReq(r); return; }
    if ((el = on("[data-req-act]"))) {
      const r = reqById(el.dataset.id), a = el.dataset.reqAct;
      if (a === "accept") { setStatus(r, "accepted"); toast(r.lab ? `${r.lab} принята и появилась в каталоге лабораторий курса.` : "Сцена принята в лекцию."); }
      if (a === "redo") { setStatus(r, "awaiting", { version: r.version + 1 }); openPlan(r, true); }
      if (a === "reject") setStatus(r, "rejected", { reason: "Отклонено на черновике." });
      if (a === "hide") { r.hidden = true; changed(); }
      return;
    }
    if ((el = on("[data-req-filter]"))) { filter = el.dataset.reqFilter; document.dispatchEvent(new CustomEvent("cc:changed")); return; }
    if ((el = on("[data-mini] button"))) { $$("button", el.parentElement).forEach(b => b.setAttribute("aria-pressed", b === el)); return; }
    if ((el = on("[data-mini-run]"))) { runMini(el.closest(".mini")); return; }
    if ((el = on("[data-card-del]"))) { st.cards = st.cards.filter(c => c.id !== el.dataset.cardDel); changed(); return; }
    if ((el = on("[data-simple-drop]"))) { el.closest(".xcard").remove(); return; }
    if ((el = on("[data-simple-keep]"))) {
      const c = lastSimple;
      el.closest(".xcard").remove();
      if (!c) return;
      st.cards.push(c.src === "notes" ? { id: "c" + st.seq++, kind: "simple", sec: c.sec, pid: c.pid, text: SIMPLE[c.sec] || SIMPLE[4] }
        : { id: "c" + st.seq++, kind: "simple", sec: c.sec, text: SIMPLE[c.sec] || SIMPLE[4], refs: [{ t: c.t, label: "фрагмент транскрипта" }] });
      changed();
      if (c.src !== "notes") toast(`Пересказ сохранён в конспект §${c.sec}.`);
      return;
    }
    if ((el = on("[data-edit-save]"))) {
      const frag = el.closest(".frag"), v = $("textarea", frag).value.trim();
      if (v && v !== srcText($(".frag-src", frag))) st.edits[frag.dataset.pid] = v; else delete st.edits[frag.dataset.pid];
      save(); $(".frag-edit", frag).remove(); frag.classList.remove("editing"); applyEdit(frag);
      return;
    }
    if ((el = on("[data-edit-cancel]"))) { const frag = el.closest(".frag"); $(".frag-edit", frag).remove(); frag.classList.remove("editing"); return; }
    if ((el = on("[data-mine]"))) {
      const frag = el.closest(".frag"), a = el.dataset.mine;
      if (a === "orig") { const v = frag.classList.toggle("show-orig"); el.setAttribute("aria-pressed", v); el.textContent = v ? "Скрыть оригинал" : "Показать оригинал"; }
      if (a === "edit") startEdit(frag);
      if (a === "reset") { delete st.edits[frag.dataset.pid]; save(); applyEdit(frag); toast("Возвращён оригинальный текст."); }
      return;
    }
    if ((el = on("[data-mat-open]"))) { const f = $(`[data-mat-form="${el.dataset.matOpen}"]`); f.hidden = !f.hidden; if (!f.hidden) $("[data-mat-in]", f).focus(); return; }
    if ((el = on("[data-mat-cancel]"))) { el.closest("form").hidden = true; return; }
    if ((el = on("[data-mtype]"))) {
      const f = el.closest("form"), type = el.dataset.mtype, inp = $("[data-mat-in]", f);
      $$("[data-mtype]", f).forEach(b => b.setAttribute("aria-pressed", b === el));
      inp.type = type === "link" ? "url" : "text";
      inp.placeholder = { link: "https://…", note: "Своя заметка к разделу", file: "Выберите файл" }[type];
      inp.hidden = type === "file"; $("[data-mat-file]", f).hidden = type !== "file"; $("[data-mat-cap]", f).hidden = type !== "link";
      return;
    }
    if ((el = on("[data-reset-demo]"))) {
      if (!confirm("Сбросить правки, карточки и заявки этого прототипа в этом браузере?")) return;
      st = blank(); save(); location.reload();
    }
  });

  document.addEventListener("submit", e => {
    const f = e.target.closest("[data-mat-form]");
    if (!f) return;
    e.preventDefault();
    const type = $("[data-mtype][aria-pressed='true']", f).dataset.mtype, n = +f.dataset.matForm;
    const v = $("[data-mat-in]", f).value.trim(), file = $("[data-mat-file]", f).files[0];
    if (type === "link" && !/^https?:\/\//.test(v)) { $("[data-mat-in]", f).focus(); return; }
    if ((type === "note" && !v) || (type === "file" && !file)) return;
    st.cards.push({ id: "c" + st.seq++, kind: "material", sec: n, mtype: type, url: type === "link" ? v : null,
      text: type === "file" ? file.name : type === "link" ? $("[data-mat-cap]", f).value.trim() : v });
    changed();
  });

  window.Custom = {
    decorateNotes, decorateTranscript, renderRequests, activeCount, takeQuote, quoteAnswer, pinChat, suggestion, wantsScene, sceneReply,
    labDone: code => !!st.reqs.find(r => r.lab === code && r.status === "accepted"),
    labReq: activeLab, STATUS,
    matReq: (lec, kind) => st.reqs.find(r => r.lecture === lec && r.kind === kind && !r.lab && r.status !== "rejected")
  };
})();
