/* Онбординг: одно окно при первом входе, повторно открывается из меню «Как это работает». */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const modal = $("#onb-modal");
  if (!modal) return;

  // Любое закрытие считается прохождением; сбой хранилища не должен ломать окно.
  function close() {
    modal.hidden = true;
    window.CCUI.close(modal);
    try { window.Learn.save({ onboarded: true }); } catch (e) { }
  }
  function open() {
    window.CCUI.open(modal, $("#onb-title"), close);
  }

  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.closest("[data-onb-close]")) { close(); return; }
    const go = e.target.closest("[data-onb]");
    if (!go) return;
    close();
    // Маршрут физики появится позже; неизвестный маршрут ведёт в библиотеку.
    location.hash = go.dataset.onb === "physics" ? "#physics" : "#lecture-tools-mcp";
  });
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-open-onboarding]")) return;
    // Мобильное меню закрываем штатным путём (клик по подложке), иначе оно останется открытым.
    if ($("#side").classList.contains("open")) $("#scrim").click();
    open();
  });

  let seen = false;
  try { seen = !!window.Learn.state().onboarded; } catch (e) { }
  if (!seen) open();
  window.Onboarding = { open, close };
})();
