import View from "./view.js";

const fmt = (n) =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PALETTE = ['#22c55e','#60a5fa','#f59e0b','#f87171','#a78bfa','#34d399','#fb923c','#818cf8'];

const makeOuterLabelPlugin = (mutedColor, textColor) => ({
  id: 'outerLabels',
  afterDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const ds = chart.data.datasets[0];
    const total = ds.data.reduce((s, v) => s + v, 0);
    if (!total) return;
    ctx.save();
    ctx.textBaseline = 'middle';
    meta.data.forEach((arc, i) => {
      const pct = (ds.data[i] / total) * 100;
      if (pct < 5) return;
      const mid = (arc.startAngle + arc.endAngle) / 2;
      const r = arc.outerRadius + 22;
      const x = arc.x + Math.cos(mid) * r;
      const y = arc.y + Math.sin(mid) * r;
      const align = x >= arc.x ? 'left' : 'right';
      ctx.textAlign = align;

      const raw = chart.data.labels[i] ?? '';
      const label = raw.length > 11 ? raw.slice(0, 10) + '…' : raw;

      ctx.font = '700 11px system-ui, sans-serif';
      ctx.fillStyle = textColor ?? mutedColor;
      ctx.fillText(`${pct.toFixed(1)}%`, x, y - 8);

      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = mutedColor;
      ctx.fillText(label, x, y + 8);
    });
    ctx.restore();
  }
});

class ReportsView extends View {
  _parentElement = document.querySelector("#reportsPanel");
  _Chart = null;
  _charts = {};
  _observers = {};
  _activeSection = "overview";

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
    this._switchSection("overview");
  }

  // ── Sidebar section switching ─────────────────────────────────────────────

  _switchSection(section) {
    this._activeSection = section;
    this._parentElement.querySelectorAll(".rp-nav-tab").forEach(btn => {
      btn.classList.toggle("rp-nav-tab--active", btn.dataset.section === section);
    });
    this._parentElement.querySelectorAll(".rp-section").forEach(sec => {
      sec.classList.toggle("hidden", sec.dataset.section !== section);
    });
  }

  _addHandlerSections() {
    this._parentElement.querySelector(".rp-sidebar")?.addEventListener("click", e => {
      const btn = e.target.closest(".rp-nav-tab");
      if (!btn) return;
      this._switchSection(btn.dataset.section);
    });
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
    const sgEl = document.querySelector("#salesGrossIncome"); if (sgEl) sgEl.textContent = fmt(revenue);
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

  // ── Full-list modal ──────────────────────────────────────────────────────

  _openListModal(title, bodyHtml) {
    const modal = document.querySelector("#rpListModal");
    if (!modal) return;
    document.querySelector("#rpListModalTitle").textContent = title;
    document.querySelector("#rpListModalBody").innerHTML = bodyHtml;
    modal.classList.remove("hidden");

    const close = () => modal.classList.add("hidden");
    document.querySelector("#rpListModalClose").onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
  }

  // ── Top items list ───────────────────────────────────────────────────────

  renderTopItems(items, sortKey = "quantity") {
    const el = document.querySelector("#reportsTopItems");
    if (!items.length) {
      el.innerHTML = `<p class="rp-empty">No sales data for this period.</p>`;
      return;
    }
    const LIMIT = 6;
    const preview = items.slice(0, LIMIT);
    const maxQty = items[0].quantity;
    const maxRev = items[0].revenue;
    const byQty = sortKey === "quantity";

    const MEDALS = ['🥇', '🥈', '🥉'];
    const rowHtml = (item, i) => `
      <div class="rp-item-row">
        <span class="rp-item-rank">${MEDALS[i] ?? i + 1}</span>
        <div class="rp-item-main">
          <div class="rp-item-row-top">
            <span class="rp-item-name">${item.name}</span>
            <span class="rp-item-rev">${byQty ? item.quantity : fmt(item.revenue)}</span>
          </div>
          <div class="rp-item-bar-track">
            <div class="rp-item-bar" style="width:${byQty ? Math.round((item.quantity / maxQty) * 100) : Math.round((item.revenue / maxRev) * 100)}%"></div>
          </div>
          <span class="rp-item-qty">${byQty ? fmt(item.revenue) : `${item.quantity} sold`}</span>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="rp-item-list rp-item-list--grid">
        ${preview.map((item, i) => rowHtml(item, i)).join("")}
      </div>
      ${items.length > LIMIT ? `<button class="rp-top-items-toggle">View full list (${items.length} items)</button>` : ""}`;

    if (items.length > LIMIT) {
      el.querySelector(".rp-top-items-toggle").addEventListener("click", () => {
        this._openListModal("Top Items", `
          <div class="rp-item-list">
            ${items.map((item, i) => rowHtml(item, i)).join("")}
          </div>`);
      });
    }
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

  async renderCharts({ categoryMix, itemMix, hourlyBreakdown, dayOfWeek, servingTime }) {
    let Chart;
    try {
      Chart = await this._ensureChart();
    } catch (err) {
      console.error('[Pointbunny] Chart.js failed to load after retries:', err);
      this._setChartsError();
      return;
    }
    this._renderCategoryChart(Chart, categoryMix);
    this._renderItemMixChart(Chart, itemMix ?? []);
    this._renderHourlyChart(Chart, hourlyBreakdown);
    this._renderDowChart(Chart, dayOfWeek);
    this._renderServingHourChart(Chart, servingTime);
    this._renderServingDayChart(Chart, servingTime);
  }

  // ── Chart.js loader with retry ─────────────────────────────────────────────
  // Parcel compiles dynamic-import chunks lazily; on a cold dev-server start
  // the chunk may not exist yet when we first try to fetch it. Retry with
  // increasing delays so charts appear automatically once Parcel finishes.
  async _ensureChart() {
    if (this._Chart) return this._Chart;
    if (this._chartPromise) return this._chartPromise; // deduplicate concurrent calls

    const DELAYS = [1500, 2000, 3000, 4000]; // ms between attempts (4 retries)
    let spinnerShown = false;

    this._chartPromise = (async () => {
      for (let attempt = 0; attempt <= DELAYS.length; attempt++) {
        try {
          const { Chart, registerables } = await import('chart.js');
          Chart.register(...registerables);
          Chart.defaults.font.family = 'Inter, sans-serif';
          Chart.defaults.font.size = 11;
          this._Chart = Chart;
          this._chartPromise = null;
          return Chart;
        } catch (err) {
          if (attempt < DELAYS.length) {
            // On first failure: swap skeleton bars → spinner so user knows what's happening
            if (!spinnerShown) {
              spinnerShown = true;
              this._setChartPlaceholdersSpinner();
            }
            await new Promise(r => setTimeout(r, DELAYS[attempt]));
          } else {
            // All retries exhausted
            this._chartPromise = null;
            this._Chart = null;
            throw err;
          }
        }
      }
    })();

    return this._chartPromise;
  }

  // Kick off Chart.js loading eagerly (fire-and-forget) so Parcel has max time
  preloadChart() {
    this._ensureChart().catch(() => {});
  }

  _setChartPlaceholdersSpinner() {
    const html = `
      <div class="rp-chart-loading">
        <span class="rp-chart-spinner"></span>
        <span class="rp-chart-loading-text">Loading charts…</span>
      </div>`;
    ['rpRevenuePh', 'rpCategoryPh', 'rpHourlyPh'].forEach(id => {
      const el = document.querySelector(`#${id}`);
      if (el && !el.classList.contains('hidden')) el.innerHTML = html;
    });
  }

  _setChartsError() {
    this._Chart = null; // reset so reopening Reports will retry fresh
    const html = `
      <div class="rp-chart-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Charts failed to load</span>
        <button class="rp-chart-retry-btn" type="button" onclick="window.location.reload()">Reload page</button>
      </div>`;
    ['rpRevenuePh', 'rpCategoryPh', 'rpHourlyPh'].forEach(id => {
      const el = document.querySelector(`#${id}`);
      if (el && !el.classList.contains('hidden')) el.innerHTML = html;
    });
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

  async renderOverviewChart({ labels, datasets }) {
    let Chart;
    try {
      Chart = await this._ensureChart();
    } catch {
      return; // error state already shown by renderCharts
    }
    this._activateCard("rpRevenueCard", "rpRevenuePh", "rpRevenueWrap", "rpRevenueBadge");

    // Cancel any pending observer so we can render immediately (canvas is visible)
    this._observers['rpRevenueCanvas']?.disconnect();
    delete this._observers['rpRevenueCanvas'];
    if (this._charts.revenue) { this._charts.revenue.destroy(); this._charts.revenue = null; }

    const canvas = document.querySelector('#rpRevenueCanvas');
    if (!canvas) return;

    // Empty state: no metrics selected
    const wrap = canvas.parentElement;
    let emptyEl = wrap.querySelector('.rp-chart-empty');
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.className = 'rp-chart-empty';
      emptyEl.innerHTML = '<span>Select a card above to display it on the chart</span>';
      wrap.appendChild(emptyEl);
    }
    const legendEl = document.getElementById('rpOverviewLegend');

    if (datasets.length === 0) {
      canvas.style.display = 'none';
      emptyEl.style.display = '';
      const titleEl = document.getElementById('rpOverviewChartTitle');
      if (titleEl) titleEl.textContent = 'Overview';
      if (legendEl) legendEl.innerHTML = '';
      return;
    }
    canvas.style.display = '';
    emptyEl.style.display = 'none';

    const gridColor  = this._css('--line');
    const mutedColor = this._css('--muted');

    const CURRENCY = new Set(['revenue', 'expenses', 'net', 'avgOrder']);
    const hasCurrency    = datasets.some(d => CURRENCY.has(d._metric));
    const hasNonCurrency = datasets.some(d => !CURRENCY.has(d._metric));

    const mapped = datasets.map(d => ({ ...d, yAxisID: CURRENCY.has(d._metric) ? 'yLeft' : 'yRight' }));

    // Update the title span
    const titleEl = document.getElementById('rpOverviewChartTitle');
    if (titleEl) {
      const names = datasets.map(d => d.label);
      titleEl.textContent = names.length <= 3 ? names.join(' · ') : 'Overview';
    }

    // Build custom DOM legend next to the title (no canvas space used → no reflow)
    if (legendEl) {
      legendEl.innerHTML = mapped.length > 1
        ? mapped.map(d => `
            <span class="rp-legend-item">
              <span class="rp-legend-dot" style="background:${d.borderColor}"></span>
              ${d.label}
            </span>`).join('')
        : '';
    }

    this._charts.revenue = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets: mapped },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false }, // handled by DOM legend above
          tooltip: {
            callbacks: {
              label: ctx => {
                const m = ctx.dataset._metric;
                const v = ctx.raw;
                if (m === 'transactions') return ` ${Math.round(v)} orders`;
                return ' ' + fmt(v);
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: gridColor, drawTicks: false },
            ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          },
          yLeft: {
            display: hasCurrency,
            position: 'left',
            grid: { color: gridColor },
            ticks: {
              color: mutedColor,
              callback: v => v === 0 ? '$0' : '$' + (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)),
            },
            beginAtZero: true,
          },
          yRight: {
            display: hasNonCurrency,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: mutedColor, callback: v => Math.round(v) },
            beginAtZero: true,
          },
        },
      },
    });
  }

  setSelectedMetrics(set) {
    this._parentElement.querySelectorAll('.rp-kpi[data-metric]').forEach(card => {
      const selected = set.has(card.dataset.metric);
      card.classList.toggle('rp-kpi--selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
  }

  _addHandlerKpiToggle(handler) {
    const strip = this._parentElement.querySelector('.rp-kpi-strip');
    if (!strip) return;
    strip.addEventListener('click', e => {
      const card = e.target.closest('[data-metric]');
      if (!card || e.target.closest('button')) return;
      handler(card.dataset.metric);
    });
    strip.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const card = e.target.closest('[data-metric]');
      if (!card) return;
      e.preventDefault();
      handler(card.dataset.metric);
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

    const totalValue  = items.reduce((s, i) => s + i.value, 0);
    const mutedColor  = this._css("--muted");
    const textColor   = this._css("--text");
    const gapColor    = this._css("--panel-strong");
    const outerLabels = makeOuterLabelPlugin(mutedColor, textColor);

    const centerPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        const active = chart.getActiveElements();
        let l1, l2;
        if (active.length > 0) {
          const { datasetIndex, index } = active[0];
          const v   = chart.data.datasets[datasetIndex].data[index];
          const lbl = chart.data.labels[index];
          l1 = fmt(v);
          l2 = lbl.length > 13 ? lbl.slice(0, 11) + '…' : lbl;
        } else {
          l1 = fmt(totalValue);
          l2 = 'total sales';
        }
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 16px system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(l1, cx, cy - 9);
        ctx.font = `11px system-ui, sans-serif`;
        ctx.fillStyle = mutedColor;
        ctx.fillText(l2, cx, cy + 9);
        ctx.restore();
      }
    };

    this._observeChart("rpCategoryCanvas", (cvs) => {
      this._charts.category = new Chart(cvs, {
        type: "doughnut",
        data: {
          labels: items.map(i => i.label),
          datasets: [{
            data: items.map(i => i.value),
            backgroundColor: PALETTE.slice(0, items.length),
            borderWidth: 3,
            borderColor: gapColor,
            borderRadius: 6,
            hoverOffset: 14,
            hoverBorderColor: gapColor,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          layout: { padding: 52 },
          animation: this._donutAnim(),
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pct = totalValue > 0 ? ((ctx.raw / totalValue) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`;
                }
              },
            },
          },
        },
        plugins: [centerPlugin, outerLabels],
      });
      requestAnimationFrame(() => this._charts.category?.resize());
    });
  }

  _renderItemMixChart(Chart, items) {
    this._activateCard("rpItemMixCard", "rpItemMixPh", "rpItemMixWrap", "rpItemMixBadge");
    const canvas = document.querySelector("#rpItemMixCanvas");
    if (!canvas) return;

    const wrap = canvas.parentElement;
    let emptyEl = wrap.querySelector(".rp-item-mix-empty");
    if (!emptyEl) {
      emptyEl = document.createElement("p");
      emptyEl.className = "rp-empty rp-item-mix-empty";
      wrap.appendChild(emptyEl);
    }

    if (!items.length) {
      if (this._charts.itemMix) { this._charts.itemMix.destroy(); this._charts.itemMix = null; }
      this._observers["rpItemMixCanvas"]?.disconnect();
      canvas.style.display = "none";
      emptyEl.textContent = "No data.";
      emptyEl.style.display = "";
      return;
    }

    canvas.style.display = "";
    emptyEl.style.display = "none";
    if (this._charts.itemMix) { this._charts.itemMix.destroy(); this._charts.itemMix = null; }

    const top         = items.slice(0, 8);
    const totalQty    = top.reduce((s, i) => s + i.quantity, 0);
    const mutedColor  = this._css("--muted");
    const textColor   = this._css("--text");
    const gapColor    = this._css("--panel-strong");
    const outerLabels = makeOuterLabelPlugin(mutedColor, textColor);

    const centerPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2, cy = (top + bottom) / 2;
        const active = chart.getActiveElements();
        let l1, l2;
        if (active.length > 0) {
          const { datasetIndex, index } = active[0];
          const v   = chart.data.datasets[datasetIndex].data[index];
          const lbl = chart.data.labels[index];
          const pct = totalQty > 0 ? ((v / totalQty) * 100).toFixed(1) : 0;
          l1 = `${pct}%`;
          l2 = lbl.length > 13 ? lbl.slice(0, 11) + '…' : lbl;
        } else {
          l1 = String(totalQty);
          l2 = 'items sold';
        }
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 16px system-ui, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.fillText(l1, cx, cy - 9);
        ctx.font = `11px system-ui, sans-serif`;
        ctx.fillStyle = mutedColor;
        ctx.fillText(l2, cx, cy + 9);
        ctx.restore();
      }
    };

    this._observeChart("rpItemMixCanvas", (cvs) => {
      this._charts.itemMix = new Chart(cvs, {
        type: "doughnut",
        data: {
          labels: top.map(i => i.name),
          datasets: [{
            data: top.map(i => i.quantity),
            backgroundColor: PALETTE.slice(0, top.length),
            borderWidth: 3,
            borderColor: gapColor,
            borderRadius: 6,
            hoverOffset: 14,
            hoverBorderColor: gapColor,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "70%",
          layout: { padding: 52 },
          animation: this._donutAnim(),
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const pct = totalQty > 0 ? ((ctx.raw / totalQty) * 100).toFixed(1) : 0;
                  return ` ${ctx.label}: ${ctx.raw} sold (${pct}%)`;
                },
              },
            },
          },
        },
        plugins: [centerPlugin, outerLabels],
      });
      requestAnimationFrame(() => this._charts.itemMix?.resize());
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
            callbacks: { label: (ctx) => " " + Math.round(ctx.raw) + " orders" }
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
                callback: (v) => Number.isInteger(v) ? v : "",
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
            tooltip: { callbacks: { label: (ctx) => " " + Math.round(ctx.raw) + " orders" } },
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
                callback: (v) => Number.isInteger(v) ? v : "",
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
      emptyMsg.textContent = "No serving time data. Orders must be marked done in the Queue Display to track this.";
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

  renderStaff(staff, sortKey = "revenue") {
    const el = document.querySelector("#reportsStaff");
    if (!el) return;
    if (!staff.length) {
      el.innerHTML = `<p class="rp-empty">No sales data for this period.</p>`;
      return;
    }
    const LIMIT = 6;
    const preview = staff.slice(0, LIMIT);
    const maxRev = staff[0].revenue;
    const maxTx  = staff[0].transactions;
    const byQty  = sortKey === "quantity";

    const MEDALS = ['🥇', '🥈', '🥉'];
    const rowHtml = (s, i) => `
      <div class="rp-staff-row">
        <span class="rp-item-rank">${MEDALS[i] ?? i + 1}</span>
        <div class="rp-item-main">
          <div class="rp-item-row-top">
            <span class="rp-item-name">${s.name}</span>
            <span class="rp-item-rev">${byQty ? s.transactions : fmt(s.revenue)}</span>
          </div>
          <div class="rp-item-bar-track">
            <div class="rp-item-bar rp-item-bar--staff" style="width:${byQty ? Math.round((s.transactions / maxTx) * 100) : Math.round((s.revenue / maxRev) * 100)}%"></div>
          </div>
          <span class="rp-item-qty">${byQty ? fmt(s.revenue) : `${s.transactions} transaction${s.transactions !== 1 ? "s" : ""}`}</span>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="rp-staff-list rp-staff-list--grid">
        ${preview.map((s, i) => rowHtml(s, i)).join("")}
      </div>
      ${staff.length > LIMIT ? `<button class="rp-top-items-toggle">View full list (${staff.length} members)</button>` : ""}`;

    if (staff.length > LIMIT) {
      el.querySelector(".rp-top-items-toggle").addEventListener("click", () => {
        this._openListModal("Staff Performance", `
          <div class="rp-staff-list">
            ${staff.map((s, i) => rowHtml(s, i)).join("")}
          </div>`);
      });
    }
  }

  // ── Sort pills ───────────────────────────────────────────────────────────

  setTopItemsSort(key) {
    document.querySelectorAll("#topItemsSortPills .rp-sort-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.sort === key);
    });
  }

  setStaffSort(key) {
    document.querySelectorAll("#staffSortPills .rp-sort-pill").forEach(btn => {
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

  _addHandlerStaffSort(handler) {
    document.querySelector("#staffSortPills")?.addEventListener("click", (e) => {
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
    document.querySelector(".rp-sidebar")?.classList.add("hidden");
    this._parentElement.querySelectorAll(".rp-section").forEach(s => s.classList.add("hidden"));
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
    document.querySelector(".rp-sidebar")?.classList.remove("hidden");
    this._switchSection(this._activeSection);
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

  renderCmpPeakStats({ salesPeaksA, salesPeaksB, tPeaksA, tPeaksB }) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("rpCmpBestSellerA",    salesPeaksA.bestSeller);
    set("rpCmpBestSellerB",    salesPeaksB.bestSeller);
    set("rpCmpBestSellerSubA", salesPeaksA.bestSellerSub);
    set("rpCmpBestSellerSubB", salesPeaksB.bestSellerSub);
    set("rpCmpTopCatA",        salesPeaksA.topCategory);
    set("rpCmpTopCatB",        salesPeaksB.topCategory);
    set("rpCmpTopCatSubA",     salesPeaksA.topCategorySub);
    set("rpCmpTopCatSubB",     salesPeaksB.topCategorySub);
    set("rpCmpTopStaffA",      salesPeaksA.topStaff);
    set("rpCmpTopStaffB",      salesPeaksB.topStaff);
    set("rpCmpTopStaffSubA",   salesPeaksA.topStaffSub);
    set("rpCmpTopStaffSubB",   salesPeaksB.topStaffSub);
    set("rpCmpPeakHourA",      tPeaksA.peakHour);
    set("rpCmpPeakHourB",      tPeaksB.peakHour);
    set("rpCmpPeakHourSubA",   tPeaksA.peakHourCount > 0 ? `${tPeaksA.peakHourCount} orders` : "");
    set("rpCmpPeakHourSubB",   tPeaksB.peakHourCount > 0 ? `${tPeaksB.peakHourCount} orders` : "");
    set("rpCmpPeakDayA",       tPeaksA.peakDay);
    set("rpCmpPeakDayB",       tPeaksB.peakDay);
    set("rpCmpPeakDaySubA",    tPeaksA.peakDayCount > 0 ? `${tPeaksA.peakDayCount} orders` : "");
    set("rpCmpPeakDaySubB",    tPeaksB.peakDayCount > 0 ? `${tPeaksB.peakDayCount} orders` : "");
  }

  renderCmpStaff({ staffA, staffB }) {
    const renderList = (elId, staff) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (!staff.length) { el.innerHTML = `<p class="rp-empty">No data.</p>`; return; }
      const maxRev = staff[0].revenue;
      el.innerHTML = `<div class="rp-item-list">${staff.map((s, i) => `
        <div class="rp-item-row">
          <span class="rp-item-rank">${i + 1}</span>
          <div class="rp-item-main">
            <div class="rp-item-row-top">
              <span class="rp-item-name">${s.name}</span>
              <span class="rp-item-rev">${fmt(s.revenue)}</span>
            </div>
            <div class="rp-item-bar-track">
              <div class="rp-item-bar" style="width:${maxRev > 0 ? Math.round((s.revenue / maxRev) * 100) : 0}%"></div>
            </div>
            <span class="rp-item-qty">${s.transactions} orders</span>
          </div>
        </div>`).join("")}</div>`;
    };
    renderList("rpCmpStaffA", staffA);
    renderList("rpCmpStaffB", staffB);
  }

  async renderCmpSalesCharts({ categoryA, categoryB, itemMixA, itemMixB }) {
    const Chart = await this._ensureChart();
    const mutedColor = this._css("--muted");
    const gapColor   = this._css("--panel-strong");

    const renderDonut = (chartKey, canvasId, items) => {
      if (this._charts[chartKey]) { this._charts[chartKey].destroy(); this._charts[chartKey] = null; }
      const canvas = document.querySelector(`#${canvasId}`);
      if (!canvas) return;
      if (!items.length) {
        canvas.style.display = "none";
        let empty = canvas.parentElement.querySelector(".rp-empty");
        if (!empty) { empty = document.createElement("p"); empty.className = "rp-empty"; canvas.parentElement.appendChild(empty); }
        empty.textContent = "No data."; empty.style.display = "";
        return;
      }
      canvas.style.display = "";
      const totalValue = items.reduce((s, i) => s + i.value, 0);
      this._observeChart(canvasId, (cvs) => {
        this._charts[chartKey] = new Chart(cvs, {
          type: "doughnut",
          data: {
            labels: items.map(i => i.label),
            datasets: [{ data: items.map(i => i.value), backgroundColor: PALETTE.slice(0, items.length), borderWidth: 3, borderColor: gapColor, borderRadius: 4, hoverOffset: 10 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "65%",
            animation: this._donutAnim(),
            plugins: {
              legend: { display: true, position: "right", labels: { color: mutedColor, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10 } },
              tooltip: { callbacks: { label: (ctx) => { const pct = totalValue > 0 ? ((ctx.raw / totalValue) * 100).toFixed(1) : 0; return ` ${ctx.label}: ${fmt(ctx.raw)} (${pct}%)`; } } },
            },
          },
        });
      });
    };

    const renderItemDonut = (chartKey, canvasId, items) => {
      if (this._charts[chartKey]) { this._charts[chartKey].destroy(); this._charts[chartKey] = null; }
      const canvas = document.querySelector(`#${canvasId}`);
      if (!canvas) return;
      if (!items.length) {
        canvas.style.display = "none";
        let empty = canvas.parentElement.querySelector(".rp-empty");
        if (!empty) { empty = document.createElement("p"); empty.className = "rp-empty"; canvas.parentElement.appendChild(empty); }
        empty.textContent = "No data."; empty.style.display = "";
        return;
      }
      canvas.style.display = "";
      const top = items.slice(0, 8);
      const totalQty = top.reduce((s, i) => s + i.quantity, 0);
      this._observeChart(canvasId, (cvs) => {
        this._charts[chartKey] = new Chart(cvs, {
          type: "doughnut",
          data: {
            labels: top.map(i => i.name),
            datasets: [{ data: top.map(i => i.quantity), backgroundColor: PALETTE.slice(0, top.length), borderWidth: 3, borderColor: gapColor, borderRadius: 4, hoverOffset: 10 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "65%",
            animation: this._donutAnim(),
            plugins: {
              legend: { display: true, position: "right", labels: { color: mutedColor, boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 10 } },
              tooltip: { callbacks: { label: (ctx) => { const pct = totalQty > 0 ? ((ctx.raw / totalQty) * 100).toFixed(1) : 0; return ` ${ctx.label}: ${ctx.raw} sold (${pct}%)`; } } },
            },
          },
        });
      });
    };

    renderDonut("cmpCategoryA", "rpCmpCategoryCanvasA", categoryA);
    renderDonut("cmpCategoryB", "rpCmpCategoryCanvasB", categoryB);
    renderItemDonut("cmpItemMixA", "rpCmpItemMixCanvasA", itemMixA);
    renderItemDonut("cmpItemMixB", "rpCmpItemMixCanvasB", itemMixB);
  }

  async renderCmpTrafficCharts({ hourlyA, hourlyB, dowA, dowB, labelA, labelB }) {
    const Chart = await this._ensureChart();
    this._renderCmpGroupedBar(Chart, "cmpHourly", "rpCmpHourlyCanvas", hourlyA.labels, hourlyA.data, hourlyB.data, labelA, labelB,
      (v) => String(Math.round(v)));
    this._renderCmpGroupedBar(Chart, "cmpDow", "rpCmpDowCanvas", dowA.labels, dowA.data, dowB.data, labelA, labelB,
      (v) => String(Math.round(v)));
  }

  async renderCmpKitchenCharts({ servingA, servingB, labelA, labelB }) {
    const Chart = await this._ensureChart();
    const fmtMin = (v) => v > 0 ? `${v.toFixed(1)}m` : "0m";
    const fmtHour = (i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`;
    const fallbackHour = { labels: Array.from({ length: 24 }, (_, i) => fmtHour(i)), data: Array(24).fill(0) };
    const fallbackDay  = { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], data: Array(7).fill(0) };
    const hA = servingA?.byHour ?? fallbackHour;
    const hB = servingB?.byHour ?? fallbackHour;
    const dA = servingA?.byDay  ?? fallbackDay;
    const dB = servingB?.byDay  ?? fallbackDay;
    this._renderCmpGroupedBar(Chart, "cmpServingHour", "rpCmpServingHourCanvas",
      hA.labels, hA.data, hB.data, labelA, labelB, fmtMin);
    this._renderCmpGroupedBar(Chart, "cmpServingDay", "rpCmpServingDayCanvas",
      dA.labels, dA.data, dB.data, labelA, labelB, fmtMin);
  }

  _renderCmpGroupedBar(Chart, chartKey, canvasId, labels, dataA, dataB, labelA, labelB, yFmt) {
    if (this._charts[chartKey]) { this._charts[chartKey].destroy(); this._charts[chartKey] = null; }
    const canvas = document.querySelector(`#${canvasId}`);
    if (!canvas) return;
    const gridColor  = this._css("--line");
    const mutedColor = this._css("--muted");
    const colorA = "#22c55e", colorB = "#60a5fa";
    this._observeChart(canvasId, (cvs) => {
      this._charts[chartKey] = new Chart(cvs, {
        type: "bar",
        data: {
          labels,
          datasets: [
            { label: labelA, data: dataA, backgroundColor: this._withAlpha(colorA, 0.7), borderColor: colorA, borderWidth: 0, borderRadius: 4, borderSkipped: false },
            { label: labelB, data: dataB, backgroundColor: this._withAlpha(colorB, 0.7), borderColor: colorB, borderWidth: 0, borderRadius: 4, borderSkipped: false },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top", align: "end", labels: { color: mutedColor, boxWidth: 10, boxHeight: 10, borderRadius: 3, padding: 12, font: { size: 11 } } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${yFmt(ctx.raw)}` } },
          },
          scales: {
            x: { grid: { color: gridColor, drawTicks: false }, ticks: { color: mutedColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 } },
            y: { grid: { color: gridColor }, ticks: { color: mutedColor, callback: yFmt }, beginAtZero: true },
          },
        },
      });
    });
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

    // Format helpers for button labels
    const fmtDay = (ymd) => {
      if (!ymd) return "Pick date";
      const d = new Date(ymd + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };
    const fmtMonth = (ym) => {
      if (!ym) return "Pick month";
      const [y, m] = ym.split("-");
      return new Date(+y, +m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    };

    // Wire showPicker() for all date/month buttons
    const wirePicker = (inputId, btnId, fmtFn) => {
      const input = document.querySelector(`#${inputId}`);
      const btn   = document.querySelector(`#${btnId}`);
      if (!input || !btn) return;
      btn.addEventListener("click", () => { try { input.showPicker(); } catch (e) {} });
      input.addEventListener("change", () => { btn.textContent = fmtFn(input.value); });
    };

    wirePicker("rpCmpADay",   "rpCmpADayLabel",   fmtDay);
    wirePicker("rpCmpBDay",   "rpCmpBDayLabel",   fmtDay);
    wirePicker("rpCmpAWeek",  "rpCmpAWeekLabel",  fmtDay);
    wirePicker("rpCmpBWeek",  "rpCmpBWeekLabel",  fmtDay);
    wirePicker("rpCmpAMonth", "rpCmpAMonthLabel", fmtMonth);
    wirePicker("rpCmpBMonth", "rpCmpBMonthLabel", fmtMonth);
    wirePicker("rpCmpFromA",  "rpCmpFromALabel",  fmtDay);
    wirePicker("rpCmpToA",    "rpCmpToALabel",    fmtDay);
    wirePicker("rpCmpFromB",  "rpCmpFromBLabel",  fmtDay);
    wirePicker("rpCmpToB",    "rpCmpToBLabel",    fmtDay);

    const setLabel = (btnId, val, fmtFn) => {
      const btn = document.querySelector(`#${btnId}`);
      if (btn) btn.textContent = fmtFn(val);
    };

    const setDefaults = (type) => {
      const now = new Date();
      if (type === "day") {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        const aEl = document.querySelector("#rpCmpADay");
        const bEl = document.querySelector("#rpCmpBDay");
        if (aEl) { aEl.value = _ymd(now);       setLabel("rpCmpADayLabel", aEl.value, fmtDay); }
        if (bEl) { bEl.value = _ymd(yesterday); setLabel("rpCmpBDayLabel", bEl.value, fmtDay); }
      } else if (type === "week") {
        const day = now.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        const thisMon = new Date(now); thisMon.setDate(now.getDate() + diffToMon);
        const lastMon = new Date(thisMon); lastMon.setDate(thisMon.getDate() - 7);
        const aEl = document.querySelector("#rpCmpAWeek");
        const bEl = document.querySelector("#rpCmpBWeek");
        if (aEl) { aEl.value = _ymd(thisMon); setLabel("rpCmpAWeekLabel", aEl.value, fmtDay); }
        if (bEl) { bEl.value = _ymd(lastMon); setLabel("rpCmpBWeekLabel", bEl.value, fmtDay); }
      } else if (type === "month") {
        const aEl = document.querySelector("#rpCmpAMonth");
        const bEl = document.querySelector("#rpCmpBMonth");
        if (aEl) { aEl.value = _ym(now);                                          setLabel("rpCmpAMonthLabel", aEl.value, fmtMonth); }
        if (bEl) { bEl.value = _ym(new Date(now.getFullYear(), now.getMonth() - 1, 1)); setLabel("rpCmpBMonthLabel", bEl.value, fmtMonth); }
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
    const fromEl      = document.querySelector("#reportsFrom");
    const toEl        = document.querySelector("#reportsTo");
    const fromLabel   = document.querySelector("#reportsFromLabel");
    const toLabel     = document.querySelector("#reportsToLabel");

    const fmtDate = (ymd) => {
      if (!ymd) return "Start date";
      const d = new Date(ymd + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    };

    // Buttons trigger the native date picker
    fromLabel?.addEventListener("click", () => { try { fromEl.showPicker(); } catch (e) {} });
    toLabel?.addEventListener("click",   () => { try { toEl.showPicker();   } catch (e) {} });

    fromEl.addEventListener("change", () => {
      fromLabel.textContent = fmtDate(fromEl.value);
      if (toEl.value && toEl.value < fromEl.value) {
        toEl.value = fromEl.value;
        toLabel.textContent = fmtDate(toEl.value);
      }
      toEl.min = fromEl.value;
    });

    toEl.addEventListener("change", () => {
      toLabel.textContent = fmtDate(toEl.value);
    });

    document.querySelector("#applyReportsRangeBtn").addEventListener("click", () => {
      const from = fromEl.value;
      const to = toEl.value;
      if (!from || !to) return;
      if (to < from) { toEl.value = from; toLabel.textContent = fmtDate(toEl.value); return; }
      handler({ period: "custom", from, to });
    });
  }

  // ── Expenses ──────────────────────────────────────────────────────────────

  renderExpenseKpis({ expenses, net, avgGross = 0, avgNet = 0, avgSuffix = '', avgTooltip = '' }) {
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmt(val); };
    setVal("reportsExpenses", expenses);
    setVal("reportsNetIncome", net);
    setVal("salesNetIncome", net);
    setVal("salesAvgGross", avgGross);
    setVal("salesAvgNet", avgNet);
    const applyNetClass = (id) => {
      const el = document.getElementById(id);
      if (el) { el.classList.toggle("rp-kpi-val--positive", net >= 0); el.classList.toggle("rp-kpi-val--negative", net < 0); }
    };
    applyNetClass("reportsNetIncome");
    applyNetClass("salesNetIncome");
    const avgNetEl = document.getElementById("salesAvgNet");
    if (avgNetEl) { avgNetEl.classList.toggle("rp-kpi-val--positive", avgNet >= 0); avgNetEl.classList.toggle("rp-kpi-val--negative", avgNet < 0); }
    if (avgSuffix) {
      const glEl = document.getElementById("salesAvgGrossLabel");
      const nlEl = document.getElementById("salesAvgNetLabel");
      if (glEl) glEl.textContent = `Avg. Gross ${avgSuffix}`;
      if (nlEl) nlEl.textContent = `Avg. Net ${avgSuffix}`;
    }
    if (avgTooltip) {
      const gi = document.getElementById("salesAvgGrossInfo");
      const ni = document.getElementById("salesAvgNetInfo");
      if (gi) gi.dataset.tip = avgTooltip;
      if (ni) ni.dataset.tip = avgTooltip;
    }
  }

  renderSalesKpis({ bestSeller, topCategory, topStaff }) {
    const set = (valId, subId, val, sub) => {
      const v = document.getElementById(valId);
      const s = document.getElementById(subId);
      if (v) v.textContent = val ?? '—';
      if (s) s.textContent = sub ?? '';
    };
    set('salesBestSeller',    'salesBestSellerSub',   bestSeller?.name,    bestSeller  ? `${bestSeller.quantity} sold`  : '');
    set('salesTopCategory',   'salesTopCategorySub',  topCategory?.label,  topCategory ? fmt(topCategory.value)         : '');
    set('salesTopStaff',      'salesTopStaffSub',     topStaff?.name,      topStaff    ? fmt(topStaff.revenue)           : '');
  }

  renderTrafficKpis({ peakHour, peakDay, total, avgDaily }) {
    const hourVal = document.getElementById('trafficPeakHour');
    const hourSub = document.getElementById('trafficPeakHourSub');
    const dayVal  = document.getElementById('trafficPeakDay');
    const daySub  = document.getElementById('trafficPeakDaySub');
    const avgVal  = document.getElementById('trafficAvgDaily');
    const avgSub  = document.getElementById('trafficAvgDailySub');

    if (hourVal) hourVal.textContent = peakHour ? peakHour.label : '—';
    if (hourSub) hourSub.textContent = peakHour ? `${peakHour.count} orders` : '';
    if (dayVal)  dayVal.textContent  = peakDay  ? peakDay.label  : '—';
    if (daySub)  daySub.textContent  = peakDay  ? `${peakDay.count} orders` : '';
    if (avgVal)  avgVal.textContent  = avgDaily > 0 ? (Number.isInteger(avgDaily) ? avgDaily : avgDaily.toFixed(1)) : '—';
    if (avgSub)  avgSub.textContent  = total > 0 ? `${total} total` : '';
  }


}

export default new ReportsView();
