const state = {
  data: null,
  selectedProvinces: [],
  startDate: "",
  endDate: "",
  enabledFields: new Set(),
  charts: [],
};

const palette = {
  primaryBar: "#8bd076",
  compareBars: ["#68a7dc", "#9bd26e", "#f4ba63", "#e78383"],
  stack: ["#6ea8dc", "#f4ba63", "#79c6c2", "#b68fd8", "#f28c8f", "#9bb565", "#d3a15f"],
  line: "#5b7fcf",
  lineAlt: "#d86666",
};

const el = {
  stamp: document.getElementById("dataStamp"),
  provinceSelect: document.getElementById("provinceSelect"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  todayButton: document.getElementById("todayButton"),
  resetButton: document.getElementById("resetButton"),
  metrics: document.getElementById("metricsSection"),
  moduleLinks: Array.from(document.querySelectorAll(".module-nav a")),
  fieldGrid: document.getElementById("fieldGrid"),
  dashboard: document.getElementById("dashboardSection"),
  emptyState: document.getElementById("emptyState"),
};

function setActiveModule(sectionId) {
  el.moduleLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });
}

function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(items) {
  let weightedSum = 0;
  let weightSum = 0;
  items.forEach(({ value, weight }) => {
    const numericValue = Number(value);
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericValue) || !Number.isFinite(numericWeight) || numericWeight <= 0) return;
    weightedSum += numericValue * numericWeight;
    weightSum += numericWeight;
  });
  return weightSum ? weightedSum / weightSum : null;
}

function maximum(values) {
  const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  return valid.length ? Math.max(...valid) : null;
}

function peakValley(values) {
  const valid = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!valid.length) return null;
  return Math.max(...valid) - Math.min(...valid);
}

function sumFields(record, fields, mode) {
  return fields.reduce((sum, field) => {
    const value = record.values[`${mode}.stack.${field}`];
    return sum + (Number.isFinite(Number(value)) ? Number(value) : 0);
  }, 0);
}

function fieldKey(province, mode, role, field) {
  return `${province}|${mode}|${role}|${field}`;
}

function selectedOptions(select) {
  return Array.from(select.selectedOptions).map((option) => option.value);
}

function getProvinceRecords(provinceName) {
  const province = state.data.provinces[provinceName];
  if (!province) return [];
  return province.records.filter((record) => {
    if (state.startDate && record.date < state.startDate) return false;
    if (state.endDate && record.date > state.endDate) return false;
    return true;
  });
}

function allDates() {
  return Object.values(state.data.provinces)
    .flatMap((province) => province.dates)
    .sort();
}

function latestMonthFirstDate(dates) {
  const lastDate = dates[dates.length - 1] || "";
  if (!lastDate) return "";
  const latestMonth = lastDate.slice(0, 7);
  return dates.find((date) => date.startsWith(latestMonth)) || lastDate;
}

function initControls() {
  const provinces = Object.keys(state.data.provinces);
  const defaultProvince = provinces.includes("广东") ? "广东" : provinces[0];
  el.provinceSelect.innerHTML = provinces
    .map((province) => `<option value="${province}" ${province === defaultProvince ? "selected" : ""}>${province}</option>`)
    .join("");
  state.selectedProvinces = defaultProvince ? [defaultProvince] : [];

  const dates = allDates();
  const defaultDate = latestMonthFirstDate(dates);
  state.startDate = defaultDate;
  state.endDate = defaultDate;
  el.startDate.value = state.startDate;
  el.endDate.value = state.endDate;

  Object.entries(state.data.provinces).forEach(([provinceName, province]) => {
    ["day", "realtime"].forEach((mode) => {
      const cfg = province.mapping[mode];
      if (cfg.barPrimary) state.enabledFields.add(fieldKey(provinceName, mode, "barPrimary", cfg.barPrimary));
      if (cfg.line) state.enabledFields.add(fieldKey(provinceName, mode, "line", cfg.line));
      cfg.stackBars.forEach((field) => state.enabledFields.add(fieldKey(provinceName, mode, "stack", field)));
    });
    const compare = province.mapping.compare || {};
    [
      ["dayBarPrimary", compare.dayBarPrimary],
      ["dayBarSecondary", compare.dayBarSecondary],
      ["realtimeBarPrimary", compare.realtimeBarPrimary],
      ["realtimeBarSecondary", compare.realtimeBarSecondary],
      ["dayLine", compare.dayLine],
      ["realtimeLine", compare.realtimeLine],
    ].forEach(([role, field]) => {
      if (field) state.enabledFields.add(fieldKey(provinceName, "compare", role, field));
    });
  });
}

function bindEvents() {
  el.provinceSelect.addEventListener("change", () => {
    state.selectedProvinces = el.provinceSelect.value ? [el.provinceSelect.value] : [];
    render();
  });

  el.startDate.addEventListener("change", () => {
    state.startDate = el.startDate.value;
    if (state.endDate && state.startDate > state.endDate) {
      state.endDate = state.startDate;
      el.endDate.value = state.endDate;
    }
    render();
  });

  el.endDate.addEventListener("change", () => {
    state.endDate = el.endDate.value;
    if (state.startDate && state.endDate < state.startDate) {
      state.startDate = state.endDate;
      el.startDate.value = state.startDate;
    }
    render();
  });

  el.todayButton.addEventListener("click", () => {
    const dates = allDates();
    const lastDate = dates[dates.length - 1] || "";
    state.startDate = lastDate;
    state.endDate = lastDate;
    el.startDate.value = lastDate;
    el.endDate.value = lastDate;
    render();
  });

  el.resetButton.addEventListener("click", () => {
    const dates = allDates();
    state.startDate = dates[0] || "";
    state.endDate = dates[dates.length - 1] || "";
    el.startDate.value = state.startDate;
    el.endDate.value = state.endDate;
    render();
  });

  el.moduleLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const target = document.getElementById(link.dataset.section);
      if (!target) return;
      setActiveModule(link.dataset.section);
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveModule(visible.target.id);
      },
      { rootMargin: "-120px 0px -55% 0px", threshold: [0.1, 0.35, 0.6] }
    );
    el.moduleLinks.forEach((link) => {
      const target = document.getElementById(link.dataset.section);
      if (target) observer.observe(target);
    });
  }

  window.addEventListener("resize", () => {
    state.charts.forEach((chart) => chart.resize());
  });
}

function renderFields() {
  const pieces = [];
  state.selectedProvinces.forEach((provinceName) => {
    const province = state.data.provinces[provinceName];
    if (!province) return;
    const compare = province.mapping.compare || {};
    const compareFields = [
      ["dayBarPrimary", compare.dayBarPrimary, "对比-日前柱子1"],
      ["dayBarSecondary", compare.dayBarSecondary, "对比-日前柱子2"],
      ["realtimeBarPrimary", compare.realtimeBarPrimary, "对比-实时柱子1"],
      ["realtimeBarSecondary", compare.realtimeBarSecondary, "对比-实时柱子2"],
      ["dayLine", compare.dayLine, "对比-日前价格"],
      ["realtimeLine", compare.realtimeLine, "对比-实时价格"],
    ].filter((item) => item[1]);
    compareFields.forEach(([role, field, label]) => {
      const key = fieldKey(provinceName, "compare", role, field);
      pieces.push(`
        <label class="check" title="${provinceName} ${label} ${field}">
          <input type="checkbox" value="${key}" ${state.enabledFields.has(key) ? "checked" : ""} />
          ${provinceName}-${label}-${field}
        </label>
      `);
    });
    ["day", "realtime"].forEach((mode) => {
      const modeName = mode === "day" ? "日前" : "实时";
      const cfg = province.mapping[mode];
      const fields = [
        ["barPrimary", cfg.barPrimary],
        ...cfg.stackBars.map((field) => ["stack", field]),
        ["line", cfg.line],
      ].filter((item) => item[1]);
      fields.forEach(([role, field]) => {
        const key = fieldKey(provinceName, mode, role, field);
        pieces.push(`
          <label class="check" title="${provinceName} ${modeName} ${field}">
            <input type="checkbox" value="${key}" ${state.enabledFields.has(key) ? "checked" : ""} />
            ${provinceName}-${modeName}-${field}
          </label>
        `);
      });
    });
  });
  el.fieldGrid.innerHTML = pieces.join("");
  el.fieldGrid.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.enabledFields.add(input.value);
      else state.enabledFields.delete(input.value);
      renderBoards();
      renderMetrics();
    });
  });
}

function renderMetrics() {
  const dayLoad = [];
  const dayPriceItems = [];
  const realtimeLoad = [];
  const realtimePriceItems = [];

  state.selectedProvinces.forEach((provinceName) => {
    const province = state.data.provinces[provinceName];
    const records = getProvinceRecords(provinceName);
    if (!province) return;
    records.forEach((record) => {
      const dayLoadValue = record.values["day.barPrimary"];
      const realtimeLoadValue = record.values["realtime.barPrimary"];
      dayLoad.push(dayLoadValue);
      realtimeLoad.push(realtimeLoadValue);
      dayPriceItems.push({ value: record.values["day.line"] ?? record.values["compare.dayLine"], weight: dayLoadValue });
      realtimePriceItems.push({ value: record.values["realtime.line"] ?? record.values["compare.realtimeLine"], weight: realtimeLoadValue });
    });
  });

  const metrics = [
    ["日前负荷峰值", maximum(dayLoad), "MW"],
    ["日前加权均价", weightedAverage(dayPriceItems), "元/MW"],
    ["实时负荷峰值", maximum(realtimeLoad), "MW"],
    ["实时加权均价", weightedAverage(realtimePriceItems), "元/MW"],
    ["日前峰谷差", peakValley(dayLoad), "MW"],
    ["实时峰谷差", peakValley(realtimeLoad), "MW"],
  ];

  el.metrics.innerHTML = metrics
    .map(([title, value, unit]) => `
      <article class="metric-card">
        <div class="metric-title">${title}</div>
        <div class="metric-value">${fmtNumber(value)}</div>
        <div class="metric-unit">${unit}</div>
      </article>
    `)
    .join("");
}

function addCompareBar(series, provinceName, cfg, role, name, dataKey, records, color) {
  const field = cfg[role];
  if (!field || !state.enabledFields.has(fieldKey(provinceName, "compare", role, field))) return;
  series.push({
    name,
    type: "bar",
    data: records.map((record) => record.values[dataKey] ?? null),
    itemStyle: { color },
    barMaxWidth: 14,
  });
}

function addCompareLine(series, provinceName, cfg, role, name, dataKey, records, color) {
  const field = cfg[role];
  if (!field || !state.enabledFields.has(fieldKey(provinceName, "compare", role, field))) return;
  series.push({
    name,
    type: "line",
    yAxisIndex: 1,
    data: records.map((record) => record.values[dataKey] ?? null),
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2, color },
    itemStyle: { color },
  });
}

function buildCompareChartOption(provinceName, records) {
  const province = state.data.provinces[provinceName];
  const cfg = province.mapping.compare || {};
  const xData = records.map((record) => (state.startDate === state.endDate ? record.time : `${record.date} ${record.time}`));
  const series = [];

  addCompareBar(series, provinceName, cfg, "dayBarPrimary", `日前-${cfg.dayBarPrimary || "柱子1"}`, "compare.dayBarPrimary", records, palette.compareBars[0]);
  addCompareBar(series, provinceName, cfg, "dayBarSecondary", `日前-${cfg.dayBarSecondary || "柱子2"}`, "compare.dayBarSecondary", records, palette.compareBars[1]);
  addCompareBar(series, provinceName, cfg, "realtimeBarPrimary", `实时-${cfg.realtimeBarPrimary || "柱子1"}`, "compare.realtimeBarPrimary", records, palette.compareBars[2]);
  addCompareBar(series, provinceName, cfg, "realtimeBarSecondary", `实时-${cfg.realtimeBarSecondary || "柱子2"}`, "compare.realtimeBarSecondary", records, palette.compareBars[3]);
  addCompareLine(series, provinceName, cfg, "dayLine", `日前-${cfg.dayLine || "价格"}`, "compare.dayLine", records, palette.line);
  addCompareLine(series, provinceName, cfg, "realtimeLine", `实时-${cfg.realtimeLine || "价格"}`, "compare.realtimeLine", records, palette.lineAlt);

  return {
    animation: false,
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: {
      top: 0,
      type: "scroll",
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: "#536176", fontSize: 11 },
    },
    grid: { top: 46, left: 58, right: 58, bottom: 50 },
    xAxis: {
      type: "category",
      data: xData,
      axisLabel: { color: "#728196", fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: "#cbd8e7" } },
    },
    yAxis: [
      {
        type: "value",
        name: "MW",
        nameTextStyle: { color: "#728196" },
        axisLabel: { color: "#728196" },
        splitLine: { lineStyle: { color: "#edf2f7" } },
      },
      {
        type: "value",
        name: "元/MW",
        nameTextStyle: { color: "#728196" },
        axisLabel: { color: "#728196" },
        splitLine: { show: false },
      },
    ],
    dataZoom: records.length > 160 ? [{ type: "inside" }, { type: "slider", height: 18, bottom: 15 }] : [{ type: "inside" }],
    series,
    title: series.length
      ? undefined
      : {
          text: "日前实时边界对比暂无已勾选字段",
          left: "center",
          top: "middle",
          textStyle: { color: "#9aa8ba", fontSize: 14, fontWeight: 400 },
        },
  };
}

function buildChartOption(provinceName, mode, records) {
  const province = state.data.provinces[provinceName];
  const cfg = province.mapping[mode];
  const modeName = mode === "day" ? "日前" : "实时";
  const xData = records.map((record) => (state.startDate === state.endDate ? record.time : `${record.date} ${record.time}`));
  const series = [];

  if (cfg.barPrimary && state.enabledFields.has(fieldKey(provinceName, mode, "barPrimary", cfg.barPrimary))) {
    series.push({
      name: cfg.barPrimary,
      type: "bar",
      data: records.map((record) => record.values[`${mode}.barPrimary`] ?? null),
      itemStyle: { color: palette.primaryBar },
      barMaxWidth: 12,
    });
  }

  cfg.stackBars.forEach((field, index) => {
    if (!state.enabledFields.has(fieldKey(provinceName, mode, "stack", field))) return;
    series.push({
      name: field,
      type: "bar",
      stack: `${mode}-stack`,
      data: records.map((record) => record.values[`${mode}.stack.${field}`] ?? null),
      itemStyle: { color: palette.stack[index % palette.stack.length] },
      barMaxWidth: 12,
    });
  });

  if (cfg.line && state.enabledFields.has(fieldKey(provinceName, mode, "line", cfg.line))) {
    series.push({
      name: cfg.line,
      type: "line",
      yAxisIndex: 1,
      data: records.map((record) => record.values[`${mode}.line`] ?? null),
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: palette.line },
      itemStyle: { color: palette.line },
    });
  }

  return {
    animation: false,
    color: [palette.primaryBar, ...palette.stack, palette.line],
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    legend: {
      top: 0,
      type: "scroll",
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: "#536176", fontSize: 11 },
    },
    grid: { top: 46, left: 58, right: 58, bottom: 50 },
    xAxis: {
      type: "category",
      data: xData,
      axisLabel: { color: "#728196", fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: "#cbd8e7" } },
    },
    yAxis: [
      {
        type: "value",
        name: "MW",
        nameTextStyle: { color: "#728196" },
        axisLabel: { color: "#728196" },
        splitLine: { lineStyle: { color: "#edf2f7" } },
      },
      {
        type: "value",
        name: "元/MW",
        nameTextStyle: { color: "#728196" },
        axisLabel: { color: "#728196" },
        splitLine: { show: false },
      },
    ],
    dataZoom: records.length > 160 ? [{ type: "inside" }, { type: "slider", height: 18, bottom: 15 }] : [{ type: "inside" }],
    series,
    title: series.length
      ? undefined
      : {
          text: `${modeName}图暂无已勾选字段`,
          left: "center",
          top: "middle",
          textStyle: { color: "#9aa8ba", fontSize: 14, fontWeight: 400 },
        },
  };
}

function renderTable(provinceName, mode, records) {
  const province = state.data.provinces[provinceName];
  const fields = [];
  const cfg = province.mapping[mode];
  if (cfg.barPrimary) fields.push([cfg.barPrimary, `${mode}.barPrimary`]);
  cfg.stackBars.forEach((field) => fields.push([field, `${mode}.stack.${field}`]));
  if (cfg.line) fields.push([cfg.line, `${mode}.line`]);
  const rows = records.slice(0, 260);
  return `
    <div class="table-wrap">
      <p class="table-note">明细表展示前 ${rows.length} 条，图表使用当前筛选下全部 ${records.length} 条。</p>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>日期</th>
              <th>时刻</th>
              ${fields.map(([label]) => `<th>${label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((record) => `
                <tr>
                  <td>${record.date}</td>
                  <td>${record.time}</td>
                  ${fields.map(([, key]) => `<td>${fmtNumber(record.values[key])}</td>`).join("")}
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderBoards() {
  state.charts.forEach((chart) => chart.dispose());
  state.charts = [];
  const boards = state.selectedProvinces
    .map((provinceName) => {
      const records = getProvinceRecords(provinceName);
      if (!records.length) return "";
      const province = state.data.provinces[provinceName];
      const dateText = `${records[0].date} 至 ${records[records.length - 1].date}`;
      return `
        <article class="province-board" data-province="${provinceName}">
          <header class="province-head">
            <h2>${provinceName}</h2>
            <span>${dateText} · ${records.length} 个分时点 · 来源 ${province.files.length} 个文件</span>
          </header>
          <section class="mode-section">
            <div class="chart-row">
              <div class="chart-card">
                <div class="chart-title"><h3>日前实时边界对比</h3></div>
                <div class="chart" id="chart-${provinceName}-compare"></div>
              </div>
            </div>
          </section>
          <section class="mode-section">
            <div class="chart-row">
              <div class="chart-card">
                <div class="chart-title"><h3>日前边界信息</h3></div>
                <div class="chart" id="chart-${provinceName}-day"></div>
              </div>
            </div>
            ${renderTable(provinceName, "day", records)}
          </section>
          <section class="mode-section">
            <div class="chart-row">
              <div class="chart-card">
                <div class="chart-title"><h3>实时边界信息</h3></div>
                <div class="chart" id="chart-${provinceName}-realtime"></div>
              </div>
            </div>
            ${renderTable(provinceName, "realtime", records)}
          </section>
        </article>
      `;
    })
    .filter(Boolean);

  el.dashboard.innerHTML = boards.join("");
  el.emptyState.hidden = Boolean(boards.length);

  state.selectedProvinces.forEach((provinceName) => {
    const records = getProvinceRecords(provinceName);
    if (!records.length) return;
    const compareTarget = document.getElementById(`chart-${provinceName}-compare`);
    if (compareTarget) {
      const chart = echarts.init(compareTarget, null, { renderer: "canvas" });
      chart.setOption(buildCompareChartOption(provinceName, records), true);
      state.charts.push(chart);
    }
    ["day", "realtime"].forEach((mode) => {
      const target = document.getElementById(`chart-${provinceName}-${mode}`);
      if (!target) return;
      const chart = echarts.init(target, null, { renderer: "canvas" });
      chart.setOption(buildChartOption(provinceName, mode, records), true);
      state.charts.push(chart);
    });
  });
}

function render() {
  renderFields();
  renderMetrics();
  renderBoards();
}

async function main() {
  try {
    if (window.DASHBOARD_DATA) {
      state.data = window.DASHBOARD_DATA;
    } else {
      const response = await fetch("data/dashboard-data.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
    }
    if (!window.echarts) {
      throw new Error("图表库未加载成功，请刷新页面或检查 assets/echarts.min.js");
    }
    initControls();
    bindEvents();
    render();
  } catch (error) {
    el.stamp.textContent = "数据读取失败";
    el.emptyState.hidden = false;
    el.emptyState.textContent = `无法加载 data/dashboard-data.json：${error.message}`;
  }
}

main();
