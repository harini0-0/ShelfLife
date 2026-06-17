/* global Chart */

// Self-contained rendering for the Insights dashboard charts (saved-vs-lost
// bar, waste map, items-by-category donut). Each chart fetches or receives its
// own data and manages its own Chart.js instance.

// Must match the label the shelf table uses for items without a category.
const UNCATEGORIZED_LABEL = "Uncategorized";

const CATEGORY_CHART_COLORS = [
  "#16a34a",
  "#0ea5e9",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
  "#a3a3a3",
];

let categoryChart = null;
let wasteMapChart = null;
let savingsBarChart = null;

function getCategoryCounts(items) {
  const counts = new Map();

  items.forEach((food) => {
    const category = food.category || UNCATEGORIZED_LABEL;
    counts.set(category, (counts.get(category) || 0) + 1);
  });

  return counts;
}

export function renderCategoryChart(items) {
  const canvas = document.getElementById("category-chart");
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const counts = getCategoryCounts(items);
  const labels = [...counts.keys()];
  const data = [...counts.values()];
  const emptyNote = document.getElementById("category-chart-empty");

  if (labels.length === 0) {
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    canvas.classList.add("d-none");
    emptyNote?.classList.remove("d-none");
    return;
  }

  canvas.classList.remove("d-none");
  emptyNote?.classList.add("d-none");

  const colors = labels.map(
    (_, index) => CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length]
  );

  if (categoryChart) {
    categoryChart.data.labels = labels;
    categoryChart.data.datasets[0].data = data;
    categoryChart.data.datasets[0].backgroundColor = colors;
    categoryChart.update();
    return;
  }

  categoryChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 12 } },
        },
      },
    },
  });
}

function renderSavingsBar(stats) {
  const canvas = document.getElementById("savings-bar-chart");
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const saved = Number(stats.totalSaved) || 0;
  const lost = Number(stats.totalLost) || 0;

  if (savingsBarChart) {
    savingsBarChart.data.datasets[0].data = [saved];
    savingsBarChart.data.datasets[1].data = [lost];
    savingsBarChart.update();
    return;
  }

  savingsBarChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels: ["All time"],
      datasets: [
        { label: "Saved", data: [saved], backgroundColor: "#16a34a" },
        { label: "Lost", data: [lost], backgroundColor: "#ef4444" },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { callback: (value) => `$${value}` },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: $${Number(ctx.raw).toFixed(2)}`,
          },
        },
      },
    },
  });
}

export async function refreshSavingsChart() {
  try {
    const response = await fetch("/api/history/stats");
    if (!response.ok) {
      throw new Error("failed to load stats");
    }
    const stats = await response.json();
    renderSavingsBar(stats);
  } catch (error) {
    console.error("Failed to load shelf stats:", error);
  }
}

function getWasteMapRadius(wastedCount, maxWasted) {
  const MIN_RADIUS = 6;
  const MAX_RADIUS = 34;

  if (!maxWasted) {
    return MIN_RADIUS;
  }

  return MIN_RADIUS + (wastedCount / maxWasted) * (MAX_RADIUS - MIN_RADIUS);
}

function renderWasteMap(categories) {
  const canvas = document.getElementById("waste-map-chart");
  if (!canvas || typeof Chart === "undefined") {
    return;
  }

  const emptyNote = document.getElementById("waste-map-empty");

  if (!categories.length) {
    if (wasteMapChart) {
      wasteMapChart.destroy();
      wasteMapChart = null;
    }
    canvas.classList.add("d-none");
    emptyNote?.classList.remove("d-none");
    return;
  }

  canvas.classList.remove("d-none");
  emptyNote?.classList.add("d-none");

  const maxWasted = categories.reduce(
    (max, item) => Math.max(max, item.wastedCount),
    0
  );

  const datasets = categories.map((item, index) => {
    const color = CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length];

    return {
      label: item.category,
      backgroundColor: `${color}cc`,
      borderColor: color,
      borderWidth: 1,
      data: [
        {
          x: item.costLost,
          y: item.wasteRate,
          r: getWasteMapRadius(item.wastedCount, maxWasted),
          costLost: item.costLost,
          wasteRate: item.wasteRate,
          wastedCount: item.wastedCount,
          totalCount: item.totalCount,
        },
      ],
    };
  });

  if (wasteMapChart) {
    wasteMapChart.data.datasets = datasets;
    wasteMapChart.update();
    return;
  }

  wasteMapChart = new Chart(canvas, {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: { display: true, text: "Cost lost to spoilage ($)" },
          beginAtZero: true,
          ticks: { callback: (value) => `$${value}` },
        },
        y: {
          title: { display: true, text: "Waste rate (%)" },
          min: 0,
          max: 100,
          ticks: { callback: (value) => `${value}%` },
        },
      },
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const point = ctx.raw;
              return `${ctx.dataset.label}: ${point.wasteRate}% wasted · $${point.costLost.toFixed(
                2
              )} lost (${point.wastedCount}/${point.totalCount} items)`;
            },
          },
        },
      },
    },
  });
}

export async function refreshWasteMap() {
  try {
    const response = await fetch("/api/history/by-category");
    if (!response.ok) {
      throw new Error("failed to load waste map");
    }
    const categories = await response.json();
    renderWasteMap(categories);
  } catch (error) {
    console.error("Failed to load waste map:", error);
  }
}
