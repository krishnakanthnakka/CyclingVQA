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

  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
  var CROSS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  var state = { selected: new Set() };

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s == null ? "" : s;
    return div.innerHTML;
  }

  /* ---------- Model filter panel ---------- */

  function buildFilterPanel(modelsData) {
    var groupsEl = document.getElementById("model-filter-groups");
    var countEl = document.getElementById("model-filter-count");
    var searchEl = document.getElementById("model-filter-search");
    if (!groupsEl) return;

    modelsData.models.forEach(function (m) {
      if (m.default) state.selected.add(m.key);
    });

    modelsData.groups.forEach(function (group) {
      var groupModels = modelsData.models.filter(function (m) { return m.group === group.key; });
      if (!groupModels.length) return;

      var col = document.createElement("div");
      col.className = "model-filter-group";
      col.dataset.group = group.key;

      var head = document.createElement("div");
      head.className = "model-filter-group-head";
      head.innerHTML = '<span class="model-filter-group-dot" aria-hidden="true"></span><span>' + escapeHtml(group.label) + " (" + groupModels.length + ")</span>";
      col.appendChild(head);

      var list = document.createElement("div");
      list.className = "model-filter-list";
      groupModels.forEach(function (m) {
        var label = document.createElement("label");
        label.className = "model-check";
        label.dataset.name = m.display.toLowerCase();
        label.innerHTML =
          '<input type="checkbox" value="' + m.key + '"' + (state.selected.has(m.key) ? " checked" : "") + '>' +
          "<span>" + escapeHtml(m.display) + "</span>";
        list.appendChild(label);
      });
      col.appendChild(list);
      groupsEl.appendChild(col);
    });

    function updateCount() {
      if (countEl) countEl.textContent = state.selected.size + " of " + modelsData.models.length + " selected";
    }
    updateCount();

    groupsEl.addEventListener("change", function (e) {
      var input = e.target.closest('input[type="checkbox"]');
      if (!input) return;
      if (input.checked) state.selected.add(input.value);
      else state.selected.delete(input.value);
      updateCount();
      applyFilter();
    });

    document.getElementById("filter-select-all").addEventListener("click", function () {
      groupsEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        cb.checked = true;
        state.selected.add(cb.value);
      });
      updateCount();
      applyFilter();
    });
    document.getElementById("filter-select-none").addEventListener("click", function () {
      groupsEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
      state.selected.clear();
      updateCount();
      applyFilter();
    });
    document.getElementById("filter-select-default").addEventListener("click", function () {
      state.selected.clear();
      groupsEl.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
        var isDefault = modelsData.models.some(function (m) { return m.key === cb.value && m.default; });
        cb.checked = isDefault;
        if (isDefault) state.selected.add(cb.value);
      });
      updateCount();
      applyFilter();
    });

    if (searchEl) {
      searchEl.addEventListener("input", function () {
        var q = searchEl.value.trim().toLowerCase();
        groupsEl.querySelectorAll(".model-check").forEach(function (label) {
          label.classList.toggle("is-filtered-out", q.length > 0 && label.dataset.name.indexOf(q) === -1);
        });
      });
    }
  }

  function applyFilter() {
    document.querySelectorAll(".traj-model-row").forEach(function (row) {
      row.classList.toggle("is-hidden", !state.selected.has(row.dataset.model));
    });
    document.querySelectorAll(".traj-card").forEach(updateCardBadge);
  }

  function updateCardBadge(card) {
    var badge = card.querySelector(".traj-card-badge");
    if (!badge) return;
    var correctness = JSON.parse(card.dataset.correctness);
    var selectedKeys = Object.keys(correctness).filter(function (k) { return state.selected.has(k); });
    if (!selectedKeys.length) {
      badge.className = "traj-card-badge is-empty";
      badge.textContent = "No models selected";
      return;
    }
    var correct = selectedKeys.filter(function (k) { return correctness[k]; }).length;
    var total = selectedKeys.length;
    if (correct === total) badge.className = "traj-card-badge is-correct";
    else if (correct === 0) badge.className = "traj-card-badge is-wrong";
    else badge.className = "traj-card-badge is-mixed";
    badge.textContent = correct + " / " + total + " correct";
  }

  /* ---------- Cards ---------- */

  function renderModelRow(modelKey, modelInfo, prediction) {
    if (!prediction) return "";
    var hasChoice = prediction.choice != null && prediction.choice !== "";
    var statusClass = !hasChoice ? "is-empty" : prediction.correct ? "is-correct" : "is-wrong";
    var statusIcon = !hasChoice ? "" : prediction.correct ? CHECK_SVG : CROSS_SVG;
    var answer = hasChoice ? prediction.choice : "No answer parsed";
    var reasoning = prediction.reasoning && prediction.reasoning.length
      ? '<div class="traj-model-row-reasoning">' + escapeHtml(prediction.reasoning) + "</div>"
      : "";

    return (
      '<details class="traj-model-row' + (state.selected.has(modelKey) ? "" : " is-hidden") + '" data-model="' + modelKey + '">' +
      "<summary>" +
      '<span class="traj-model-status ' + statusClass + '">' + statusIcon + "</span>" +
      '<span class="traj-model-name">' + escapeHtml(modelInfo.display) + "</span>" +
      '<span class="traj-model-answer">' + escapeHtml(answer) + "</span>" +
      "</summary>" +
      reasoning +
      "</details>"
    );
  }

  function renderCard(task, example, modelsByKey, modelOrder) {
    var img = example.images[0];
    var caption = task.label + " — example " + example.index;
    var rows = modelOrder
      .map(function (key) { return renderModelRow(key, modelsByKey[key], example.predictions[key]); })
      .join("");
    var correctness = {};
    modelOrder.forEach(function (key) {
      var p = example.predictions[key];
      if (p) correctness[key] = !!p.correct;
    });

    return (
      '<article class="traj-card" data-correctness=\'' + JSON.stringify(correctness) + "'>" +
      '<div class="traj-card-media figure-plate-frame" tabindex="0" role="button" aria-label="Enlarge example image" ' +
      'data-label="' + escapeHtml(caption) + '" data-caption="' + escapeHtml(example.question) + '">' +
      '<span class="traj-card-badge"></span>' +
      '<span class="traj-card-index">#' + example.index + "</span>" +
      '<img src="' + img + '" alt="Stimulus image for ' + escapeHtml(caption) + '" loading="lazy">' +
      "</div>" +
      '<div class="traj-card-body">' +
      '<p class="traj-card-question">' + escapeHtml(example.question) + "</p>" +
      '<div class="traj-gt"><span class="traj-gt-label">Ground truth</span><span class="traj-gt-value">' + escapeHtml(example.gt_answer) + "</span></div>" +
      '<div class="traj-model-list-head"><span>Model</span><span>Answer</span></div>' +
      '<div class="traj-model-list">' + rows + "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderTask(task, modelsByKey, modelOrder) {
    var panel = document.createElement("section");
    panel.className = "task-panel";
    panel.id = "panel-" + task.slug;

    var intro = document.createElement("p");
    intro.className = "task-panel-intro";
    intro.innerHTML =
      "<strong>" + escapeHtml(task.label) + " (" + escapeHtml(task.code) + ").</strong> " +
      task.examples.length + " example trajectories on this task, in dataset order. Use the model filter above to compare responses across models.";
    panel.appendChild(intro);

    var grid = document.createElement("div");
    grid.className = "traj-grid";
    grid.innerHTML = task.examples.map(function (ex) { return renderCard(task, ex, modelsByKey, modelOrder); }).join("");
    panel.appendChild(grid);

    return panel;
  }

  function initTasks(data, modelsData) {
    var tabsEl = document.getElementById("task-tabs");
    var panelsEl = document.getElementById("task-panels");
    if (!tabsEl || !panelsEl) return;

    var modelsByKey = {};
    modelsData.models.forEach(function (m) { modelsByKey[m.key] = m; });
    var modelOrder = modelsData.models.map(function (m) { return m.key; });

    data.forEach(function (task, i) {
      var tab = document.createElement("button");
      tab.type = "button";
      tab.className = "task-tab" + (i === 0 ? " is-active" : "");
      tab.dataset.target = task.slug;
      tab.innerHTML = '<span class="task-tab-code">' + task.code + "</span><span>" + escapeHtml(task.label) + "</span>";
      tabsEl.appendChild(tab);

      var panel = renderTask(task, modelsByKey, modelOrder);
      if (i === 0) panel.classList.add("is-active");
      panelsEl.appendChild(panel);
    });

    document.querySelectorAll(".traj-card").forEach(updateCardBadge);

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

  Promise.all([
    fetch("./static/data/trajectories.json").then(function (r) { return r.json(); }),
    fetch("./static/data/models.json").then(function (r) { return r.json(); }),
  ])
    .then(function (results) {
      var data = results[0];
      var modelsData = results[1];
      buildFilterPanel(modelsData);
      initTasks(data, modelsData);
    })
    .catch(function (err) {
      var panelsEl = document.getElementById("task-panels");
      if (panelsEl) panelsEl.innerHTML = '<p class="task-panel-intro">Could not load trajectory data.</p>';
      console.error(err);
    });
})();
