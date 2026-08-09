(function () {
  "use strict";

  /* ---------- Theme toggle ---------- */
  var THEME_KEY = "cyclingvqa-theme";
  var themeColor = { light: "#f1efe8", dark: "#161613" };

  function currentTheme() {
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  }

  function setThemeColorMeta(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themeColor[theme]);
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var next = currentTheme() === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch (e) {
        /* storage can be unavailable in private modes */
      }
      setThemeColorMeta(next);
    });
  });

  /* ---------- Nav: condense on scroll + reading progress ---------- */
  var nav = document.querySelector(".site-nav");
  var progressFill = document.querySelector(".nav-progress");

  function onScroll() {
    if (nav) nav.classList.toggle("is-condensed", window.scrollY > 40);
    if (progressFill) {
      var doc = document.documentElement;
      var scrollable = doc.scrollHeight - doc.clientHeight;
      var ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
      progressFill.style.setProperty("--nav-progress", Math.min(1, Math.max(0, ratio)));
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Nav: active section highlight ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll(".nav-links a[href^='#']"));
  var sections = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      return el ? { id: id, el: el, link: link } : null;
    })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var ratios = {};
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          ratios[entry.target.id] = entry.intersectionRatio;
        });
        var bestId = "";
        var bestRatio = 0;
        Object.keys(ratios).forEach(function (id) {
          if (ratios[id] > bestRatio) {
            bestRatio = ratios[id];
            bestId = id;
          }
        });
        sections.forEach(function (s) {
          s.link.classList.toggle("is-active", bestRatio > 0.05 && s.id === bestId);
        });
      },
      { threshold: [0, 0.05, 0.25, 0.5, 0.75, 1], rootMargin: "-20% 0px -40%" }
    );
    sections.forEach(function (s) {
      observer.observe(s.el);
    });
  }

  /* ---------- Mobile menu ---------- */
  var navToggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.querySelector(".mobile-menu");

  function closeMenu() {
    if (nav) nav.classList.remove("is-menu-open");
    if (mobileMenu) mobileMenu.classList.remove("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  function openMenu() {
    if (nav) nav.classList.add("is-menu-open");
    if (mobileMenu) mobileMenu.classList.add("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  if (navToggle && mobileMenu) {
    navToggle.addEventListener("click", function () {
      var isOpen = mobileMenu.classList.contains("is-open");
      if (isOpen) closeMenu();
      else openMenu();
    });
    mobileMenu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- Figure lightbox ---------- */
  var backdrop = document.querySelector(".figure-lightbox-backdrop");
  var lightboxImg = document.querySelector(".figure-lightbox-stage img");
  var lightboxLabel = document.querySelector(".figure-lightbox-label");
  var lightboxCaption = document.querySelector(".figure-lightbox-caption");
  var lightboxClose = document.querySelector(".figure-lightbox-close");
  var lastFocused = null;

  function openLightbox(frame) {
    var img = frame.querySelector("img");
    if (!img || !backdrop || !lightboxImg) return;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt || "";
    if (lightboxLabel) lightboxLabel.textContent = frame.dataset.label || "Figure";
    if (lightboxCaption) lightboxCaption.textContent = frame.dataset.caption || "";
    backdrop.classList.add("is-open");
    document.body.style.overflow = "hidden";
    lastFocused = document.activeElement;
    if (lightboxClose) lightboxClose.focus();
  }

  function closeLightbox() {
    if (!backdrop) return;
    backdrop.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lightboxImg) lightboxImg.src = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.querySelectorAll(".figure-plate-frame").forEach(function (frame) {
    frame.addEventListener("click", function () {
      openLightbox(frame);
    });
    frame.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(frame);
      }
    });
  });

  if (lightboxClose) lightboxClose.addEventListener("click", closeLightbox);
  if (backdrop) {
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && backdrop.classList.contains("is-open")) closeLightbox();
    });
  }
})();
