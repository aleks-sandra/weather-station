var SUPABASE_URL = "https://zqrxucdiopxbeqanrspv.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxcnh1Y2Rpb3B4YmVxYW5yc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODA4ODcsImV4cCI6MjA5NTY1Njg4N30._dXFjAJsGO8gfO3biBl3DCS6EA4PAAt-SpA7ycT_uhY";

var chart;
var chartMode = "100"; // "100" or "24h"

// ── helpers ───────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce(function(s, v) { return s + v; }, 0) / arr.length;
}

function fmt(val, unit) {
  if (val === null) return "—";
  return val.toFixed(1) + " " + unit;
}

function formatTime(iso) {
  var d = new Date(iso);
  return d.getHours().toString().padStart(2, "0") + ":" +
         d.getMinutes().toString().padStart(2, "0");
}

function formatDateTime(iso) {
  var d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) +
         " " + formatTime(iso);
}

function localDateStr(d) {
  return d.getFullYear() + "-" +
         String(d.getMonth() + 1).padStart(2, "0") + "-" +
         String(d.getDate()).padStart(2, "0");
}

function splitPeriods(rows) {
  var night = [], morning = [], afternoon = [], evening = [];
  rows.forEach(function(r) {
    var h = new Date(r.created_at).getHours();
    if      (h < 6)  night.push(r);
    else if (h < 12) morning.push(r);
    else if (h < 18) afternoon.push(r);
    else             evening.push(r);
  });
  return { night: night, morning: morning, afternoon: afternoon, evening: evening };
}

function renderPeriods(prefix, rows) {
  var p = splitPeriods(rows);
  var periods = ["night", "morning", "afternoon", "evening"];
  periods.forEach(function(name) {
    var temps = p[name].map(function(r) { return r.temperature; });
    var hums  = p[name].map(function(r) { return r.humidity; });
    document.getElementById(prefix + "-" + name + "-temp").textContent = fmt(avg(temps), "°C");
    document.getElementById(prefix + "-" + name + "-hum").textContent  = fmt(avg(hums),  "%");
  });
  var allTemps = rows.map(function(r) { return r.temperature; });
  var allHums  = rows.map(function(r) { return r.humidity; });
  document.getElementById(prefix + "-avg-temp").textContent = fmt(avg(allTemps), "°C");
  document.getElementById(prefix + "-avg-hum").textContent  = fmt(avg(allHums),  "%");
}

// ── Supabase fetch helpers ─────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    "apikey": SUPABASE_KEY,
    "Authorization": "Bearer " + SUPABASE_KEY
  };
}

async function fetchDay(dateStr) {
  var start = new Date(dateStr + "T00:00:00");
  var end   = new Date(dateStr + "T23:59:59");
  var url = SUPABASE_URL + "/rest/v1/readings?select=*" +
            "&created_at=gte." + start.toISOString() +
            "&created_at=lte." + end.toISOString() +
            "&order=created_at.asc&limit=10000";
  var res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

// ── Status dot ────────────────────────────────────────────────────────────────

function setStatus(ok) {
  var dot  = document.getElementById("status-dot");
  var text = document.getElementById("status-text");
  dot.className    = "dot " + (ok ? "connected" : "disconnected");
  text.textContent = ok ? "Данные получены" : "Ошибка загрузки";
}

// ── Chart ──────────────────────────────────────────────────────────────────────

function initChart() {
  var ctx = document.getElementById("chart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Температура",
          data: [],
          borderColor: "#e8855a",
          backgroundColor: "rgba(232,133,90,0.06)",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          yAxisID: "yTemp"
        },
        {
          label: "Влажность",
          data: [],
          borderColor: "#5a9fe8",
          backgroundColor: "rgba(90,159,232,0.06)",
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
          fill: true,
          yAxisID: "yHum"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e1e1e",
          borderColor: "#2a2a2a",
          borderWidth: 1,
          titleColor: "#666",
          bodyColor: "#e8e8e0",
          titleFont: { family: "DM Mono", size: 11 },
          bodyFont: { family: "DM Mono", size: 12 },
          callbacks: {
            label: function(ctx) {
              var unit = ctx.datasetIndex === 0 ? " °C" : " %";
              return " " + ctx.parsed.y.toFixed(1) + unit;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#555", font: { family: "DM Mono", size: 10 }, maxTicksLimit: 8 },
          grid:  { color: "#1e1e1e" }
        },
        yTemp: {
          position: "left",
          ticks: { color: "#e8855a", font: { family: "DM Mono", size: 10 } },
          grid:  { color: "#1e1e1e" }
        },
        yHum: {
          position: "right",
          ticks: { color: "#5a9fe8", font: { family: "DM Mono", size: 10 } },
          grid:  { display: false }
        }
      }
    }
  });
}

// ── Main data fetch ────────────────────────────────────────────────────────────

async function fetchData() {
  try {
    var chartUrl;
    if (chartMode === "24h") {
      var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      chartUrl = SUPABASE_URL + "/rest/v1/readings?select=*&created_at=gte." + since +
                 "&order=created_at.asc&limit=10000";
    } else {
      chartUrl = SUPABASE_URL + "/rest/v1/readings?select=*&order=created_at.desc&limit=100";
    }

    var res = await fetch(chartUrl, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var rows = await res.json();
    if (!rows.length) return;

    setStatus(true);

    // Count total
    var countRes = await fetch(
      SUPABASE_URL + "/rest/v1/readings?select=count",
      { headers: Object.assign({}, supabaseHeaders(), { "Prefer": "count=exact" }) }
    );
    var total = "?";
    if (countRes.ok) {
      var cr = countRes.headers.get("content-range");
      if (cr) total = cr.split("/")[1];
    }

    // Latest reading
    var latest = chartMode === "24h" ? rows[rows.length - 1] : rows[0];
    document.getElementById("temp-value").textContent  = latest.temperature.toFixed(1);
    document.getElementById("hum-value").textContent   = latest.humidity.toFixed(1);
    document.getElementById("last-update").textContent = formatDateTime(latest.created_at);
    document.getElementById("count-sub").textContent   = "измерений в базе: " + total;

    var temps = rows.map(function(r) { return r.temperature; });
    var hums  = rows.map(function(r) { return r.humidity; });
    document.getElementById("temp-minmax").textContent =
      Math.min.apply(null, temps).toFixed(1) + "° — " + Math.max.apply(null, temps).toFixed(1) + "°";
    document.getElementById("hum-minmax").textContent =
      Math.min.apply(null, hums).toFixed(1) + "% — " + Math.max.apply(null, hums).toFixed(1) + "%";

    // Chart — 24h already asc, 100 mode needs reverse
    var chartRows = chartMode === "24h" ? rows : rows.slice().reverse();
    chart.data.labels           = chartRows.map(function(r) { return formatTime(r.created_at); });
    chart.data.datasets[0].data = chartRows.map(function(r) { return r.temperature; });
    chart.data.datasets[1].data = chartRows.map(function(r) { return r.humidity; });
    chart.update("none");

  } catch(e) {
    setStatus(false);
    console.error(e);
  }
}

// ── Stats: today & yesterday ──────────────────────────────────────────────────

async function fetchStats() {
  var today     = localDateStr(new Date());
  var yd        = new Date(); yd.setDate(yd.getDate() - 1);
  var yesterday = localDateStr(yd);

  try {
    var todayRows = await fetchDay(today);
    renderPeriods("today", todayRows);
  } catch(e) { console.error("today stats:", e); }

  try {
    var ydRows = await fetchDay(yesterday);
    renderPeriods("yesterday", ydRows);
  } catch(e) { console.error("yesterday stats:", e); }
}

// ── Date picker ───────────────────────────────────────────────────────────────

var picker = document.getElementById("date-picker");
picker.value = localDateStr(new Date());
picker.min = "2026-05-30";

picker.addEventListener("change", async function() {
  if (!picker.value) return;
  try {
    var rows = await fetchDay(picker.value);
    renderPeriods("pick", rows);
  } catch(e) {
    console.error("pick stats:", e);
  }
});

// ── Chart mode toggle ─────────────────────────────────────────────────────────

document.querySelectorAll(".chart-mode-btn").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".chart-mode-btn").forEach(function(b) { b.classList.remove("active"); });
    btn.classList.add("active");
    chartMode = btn.dataset.mode;
    fetchData();
  });
});

// ── Tabs ──────────────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn[data-tab]").forEach(function(btn) {
  btn.addEventListener("click", function() {
    document.querySelectorAll(".tab-btn[data-tab]").forEach(function(b) { b.classList.remove("active"); });
    document.querySelectorAll(".tab-content").forEach(function(c) { c.classList.add("hidden"); });
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.remove("hidden");
  });
});

// ── Clock ─────────────────────────────────────────────────────────────────────

function startClock() {
  setInterval(function() {
    var now = new Date();
    document.getElementById("clock").textContent =
      now.getHours().toString().padStart(2, "0") + ":" +
      now.getMinutes().toString().padStart(2, "0");
  }, 1000);
}

// ── Init ──────────────────────────────────────────────────────────────────────

initChart();
startClock();
fetchData();
fetchStats();
setInterval(fetchData, 90000);
setInterval(fetchStats, 90000);
