"use strict";

// DOM ready helper
function onReady(fn) {
  if (document.readyState !== "loading") fn();
  else document.addEventListener("DOMContentLoaded", fn, { once: true });
}

onReady(function () {
  // Mark JS-enabled (so .fade-up reveal CSS can apply)
  if (document.body.className.indexOf("js") === -1) {
    document.body.className += (document.body.className ? " " : "") + "js";
  }

  /* ========= Reveal-on-scroll ========= */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.2 },
    );
    var fades = document.querySelectorAll(".fade-up");
    for (var i = 0; i < fades.length; i++) io.observe(fades[i]);
  } else {
    var fades2 = document.querySelectorAll(".fade-up");
    for (var j = 0; j < fades2.length; j++) fades2[j].classList.add("visible");
  }

  /* ========= Date & time ========= */
  function pad(n) {
    return ("0" + n).slice(-2);
  }
  function setDateTime() {
    var now = new Date();
    var dateStr = pad(now.getMonth() + 1) + "/" + pad(now.getDate()) + "/" + now.getFullYear();
    var h = now.getHours(), hour12 = h % 12 || 12, ampm = h < 12 ? "AM" : "PM";
    var timeStr = hour12 + ":" + pad(now.getMinutes()) + " " + ampm;
    var el = document.getElementById("dateTimeStr");
    var dateEl = document.getElementById("dateStr");
    if (el) el.textContent = timeStr;
    if (dateEl) dateEl.textContent = dateStr;
  }
  setDateTime();
  setInterval(setDateTime, 15000);

  /* ========= THEME (simple & bullet-proof) ========= */
  var prefersReduced = false;
  try {
    prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  } catch (_) {}

  function themeSweep() {
    if (prefersReduced) return;
    document.body.classList.add("theme-switch", "theme-sweep");
    clearTimeout(themeSweep._t);
    themeSweep._t = setTimeout(function () {
      document.body.classList.remove("theme-switch", "theme-sweep");
    }, 700);
  }

  function applyTheme(theme) {
    if (theme !== "light" && theme !== "dark") return;
    themeSweep();
    document.body.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("pointy-theme", theme);
    } catch (_) {}
    // Sync optional buttons
    var lightBtn = document.getElementById("lightBtn");
    var darkBtn = document.getElementById("darkBtn");
    var isDark = theme === "dark";
    if (lightBtn) {
      lightBtn.classList[isDark ? "remove" : "add"]("active");
      lightBtn.setAttribute("aria-pressed", String(!isDark));
    }
    if (darkBtn) {
      darkBtn.classList[isDark ? "add" : "remove"]("active");
      darkBtn.setAttribute("aria-pressed", String(isDark));
    }
    if (typeof updateBokehTheme === "function") updateBokehTheme();
  }

  function initialTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("pointy-theme");
    } catch (_) {}
    if (saved === "light" || saved === "dark") return saved;
    try {
      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch (_) {
      return "light";
    }
  }

  function toggleTheme() {
    var next =
      document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
  }

  function wireTheme() {
    // Exact IDs
    var lb = document.getElementById("lightBtn");
    var db = document.getElementById("darkBtn");
    var tb = document.getElementById("themeBtn");
    if (lb)
      lb.addEventListener("click", function () {
        applyTheme("light");
      });
    if (db)
      db.addEventListener("click", function () {
        applyTheme("dark");
      });
    if (tb)
      tb.addEventListener("click", function () {
        toggleTheme();
      });

    // Data attributes
    var tTargets = document.querySelectorAll("[data-theme-target]");
    for (var i = 0; i < tTargets.length; i++) {
      (function (el) {
        el.addEventListener("click", function () {
          applyTheme(el.getAttribute("data-theme-target"));
        });
      })(tTargets[i]);
    }
    var tToggles = document.querySelectorAll("[data-theme-toggle]");
    for (var k = 0; k < tToggles.length; k++) {
      tToggles[k].addEventListener("click", function () {
        toggleTheme();
      });
    }

    // Keyboard fallback: press "T" to toggle
    document.addEventListener("keydown", function (e) {
      var key = e && e.key ? e.key.toLowerCase() : "";
      var tag =
        (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (key === "t") toggleTheme();
    });
  }

  applyTheme(initialTheme());
  wireTheme();

  /* ========= Mobile hamburger nav ========= */
  (function () {
    var menuBtn = document.getElementById("navMenuBtn");
    var navHeader = document.querySelector("header");
    var navActions = document.getElementById("navActions");
    if (!menuBtn || !navHeader) return;

    function openMenu() {
      navHeader.classList.add("is-nav-open");
      menuBtn.setAttribute("aria-expanded", "true");
    }
    function closeMenu() {
      navHeader.classList.remove("is-nav-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
    function toggleMenu() {
      navHeader.classList.contains("is-nav-open") ? closeMenu() : openMenu();
    }

    menuBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when clicking outside the nav
    document.addEventListener("click", function (e) {
      if (navHeader.classList.contains("is-nav-open") && !navHeader.contains(e.target)) {
        closeMenu();
      }
    });

    // Close on ESC
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navHeader.classList.contains("is-nav-open")) closeMenu();
    });

    // Close after any nav action item is clicked (except the menu btn itself)
    if (navActions) {
      navActions.addEventListener("click", function (e) {
        if (e.target !== menuBtn && !menuBtn.contains(e.target)) closeMenu();
      });
    }
  })();

  // Minimal debug hook so you can verify quickly from DevTools:
  window.__pointyTheme = {
    get: function () {
      return document.body.getAttribute("data-theme");
    },
    toggle: toggleTheme,
    set: applyTheme,
  };

  /* ========= Bokeh background (perf-friendly, ES5) ========= */
  (function () {
    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;

      var canvas = document.createElement("canvas");
      canvas.className = "bokeh-canvas";
      var ctx = canvas.getContext("2d");
      document.body.appendChild(canvas);

      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      function resize() {
        var w = window.innerWidth,
          h = window.innerHeight;
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      resize();
      window.addEventListener("resize", resize, false);

      function currentPalette() {
        return document.body.getAttribute("data-theme") === "dark"
          ? [
              [34, 197, 94, 0.12],
              [16, 185, 129, 0.1],
              [74, 222, 128, 0.1],
            ]
          : [
              [34, 197, 94, 0.14],
              [16, 185, 129, 0.12],
              [74, 222, 128, 0.1],
            ];
      }
      var palette = currentPalette();

      var particles = [];
      function rand(min, max) {
        return min + Math.random() * (max - min);
      }
      function spawn() {
        particles.length = 0;
        var count = 28,
          width = canvas.width / dpr,
          height = canvas.height / dpr;
        for (var i = 0; i < count; i++) {
          var r = rand(18, 64),
            sp = rand(0.06, 0.25),
            ang = Math.random() * Math.PI * 2;
          var col = palette[(Math.random() * palette.length) | 0];
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            r: r,
            color: col,
          });
        }
      }
      spawn();

      // expose for theme sync
      window.updateBokehTheme = function () {
        palette = currentPalette();
      };

      var running = true;
      function tick() {
        if (!running) return;
        var width = canvas.width / dpr,
          height = canvas.height / dpr;
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < -p.r) p.x = width + p.r;
          if (p.x > width + p.r) p.x = -p.r;
          if (p.y < -p.r) p.y = height + p.r;
          if (p.y > height + p.r) p.y = -p.r;

          var c = p.color,
            a = c[3];
          var grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          grad.addColorStop(
            0,
            "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")",
          );
          grad.addColorStop(
            1,
            "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",0)",
          );
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
        requestAnimationFrame(tick);
      }
      tick();

      document.addEventListener("visibilitychange", function () {
        running = !document.hidden;
        if (running) tick();
      });
    } catch (e) {
      console.error("Bokeh init failed:", e);
    }
  })();
});
