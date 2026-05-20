import View from "./view.js";

const fmt = (n) =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PALETTE = ['#22c55e','#60a5fa','#f59e0b','#f87171','#a78bfa','#34d399','#fb923c','#818cf8'];

class ReportsView extends View {
  _parentElement = document.querySelector("#reportsPanel");
  _Chart = null;
  _charts = {};
  _observers = {};

  // ── Panel open / close ───────────────────────────────────────────────────

  open() {
    const el = this._parentElement;
    el.classList.remove("hidden", "rp-panel--exiting");
    el.querySelectorAll(".rp-kpi, .rp-card").forEach((card, i) => {
      card.animate(
        [{ opacity: 0, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 500, delay: 55 + i * 45, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "backwards" }
      );
    });
    el.querySelectorAll(".rp-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === "today");
    });
    document.querySelector("#reportsCustomRange").classList.add("hidden");
  }

  close() {
    this._parentElement.classList.add("rp-panel--exiting");
    setTimeout(() => {
      this._parentElement.classList.add("hidden");
      this._parentElement.classList.remove("rp-panel--exiting");
    }, 240);
  }

  setPeriodLabel(label) {
    document.querySelector("#reportsPeriodLabel").textContent = label;
  }

  setActivePeriod(period) {
    this._parentElement.querySelectorAll(".rp-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.period === period);
    });
    document.querySelector("#reportsCustomRange")
      .classList.toggle("hidden", period !== "custom");
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────

  renderLoading() {
    document.querySelector("#reportsTopItems").innerHTML = `
      <div class="rp-item-list">
        ${[80, 65, 50, 35, 20].map(w => `
          <div class="rp-item-row">
            <div class="rp-skeleton rp-skeleton--rank"></div>
            <div class="rp-item-main">
              <div class="rp-skeleton" style="width:${w}%;height:12px;margin-bottom:8px;border-radius:6px"></div>
              <div class="rp-skeleton" style="width:100%;height:4px;border-radius:99px"></div>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // ── Summary KPIs ─────────────────────────────────────────────────────────

  renderSummary({ revenue, transactions, avgOrder, avgServingMinutes }) {
    document.querySelector("#reportsRevenue").textContent = fmt(revenue);
    document.querySelector("#reportsTransactions").textContent = transactions;
    document.querySelector("#reportsAvgOrder").textContent = fmt(avgOrder);
    const servEl = document.querySelector("#reportsServingTime");
    if (servEl) {
      if (avgServingMinutes == null) {
        servEl.textContent = "—";
        servEl.classList.add("rp-kpi-val--muted");
      } else {
        const mins = Math.floor(avgServingMinutes);
        const secs = Math.round((avgServingMinutes - mins) * 60);
        servEl.textContent = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        servEl.classList.remove("rp-kpi-val--muted");
      }
    }
  }

  // ── Top items list ───────────────────────────────────────────────────────

  renderTopItems(items) {
    const el = document.querySelector("#reportsTopItems");
    if (!items.length) {
      el.innerHTML = `<p class="rp-empty">No sales data for this period.</p>`;
      return;
    }
    const maxQty = items[0].quantity;
    el.innerHTML = `
      <div class="rp-item-list">
        ${items.map((item, i) => `
          <div class="rp-item-row">
            <span class="rp-item-rank">${i + 1}</span>
            <div class="rp-item-main">
              <div class="rp-item-row-top">
                <span class="rp-item-name">${item.name}</span>
                <span class="rp-item-rev">${fmt(item.revenue)}</span>
              </div>
              <div class="rp-item-bar-track">
                <div class="rp-item-bar" style="width:${Math.round((item.quantity / maxQty) * 100)}%"></div>
              </div>
              <span class="rp-item-qty">${item.quantity} sold</span>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // ── Charts ───────────────────────────────────────────────────────────────

  // ── Comparison badges ────────────────────────────────────────────────────

  renderComparison(current, previous, vsLabel) {
    const update = (id, curr, prev, invert = false) => {
      const el = document.querySelector(`#${id}`);
      if (!el) return;
      if (prev == null || prev === 0) { el.innerHTML = ""; return; }
      const pct = Math.round(((curr - prev) / prev) * 100);
      const up = invert ? pct <= 0 : pct >= 0;
      const arrow = pct >= 0
        ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
        : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      el.className = `rp-kpi-cmp ${up ? "rp-kpi-cmp--up" : "rp-kpi-cmp--down"}`;
      el.innerHTML = `${arrow} ${Math.abs(pct)}% vs ${vsLabel}`;
    };
    update("reportsRevenueCmp",  current.revenue,           previous.revenue);
    update("reportsTransCmp",    current.transactions,       previous.transactions);
    update("reportsAvgCmp",      current.avgOrder,           previous.avgOrder);
    update("reportsServingCmp",  current.avgServingMinutes,  previous.avgServingMinutes, true);
  }

  // ── Charts ───────────────────────────────────────────────────────────────

  async renderCharts({ revenueOverTime, categoryMix, hourlyBreakdown, dayOfWeek, servingTime }) {
    const Chart = await this._ensureChart();
    this._renderRevenueChart(Chart, revenueOverTime);
    this._renderCategoryChart(Chart, categoryMix);
    this._renderHourlyChart(Chart, hourlyBreakdown);
    this._renderDowChart(Chart, dayOfWeek);
    this._renderServingHourChart(Chart, servingTime);
    this._renderServingDayChart(Chart, servingTime);
  }

  async _ensureChart() {
    if (this._Chart) return this._Chart;
    const { Chart, registerables } = await import("chart.js");
    Chart.register(...registerables);
    Chart.defaults.font.family = "Inter, sans-serif";
    Chart.defaults.font.size = 11;
    this._Chart = Chart;
    return Chart;
  }

  _css(v) {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  }

  _withAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  _barAnim(stagger = 30) {
    return {
      duration: 700,
      easing: "easeOutQuart",
      delay: (ctx) => ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * stagger : 0,
    };
  }

  _donutAnim() {
    return { animateRotate: true, animateScale: true, duration: 850, easing: "easeOutCubic" };
  }

  _activateCard(cardId, phId, wrapId, badgeId) {
    document.querySelector(`#${cardId}`)?.classList.remove("rp-card--ph");
    document.querySelector(`#${phId}`)?.classList.add("hidden");
    document.querySelector(`#${wrapId}`)?.classList.remove("hidden");
    const badge = document.querySelector(`#${badgeId}`);
    if (badge) badge.style.display = "none";
  }

  _observeChart(canvasId, factory) {
    this._observers[canvasId]?.disconnect();
    const canvas = document.querySelector(`#${canvasId}`);
    if (!canvas) return;
    // Observe the parent wrap (has CSS height) — canvas itself may be 0px before Chart.js runs
    const target = canvas.parentElement ?? canvas;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        obs.disconnect();
        delete this._observers[canvasId];
        factory(canvas);
      },
      { threshold: 0 }
    );
    this._observers[canvasId] = obs;
    obs.observe(target);
  }

  _renderRevenueChart(Chart, { labels, data }) {
    this._activateCard("rpRevenueCard", "rpRevenuePh", "rpRevenueWrap", "rpRevenueBadge");
    if (this._charts.revenue) { this._charts.revenue.destroy(); this._charts.revenue = null; }

    const brand = "#22c55e";
    const gridColor = this._css("--line");
    const mutedColor = this._css("--muted");

    this._observeChart("rpRevenueCanvas", (canvas) => {
      this._charts.revenue = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: this._withAlpha(brand, 0.75),
            borderColor: brand,
            borderWidth: 0,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: this._barAnim(),
          plugins: { legend: { display: false }, tooltip: {
            callbacks: { label: (ctx) => " " + fmt(ctx.raw) }
          }},
          scales: {
            x: {
              grid: { color: gridColor, drawTicks: false },
              ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: mutedColor,
                callback: (v) => v === 0 ? "$0" : "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v),
              },
              beginAtZero: true,
            },
          },
        },
      });
    });
  }

  _renderCategoryChart(Chart, items) {
    this._activateCard("rpCategoryCard", "rpCategoryPh", "rpCategoryWrap", "rpCategoryBadge");
    const canvas = document.querySelector("#rpCategoryCanvas");
    if (!canvas) return;

    const catWrap = canvas.parentElement;
    let catEmpty = catWrap.querySelector(".rp-cat-empty");
    if (!catEmpty) {
      catEmpty = document.createElement("p");
      catEmpty.className = "rp-empty rp-cat-empty";
      catWrap.appendChild(catEmpty);
    }

    if (!items.length) {
      if (this._charts.category) { this._charts.category.destroy(); this._charts.category = null; }
      this._observers["rpCategoryCanvas"]?.disconnect();
      canvas.style.display = "none";
      catEmpty.textContent = "No data.";
      catEmpty.style.display = "";
      return;
    }

    canvas.style.display = "";
    catEmpty.style.display = "none";

    if (this._charts.category) { this._charts.category.destroy(); this._charts.category = null; }
    const mutedColor = this._css("--muted");

    this._observeChart("rpCategoryCanvas", (cvs) => {
      this._charts.category = new Chart(cvs, {
        type: "doughnut",
        data: {
          labels: items.map(i => i.label),
          datasets: [{
            data: items.map(i => i.value),
            backgroundColor: PALETTE.slice(0, items.length),
            borderWidth: 0,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          animation: this._donutAnim(),
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: mutedColor,
                boxWidth: 10,
                boxHeight: 10,
                borderRadius: 3,
                padding: 12,
                font: { size: 11 },
              },
            },
            tooltip: {
              callbacks: { label: (ctx) => ` ${ctx.label}: ${fmt(ctx.raw)}` }
            },
          },
        },
      });
    });
  }

  _renderHourlyChart(Chart, { labels, data }) {
    this._activateCard("rpHourlyCard", "rpHourlyPh", "rpHourlyWrap", "rpHourlyBadge");
    if (this._charts.hourly) { this._charts.hourly.destroy(); this._charts.hourly = null; }

    const brand = "#22c55e";
    const gridColor = this._css("--line");
    const mutedColor = this._css("--muted");
    const peak = Math.max(...data, 1);
    const bgColors = data.map(v => this._withAlpha(brand, 0.25 + (v / peak) * 0.65));

    this._observeChart("rpHourlyCanvas", (canvas) => {
      this._charts.hourly = new Chart(canvas, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: brand,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: this._barAnim(15),
          plugins: { legend: { display: false }, tooltip: {
            callbacks: { label: (ctx) => " " + fmt(ctx.raw) }
          }},
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: mutedColor,
                callback: (v) => v === 0 ? "$0" : "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v),
              },
              beginAtZero: true,
            },
          },
        },
      });
    });
  }

  _renderDowChart(Chart, { labels, data, isEmpty }) {
    this._activateCard("rpDowCard", "rpDowPh", "rpDowWrap", "rpDowBadge");
    const canvas = document.querySelector("#rpDowCanvas");
    if (!canvas) return;

    const wrap = canvas.parentElement;
    let emptyMsg = wrap.querySelector(".rp-dow-empty");
    if (!emptyMsg) {
      emptyMsg = document.createElement("p");
      emptyMsg.className = "rp-empty rp-dow-empty";
      wrap.appendChild(emptyMsg);
    }

    if (isEmpty) {
      if (this._charts.dow) { this._charts.dow.destroy(); this._charts.dow = null; }
      this._observers["rpDowCanvas"]?.disconnect();
      canvas.style.display = "none";
      emptyMsg.textContent = "Select a wider period to see day-of-week patterns.";
      emptyMsg.style.display = "";
      return;
    }

    canvas.style.display = "";
    emptyMsg.style.display = "none";

    if (this._charts.dow) { this._charts.dow.destroy(); this._charts.dow = null; }

    const brand       = "#22c55e";
    const gridColor   = this._css("--line");
    const mutedColor  = this._css("--muted");
    const peak        = Math.max(...data, 1);
    const bgColors    = data.map(v => this._withAlpha(brand, 0.3 + (v / peak) * 0.6));
    const borderColors = data.map(v => v === peak ? brand : this._withAlpha(brand, 0));

    this._observeChart("rpDowCanvas", (cvs) => {
      this._charts.dow = new Chart(cvs, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: this._barAnim(60),
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => " " + fmt(ctx.raw) } },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: mutedColor, font: { size: 12, weight: "500" } },
            },
            y: {
              grid: { color: gridColor },
              ticks: {
                color: mutedColor,
                callback: (v) => v === 0 ? "$0" : "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v),
              },
              beginAtZero: true,
            },
          },
        },
      });
    });
  }

  _renderServingHourChart(Chart, servingTime) {
    this._activateCard("rpServingHourCard", "rpServingHourPh", "rpServingHourWrap", "rpServingHourBadge");
    const canvas = document.querySelector("#rpServingHourCanvas");
    if (!canvas) return;

    const wrap = canvas.parentElement;
    let emptyMsg = wrap.querySelector(".rp-serving-hour-empty");
    if (!emptyMsg) {
      emptyMsg = document.createElement("p");
      emptyMsg.className = "rp-empty rp-serving-hour-empty";
      wrap.appendChild(emptyMsg);
    }

    if (!servingTime) {
      if (this._charts.servingHour) { this._charts.servingHour.destroy(); this._charts.servingHour = null; }
      this._observers["rpServingHourCanvas"]?.disconnect();
      canvas.style.display = "none";
      emptyMsg.textContent = "No serving time data. Orders must be marked done in the Kitchen Display to track this.";
      emptyMsg.style.display = "";
      return;
    }

    canvas.style.display = "";
    emptyMsg.style.display = "none";

    if (this._charts.servingHour) { this._charts.servingHour.destroy(); this._charts.servingHour = null; }

    const { labels, data } = servingTime.byHour;
    const orange      = "#f59e0b";
    const gridColor   = this._css("--line");
    const mutedColor  = this._css("--muted");
    const peak        = Math.max(...data, 0.001);
    const bgColors    = data.map(v => this._withAlpha(orange, v > 0 ? 0.3 + (v / peak) * 0.6 : 0));
    const borderColors = data.map(v => v === peak && v > 0 ? orange : this._withAlpha(orange, 0));

    this._observeChart("rpServingHourCanvas", (cvs) => {
      this._charts.servingHour = new Chart(cvs, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 5,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: this._barAnim(15),
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw.toFixed(1)} min avg` } },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: mutedColor, callback: (v) => `${v.toFixed(0)}m` },
              beginAtZero: true,
            },
          },
        },
      });
    });
  }

  _renderServingDayChart(Chart, servingTime) {
    this._activateCard("rpServingDayCard", "rpServingDayPh", "rpServingDayWrap", "rpServingDayBadge");
    const canvas = document.querySelector("#rpServingDayCanvas");
    if (!canvas) return;

    const wrap = canvas.parentElement;
    let emptyMsg = wrap.querySelector(".rp-serving-day-empty");
    if (!emptyMsg) {
      emptyMsg = document.createElement("p");
      emptyMsg.className = "rp-empty rp-serving-day-empty";
      wrap.appendChild(emptyMsg);
    }

    if (!servingTime) {
      if (this._charts.servingDay) { this._charts.servingDay.destroy(); this._charts.servingDay = null; }
      this._observers["rpServingDayCanvas"]?.disconnect();
      canvas.style.display = "none";
      emptyMsg.textContent = "No serving time data for this period.";
      emptyMsg.style.display = "";
      return;
    }

    canvas.style.display = "";
    emptyMsg.style.display = "none";

    if (this._charts.servingDay) { this._charts.servingDay.destroy(); this._charts.servingDay = null; }

    const { labels, data } = servingTime.byDay;
    const orange      = "#f59e0b";
    const gridColor   = this._css("--line");
    const mutedColor  = this._css("--muted");
    const peak        = Math.max(...data, 0.001);
    const bgColors    = data.map(v => this._withAlpha(orange, v > 0 ? 0.3 + (v / peak) * 0.6 : 0));
    const borderColors = data.map(v => v === peak && v > 0 ? orange : this._withAlpha(orange, 0));

    this._observeChart("rpServingDayCanvas", (cvs) => {
      this._charts.servingDay = new Chart(cvs, {
        type: "bar",
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: borderColors,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: this._barAnim(60),
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw.toFixed(1)} min avg` } },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: mutedColor, font: { size: 12, weight: "500" } },
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: mutedColor, callback: (v) => `${v.toFixed(0)}m` },
              beginAtZero: true,
            },
          },
        },
      });
    });
  }

  // ── Staff performance ────────────────────────────────────────────────────

  renderStaff(staff) {
    const el = document.querySelector("#reportsStaff");
    if (!el) return;
    if (!staff.length) {
      el.innerHTML = `<p class="rp-empty">No sales data for this period.</p>`;
      return;
    }
    const maxRev = staff[0].revenue;
    el.innerHTML = `
      <div class="rp-staff-list">
        ${staff.map((s, i) => `
          <div class="rp-staff-row">
            <span class="rp-item-rank">${i + 1}</span>
            <div class="rp-item-main">
              <div class="rp-item-row-top">
                <span class="rp-item-name">${s.name}</span>
                <span class="rp-item-rev">${fmt(s.revenue)}</span>
              </div>
              <div class="rp-item-bar-track">
                <div class="rp-item-bar rp-item-bar--staff" style="width:${Math.round((s.revenue / maxRev) * 100)}%"></div>
              </div>
              <span class="rp-item-qty">${s.transactions} transaction${s.transactions !== 1 ? "s" : ""}</span>
            </div>
          </div>`).join("")}
      </div>`;
  }

  // ── Sort pills ───────────────────────────────────────────────────────────

  setTopItemsSort(key) {
    document.querySelectorAll("#topItemsSortPills .rp-sort-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sort === key);
    });
  }

  _addHandlerTopItemsSort(handler) {
    document.querySelector("#topItemsSortPills")?.addEventListener("click", (e) => {
      const pill = e.target.closest(".rp-sort-pill");
      if (!pill || pill.classList.contains("active")) return;
      handler(pill.dataset.sort);
    });
  }

  // ── Info tooltips ────────────────────────────────────────────────────────

  _addHandlerInfoTooltips() {
    const tip = document.createElement("div");
    tip.className = "rp-tip-float hidden";
    document.body.appendChild(tip);
    let activeBtn = null;

    this._parentElement.addEventListener("click", (e) => {
      const btn = e.target.closest(".rp-info-btn");
      if (!btn || !btn.dataset.tip) { tip.classList.add("hidden"); activeBtn = null; return; }
      e.stopPropagation();
      if (activeBtn === btn) { tip.classList.add("hidden"); activeBtn = null; return; }
      activeBtn = btn;
      tip.textContent = btn.dataset.tip;
      tip.classList.remove("hidden");
      const rect = btn.getBoundingClientRect();
      const tw = 224;
      tip.style.top  = `${rect.bottom + 8}px`;
      tip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - tw - 8))}px`;
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".rp-info-btn")) { tip.classList.add("hidden"); activeBtn = null; }
    });
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  _addHandlerOpen(handler) {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-action='summary']")) handler();
    });
  }

  _addHandlerClose(handler) {
    this._parentElement.addEventListener("click", (e) => {
      if (e.target.closest(".rp-back")) handler();
    });
  }

  _addHandlerPeriodChange(handler) {
    this._parentElement.querySelector(".rp-tabs")
      .addEventListener("click", (e) => {
        const btn = e.target.closest(".rp-tab");
        if (!btn) return;
        const period = btn.dataset.period;
        this.setActivePeriod(period);
        if (period !== "custom") handler({ period });
      });
  }

  // ── Compare mode ─────────────────────────────────────────────────────────

  enterCompareMode() {
    document.querySelector("#reportsTabs")?.classList.add("hidden");
    document.querySelector("#reportsCustomRange")?.classList.add("hidden");
    document.querySelector("#reportsCompareBar")?.classList.remove("hidden");
    document.querySelector(".rp-kpi-strip")?.classList.add("hidden");
    document.querySelector(".rp-grid")?.classList.add("hidden");
    document.querySelector("#rpCompareResults")?.classList.add("hidden");
    const btn = document.querySelector("#reportsCompareBtn");
    if (btn) {
      btn.classList.add("active");
      btn.querySelector(".rp-compare-btn-label").textContent = "← Back";
      btn.querySelector("#reportsCompareBtnIcon").innerHTML = '<polyline points="15 18 9 12 15 6"/>';
    }
  }

  exitCompareMode() {
    document.querySelector("#reportsTabs")?.classList.remove("hidden");
    document.querySelector("#reportsCompareBar")?.classList.add("hidden");
    document.querySelector("#rpCompareResults")?.classList.add("hidden");
    document.querySelector(".rp-kpi-strip")?.classList.remove("hidden");
    document.querySelector(".rp-grid")?.classList.remove("hidden");
    const btn = document.querySelector("#reportsCompareBtn");
    if (btn) {
      btn.classList.remove("active");
      btn.querySelector(".rp-compare-btn-label").textContent = "Compare";
      btn.querySelector("#reportsCompareBtnIcon").innerHTML =
        '<rect x="2" y="3" width="9" height="18" rx="2"/><rect x="13" y="3" width="9" height="18" rx="2"/>';
    }
  }

  renderCompareResults({ labelA, labelB, summaryA, summaryB, topItemsA, topItemsB }) {
    const fmtServ = (v) => {
      if (v == null) return "—";
      const mins = Math.floor(v);
      const secs = Math.round((v - mins) * 60);
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    const deltaBadge = (a, b, invert = false) => {
      if (b == null || b === 0 || a == null) return "";
      const pct = Math.round(((a - b) / b) * 100);
      const up = invert ? pct <= 0 : pct >= 0;
      const arrow = pct >= 0
        ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`
        : `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      return `<span class="rp-cmp-delta-badge rp-cmp-delta-badge--${up ? "up" : "down"}">${arrow} ${Math.abs(pct)}%</span>`;
    };

    const setKpi = (idA, idB, idDelta, a, b, fmtFn, invert = false) => {
      const elA = document.querySelector(`#${idA}`);
      const elB = document.querySelector(`#${idB}`);
      const aWins = invert ? (a != null && b != null && a < b) : (a > b);
      const bWins = invert ? (a != null && b != null && b < a) : (b > a);
      if (elA) {
        elA.textContent = fmtFn(a);
        elA.className = `rp-cmp-kpi-val${aWins ? " rp-cmp-kpi-val--up" : (!aWins && a !== b && a != null && b != null) ? " rp-cmp-kpi-val--down" : ""}`;
      }
      if (elB) {
        elB.textContent = fmtFn(b);
        elB.className = `rp-cmp-kpi-val${bWins ? " rp-cmp-kpi-val--up" : (!bWins && a !== b && a != null && b != null) ? " rp-cmp-kpi-val--down" : ""}`;
      }
      const deltaEl = document.querySelector(`#${idDelta}`);
      if (deltaEl) deltaEl.outerHTML = `<span id="${idDelta}">${deltaBadge(a, b, invert)}</span>`;
    };

    document.querySelectorAll(".rp-cmp-period-name-a").forEach(el => el.textContent = labelA);
    document.querySelectorAll(".rp-cmp-period-name-b").forEach(el => el.textContent = labelB);

    setKpi("rpCmpRevA",  "rpCmpRevB",  "rpCmpRevDelta",  summaryA.revenue,           summaryB.revenue,           fmt);
    setKpi("rpCmpTxA",   "rpCmpTxB",   "rpCmpTxDelta",   summaryA.transactions,      summaryB.transactions,      String);
    setKpi("rpCmpAvgA",  "rpCmpAvgB",  "rpCmpAvgDelta",  summaryA.avgOrder,          summaryB.avgOrder,          fmt);
    setKpi("rpCmpServA", "rpCmpServB", "rpCmpServDelta",  summaryA.avgServingMinutes, summaryB.avgServingMinutes, fmtServ, true);

    this._renderCmpItemList("#rpCmpTopItemsA", topItemsA);
    this._renderCmpItemList("#rpCmpTopItemsB", topItemsB);

    document.querySelector("#rpCompareResults")?.classList.remove("hidden");
  }

  _renderCmpItemList(selector, items) {
    const el = document.querySelector(selector);
    if (!el) return;
    if (!items.length) { el.innerHTML = `<p class="rp-empty">No data.</p>`; return; }
    const maxQty = items[0].quantity;
    el.innerHTML = `
      <div class="rp-item-list">
        ${items.map((item, i) => `
          <div class="rp-item-row">
            <span class="rp-item-rank">${i + 1}</span>
            <div class="rp-item-main">
              <div class="rp-item-row-top">
                <span class="rp-item-name">${item.name}</span>
                <span class="rp-item-rev">${fmt(item.revenue)}</span>
              </div>
              <div class="rp-item-bar-track">
                <div class="rp-item-bar" style="width:${Math.round((item.quantity / maxQty) * 100)}%"></div>
              </div>
              <span class="rp-item-qty">${item.quantity} sold</span>
            </div>
          </div>`).join("")}
      </div>`;
  }

  async renderCompareChart({ labelA, dataA, labelB, dataB, labels }) {
    const Chart = await this._ensureChart();
    if (this._charts.cmpRevenue) { this._charts.cmpRevenue.destroy(); this._charts.cmpRevenue = null; }

    const gridColor  = this._css("--line");
    const mutedColor = this._css("--muted");
    const colorA = "#22c55e";
    const colorB = "#60a5fa";

    this._observeChart("rpCmpRevenueCanvas", (canvas) => {
    this._charts.cmpRevenue = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: labelA,
            data: dataA,
            backgroundColor: this._withAlpha(colorA, 0.7),
            borderColor: colorA,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: labelB,
            data: dataB,
            backgroundColor: this._withAlpha(colorB, 0.7),
            borderColor: colorB,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            align: "end",
            labels: {
              color: mutedColor,
              boxWidth: 10,
              boxHeight: 10,
              borderRadius: 3,
              padding: 12,
              font: { size: 11 },
            },
          },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor, drawTicks: false },
            ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: mutedColor,
              callback: (v) => v === 0 ? "$0" : "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v),
            },
            beginAtZero: true,
          },
        },
      },
    });
    });
  }

  renderCmpTopItems(itemsA, itemsB) {
    this._renderCmpItemList("#rpCmpTopItemsA", itemsA);
    this._renderCmpItemList("#rpCmpTopItemsB", itemsB);
  }

  setCmpTopItemsSort(key) {
    document.querySelectorAll(".rp-cmp-sort-pills .rp-sort-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sort === key);
    });
  }

  _addHandlerCmpTopItemsSort(handler) {
    document.querySelectorAll(".rp-cmp-sort-pills").forEach(group => {
      group.addEventListener("click", (e) => {
        const pill = e.target.closest(".rp-sort-pill");
        if (!pill || pill.classList.contains("active")) return;
        handler(pill.dataset.sort);
      });
    });
  }

  _addHandlerCompareBack(handler) {
    document.querySelector("#rpCmpBackBtn")?.addEventListener("click", handler);
  }

  _addHandlerCompareToggle(handler) {
    document.querySelector("#reportsCompareBtn")?.addEventListener("click", handler);
  }

  _addHandlerRunComparison(handler) {
    const typeAEl = document.querySelector("#rpCmpTypeA");
    const vsLabel = document.querySelector("#rpCmpVsLabel");

    const A_WRAPPERS = {
      day:    document.querySelector("#rpCmpADayWrap"),
      week:   document.querySelector("#rpCmpAWeekWrap"),
      month:  document.querySelector("#rpCmpAMonthWrap"),
      year:   document.querySelector("#rpCmpAYearWrap"),
      custom: document.querySelector("#rpCmpCustomA"),
    };
    const B_WRAPPERS = {
      day:    document.querySelector("#rpCmpBDayWrap"),
      week:   document.querySelector("#rpCmpBWeekWrap"),
      month:  document.querySelector("#rpCmpBMonthWrap"),
      year:   document.querySelector("#rpCmpBYearWrap"),
      custom: document.querySelector("#rpCmpCustomB"),
    };
    const VS_LABELS = {
      day: "Day vs Day", week: "Week vs Week",
      month: "Month vs Month", year: "Year vs Year", custom: "Custom Range",
    };

    const _ymd = (d) => d.toISOString().slice(0, 10);
    const _ym  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    const setDefaults = (type) => {
      const now = new Date();
      if (type === "day") {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        const aEl = document.querySelector("#rpCmpADay");
        const bEl = document.querySelector("#rpCmpBDay");
        if (aEl) aEl.value = _ymd(now);
        if (bEl) bEl.value = _ymd(yesterday);
      } else if (type === "week") {
        const day = now.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        const thisMon = new Date(now); thisMon.setDate(now.getDate() + diffToMon);
        const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
        const aEl = document.querySelector("#rpCmpAWeek");
        const bEl = document.querySelector("#rpCmpBWeek");
        if (aEl) aEl.value = _ymd(thisMon);
        if (bEl) bEl.value = _ymd(lastMon);
      } else if (type === "month") {
        const aEl = document.querySelector("#rpCmpAMonth");
        const bEl = document.querySelector("#rpCmpBMonth");
        if (aEl) aEl.value = _ym(now);
        if (bEl) bEl.value = _ym(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      } else if (type === "year") {
        const aEl = document.querySelector("#rpCmpAYear");
        const bEl = document.querySelector("#rpCmpBYear");
        if (aEl) aEl.value = String(now.getFullYear());
        if (bEl) bEl.value = String(now.getFullYear() - 1);
      }
    };

    const showWrappers = (type) => {
      Object.values(A_WRAPPERS).forEach(w => w?.classList.add("hidden"));
      Object.values(B_WRAPPERS).forEach(w => w?.classList.add("hidden"));
      A_WRAPPERS[type]?.classList.remove("hidden");
      B_WRAPPERS[type]?.classList.remove("hidden");
      if (vsLabel) vsLabel.textContent = VS_LABELS[type] ?? "vs";
    };

    setDefaults("day");
    showWrappers("day");

    typeAEl?.addEventListener("change", (e) => {
      showWrappers(e.target.value);
      setDefaults(e.target.value);
    });

    document.querySelector("#rpRunCmpBtn")?.addEventListener("click", () => {
      const type = typeAEl?.value;
      if (!type) return;
      if (type === "custom") {
        const fromA = document.querySelector("#rpCmpFromA")?.value;
        const toA   = document.querySelector("#rpCmpToA")?.value;
        const fromB = document.querySelector("#rpCmpFromB")?.value;
        const toB   = document.querySelector("#rpCmpToB")?.value;
        if (!fromA || !toA || !fromB || !toB) return;
        handler({ type, fromA, toA, fromB, toB });
      } else {
        const A_VALS = {
          day:   document.querySelector("#rpCmpADay")?.value,
          week:  document.querySelector("#rpCmpAWeek")?.value,
          month: document.querySelector("#rpCmpAMonth")?.value,
          year:  document.querySelector("#rpCmpAYear")?.value,
        };
        const B_VALS = {
          day:   document.querySelector("#rpCmpBDay")?.value,
          week:  document.querySelector("#rpCmpBWeek")?.value,
          month: document.querySelector("#rpCmpBMonth")?.value,
          year:  document.querySelector("#rpCmpBYear")?.value,
        };
        const aValue = A_VALS[type];
        const bValue = B_VALS[type];
        if (!aValue || !bValue) return;
        handler({ type, aValue, bValue });
      }
    });
  }

  _addHandlerExport(csvHandler, pdfHandler) {
    const btn  = document.querySelector("#reportsExportBtn");
    const menu = document.querySelector("#reportsExportMenu");
    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    document.querySelector("#reportsExportCsvBtn")?.addEventListener("click", () => {
      menu.classList.add("hidden");
      csvHandler();
    });

    document.querySelector("#reportsExportPdfBtn")?.addEventListener("click", () => {
      menu.classList.add("hidden");
      pdfHandler();
    });

    document.addEventListener("click", (e) => {
      if (!document.querySelector("#reportsExportWrap")?.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  }

  _addHandlerCustomRange(handler) {
    const fromEl = document.querySelector("#reportsFrom");
    const toEl = document.querySelector("#reportsTo");

    fromEl.addEventListener("change", () => {
      if (toEl.value && toEl.value < fromEl.value) toEl.value = fromEl.value;
      toEl.min = fromEl.value;
    });

    document.querySelector("#applyReportsRangeBtn").addEventListener("click", () => {
      const from = fromEl.value;
      const to = toEl.value;
      if (!from || !to) return;
      if (to < from) { toEl.value = from; return; }
      handler({ period: "custom", from, to });
    });
  }
}

export default new ReportsView();
