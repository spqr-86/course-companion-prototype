/* Code-video: один ход агента из ноутбука лекции 1.2 — подтверждение отмены брони.
   Сцена задаётся ключевыми шагами; render(t) чистый, поэтому перемотка и пауза бесплатны. */
(function () {
  const GRAPH = `llm_with_tools = ChatOpenAI(model=MODEL).bind_tools(TOOLS)

def llm_with_tools_node(state: AgentStateRed) -> AgentStateRed:
    msgs = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
    resp = llm_with_tools.invoke(msgs)
    return {"messages": [resp]}

def route_after_llm(state: AgentStateRed) -> Literal["tools", "end"]:
    last = state["messages"][-1]
    # If the model requested tool calls, send to ToolNode; else finish.
    has_tool_calls = getattr(last, "tool_calls", None)
    return "tools" if has_tool_calls else "end"

graph_with_tools.add_conditional_edges(
    "llm",
    route_after_llm,
    {"tools": "tools", "end": END},
)
graph_with_tools.add_edge("tools", "llm")`;

  const TOOL = `@tool
def cancel_booking(booking_id: str) -> str:
    """Cancel a booking."""
    booking_record = DATABASE["bookings"].get(booking_id)
    if not booking_record:
        return json.dumps({"error": "Booking not found"}, ensure_ascii=False)

    flight_record = DATABASE["flights"].get(booking_record["flight_key"])
    booking_record["status"] = "cancelled"

    if flight_record:
        flight_record["seats"] += 1

    refund_amount = flight_record["price"] if flight_record else 0
    return json.dumps({"success": True, "refund": refund_amount}, ensure_ascii=False)`;

  const FILES = {
    graph: { name: "граф агента · ячейка 35", code: GRAPH },
    tool: { name: "cancel_booking · ячейка 35", code: TOOL }
  };

  const MSGS = [
    { cls: "sys", k: "история", v: "SystemMessage с политиками + 3 сообщения первого хода: запрос, get_booking, просьба подтвердить" },
    { cls: "human", k: "HumanMessage", v: "I confirm the cancellation of booking BKG-123" },
    { cls: "ai-call", k: "AIMessage", v: 'tool_calls=[cancel_booking({"booking_id": "BKG-123"})]' },
    { cls: "tool", k: "ToolMessage", v: '{"success": true, "refund": 120}' },
    { cls: "ai", k: "AIMessage", v: "Your booking BKG-123 has been successfully canceled. A refund of $120 will be processed back to your account." }
  ];

  const STEPS = [
    { label: "Подготовка", dur: 5, nodes: ["model"], hops: [], file: "graph", lines: [[1, 1]], msgs: 1, msgAt: 0,
      title: "Модель получает схемы инструментов",
      text: "bind_tools превращает три функции в JSON-схемы: имя, описание из docstring, типы аргументов. Модель увидит схемы рядом с сообщениями. Код функций она не видит." },
    { label: "Запрос", dur: 6, nodes: ["user", "llm"], hops: [["p-user-llm", "HumanMessage", "user"]], file: "graph", lines: [[3, 4]], msgs: 2, msgAt: .6,
      title: "Пользователь подтверждает отмену",
      text: "Это второй ход диалога. В первом агент вызвал get_booking и попросил подтверждение, как требует политика. Новое сообщение дописывается к истории редьюсером add_messages." },
    { label: "Модель", dur: 6, nodes: ["llm", "model"], hops: [["p-llm-model", "messages + tools", "model"]], file: "graph", lines: [[4, 5]], msgs: 2, msgAt: 0,
      title: "Узел llm вызывает модель",
      text: "Модели уходят системный промпт с политиками, вся история и схемы инструментов. Подтверждение получено, поэтому модель решает вызвать cancel_booking." },
    { label: "Вызов инструмента", dur: 7.5, nodes: ["model", "llm", "tools"], hops: [["p-model-llm", "tool_calls", "call"], ["p-llm-tools", "→ tools", "call"]],
      file: "graph", lines: [[6, 6], [8, 12], [14, 18]], msgs: 3, msgAt: .3,
      title: "Модель возвращает tool_call, а не действие",
      text: "Ответ модели — AIMessage с полем tool_calls: имя функции и аргументы в JSON. Пока ничего не выполнено. route_after_llm видит tool_calls и отправляет состояние в узел tools." },
    { label: "Выполнение", dur: 8, nodes: ["tools", "db"], hops: [["p-tools-db", 'booking_id="BKG-123"', "exec"]], file: "tool", lines: [[4, 4], [8, 9], [11, 12], [14, 15]],
      msgs: 3, msgAt: 0, dbAt: .55,
      title: "ToolNode исполняет функцию",
      text: "Код агента вызывает cancel_booking. Бронь получает статус cancelled, место возвращается в продажу, считается возврат. Это настоящий побочный эффект: повтор вызова выполнит его ещё раз." },
    { label: "Результат", dur: 6.5, nodes: ["db", "tools", "llm"], hops: [["p-db-tools", '{"success": true}', "result"], ["p-tools-llm", "ToolMessage", "result"]],
      file: "graph", lines: [[19, 19]], msgs: 4, msgAt: .5,
      title: "Результат возвращается в историю",
      text: "ToolNode кладёт строку JSON в ToolMessage с тем же tool_call_id. Ребро add_edge(\"tools\", \"llm\") снова передаёт управление модели." },
    { label: "Ответ", dur: 7.5, nodes: ["model", "llm", "user"], hops: [["p-llm-model", "messages", "model"], ["p-model-llm", "AIMessage", "model"], ["p-llm-user", "ответ", "user"]],
      file: "graph", lines: [[5, 5], [11, 12]], msgs: 5, msgAt: .62,
      title: "Модель отвечает пользователю",
      text: "Модель читает ToolMessage и пишет ответ без tool_calls. route_after_llm возвращает \"end\", граф завершается. Текст ответа взят из вывода ноутбука." }
  ];

  const COLORS = { user: "--c-user", model: "--c-model", call: "--c-call", exec: "--c-exec", result: "--c-result" };

  const SVG = `
<svg viewBox="0 0 640 316" role="img" aria-label="Схема: пользователь, граф LangGraph из узлов llm и tools, модель и функция cancel_booking с базой">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-arrow" d="M0 0L10 5L0 10z"/></marker></defs>
  <rect class="dg-group" x="168" y="18" width="214" height="282" rx="12"/>
  <text class="dg-group-label" x="180" y="36">app_with_tools · LangGraph</text>
  <path id="p-user-llm" class="dg-edge" d="M120 150 C 158 150, 160 92, 194 92"/>
  <path id="p-llm-user" class="dg-edge" d="M194 106 C 168 106, 160 174, 122 174"/>
  <path id="p-llm-model" class="dg-edge" d="M358 78 L 448 78"/>
  <path id="p-model-llm" class="dg-edge" d="M448 104 L 360 104"/>
  <path id="p-llm-tools" class="dg-edge" d="M250 124 L 250 208"/>
  <path id="p-tools-llm" class="dg-edge" d="M302 208 L 302 126"/>
  <path id="p-tools-db" class="dg-edge" d="M358 230 L 448 230"/>
  <path id="p-db-tools" class="dg-edge" d="M448 256 L 360 256"/>
  <text class="dg-edge-label" x="186" y="170" text-anchor="end">END</text>
  <text class="dg-edge-label" x="244" y="170" text-anchor="end">tools</text>
  <text class="dg-edge-label" x="308" y="170">add_edge</text>
  <g class="dg-node user" data-n="user"><rect x="14" y="134" width="106" height="56" rx="10"/><text x="67" y="158" text-anchor="middle">Пользователь</text><text class="sub" x="67" y="176" text-anchor="middle">Jane Doe</text></g>
  <g class="dg-node llm" data-n="llm"><rect x="194" y="62" width="164" height="62" rx="10"/><text x="276" y="88" text-anchor="middle">узел llm</text><text class="sub" x="276" y="107" text-anchor="middle">llm_with_tools_node</text></g>
  <g class="dg-node tools" data-n="tools"><rect x="194" y="208" width="164" height="62" rx="10"/><text x="276" y="234" text-anchor="middle">узел tools</text><text class="sub" x="276" y="253" text-anchor="middle">ToolNode(TOOLS)</text></g>
  <g class="dg-node model" data-n="model"><rect x="448" y="62" width="178" height="62" rx="10"/><text x="537" y="88" text-anchor="middle">Модель</text><text class="sub" x="537" y="107" text-anchor="middle">gpt-4o-mini · bind_tools</text></g>
  <g class="dg-node db" data-n="db"><rect x="448" y="208" width="178" height="62" rx="10"/><text x="537" y="234" text-anchor="middle">cancel_booking</text><text class="sub" x="537" y="253" text-anchor="middle">DATABASE в памяти</text></g>
  <g class="packet" hidden><rect height="22" rx="6"/><text y="15"></text></g>
</svg>`;

  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  function mount(root, { highlightLines }) {
    const starts = [];
    let total = 0;
    STEPS.forEach(s => { starts.push(total); total += s.dur; });

    root.innerHTML = `
<div class="cv">
  <div class="cv-top"><span><span class="dot"></span>code-video · один ход агента · cancel_booking</span><span>Сцена собрана вручную по коду ноутбука</span></div>
  <div class="cv-stage">
    <div class="cv-left">
      <div class="cv-diagram">${SVG}</div>
      <div class="cv-msgs"><div class="eyebrow">state["messages"]</div><div class="cv-msg-list"></div></div>
    </div>
    <div class="cv-right">
      <div class="cv-file"><span class="cv-fname"></span><span>python</span></div>
      <pre class="code cv-code"></pre>
      <div class="cv-db">
        <div class="eyebrow">DATABASE</div>
        <div class="board">
          <div class="board-row"><div><div class="lbl">Бронь BKG-123 · Jane Doe</div><div class="val cv-status"></div></div></div>
          <div class="board-row"><div><div class="lbl">Рейс AY001 · HEL → AMS · 09:30</div><div class="val">мест в продаже</div></div><div class="flap cv-seats"></div></div>
        </div>
      </div>
    </div>
  </div>
  <div class="cv-caption" aria-live="polite"><span class="step-n"></span><h3></h3><p></p></div>
  <div class="cv-controls">
    <div class="cv-buttons">
      <button class="btn btn--small" type="button" data-cv="prev" aria-label="Предыдущий шаг"><svg viewBox="0 0 16 16"><path d="M4 3h2v10H4zM13 3v10L7 8z"/></svg></button>
      <button class="btn btn--small btn--primary" type="button" data-cv="play"><svg viewBox="0 0 16 16"><path d="M4 2l10 6-10 6z"/></svg><span>Смотреть</span></button>
      <button class="btn btn--small" type="button" data-cv="next" aria-label="Следующий шаг"><svg viewBox="0 0 16 16"><path d="M10 3h2v10h-2zM3 3v10l6-5z"/></svg></button>
    </div>
    <div class="timeline">
      <div class="tl-track" role="slider" tabindex="0" aria-label="Позиция в code-video" aria-valuemin="0" aria-valuemax="${total}">
        ${STEPS.map(s => `<div class="tl-seg" style="flex:${s.dur}"><i></i></div>`).join("")}
      </div>
      <div class="tl-labels">${STEPS.map((s, i) => `<button type="button" data-step="${i}" style="flex:${s.dur}">${i}. ${esc(s.label)}</button>`).join("")}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center">
      <span class="cv-time"></span>
      <label class="sr" for="cv-speed">Скорость</label>
      <select class="speed" id="cv-speed"><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select>
    </div>
  </div>
</div>`;

    const q = s => root.querySelector(s);
    const svg = q("svg");
    const packet = q(".packet");
    const pRect = packet.querySelector("rect"), pText = packet.querySelector("text");
    const codeEl = q(".cv-code");
    const segs = [...root.querySelectorAll(".tl-seg i")];
    const labels = [...root.querySelectorAll(".tl-labels button")];
    const playBtn = q('[data-cv="play"]');
    let t = 0, playing = false, last = 0, speed = 1, curFile = null, curMsgs = -1, curStep = -1, lastSeats = null;

    function stepAt(time) {
      for (let i = STEPS.length - 1; i >= 0; i--) if (time >= starts[i]) return i;
      return 0;
    }

    function setFile(key) {
      if (curFile === key) return;
      curFile = key;
      q(".cv-fname").textContent = FILES[key].name;
      codeEl.innerHTML = highlightLines(FILES[key].code);
    }

    function render() {
      const i = stepAt(t), s = STEPS[i];
      const p = Math.min(1, (t - starts[i]) / s.dur);

      svg.querySelectorAll(".dg-node").forEach(n => n.classList.toggle("on", s.nodes.includes(n.dataset.n)));
      const hopIds = s.hops.map(h => h[0]);
      svg.querySelectorAll(".dg-edge").forEach(e => e.classList.toggle("on", hopIds.includes(e.id)));

      // пакет: хопы идут друг за другом в окне 8–88 % шага
      const a = .08, b = .88;
      if (s.hops.length && p >= a && p <= b) {
        const k = Math.min(s.hops.length - 1, Math.floor((p - a) / (b - a) * s.hops.length));
        const local = ((p - a) / (b - a) * s.hops.length) - k;
        const [id, label, role] = s.hops[k];
        const path = svg.getElementById ? svg.getElementById(id) : svg.querySelector("#" + id);
        const pt = path.getPointAtLength(path.getTotalLength() * Math.min(1, local * 1.15));
        pText.textContent = label;
        const w = label.length * 6.9 + 16;
        pRect.setAttribute("width", w);
        pRect.setAttribute("fill", css(COLORS[role]));
        pText.setAttribute("x", 8);
        pText.setAttribute("fill", role === "user" ? css("--surface") : "#fff");
        packet.setAttribute("transform", `translate(${(pt.x - w / 2).toFixed(1)} ${(pt.y - 11).toFixed(1)})`);
        packet.hidden = false;
      } else packet.hidden = true;

      setFile(s.file);
      const g = Math.min(s.lines.length - 1, Math.floor(p * s.lines.length));
      codeEl.querySelectorAll(".ln").forEach((ln, idx) => {
        const n = idx + 1;
        const inGroup = r => n >= r[0] && n <= r[1];
        ln.classList.toggle("run", inGroup(s.lines[g]));
        ln.classList.toggle("hl", !inGroup(s.lines[g]) && s.lines.slice(0, g).some(inGroup));
      });
      const run = codeEl.querySelector(".ln.run");
      if (run && i !== curStep) {
        const top = run.offsetTop - codeEl.clientHeight / 3;
        codeEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      }

      const prevMsgs = i > 0 ? STEPS[i - 1].msgs : 1;
      const nMsgs = p >= s.msgAt ? s.msgs : prevMsgs;
      if (nMsgs !== curMsgs) {
        curMsgs = nMsgs;
        q(".cv-msg-list").innerHTML = MSGS.slice(0, nMsgs).map(m =>
          `<div class="msg ${m.cls}"><span class="k">${m.k}</span><span class="v">${esc(m.v)}</span></div>`).join("");
      }

      const after = i > 4 || (i === 4 && p >= s.dbAt);
      q(".cv-status").innerHTML = after ? `status: <b>cancelled</b> · refund 120` : `status: confirmed`;
      const seats = after ? "4" : "3";
      const flap = q(".cv-seats");
      if (seats !== lastSeats) {
        flap.innerHTML = `<span>${seats}</span>`;
        if (lastSeats !== null) { flap.classList.remove("flip"); void flap.offsetWidth; flap.classList.add("flip"); }
        lastSeats = seats;
      }

      if (i !== curStep) {
        curStep = i;
        q(".step-n").textContent = `${i} / ${STEPS.length - 1}`;
        q(".cv-caption h3").textContent = s.title;
        q(".cv-caption p").textContent = s.text;
        labels.forEach((l, k) => l.classList.toggle("on", k === i));
      }
      segs.forEach((el, k) => {
        const f = k < i ? 1 : k > i ? 0 : p;
        el.style.width = (f * 100).toFixed(1) + "%";
      });
      const fmt = x => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, "0")}`;
      q(".cv-time").textContent = `${fmt(t)} / ${fmt(total)}`;
      q(".tl-track").setAttribute("aria-valuenow", t.toFixed(1));
    }

    function setPlaying(v) {
      playing = v;
      playBtn.querySelector("span").textContent = v ? "Пауза" : (t >= total - .01 ? "Сначала" : "Смотреть");
      playBtn.querySelector("svg").innerHTML = v ? '<path d="M4 2h3v12H4zM9 2h3v12H9z"/>' : '<path d="M4 2l10 6-10 6z"/>';
      if (v) { last = performance.now(); requestAnimationFrame(tick); }
    }
    function tick(now) {
      if (!playing) return;
      t = Math.min(total, t + (now - last) / 1000 * speed);
      last = now;
      render();
      if (t >= total) { setPlaying(false); return; }
      requestAnimationFrame(tick);
    }
    function seek(x) { t = Math.max(0, Math.min(total, x)); render(); if (!playing) setPlaying(false); }
    function goStep(i) { seek(starts[Math.max(0, Math.min(STEPS.length - 1, i))] + .001); }

    playBtn.addEventListener("click", () => {
      if (playing) return setPlaying(false);
      if (t >= total - .01) t = 0;
      setPlaying(true);
    });
    q('[data-cv="prev"]').addEventListener("click", () => { const i = stepAt(t); goStep(t - starts[i] > 1 ? i : i - 1); });
    q('[data-cv="next"]').addEventListener("click", () => goStep(stepAt(t) + 1));
    labels.forEach(l => l.addEventListener("click", () => goStep(+l.dataset.step)));
    const track = q(".tl-track");
    track.addEventListener("click", e => {
      const r = track.getBoundingClientRect();
      seek((e.clientX - r.left) / r.width * total);
    });
    track.addEventListener("keydown", e => {
      if (e.key === "ArrowRight") { goStep(stepAt(t) + 1); e.preventDefault(); }
      if (e.key === "ArrowLeft") { goStep(stepAt(t) - 1); e.preventDefault(); }
      if (e.key === " ") { playBtn.click(); e.preventDefault(); }
    });
    q("#cv-speed").addEventListener("change", e => { speed = +e.target.value; });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", render);

    render();
    return { goStep, pause: () => setPlaying(false), steps: STEPS };
  }

  window.CodeVideo = { mount };
})();
