/* Лаборатория L01: повтор вызова cancel_booking.
   Учебная симуляция: модель, сеть и база смоделированы в браузере. Логика функции повторяет
   ячейку 35 ноутбука: статус не проверяется, seats += 1 и возврат на каждый вызов. */
(function () {
  const SCEN = {
    success: { title: "Успешный вызов", desc: "Верные аргументы, ответ дошёл с первого раза." },
    badargs: { title: "Неправильные аргументы", desc: "Модель передаёт id вместо booking_id. Схема отклоняет вызов." },
    lost: { title: "Ответ потерян", desc: "Функция выполнилась, ответ не дошёл. Агент повторяет вызов." }
  };
  const PHASE = { user: "Пользователь", model: "Модель", call: "Вызов", exec: "Выполнение", result: "Результат", error: "Ошибка", net: "Сеть", done: "Итог" };
  const PRICE = 120;
  const CALL_ID = "call_01";
  const KEY = "idem:call_01";
  const FINAL = "Your booking BKG-123 has been successfully canceled. A refund of $120 will be processed back to your account.";

  function initState() {
    return { status: "confirmed", seats: 3, refunds: [], sent: 0, exec: 0, store: {}, msgs: [], told: null };
  }

  // Шаг: { ph, run(state, withKey) -> текст журнала }
  function buildSteps(scenario, withKey, losses) {
    const steps = [];
    const add = (ph, run) => steps.push({ ph, run });
    const keyNote = () => withKey ? ` Заголовок Idempotency-Key: ${KEY}.` : " Ключа нет.";

    add("user", s => {
      s.msgs.push({ cls: "human", k: "HumanMessage", v: "I confirm the cancellation of booking BKG-123" });
      return "Пользователь подтверждает отмену брони BKG-123.";
    });

    const modelCall = args => add("model", s => {
      s.msgs.push({ cls: "ai-call", k: "AIMessage", v: `tool_calls=[cancel_booking(${JSON.stringify(args)})] · id=${CALL_ID}` });
      return `Модель вернула tool_call: cancel_booking(${JSON.stringify(args)}).`;
    });
    const send = label => add("call", s => { s.sent++; return `${label}.${keyNote()}`; });
    const exec = () => add("exec", s => {
      if (withKey && s.store[KEY]) {
        return `Сервер нашёл ключ ${KEY} и вернул сохранённый ответ. Функция не запускалась, база не изменилась.`;
      }
      const again = s.status === "cancelled";
      const seatsBefore = s.seats;
      s.exec++;
      s.status = "cancelled";
      s.seats += 1;
      s.refunds.push(PRICE);
      if (withKey) s.store[KEY] = true;
      return again
        ? `cancel_booking выполнен ещё раз. Статус уже cancelled, но код его не проверяет: мест ${seatsBefore} → ${s.seats}, ещё один возврат ${PRICE} $.`
        : `cancel_booking выполнен: статус cancelled, мест ${seatsBefore} → ${s.seats}, возврат ${PRICE} $.`;
    });
    const lost = n => add("net", () => `Ответ потерян: через 10 с таймаут${n > 1 ? ` (${n}-й раз)` : ""}. Агент не знает, выполнилась ли отмена.`);
    const result = () => add("result", s => {
      s.msgs.push({ cls: "tool", k: "ToolMessage", v: `{"success": true, "refund": ${PRICE}} · ${CALL_ID}` });
      return `Ответ дошёл: ToolMessage {"success": true, "refund": ${PRICE}}.`;
    });
    const answer = () => add("model", s => {
      s.msgs.push({ cls: "ai", k: "AIMessage", v: FINAL });
      s.told = PRICE;
      return `Модель отвечает пользователю: бронь отменена, возврат ${PRICE} $.`;
    });

    if (scenario === "badargs") {
      modelCall({ id: "BKG-123" });
      send("Агент отправляет вызов #1");
      add("error", s => {
        s.msgs.push({ cls: "tool-err", k: "ToolMessage", v: "Error: validation error for cancel_booking · booking_id: Field required. Please fix your mistakes." });
        return "Аргументы не прошли проверку схемы: нет booking_id. Функция не запускалась. Ошибка вернулась модели как ToolMessage.";
      });
      add("model", s => {
        s.msgs.push({ cls: "ai-call", k: "AIMessage", v: `tool_calls=[cancel_booking({"booking_id":"BKG-123"})] · id=call_02` });
        return "Модель прочитала ошибку и повторила вызов с правильным именем аргумента.";
      });
      send("Агент отправляет вызов #2");
      exec();
      result();
      answer();
    } else {
      modelCall({ booking_id: "BKG-123" });
      send("Агент отправляет вызов #1");
      exec();
      if (scenario === "lost") {
        for (let r = 1; r <= losses; r++) {
          lost(r);
          send(`Повтор ${r} из ${losses}: тот же вызов ${CALL_ID}`);
          exec();
        }
      }
      result();
      answer();
    }
    return steps;
  }

  function verdict(s, scenario) {
    const refunded = s.refunds.reduce((a, b) => a + b, 0);
    if (s.exec > 1) {
      return { good: false, title: `Двойной эффект: функция выполнена ${s.exec} раза`,
        text: `Пользователю сообщили о возврате ${s.told} $, оформлено ${refunded} $. В продаже ${s.seats} мест вместо 4, хотя отменена одна бронь.` };
    }
    if (scenario === "badargs") {
      return { good: true, title: "Одна отмена, ошибка понятна модели",
        text: "Неверный вызов остановила проверка схемы до запуска функции. Сообщение об ошибке назвало недостающий аргумент, модель исправилась сама." };
    }
    if (scenario === "lost") {
      return { good: true, title: "Один эффект при нескольких вызовах",
        text: `Отправлено вызовов: ${s.sent}, выполнение одно. Повтор с тем же ключом вернул сохранённый ответ: одно место, один возврат ${PRICE} $.` };
    }
    return { good: true, title: "Один вызов — один эффект", text: `Бронь отменена, мест 3 → 4, возврат ${PRICE} $.` };
  }

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));

  function mount(root) {
    const P = { scenario: "lost", key: false, compare: true, losses: 1, speed: 1 };
    let lanes = [], pos = 0, total = 0, timer = null, outTab = "log", prevVals = {};
    // Режим «Проверить себя»: прогноз → запуск → объяснение → новое условие. Данные — в CCLabChecks.
    const CK = (window.CCLabChecks || {}).L01, Ln = window.Learn;
    const hasCheck = !!(CK && Ln);
    const LK = Ln ? Ln.key("shad", "L01") : "shad:L01";
    const M = { mode: "explore", pred: null, revealed: false, actual: "", explainOk: false, transferOk: false };

    root.innerHTML = `
<details class="sim-info"><summary>Учебная симуляция · как устроен пример</summary><p>Модель, сеть и база смоделированы в браузере. Логика cancel_booking повторяет ноутбук. Ключ идемпотентности добавлен для сравнения.</p></details>
<div class="lab">
  <div class="lab-top"><span class="dot"></span><span class="lab-title"></span></div>
  ${hasCheck ? `<div class="lab-modebar"><div class="seg-ctl" data-group="mode" role="group" aria-label="Режим лаборатории">
      <button type="button" data-v="explore" aria-pressed="true">Исследовать</button>
      <button type="button" data-v="check" aria-pressed="false">Проверить себя</button></div></div>
    <div class="lab-predict" hidden>
      <p class="check-q">${esc(CK.predict.question)}</p>
      <div class="pred-opts" role="group" aria-label="Ваш прогноз">${CK.predict.options.map(o => `<button type="button" class="btn btn--small" data-pred="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join("")}</div>
      <p class="pred-result" aria-live="polite" hidden></p>
    </div>` : ""}
  <div class="lab-body">
    <div class="lab-main">
      <div class="lab-ctl">
        <button class="btn btn--small" type="button" data-lab="step"><svg viewBox="0 0 16 16"><path d="M10 3h2v10h-2zM3 3v10l6-5z"/></svg>Шаг</button>
        <button class="btn btn--small btn--primary" type="button" data-lab="run"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg><span>Запуск</span></button>
        <button class="btn btn--small" type="button" data-lab="reset"><svg viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 1-4.6 3H1.5L4.5 2l3 4H5.6A3 3 0 1 0 8 5z"/></svg>Сброс</button>
        <label class="sr" for="lab-speed">Скорость</label>
        <select class="speed" id="lab-speed"><option value="0.5">медленно</option><option value="1" selected>обычно</option><option value="2">быстро</option></select>
        <span class="pos" aria-live="polite"></span>
      </div>
      <div class="lab-comparison" aria-live="polite"></div>
      <button type="button" class="link-btn lab-detail-toggle" aria-expanded="false">Подробное состояние базы</button>
      <div class="lanes"></div>
      <details class="lab-out">
        <summary>Журнал и сообщения</summary>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" data-out="log" aria-selected="true">Журнал</button>
          <button type="button" role="tab" data-out="msgs" aria-selected="false">Сообщения</button>
        </div>
        <div class="out-body"></div>
      </details>
    </div>
    <div class="lab-side">
      <div class="ctl-group"><div class="eyebrow">Сценарий</div><div class="scen">
        ${Object.entries(SCEN).map(([k, v]) => `<button type="button" data-scen="${k}"><b>${v.title}</b><span>${v.desc}</span></button>`).join("")}
      </div></div>
      <p class="scenario-description"></p>
      <details class="lab-options"><summary>Условия эксперимента</summary>
      <div class="ctl-group"><div class="eyebrow">Сравнить рядом: без ключа и с ключом</div>
        <div class="seg-ctl" data-group="compare"><button type="button" data-v="0">Выкл</button><button type="button" data-v="1">Вкл</button></div>
      </div>
      <div class="ctl-group"><div class="eyebrow">Ключ идемпотентности</div>
        <div class="seg-ctl" data-group="key"><button type="button" data-v="0">Без ключа</button><button type="button" data-v="1">С ключом</button></div>
        <p class="ctl-hint key-hint"></p>
      </div>
      <div class="ctl-group losses-group"><div class="eyebrow">Сколько ответов потеряно подряд</div>
        <div class="seg-ctl" data-group="losses"><button type="button" data-v="1">1</button><button type="button" data-v="2">2</button><button type="button" data-v="3">3</button></div>
      </div>
      <div class="ctl-group"><div class="eyebrow">Как работает ключ</div>
<pre class="mini-code">PROCESSED = {}  # ключ → сохранённый ответ

def cancel_booking_idempotent(booking_id, key):
    if key in PROCESSED:
        return PROCESSED[key]  # повтор без эффекта
    result = cancel_booking(booking_id)
    PROCESSED[key] = result
    return result</pre>
        <p class="ctl-hint">Агент берёт ключ из tool_call_id, поэтому повтор того же вызова приходит с тем же ключом.</p>
      </div>
      </details>
    </div>
  </div>
  ${hasCheck ? `<div class="lab-check" hidden>
    <div class="lab-explain" hidden>
      <p class="check-q">${esc(CK.explain.question)}</p>
      <textarea rows="4" aria-label="Объяснение расхождения между прогонами"></textarea>
      <div class="u-actions"><button class="btn btn--small btn--primary" type="button" data-explain-submit>Проверить</button></div>
      <div class="explain-result" aria-live="polite"></div>
    </div>
    <div class="lab-transfer" hidden>
      <p class="check-q">${esc(CK.transfer.question)}</p>
      <div class="u-actions"><input type="text" inputmode="numeric" class="transfer-answer" aria-label="Число возвратов">
        <button class="btn btn--small btn--primary" type="button" data-transfer-check>Проверить ответ</button>
        <button class="btn btn--small" type="button" data-transfer-run>Проверить запуском</button></div>
      <p class="transfer-result" aria-live="polite"></p>
    </div>
  </div>` : ""}
</div>
${hasCheck ? `<section class="lab-note" aria-label="Мой вывод" hidden>
  <div class="u-head"><b>Мой вывод</b><span class="uorigin">моя заметка</span></div>
  <p class="lab-note-text"></p>
</section>` : ""}`;

    const q = s => root.querySelector(s);
    q(".lab-body").prepend(q(".lab-side"));
    q(".lab-out").open = innerWidth > 640;
    q(".lab-options").open = innerWidth > 640;
    q(".lab-detail-toggle").addEventListener("click", e => {
      const expanded = root.classList.toggle("lab-expanded");
      e.currentTarget.setAttribute("aria-expanded", String(expanded));
      e.currentTarget.textContent = expanded ? "Скрыть подробное состояние" : "Подробное состояние базы";
    });
    const runBtn = q('[data-lab="run"]');

    function rebuild() {
      stop();
      const defs = P.compare ? [{ key: false, name: "Без ключа" }, { key: true, name: "С ключом" }] : [{ key: P.key, name: P.key ? "С ключом" : "Без ключа" }];
      lanes = defs.map(d => ({ ...d, steps: buildSteps(P.scenario, d.key, P.losses) }));
      total = Math.max(...lanes.map(l => l.steps.length));
      pos = 0; prevVals = {};
      syncControls();
      render();
    }

    // Состояние линии на позиции pos: проигрываем шаги заново — дёшево и детерминированно.
    function laneAt(l) {
      const s = initState(), log = [];
      const n = Math.min(pos, l.steps.length);
      for (let i = 0; i < n; i++) log.push({ i: i + 1, ph: l.steps[i].ph, text: l.steps[i].run(s, l.key) });
      return { s, log, done: n >= l.steps.length };
    }

    function flap(value, bad, id) {
      const changed = prevVals[id] !== undefined && prevVals[id] !== value;
      prevVals[id] = value;
      return `<span class="flap${bad ? " bad" : ""}${changed ? " flip" : ""}">${String(value).split("").map(c => `<span>${esc(c)}</span>`).join("")}</span>`;
    }

    function render() {
      const results = lanes.map(laneAt);
      // Первый прогон в режиме проверки с прогнозом снимает маску и запоминает, что вышло.
      if (hasCheck && M.mode === "check" && !M.revealed && M.pred && P.losses === 1 && results.length === 2 && results.every(r => r.done)) {
        M.revealed = true;
        M.actual = results.map(r => r.s.refunds.length).join(" и ");
      }
      const hide = hasCheck && M.mode === "check" && !M.revealed;
      const mk = hide ? " masked" : "";
      const ah = hide ? ' aria-hidden="true"' : "";
      root.style.setProperty("--lanes", lanes.length);
      q(".lab-title").textContent = `lab · cancel_booking · ${P.scenario}${P.scenario === "lost" ? ` ×${P.losses}` : ""} · ${P.compare ? "сравнение: без ключа | с ключом" : (P.key ? "с ключом" : "без ключа")}`;
      q(".pos").textContent = `шаг ${pos} из ${total}`;
      q(".scenario-description").textContent = SCEN[P.scenario].desc;
      q(".lab-options > summary").textContent = `Условия · ${P.compare ? "сравнить оба варианта" : P.key ? "с ключом" : "без ключа"}${P.scenario === "lost" ? ` · потерь: ${P.losses}` : ""}`;
      q(".lab-comparison").classList.toggle("masked", hide);
      q(".lab-comparison").toggleAttribute("aria-hidden", hide);
      q(".lab-comparison").innerHTML = `<table><caption class="sr">Сравнение результатов</caption>
        <thead><tr><th scope="col">Результат</th>${lanes.map(l => `<th scope="col">${l.name}</th>`).join("")}</tr></thead>
        <tbody>${[
          ["Вызовы", r => r.s.sent], ["Выполнения", r => r.s.exec],
          ["Возврат", r => r.s.refunds.reduce((a, b) => a + b, 0) + " $"],
          ["Места", r => r.s.seats],
        ].map(([label, value]) => `<tr><th scope="row">${label}</th>${results.map(r => `<td>${value(r)}</td>`).join("")}</tr>`).join("")}</tbody></table>
        <p class="comparison-step">${pos === 0 ? "Запустите сценарий и сравните результаты." : esc(results[0].log.at(-1)?.text || "")}</p>
        ${results.every(r => r.done) ? `<div class="comparison-verdict">${results.map((r, i) => { const v = verdict(r.s, P.scenario); return `<p class="${v.good ? "good" : "bad"}"><b>${lanes[i].name}:</b> ${esc(v.title)}</p>`; }).join("")}</div>` : ""}`;

      q(".lanes").innerHTML = lanes.map((l, li) => {
        const { s, log, done } = results[li];
        const refunded = s.refunds.reduce((a, b) => a + b, 0);
        const lastLog = log[log.length - 1];
        const v = done ? verdict(s, P.scenario) : null;
        return `<div class="lane">
  <div class="lane-h"><b>${l.name}</b><span class="key-pill${l.key ? " on" : ""}">${l.key ? KEY : "ключа нет"}</span></div>
  <div class="board${mk}" aria-label="Состояние базы"${ah}>
    <div class="board-row"><div><div class="lbl">Бронь BKG-123 · Jane Doe</div><div class="val">${s.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}</div></div></div>
    <div class="board-row"><div><div class="lbl">Рейс AY001 · HEL → AMS · 22.02 09:30</div><div class="val">мест в продаже</div></div>${flap(s.seats, s.seats > 4, li + "s")}</div>
    <div class="board-row"><div><div class="lbl">Возвраты Jane Doe</div><div class="val">${s.refunds.length ? s.refunds.map(r => r + " $").join(" + ") : "нет"}</div></div>${flap(refunded, refunded > PRICE, li + "r")}</div>
  </div>
  <div class="counters${mk}"${ah}>
    <div class="counter"><b>${s.sent}</b><span>вызовов отправлено</span></div>
    <div class="counter exec${s.exec > 1 ? " bad" : ""}"><b>${s.exec}</b><span>фактических выполнений</span></div>
    <div class="counter${refunded > PRICE ? " bad" : ""}"><b>${refunded} $</b><span>возвращено</span></div>
  </div>
  <div class="now-step">${lastLog
    ? `<span class="ph ${lastLog.ph}">${lastLog.i}. ${PHASE[lastLog.ph]}</span><span>${esc(lastLog.text)}</span>`
    : `<span class="ph done">Готово к запуску</span><span>Нажмите «Шаг», чтобы пройти сценарий по одному событию, или «Запуск».</span>`}</div>
  ${v ? `<div class="verdict ${v.good ? "good" : "bad"}${mk}"${ah}><b>${esc(v.title)}</b>${esc(v.text)}</div>` : ""}
</div>`;
      }).join("");

      root.querySelectorAll("[data-out]").forEach(b => b.setAttribute("aria-selected", b.dataset.out === outTab));
      const out = q(".out-body");
      if (outTab === "log") {
        const rows = [];
        for (let i = 0; i < pos; i++) results.forEach((r, li) => { if (r.log[i]) rows.push({ ...r.log[i], lane: lanes.length > 1 ? lanes[li].name : "" }); });
        out.innerHTML = rows.length
          ? `<ol class="log">${rows.map(r => `<li><span class="i">${String(r.i).padStart(2, "0")}</span><span class="ph ${r.ph}">${PHASE[r.ph]}</span><span class="txt">${r.lane ? `<span class="lane-tag">${r.lane}</span>` : ""}${esc(r.text)}</span></li>`).join("")}</ol>`
          : `<p class="empty">Журнал пуст. Каждое событие сценария появится здесь со своим номером шага.</p>`;
        const lg = out.querySelector(".log");
        if (lg) lg.scrollTop = lg.scrollHeight;
      } else {
        out.innerHTML = `<div class="msgs-cols">${results.map((r, li) => `<div>${lanes.length > 1 ? `<div class="eyebrow">${lanes[li].name}</div>` : ""}${
          r.s.msgs.length ? r.s.msgs.map(m => `<div class="msg ${m.cls}"><span class="k">${m.k}</span><span class="v">${esc(m.v)}</span></div>`).join("")
            : `<p class="empty">Сообщений пока нет.</p>`}</div>`).join("")}</div>`;
      }

      const needPred = hide && !M.pred;
      runBtn.disabled = needPred && !timer;
      q(".lab-out").classList.toggle("masked", hide);
      runBtn.querySelector("span").textContent = timer ? "Пауза" : (pos >= total ? "Заново" : "Запуск");
      runBtn.querySelector("svg").innerHTML = timer ? '<path d="M4 2h3v12H4zM9 2h3v12H9z"/>' : '<path d="M4 2l10 6-10 6z"/>';
      q('[data-lab="step"]').disabled = pos >= total || needPred;
      syncCheck();
    }

    function syncControls() {
      root.querySelectorAll("[data-scen]").forEach(b => b.setAttribute("aria-pressed", b.dataset.scen === P.scenario));
      const set = (g, v) => root.querySelectorAll(`[data-group="${g}"] button`).forEach(b => b.setAttribute("aria-pressed", b.dataset.v === String(v)));
      set("compare", +P.compare); set("key", +P.key); set("losses", P.losses);
      root.querySelectorAll('[data-group="key"] button').forEach(b => { b.disabled = P.compare; });
      q(".key-hint").textContent = P.compare ? "В режиме сравнения показаны оба варианта." : "";
      q(".losses-group").hidden = P.scenario !== "lost";
    }

    function step() { if (pos < total) { pos++; if (pos >= total) stop(); render(); } }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function run() {
      if (timer) { stop(); render(); return; }
      if (pos >= total) { pos = 0; prevVals = {}; }
      timer = setInterval(step, 1100 / P.speed);
      step();
    }

    q('[data-lab="step"]').addEventListener("click", () => { stop(); step(); render(); });
    runBtn.addEventListener("click", run);
    q('[data-lab="reset"]').addEventListener("click", () => { stop(); pos = 0; prevVals = {}; render(); });
    q("#lab-speed").addEventListener("change", e => {
      P.speed = +e.target.value;
      if (timer) { clearInterval(timer); timer = setInterval(step, 1100 / P.speed); }
    });
    root.querySelectorAll("[data-scen]").forEach(b => b.addEventListener("click", () => { P.scenario = b.dataset.scen; rebuild(); }));
    root.querySelectorAll("[data-group]:not([data-group=mode]) button").forEach(b => b.addEventListener("click", () => {
      const g = b.closest("[data-group]").dataset.group, v = +b.dataset.v;
      if (g === "compare") P.compare = !!v;
      if (g === "key") P.key = !!v;
      if (g === "losses") P.losses = v;
      rebuild();
    }));
    root.querySelectorAll("[data-out]").forEach(b => b.addEventListener("click", () => { outTab = b.dataset.out; render(); }));

    // ---------- Режим «Проверить себя» ----------
    const touch = () => { if (Ln) Ln.touch({ lecture: "shad", unit: "L01", kind: "lab", route: "tools-mcp-lab", mode: M.mode }); };
    const ta = hasCheck ? q(".lab-explain textarea") : null;
    let draftTimer = 0;

    function syncCheck() {
      if (!hasCheck) return;
      const on = M.mode === "check";
      q(".lab").classList.toggle("checking", on);
      root.querySelectorAll('[data-group="mode"] button').forEach(b => b.setAttribute("aria-pressed", b.dataset.v === M.mode));
      q(".lab-predict").hidden = !on;
      q(".lab-check").hidden = !(on && M.revealed);
      q(".lab-explain").hidden = !(on && M.revealed);
      q(".lab-transfer").hidden = !(on && M.explainOk);
      root.querySelectorAll("[data-pred]").forEach(b => {
        b.setAttribute("aria-pressed", b.dataset.pred === M.pred);
        b.disabled = M.revealed;
      });
      const pr = q(".pred-result");
      pr.hidden = !M.revealed;
      if (M.revealed) pr.textContent = `Ваш прогноз: ${M.pred} · вышло: ${M.actual}`;
      const note = (Ln.state().understood || {})[LK] || "";
      q(".lab-note").hidden = !note;
      q(".lab-note-text").textContent = note;
    }

    function setMode(m) {
      if (!hasCheck || M.mode === m) return;
      M.mode = m;
      // Условия проверки ставим, пока маска не снята. Введённое не сбрасываем.
      if (m === "check" && !M.revealed) { P.scenario = "lost"; P.compare = true; P.losses = 1; rebuild(); }
      else render();
      touch();
    }

    function maybeDone() { if (M.explainOk && M.transferOk) Ln.setStatus(LK, "self"); }
    function accept(text) {
      clearTimeout(draftTimer); draftTimer = 0;
      const u = Ln.state().understood;
      u[LK] = text;
      delete u[LK + ":draft"];
      Ln.save({ understood: u });
      M.explainOk = true;
      syncCheck();
      maybeDone();
    }
    function flushDraft() {
      clearTimeout(draftTimer); draftTimer = 0;
      const u = Ln.state().understood;
      if (ta.value === (u[LK] || "") || ta.value === (u[LK + ":draft"] || "")) return;
      if (ta.value) u[LK + ":draft"] = ta.value; else delete u[LK + ":draft"];
      Ln.save({ understood: u });
    }
    let onHide = null;
    if (hasCheck) {
      const u0 = Ln.state().understood || {};
      ta.value = u0[LK + ":draft"] || u0[LK] || "";
      root.querySelectorAll('[data-group="mode"] button').forEach(b => b.addEventListener("click", () => setMode(b.dataset.v)));
      root.querySelectorAll("[data-pred]").forEach(b => b.addEventListener("click", () => { M.pred = b.dataset.pred; render(); }));
      ta.addEventListener("input", () => { clearTimeout(draftTimer); draftTimer = setTimeout(flushDraft, 400); });
      ta.addEventListener("blur", flushDraft);
      onHide = flushDraft;
      addEventListener("pagehide", onHide);
      q("[data-explain-submit]").addEventListener("click", () => {
        const r = Ln.grade(ta.value, CK.explain);
        r.hint = CK.explain.hint;
        const res = q(".explain-result");
        const dispute = () => {
          const d = Ln.state().disputed; d[LK] = true; Ln.save({ disputed: d });
          window.LearnUI.renderVerdict(res, { ok: true, disputed: true });
          accept(ta.value);
        };
        window.LearnUI.renderVerdict(res, r, { onDispute: dispute });
        if (r.ok) accept(ta.value);
      });
      q("[data-transfer-check]").addEventListener("click", () => {
        const ok = Ln.checkNumber(q(".transfer-answer").value, CK.transfer.expected, 0);
        const res = q(".transfer-result");
        res.textContent = ok
          ? `Верно: ${CK.transfer.expected} возврата. Каждый повтор без ключа выполняет отмену заново, к первому выполнению добавляются повторы. Проверьте запуском.`
          : "Не сходится. Подумайте: без ключа каждый повтор снова выполняет отмену, а первое выполнение уже было.";
        res.dataset.ok = ok;
        if (ok) { M.transferOk = true; maybeDone(); }
      });
      q("[data-transfer-run]").addEventListener("click", () => {
        P.scenario = "lost"; P.compare = true; P.losses = CK.transfer.losses;
        rebuild();
        run();
      });
    }

    rebuild();
    return {
      setScenario(name, opts = {}) { P.scenario = name; Object.assign(P, opts); rebuild(); },
      stop,
      enter: touch, // вход в лабораторию: запоминаем место для «Продолжить разбор»
      dispose() { stop(); if (onHide) removeEventListener("pagehide", onHide); }
    };
  }

  window.Lab = { mount };
})();
