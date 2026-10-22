/* Механики раздела конспекта 0.4: «Как я понял», статус, «видел» по прокрутке, проверка-заглушка с вердиктом.
   Состояние — в Learn (localStorage); здесь только DOM. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const PLACEHOLDER = "Напиши 1–2 предложения своими словами. ИИ сюда не пишет — это твой след понимания";
  const DEMO_BADGE = "Демо-проверка по ключевым словам, не ИИ";
  const STATUS = { seen: "видел", helped: "разобрался с помощью", solved: "решено с решением", self: "воспроизвёл сам" };
  let observers = [];
  let disposers = []; // снятие глобальных слушателей при пересборке конспекта

  // Вердикт заглушки: текст, плашка «не ИИ» и (если не засчитано) «Оспорить». Переиспользуется лабораторией.
  function renderVerdict(container, result, opts = {}) {
    const hint = (result.hint || []).join(", ");
    let text;
    if (result.disputed) text = "Тебе виднее: засчитано по оспариванию.";
    else if (result.reason === "short") text = "Слишком коротко, раскрой: " + (hint || "главную мысль") + ".";
    else if (result.reason === "missing") text = "Не хватает: " + (result.missing || []).join(", ") + ".";
    else text = "Зачтено.";
    const ok = result.ok || result.disputed;
    const dispute = !ok && typeof opts.onDispute === "function";
    container.innerHTML = `<div class="verdict ${ok ? "is-ok" : "is-no"}" role="status">
      <p class="verdict-text">${esc(text)}</p>
      <span class="demo-badge">${DEMO_BADGE}</span>
      ${dispute ? `<button class="btn btn--small" type="button" data-check-dispute>Оспорить</button>` : ""}
    </div>`;
    if (dispute) $("[data-check-dispute]", container).addEventListener("click", opts.onDispute);
  }

  function badge(el, k) {
    const s = window.Learn.state().status[k];
    el.textContent = s ? STATUS[s] : "";
    el.hidden = !s;
    el.dataset.s = s || "";
  }

  // Узлы справочного слоя раздела: всё между h2 и блоком «Как я понял».
  function layer(h2, block) {
    const out = [];
    for (let n = h2.nextElementSibling; n && n !== block; n = n.nextElementSibling) out.push(n);
    return out;
  }

  function observeSeen(sectionEnd, k) {
    if (!("IntersectionObserver" in window)) return null;
    const io = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) { window.Learn.setStatus(k, "seen"); io.disconnect(); }
    });
    io.observe(sectionEnd);
    observers.push(io);
    return io;
  }

  function mountSection(h2, opts) {
    const L = window.Learn, k = L.key(opts.lecture, opts.unit), rule = opts.rule || null;
    let next = h2.nextElementSibling;
    while (next && next.tagName !== "H2") next = next.nextElementSibling;
    const block = document.createElement("section");
    block.className = "understand";
    block.dataset.unit = opts.unit;
    block.setAttribute("aria-label", "Как я понял: " + (opts.title || opts.unit));
    block.innerHTML = `<div class="u-head"><b>Как я понял</b><span class="ustatus" hidden></span><span class="uorigin">моя заметка</span></div>
      <textarea class="understood" rows="3" placeholder="${esc(PLACEHOLDER)}" aria-label="Как я понял: ${esc(opts.title || "")}"></textarea>
      ${rule ? `<div class="u-actions"><button class="btn btn--small" type="button" data-check-open>Проверить себя</button></div>
      <div class="check" hidden>
        <p class="check-q">${esc(rule.question)}</p>
        <textarea class="check-answer" rows="4" aria-label="Ответ на вопрос проверки"></textarea>
        <div class="u-actions"><button class="btn btn--small btn--primary" type="button" data-check-submit>Проверить</button>
        <button class="btn btn--small" type="button" data-check-close>Закрыть</button></div>
      </div>
      <div class="check-result" aria-live="polite"></div>` : ""}`;
    if (next) next.before(block); else h2.parentNode.appendChild(block);
    h2.insertAdjacentHTML("afterend", `<div class="layer-tag"><span class="uorigin uorigin--ai">объяснение ИИ</span></div>`);

    const ta = $("textarea.understood", block), st = $(".ustatus", block);
    ta.value = (L.state().understood || {})[k] || "";
    badge(st, k);
    let timer = 0;
    const flush = () => {
      clearTimeout(timer); timer = 0;
      const u = L.state().understood;
      if (u[k] === ta.value) return;
      u[k] = ta.value;
      L.save({ understood: u });
    };
    ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(flush, 400); });
    ta.addEventListener("blur", flush);
    const onLearn = () => { if (document.contains(block)) badge(st, k); };
    addEventListener("pagehide", flush);
    addEventListener("cc:learn", onLearn);
    disposers.push(() => { removeEventListener("pagehide", flush); removeEventListener("cc:learn", onLearn); });

    if (rule) {
      const box = $(".check", block), res = $(".check-result", block);
      const collapse = on => {
        block.classList.toggle("checking", on);
        box.hidden = !on;
        layer(h2, block).forEach(n => { n.hidden = on; });
      };
      block._openCheck = () => { collapse(true); $("textarea.check-answer", block).focus({ preventScroll: true }); };
      $("[data-check-open]", block).addEventListener("click", block._openCheck);
      $("[data-check-close]", block).addEventListener("click", () => collapse(false));
      $("[data-check-submit]", block).addEventListener("click", () => {
        const r = L.grade($("textarea.check-answer", block).value, rule);
        r.hint = rule.concepts.map(c => c[0]);
        const dispute = () => {
          L.setStatus(k, "self");
          const d = L.state().disputed; d[k] = true; L.save({ disputed: d });
          renderVerdict(res, { ok: true, disputed: true });
          collapse(false);
        };
        renderVerdict(res, r, { onDispute: dispute });
        if (r.ok) { L.setStatus(k, "self"); collapse(false); }
      });
    }
    observeSeen(block, k);
    return block;
  }

  // Открыть проверку раздела (из меню фрагмента) и прокрутить к ней.
  function openCheck(unit) {
    const go = () => {
      const block = $(`.understand[data-unit="${unit}"]`);
      if (!block || !block._openCheck) return;
      block._openCheck();
      block.scrollIntoView({ block: "start", behavior: "smooth" });
    };
    const notes = $("#sec-notes");
    if (notes && notes.offsetParent === null) { location.hash = "tools-mcp-notes"; setTimeout(go, 450); } else go();
  }
  const hasRule = unit => !!(window.CCChecks && window.CCChecks.shad && window.CCChecks.shad[unit]);
  function dispose() { observers.forEach(io => io.disconnect()); observers = []; disposers.forEach(f => f()); disposers = []; }

  window.LearnUI = { mountSection, observeSeen, renderVerdict, openCheck, hasRule, dispose, STATUS };
})();
