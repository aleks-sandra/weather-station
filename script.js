var SUPABASE_URL = "https://zqrxucdiopxbeqanrspv.supabase.co";
var SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpxcnh1Y2Rpb3B4YmVxYW5yc3B2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwODA4ODcsImV4cCI6MjA5NTY1Njg4N30._dXFjAJsGO8gfO3biBl3DCS6EA4PAAt-SpA7ycT_uhY";

var chart;

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
          padding: 10,
          callbacks: {
            label: function(ctx) {
              if (ctx.datasetIndex === 0) return "  " + ctx.parsed.y.toFixed(1) + " °C";
              return "  " + ctx.parsed.y.toFixed(1) + " %";
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#444",
            font: { family: "DM Mono", size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0
          },
          grid: { color: "rgba(255,255,255,0.04)" },
          border: { color: "#2a2a2a" }
        },
        yTemp: {
          position: "left",
          ticks: {
            color: "#e8855a",
            font: { family: "DM Mono", size: 10 },
            callback: function(v) { return v.toFixed(1) + "°"; }
          },
          grid: { color: "rgba(255,255,255,0.04)" },
          border: { color: "#2a2a2a" }
        },
        yHum: {
          position: "right",
          ticks: {
            color: "#5a9fe8",
            font: { family: "DM Mono", size: 10 },
            callback: function(v) { return v.toFixed(0) + "%"; }
          },
          grid: { display: false },
          border: { color: "#2a2a2a" }
        }
      }
    }
  });
}

function formatTime(isoString) {
  var d = new Date(isoString);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(isoString) {
  var d = new Date(isoString);
  return d.toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function setStatus(ok) {
  var dot = document.getElementById("status-dot");
  var text = document.getElementById("status-text");
  dot.className = "dot " + (ok ? "connected" : "disconnected");
  text.textContent = ok ? "Данные получены" : "Ошибка загрузки";
}

async function fetchData() {
  try {
    var res = await fetch(
      SUPABASE_URL + "/rest/v1/readings?select=*&order=created_at.desc&limit=50",
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY
        }
      }
    );

    if (!res.ok) throw new Error("HTTP " + res.status);

    var rows = await res.json();
    if (!rows.length) return;

    setStatus(true);

    var latest = rows[0];
    document.getElementById("temp-value").textContent = latest.temperature.toFixed(1);
    document.getElementById("hum-value").textContent = latest.humidity.toFixed(1);
    document.getElementById("last-update").textContent = formatDateTime(latest.created_at);
    document.getElementById("count-sub").textContent = "измерений в базе: " + rows.length;

    var temps = rows.map(function(r) { return r.temperature; });
    var hums = rows.map(function(r) { return r.humidity; });

    document.getElementById("temp-minmax").textContent =
      Math.min.apply(null, temps).toFixed(1) + "° — " + Math.max.apply(null, temps).toFixed(1) + "°";
    document.getElementById("hum-minmax").textContent =
      Math.min.apply(null, hums).toFixed(1) + "% — " + Math.max.apply(null, hums).toFixed(1) + "%";

    var reversed = rows.slice().reverse();
    chart.data.labels = reversed.map(function(r) { return formatTime(r.created_at); });
    chart.data.datasets[0].data = reversed.map(function(r) { return r.temperature; });
    chart.data.datasets[1].data = reversed.map(function(r) { return r.humidity; });
    chart.update("none");

  } catch(e) {
    setStatus(false);
    console.error(e);
  }
}

function startClock() {
  setInterval(function() {
    var now = new Date();
    var t = now.getHours().toString().padStart(2, "0") + ":" +
            now.getMinutes().toString().padStart(2, "0") + ":" +
            now.getSeconds().toString().padStart(2, "0");
    document.getElementById("clock").textContent = t;
  }, 1000);
}

initChart();
startClock();
fetchData();
setInterval(fetchData, 60000);