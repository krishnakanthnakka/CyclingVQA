(function () {
  "use strict";

  var THEME_KEY = "cyclingvqa-theme";
  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    });
  });

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var CROSS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : s;
    return div.innerHTML;
  }

  function renderChoices(example) {
    return example.choices
      .map(function (choice) {
        var isGt = choice === example.gt_answer;
        var isPredWrong = !example.correct && choice === example.predicted_choice;
        var cls = "traj-choice" + (isGt ? " is-gt" : "") + (isPredWrong ? " is-pred-wrong" : "");
        var icon = isGt ? CHECK_SVG : isPredWrong ? CROSS_SVG : "";
        return '<li class="' + cls + '">' + icon + "<span>" + escapeHtml(choice) + "</span></li>";
      })
      .join("");
  }

  function renderCard(task, example) {
    var badge = example.correct
      ? '<span class="traj-card-badge is-correct">Correct</span>'
      : '<span class="traj-card-badge is-wrong">Incorrect</span>';
    var img = example.images[0];
    var caption = task.label + " — example " + example.index;

    return (
      '<article class="traj-card">' +
      '<div class="traj-card-media figure-plate-frame" tabindex="0" role="button" aria-label="Enlarge example image" ' +
      'data-label="' + escapeHtml(caption) + '" data-caption="' + escapeHtml(example.question) + '">' +
      badge +
      '<span class="traj-card-index">#' + example.index + "</span>" +
      '<img src="' + img + '" alt="Stimulus image for ' + escapeHtml(caption) + '" loading="lazy">' +
      "</div>" +
      '<div class="traj-card-body">' +
      '<p class="traj-card-question">' + escapeHtml(example.question) + "</p>" +
      '<ul class="traj-choices">' + renderChoices(example) + "</ul>" +
      '<details class="traj-reasoning"><summary>Model reasoning</summary><p>' + escapeHtml(example.predicted_answer) + "</p></details>" +
      "</div>" +
      "</article>"
    );
  }

  function renderTask(task) {
    var panel = document.createElement("section");
    panel.className = "task-panel";
    panel.id = "panel-" + task.slug;

    var intro = document.createElement("p");
    intro.className = "task-panel-intro";
    intro.innerHTML =
      "<strong>" + escapeHtml(task.label) + " (" + escapeHtml(task.code) + ").</strong> " +
      task.examples.length + " example trajectories from <strong>gemini-2.5-flash</strong> on this task, in dataset order.";
    panel.appendChild(intro);

    var grid = document.createElement("div");
    grid.className = "traj-grid";
    grid.innerHTML = task.examples.map(function (ex) { return renderCard(task, ex); }).join("");
    panel.appendChild(grid);

    return panel;
  }

  function init(data) {
    var tabsEl = document.getElementById("task-tabs");
    var panelsEl = document.getElementById("task-panels");
    if (!tabsEl || !panelsEl) return;

    data.forEach(function (task, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "task-tab" + (i === 0 ? " is-active" : "");
      tab.dataset.target = task.slug;
      tab.innerHTML = '<span class="task-tab-code">' + task.code + "</span><span>" + escapeHtml(task.label) + "</span>";
      tabsEl.appendChild(tab);

      var panel = renderTask(task);
      if (i === 0) panel.classList.add("is-active");
      panelsEl.appendChild(panel);
    });

    tabsEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".task-tab");
      if (!btn) return;
      tabsEl.querySelectorAll(".task-tab").forEach(function (t) { t.classList.remove("is-active"); });
      panelsEl.querySelectorAll(".task-panel").forEach(function (p) { p.classList.remove("is-active"); });
      btn.classList.add("is-active");
      document.getElementById("panel-" + btn.dataset.target).classList.add("is-active");
      window.scrollTo({ top: tabsEl.offsetTop - 1, behavior: "smooth" });
    });

    initLightbox();
  }

  function initLightbox() {
    var backdrop = document.querySelector(".figure-lightbox-backdrop");
    var stageImg = document.querySelector(".figure-lightbox-stage img");
    var label = document.querySelector(".figure-lightbox-label");
    var caption = document.querySelector(".figure-lightbox-caption");
    var closeBtn = document.querySelector(".figure-lightbox-close");
    if (!backdrop) return;

    function open(frame) {
      var img = frame.querySelector("img");
      if (!img) return;
      stageImg.src = img.currentSrc || img.src;
      stageImg.alt = img.alt || "";
      if (label) label.textContent = frame.dataset.label || "Example";
      if (caption) caption.textContent = frame.dataset.caption || "";
      backdrop.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      backdrop.classList.remove("is-open");
      document.body.style.overflow = "";
      stageImg.src = "";
    }

    document.addEventListener("click", function (e) {
      var frame = e.target.closest(".figure-plate-frame");
      if (frame) open(frame);
    });
    document.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && document.activeElement && document.activeElement.classList.contains("figure-plate-frame")) {
        e.preventDefault();
        open(document.activeElement);
      }
      if (e.key === "Escape") close();
    });
    if (closeBtn) closeBtn.addEventListener("click", close);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close();
    });
  }

  fetch("./static/data/trajectories.json")
    .then(function (r) { return r.json(); })
    .then(init)
    .catch(function (err) {
      var panelsEl = document.getElementById("task-panels");
      if (panelsEl) panelsEl.innerHTML = '<p class="task-panel-intro">Could not load trajectory data.</p>';
      console.error(err);
    });
})();
