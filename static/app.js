"use strict";

const $ = (id) => document.getElementById(id);
const keys = ["first", "second"];
const defaults = ["y = 2x + 1", "y = -x + 4"];
const examples = {
  parallel: ["y = 2x + 1", "y = 2x - 3"],
  identical: ["y = 2x + 1", "2y = 4x + 2"],
  vertical: ["x = 3", "y = -x + 4"],
};
const colors = ["#437bad", "#cd8248"];
const width = 680, height = 520;
let current = null, radius = 10, center = { x: 0, y: 0 };
let requestVersion = 0, timer;

function format(n) {
  if (n === 0) return "0";
  return Math.abs(n) >= 1e6 || Math.abs(n) < 1e-4
    ? n.toExponential(3) : String(Number(n.toPrecision(7)));
}

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function draw() {
  const graph = $("graph");
  const description = current
    ? `${$("first").value}; ${$("second").value}. ${$("result-title").textContent}. ${$("result-detail").textContent}`
    : "Enter two valid line equations to display their graph.";
  graph.replaceChildren(svg("title", { id: "graph-title" }, "Two-line coordinate graph"),
    svg("desc", { id: "graph-description" }, description));
  const yr = radius * height / width;
  const bounds = { left: center.x - radius, right: center.x + radius,
    bottom: center.y - yr, top: center.y + yr };
  const px = (x) => (x - bounds.left) / (2 * radius) * width;
  const py = (y) => (bounds.top - y) / (2 * yr) * height;
  const base = 10 ** Math.floor(Math.log10(radius / 5));
  const step = [1, 2, 5, 10].map((n) => n * base).find((n) => n >= radius / 5);
  for (let i = Math.ceil(bounds.left / step); i <= Math.floor(bounds.right / step); i++) {
    const x = i * step, pos = px(x);
    graph.append(svg("line", { x1: pos, y1: 0, x2: pos, y2: height, stroke: "#e7ebe1" }));
    if (i !== 0) graph.append(svg("text", { x: pos + 4, y: Math.max(18, Math.min(height - 8, py(0) + 17)),
      fill: "#929e91", "font-size": 10 }, format(x)));
  }
  for (let i = Math.ceil(bounds.bottom / step); i <= Math.floor(bounds.top / step); i++) {
    const y = i * step, pos = py(y);
    graph.append(svg("line", { x1: 0, y1: pos, x2: width, y2: pos, stroke: "#e7ebe1" }));
    if (i !== 0) graph.append(svg("text", { x: Math.max(5, Math.min(width - 60, px(0) + 7)), y: pos - 5,
      fill: "#929e91", "font-size": 10 }, format(y)));
  }
  if (bounds.bottom <= 0 && bounds.top >= 0) {
    graph.append(svg("line", { x1: 0, y1: py(0), x2: width, y2: py(0), stroke: "#b3c0af" }));
    graph.append(svg("text", { x: width - 14, y: py(0) - 8, fill: "#72836f", "font-size": 12 }, "x"));
  }
  if (bounds.left <= 0 && bounds.right >= 0) {
    graph.append(svg("line", { x1: px(0), y1: 0, x2: px(0), y2: height, stroke: "#b3c0af" }));
    graph.append(svg("text", { x: px(0) + 8, y: 16, fill: "#72836f", "font-size": 12 }, "y"));
  }
  if (!current) return;
  current.lines.forEach((line, index) => {
    const points = [];
    const add = (x, y) => {
      const epsilon = radius * 1e-8;
      if (Number.isFinite(x) && Number.isFinite(y) && x >= bounds.left - epsilon
        && x <= bounds.right + epsilon && y >= bounds.bottom - epsilon && y <= bounds.top + epsilon
        && !points.some((p) => Math.hypot(p.x - x, p.y - y) < epsilon)) points.push({ x, y });
    };
    if (line.b !== 0) {
      for (const x of [bounds.left, bounds.right]) add(x, (line.c - line.a * x) / line.b);
    }
    if (line.a !== 0) {
      for (const y of [bounds.bottom, bounds.top]) add((line.c - line.b * y) / line.a, y);
    }
    if (points.length >= 2) graph.append(svg("line", {
      x1: px(points[0].x), y1: py(points[0].y), x2: px(points[1].x), y2: py(points[1].y),
      stroke: colors[index], "stroke-width": 2.5,
      "stroke-dasharray": current.result.kind === "identical" && index === 1 ? "9 7" : "none",
    }));
  });
  const p = current.result.point;
  if (p && p.x >= bounds.left && p.x <= bounds.right && p.y >= bounds.bottom && p.y <= bounds.top) {
    const x = px(p.x), y = py(p.y);
    graph.append(svg("circle", { cx: x, cy: y, r: 12, fill: "#234c40", opacity: .1 }),
      svg("circle", { cx: x, cy: y, r: 5, fill: "#234c40", stroke: "white", "stroke-width": 2 }));
    const label = svg("text", { x: Math.max(12, Math.min(width - 150, x + 15)),
      y: Math.max(20, y - 15), fill: "#234c40", "font-size": 13,
      "font-weight": 650, stroke: "#fdfefb", "stroke-width": 4, "paint-order": "stroke" },
    `(${format(p.x)}, ${format(p.y)})`);
    graph.append(label);
  }
}

function fit() {
  if (!current) return;
  const points = [{ x: 0, y: 0 }];
  for (const l of current.lines) {
    if (l.a) points.push({ x: l.c / l.a, y: 0 });
    if (l.b) points.push({ x: 0, y: l.c / l.b });
  }
  if (current.result.point) points.push(current.result.point);
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  center = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  radius = Math.max(3, (Math.max(...xs) - Math.min(...xs)) * .7,
    (Math.max(...ys) - Math.min(...ys)) * .7 * width / height);
  draw();
}

function renderSliders() {
  keys.forEach((key, index) => {
    const container = $(`${key}-sliders`);
    container.replaceChildren();
    const line = current.lines[index];
    const parameters = line.vertical ? [line.x] : [line.slope, line.intercept];
    if (parameters.some((value) => Math.abs(value) > 1e12)) {
      const hint = document.createElement("p");
      hint.className = "error";
      hint.textContent = "Edit this equation directly; its parameters exceed the slider range.";
      container.append(hint);
      return;
    }
    const controls = line.vertical ? [["x", "Position x", line.x]]
      : [["slope", "Slope m", line.slope], ["intercept", "Intercept b", line.intercept]];
    for (const [name, title, value] of controls) {
      const id = `${key}-${name}`;
      const label = document.createElement("label");
      label.htmlFor = id;
      label.append(document.createTextNode(title));
      const output = document.createElement("output");
      output.htmlFor = id;
      output.textContent = format(value);
      label.append(output);
      const input = document.createElement("input");
      input.type = "range";
      input.id = id;
      const extent = Math.max(10, Math.ceil(Math.abs(value)));
      input.min = -extent;
      input.max = extent;
      input.step = "any";
      input.value = value;
      input.addEventListener("input", () => {
        const decimal = (value) => Number(Number(value).toFixed(12));
        const changed = decimal(input.value);
        output.textContent = format(changed);
        // Read the other control so repeated edits do not restore stale values.
        const m = name === "slope" ? changed : decimal($(`${key}-slope`)?.value);
        const b = name === "intercept" ? changed : decimal($(`${key}-intercept`)?.value);
        $(key).value = line.vertical ? `x = ${changed}` : `y = ${m} * x + (${b})`;
        schedule(false);
      });
      // Preserve the focused slider so consecutive keyboard steps keep working.
      input.addEventListener("change", () => compare(false));
      container.append(label, input);
    }
  });
}

async function compare(rebuildSliders = true, autoFit = false) {
  clearTimeout(timer);
  const version = ++requestVersion;
  try {
    const response = await fetch("/api/compare", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ first: $("first").value, second: $("second").value }) });
    const data = await response.json();
    if (version !== requestVersion) return;
    keys.forEach((key) => {
      $(`${key}-error`).textContent = data.errors?.[key] || "";
      $(key).setAttribute("aria-invalid", String(Boolean(data.errors?.[key])));
    });
    if (!response.ok) {
      current = null;
      keys.forEach((key) => $(`${key}-sliders`).replaceChildren());
      $("result-label").textContent = "CHECK YOUR EQUATIONS";
      $("result-title").textContent = "Let’s get those lines ready.";
      $("result-detail").textContent = data.error || "Correct the highlighted equation to plot both lines.";
      draw();
      return;
    }
    current = data;
    const result = data.result;
    if (result.kind === "intersection") {
      $("result-label").textContent = "ONE SHARED POINT";
      $("result-title").textContent = `They meet at (${format(result.point.x)}, ${format(result.point.y)})`;
      $("result-detail").textContent = `Exact solution: x = ${result.exact.x}, y = ${result.exact.y}. This point satisfies both equations. Use Fit lines if it is outside the view.`;
    } else {
      const same = result.kind === "identical";
      $("result-label").textContent = same ? "INFINITELY MANY SOLUTIONS" : "NO SHARED POINT";
      $("result-title").textContent = same ? "Two equations. The same line." : "These lines are parallel.";
      $("result-detail").textContent = same ? "Every point on one line is also on the other. The dashed line overlaps the solid line."
        : "They have the same direction and different positions, so they never meet.";
    }
    if (rebuildSliders) renderSliders();
    if (autoFit) fit(); else draw();
  } catch (error) {
    if (version !== requestVersion) return;
    current = null;
    keys.forEach((key) => $(`${key}-sliders`).replaceChildren());
    $("result-label").textContent = "CONNECTION INTERRUPTED";
    $("result-title").textContent = "Can’t reach the calculator.";
    $("result-detail").textContent = "Check that the Python app is running, then press Plot equations to retry.";
    draw();
  }
}

function schedule(rebuildSliders = true) {
  ++requestVersion; // Invalidate in-flight responses immediately, before the debounce.
  clearTimeout(timer);
  timer = setTimeout(() => compare(rebuildSliders), 120);
}
$("equations").addEventListener("submit", (event) => { event.preventDefault(); compare(); });
keys.forEach((key) => $(key).addEventListener("input", () => {
  // A slider must never silently overwrite a newly typed, unvalidated equation.
  keys.forEach((name) => $(`${name}-sliders`).replaceChildren());
  schedule();
}));
$("reset").addEventListener("click", () => {
  keys.forEach((key, i) => { $(key).value = defaults[i]; });
  center = { x: 0, y: 0 }; radius = 10; compare();
});
document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => {
  keys.forEach((key, i) => { $(key).value = examples[button.dataset.example][i]; });
  compare(true, true);
}));
$("zoom-in").addEventListener("click", () => { radius = Math.max(1e-6, radius / 1.5); draw(); });
$("zoom-out").addEventListener("click", () => { radius = Math.min(1e30, radius * 1.5); draw(); });
$("fit").addEventListener("click", fit);
compare();
