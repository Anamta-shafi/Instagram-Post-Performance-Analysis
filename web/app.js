/* Instagram Performance Analytics — interactive dashboard (vanilla JS + SVG) */
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const D = window.IG;
  if (!D) return;

  const MONTHS = D.months, MEDIA = D.media, CATS = D.category, TRAFFIC = D.traffic,
        ACCTS = D.account, DOW = D.dow, BUCKETS = D.bucket;

  const DATA = D.rows.map(r => ({
    m: r[0], media: MEDIA[r[1]], cat: CATS[r[2]], traffic: TRAFFIC[r[3]], acct: ACCTS[r[4]],
    cta: r[5], hour: r[6], dow: DOW[r[7]], likes: r[8], comments: r[9], shares: r[10],
    saves: r[11], reach: r[12], impressions: r[13], er: r[14], gained: r[15],
    caption: r[16], tags: r[17], bucket: BUCKETS[r[18]], date: r[19]
  }));

  const PALETTE = ["#ff4d8d", "#8b5cf6", "#22d3ee", "#f59e0b", "#34d399", "#f472b6",
                   "#60a5fa", "#a78bfa", "#fbbf24", "#2dd4bf"];
  const BUCKET_COLORS = { low: "#64748b", medium: "#60a5fa", high: "#f59e0b", viral: "#ff4d8d" };
  const MEDIA_COLORS = { reel: "#ff4d8d", image: "#22d3ee", carousel: "#8b5cf6" };
  const CATEGORY_COLORS = {
    Beauty: "#fbbf24", Comedy: "#2dd4bf", Fashion: "#ff4d8d", Fitness: "#f472b6",
    Food: "#34d399", Lifestyle: "#f59e0b", Music: "#60a5fa", Photography: "#8b5cf6",
    Technology: "#22d3ee", Travel: "#a78bfa"
  };
  const TRAFFIC_COLORS = {
    "Hashtags": "#ff4d8d", "Home Feed": "#8b5cf6", "Reels Feed": "#22d3ee",
    "External": "#f59e0b", "Profile": "#34d399", "Explore": "#60a5fa"
  };
  const DOW_COLORS = {
    Monday: "#ff4d8d", Tuesday: "#8b5cf6", Wednesday: "#22d3ee", Thursday: "#f59e0b",
    Friday: "#34d399", Saturday: "#f472b6", Sunday: "#60a5fa"
  };

  const state = {
    from: 0, to: MONTHS.length - 1,
    media: new Set(MEDIA), cat: "All", traffic: "All", account: "All", bucket: "All", cta: "all",
    search: ""
  };

  const $ = id => document.getElementById(id);
  const fmtInt = n => Math.round(n).toLocaleString("en-US");
  const fmtCompact = n => {
    n = Math.round(n);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return String(n);
  };
  const fmtPct = v => (v * 100).toFixed(2) + "%";
  const fmtPct1 = v => (v * 100).toFixed(1) + "%";
  const monthLabel = i => {
    const [y, m] = MONTHS[i].split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
  };
  const monthShort = i => {
    const [y, m] = MONTHS[i].split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- filtering ----------
  function filtered() {
    const out = [];
    for (const d of DATA) {
      if (d.m < state.from || d.m > state.to) continue;
      if (!state.media.has(d.media)) continue;
      if (state.cat !== "All" && d.cat !== state.cat) continue;
      if (state.traffic !== "All" && d.traffic !== state.traffic) continue;
      if (state.account !== "All" && d.acct !== state.account) continue;
      if (state.bucket !== "All" && d.bucket !== state.bucket) continue;
      if (state.cta !== "all" && String(d.cta) !== state.cta) continue;
      out.push(d);
    }
    return out;
  }

  function agg(rows) {
    const a = { n: 0, er: 0, reach: 0, impressions: 0, interactions: 0, gained: 0,
                likes: 0, comments: 0, shares: 0, saves: 0, followers: 0 };
    for (const d of rows) {
      a.n++; a.er += d.er; a.reach += d.reach; a.impressions += d.impressions;
      a.interactions += d.likes + d.comments + d.shares + d.saves;
      a.gained += d.gained; a.likes += d.likes; a.comments += d.comments;
      a.shares += d.shares; a.saves += d.saves; a.followers += 0;
    }
    a.avgEr = a.n ? a.er / a.n : 0;
    a.avgReach = a.n ? a.reach / a.n : 0;
    a.avgGained = a.n ? a.gained / a.n : 0;
    return a;
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    for (const d of rows) {
      const k = keyFn(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(d);
    }
    return map;
  }

  // ---------- tooltip ----------
  const tip = $("tooltip");
  document.addEventListener("mouseover", e => {
    const t = e.target.closest("[data-tip]");
    if (t) { tip.innerHTML = t.getAttribute("data-tip"); tip.style.opacity = "1"; }
  });
  document.addEventListener("mousemove", e => {
    if (tip.style.opacity === "1") {
      tip.style.left = e.clientX + "px";
      tip.style.top = e.clientY + "px";
    }
  });
  document.addEventListener("mouseout", e => {
    if (e.target.closest("[data-tip]")) tip.style.opacity = "0";
  });

  // ---------- SVG helpers ----------
  const svgEl = (tag, attrs = {}) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };
  const mkSvg = (w, h, el) => {
    el.innerHTML = "";
    const svg = svgEl("svg", { viewBox: `0 0 ${w} ${h}`, width: "100%", height: h,
                               preserveAspectRatio: "xMidYMid meet", role: "img" });
    el.appendChild(svg);
    return svg;
  };
  const empty = el => { el.innerHTML = '<div class="hint" style="padding:24px;text-align:center">No posts match the current filters.</div>'; };

  function lineChart(el, pts, opt = {}) {
    const vals = pts.map(p => p.value).filter(v => v != null && isFinite(v));
    if (!vals.length) return empty(el);
    const W = 780, H = opt.height || 250, P = { l: 50, r: 16, t: 18, b: 32 };
    const svg = mkSvg(W, H, el);
    const min = Math.min(...vals), max = Math.max(...vals);
    const pad = (max - min) * 0.28 || Math.max(max * 0.12, 0.0008);
    const y0 = Math.max(0, min - pad), y1 = max + pad;
    const X = i => P.l + (pts.length === 1 ? (W - P.l - P.r) / 2 : i * (W - P.l - P.r) / (pts.length - 1));
    const Y = v => H - P.b - ((v - y0) / (y1 - y0)) * (H - P.t - P.b);
    const color = opt.color || "#ff4d8d";
    const stops = opt.gradient && opt.gradient.length > 1 ? opt.gradient : [color, color];
    const gid = "a" + Math.random().toString(36).slice(2, 8);
    const lid = "l" + Math.random().toString(36).slice(2, 8);

    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse",
                                          x1: 0, y1: P.t, x2: 0, y2: H - P.b });
    grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": stops[0], "stop-opacity": .34 }));
    grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": stops[stops.length - 1], "stop-opacity": .02 }));
    const lineGrad = svgEl("linearGradient", { id: lid, gradientUnits: "userSpaceOnUse",
                                              x1: P.l, y1: 0, x2: W - P.r, y2: 0 });
    stops.forEach((c, i) => {
      lineGrad.appendChild(svgEl("stop", { offset: `${(i / (stops.length - 1)) * 100}%`, "stop-color": c }));
    });
    defs.appendChild(grad); defs.appendChild(lineGrad); svg.appendChild(defs);

    for (let t = 0; t <= 4; t++) {
      const v = y0 + (y1 - y0) * t / 4, y = Y(v);
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
      const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
      tx.textContent = (opt.pct === false ? fmtCompact(v) : fmtPct1(v));
      svg.appendChild(tx);
    }

    const segs = [];
    let cur = [];
    pts.forEach((p, i) => {
      if (p.value == null || !isFinite(p.value)) { if (cur.length) segs.push(cur); cur = []; }
      else cur.push({ x: X(i), y: Y(p.value), p, i });
    });
    if (cur.length) segs.push(cur);

    for (const seg of segs) {
      if (seg.length > 1) {
        const d = seg.map((q, i) => (i ? "L" : "M") + q.x.toFixed(1) + " " + q.y.toFixed(1)).join(" ");
        const area = d + ` L ${seg[seg.length - 1].x.toFixed(1)} ${H - P.b} L ${seg[0].x.toFixed(1)} ${H - P.b} Z`;
        svg.appendChild(svgEl("path", { d: area, fill: `url(#${gid})` }));
        svg.appendChild(svgEl("path", { d, fill: "none", stroke: `url(#${lid})`, "stroke-width": 2.8,
                                        "stroke-linejoin": "round", "stroke-linecap": "round" }));
      }
      for (const q of seg) {
        const c = svgEl("circle", { cx: q.x, cy: q.y, r: 3.8, fill: `url(#${lid})`, stroke: "#0b1222", "stroke-width": 1.6 });
        c.style.cursor = "crosshair";
        c.setAttribute("data-tip", `<b>${esc(q.p.label)}</b><br><span class="muted">${esc(opt.label || "Value")}:</span> ${opt.fmt ? opt.fmt(q.p.value) : fmtPct(q.p.value)}${q.p.meta ? "<br>" + q.p.meta : ""}`);
        svg.appendChild(c);
      }
    }

    const step = Math.ceil(pts.length / 8);
    pts.forEach((p, i) => {
      if (i % step !== 0 && i !== pts.length - 1) return;
      const tx = svgEl("text", { x: X(i), y: H - 8, "text-anchor": "middle", class: "axis-label" });
      tx.textContent = p.label;
      svg.appendChild(tx);
    });
  }

  function barChart(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const horizontal = opt.horizontal !== false;
    const max = Math.max(...items.map(i => i.value), 1e-9);
    const fmt = opt.fmt || fmtPct1;
    if (horizontal) {
      const W = 780, rowH = 34, P = { l: opt.labelWidth || 150, r: 72, t: 10, b: 10 };
      const H = items.length * rowH + P.t + P.b;
      const svg = mkSvg(W, H, el);
      const x0 = P.l, x1 = W - P.r;
      items.forEach((it, i) => {
        const y = P.t + i * rowH + 8;
        const bw = Math.max(2, (it.value / max) * (x1 - x0));
        const color = opt.colorFn ? opt.colorFn(i, it) : PALETTE[i % PALETTE.length];
        const lbl = svgEl("text", { x: x0 - 10, y: y + 12, "text-anchor": "end", class: "axis-label" });
        lbl.textContent = it.label; lbl.style.fill = "#b9c7df"; lbl.style.fontSize = "11px";
        svg.appendChild(lbl);
        const bg = svgEl("rect", { x: x0, y: y, width: x1 - x0, height: 17, rx: 8, fill: "rgba(126,150,190,.09)" });
        svg.appendChild(bg);
        const bar = svgEl("rect", { x: x0, y: y, width: bw, height: 17, rx: 8, fill: color, class: "bar" + (opt.onClick ? " clickable" : "") });
        if (opt.onClick) bar.addEventListener("click", () => opt.onClick(it));
        bar.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">${esc(opt.label || "Avg engagement")}:</span> ${fmt(it.value)}${it.meta ? "<br>" + it.meta : ""}`);
        svg.appendChild(bar);
        const val = svgEl("text", { x: x0 + bw + 8, y: y + 12, class: "axis-label" });
        val.textContent = fmt(it.value); val.style.fill = "#e8eefb"; val.style.fontSize = "11px";
        svg.appendChild(val);
      });
    } else {
      const W = 780, H = opt.height || 250, P = { l: 44, r: 14, t: 14, b: 38 };
      const svg = mkSvg(W, H, el);
      const plotW = W - P.l - P.r;
      const bw = Math.min(46, plotW / items.length * 0.62);
      const maxV = max * 1.12;
      for (let t = 0; t <= 4; t++) {
        const y = H - P.b - (t / 4) * (H - P.t - P.b);
        svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
        const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
        tx.textContent = fmtPct1(maxV * t / 4); svg.appendChild(tx);
      }
      items.forEach((it, i) => {
        const cx = P.l + (i + .5) * plotW / items.length;
        const h = Math.max(2, (it.value / maxV) * (H - P.t - P.b));
        const color = opt.colorFn ? opt.colorFn(i, it) : PALETTE[i % PALETTE.length];
        const bar = svgEl("rect", { x: cx - bw / 2, y: H - P.b - h, width: bw, height: h, rx: 6, fill: color, class: "bar" + (opt.onClick ? " clickable" : "") });
        if (opt.onClick) bar.addEventListener("click", () => opt.onClick(it));
        bar.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">${esc(opt.label || "Avg engagement")}:</span> ${fmt(it.value)}${it.meta ? "<br>" + it.meta : ""}`);
        svg.appendChild(bar);
        const val = svgEl("text", { x: cx, y: H - P.b - h - 6, "text-anchor": "middle", class: "axis-label" });
        val.textContent = fmt(it.value); val.style.fill = "#e8eefb"; val.style.fontSize = "10px";
        svg.appendChild(val);
        const lbl = svgEl("text", { x: cx, y: H - 12, "text-anchor": "middle", class: "axis-label" });
        lbl.textContent = it.label; svg.appendChild(lbl);
      });
    }
  }

  function dotPlot(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const horizontal = opt.horizontal !== false;
    const fmt = opt.fmt || fmtPct;
    const vals = items.map(i => i.value);
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const pad = (vmax - vmin) * 0.55 || Math.max(vmax * 0.01, 0.0001);
    const d0 = Math.max(0, vmin - pad), d1 = vmax + pad;

    if (horizontal) {
      const W = 780, rowH = 30, P = { l: 150, r: 94, t: 28, b: 46 };
      const H = items.length * rowH + P.t + P.b;
      const svg = mkSvg(W, H, el);
      const X = v => P.l + (v - d0) / (d1 - d0 || 1) * (W - P.l - P.r);
      for (let t = 0; t <= 4; t++) {
        const x = P.l + t / 4 * (W - P.l - P.r);
        svg.appendChild(svgEl("line", { x1: x, x2: x, y1: P.t - 4, y2: H - P.b, class: "grid-line", opacity: .65 }));
        const tx = svgEl("text", { x, y: H - 16, "text-anchor": "middle", class: "axis-label" });
        tx.textContent = fmtPct1(d0 + (d1 - d0) * t / 4); tx.style.fontSize = "11px"; svg.appendChild(tx);
      }
      if (opt.avg != null) {
        const x = X(opt.avg);
        svg.appendChild(svgEl("line", { x1: x, x2: x, y1: P.t - 8, y2: H - P.b, stroke: "#e8eefb",
                                        "stroke-width": 1.2, "stroke-dasharray": "4 4", opacity: .5 }));
        const t = svgEl("text", { x: x, y: 15, "text-anchor": "middle", class: "axis-label" });
        t.textContent = "avg " + fmtPct1(opt.avg); t.style.fill = "#e8eefb"; t.style.fontSize = "11px";
        svg.appendChild(t);
      }
      items.forEach((it, i) => {
        const y = P.t + i * rowH + rowH / 2;
        const color = opt.colorFn ? opt.colorFn(i, it) : PALETTE[i % PALETTE.length];
        const lbl = svgEl("text", { x: P.l - 12, y: y + 4.5, "text-anchor": "end", class: "axis-label" });
        lbl.textContent = it.label; lbl.style.fill = "#c8d5ea"; lbl.style.fontSize = "12px";
        svg.appendChild(lbl);
        svg.appendChild(svgEl("line", { x1: P.l, x2: X(it.value), y1: y, y2: y, stroke: color,
                                        "stroke-width": 1.6, opacity: .4 }));
        const dot = svgEl("circle", { cx: X(it.value), cy: y, r: 6.8, fill: color, stroke: "#0b1222",
                                      "stroke-width": 1.6, class: "bar" + (opt.onClick ? " clickable" : "") });
        if (opt.onClick) dot.addEventListener("click", () => opt.onClick(it));
        dot.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmt(it.value)}<br><span class="muted">Posts:</span> ${fmtInt(it.n || 0)}${opt.avg != null ? `<br><span class="muted">vs overall:</span> ${it.value >= opt.avg ? "+" : ""}${((it.value - opt.avg) * 100).toFixed(2)} pp` : ""}`);
        svg.appendChild(dot);
        const vt = svgEl("text", { x: X(it.value) + 12, y: y + 4.5, class: "axis-label" });
        vt.textContent = fmt(it.value); vt.style.fill = "#e8eefb"; vt.style.fontSize = "11.5px";
        svg.appendChild(vt);
      });
    } else {
      const W = 780, H = 380, P = { l: 52, r: 18, t: 34, b: 52 };
      const svg = mkSvg(W, H, el);
      const Y = v => H - P.b - (v - d0) / (d1 - d0 || 1) * (H - P.t - P.b);
      for (let t = 0; t <= 4; t++) {
        const y = H - P.b - t / 4 * (H - P.t - P.b);
        svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
        const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
        tx.textContent = fmtPct1(d0 + (d1 - d0) * t / 4); tx.style.fontSize = "11px"; svg.appendChild(tx);
      }
      if (opt.avg != null) {
        const y = Y(opt.avg);
        svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, stroke: "#e8eefb",
                                        "stroke-width": 1.2, "stroke-dasharray": "4 4", opacity: .45 }));
        const t = svgEl("text", { x: W - P.r, y: y - 6, "text-anchor": "end", class: "axis-label" });
        t.textContent = "avg " + fmtPct1(opt.avg); t.style.fill = "#e8eefb"; t.style.fontSize = "11px";
        svg.appendChild(t);
      }
      const step = (W - P.l - P.r) / Math.max(items.length, 1);
      const pts = items.map((it, i) => ({ x: P.l + step * (i + .5), y: Y(it.value), it, i }));
      if (pts.length > 1) {
        svg.appendChild(svgEl("path", {
          d: pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" "),
          fill: "none", stroke: "rgba(185,199,223,.32)", "stroke-width": 1.6
        }));
      }
      pts.forEach(p => {
        const color = opt.colorFn ? opt.colorFn(p.i, p.it) : PALETTE[p.i % PALETTE.length];
        const dot = svgEl("circle", { cx: p.x, cy: p.y, r: 7.2, fill: color, stroke: "#0b1222",
                                      "stroke-width": 1.6, class: "bar" + (opt.onClick ? " clickable" : "") });
        if (opt.onClick) dot.addEventListener("click", () => opt.onClick(p.it));
        dot.setAttribute("data-tip", `<b>${esc(p.it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmt(p.it.value)}<br><span class="muted">Posts:</span> ${fmtInt(p.it.n || 0)}${opt.avg != null ? `<br><span class="muted">vs overall:</span> ${p.it.value >= opt.avg ? "+" : ""}${((p.it.value - opt.avg) * 100).toFixed(2)} pp` : ""}`);
        svg.appendChild(dot);
        const vt = svgEl("text", { x: p.x, y: p.y - 12, "text-anchor": "middle", class: "axis-label" });
        vt.textContent = fmt(p.it.value); vt.style.fill = "#e8eefb"; vt.style.fontSize = "11px";
        svg.appendChild(vt);
        const lbl = svgEl("text", { x: p.x, y: H - 20, "text-anchor": "middle", class: "axis-label" });
        lbl.textContent = p.it.label; lbl.style.fill = "#c8d5ea"; lbl.style.fontSize = "12px";
        svg.appendChild(lbl);
      });
    }
  }

  function donutChart(el, items, opt = {}) {
    const total = items.reduce((s, i) => s + i.value, 0);
    if (!total) return empty(el);
    const W = 430, H = 250;
    const svg = mkSvg(W, H, el);
    const cx = 118, cy = 122, r = 82, ir = 52;
    let a = -Math.PI / 2;
    const arcs = [];
    items.forEach((it, idx) => {
      const ang = (it.value / total) * Math.PI * 2;
      const a0 = a, a1 = a + ang;
      const large = ang > Math.PI ? 1 : 0;
      const p = (rad, angle) => [cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)];
      const [x0, y0] = p(r, a0), [x1, y1] = p(r, a1);
      const [x2, y2] = p(ir, a1), [x3, y3] = p(ir, a0);
      const color = opt.colorFn ? opt.colorFn(it, idx) : PALETTE[idx % PALETTE.length];
      const path = svgEl("path", {
        d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`,
        fill: color, stroke: "#0b1222", "stroke-width": 2, class: "bar" + (opt.onClick ? " clickable" : "")
      });
      path.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Posts:</span> ${fmtInt(it.value)} (${(it.value / total * 100).toFixed(1)}%)${it.extra ? "<br>" + it.extra : ""}`);
      if (opt.onClick) path.addEventListener("click", () => opt.onClick(it));
      svg.appendChild(path);
      arcs.push({ it, color });
      a = a1;
    });
    const c1 = svgEl("text", { x: cx, y: cy - 6, "text-anchor": "middle" });
    c1.textContent = opt.centerValue || fmtCompact(total);
    c1.style.fill = "#fff"; c1.style.fontSize = "21px"; c1.style.fontWeight = "700";
    svg.appendChild(c1);
    const c2 = svgEl("text", { x: cx, y: cy + 14, "text-anchor": "middle", class: "axis-label" });
    c2.textContent = opt.centerLabel || "posts"; svg.appendChild(c2);

    arcs.forEach((ar, i) => {
      const y = 58 + i * 34;
      svg.appendChild(svgEl("circle", { cx: 240, cy: y - 4, r: 5, fill: ar.color }));
      const t1 = svgEl("text", { x: 254, y: y, class: "axis-label" });
      t1.textContent = ar.it.label; t1.style.fill = "#dbe4f5"; t1.style.fontSize = "11.5px";
      svg.appendChild(t1);
      const t2 = svgEl("text", { x: 420, y: y, "text-anchor": "end", class: "axis-label" });
      t2.textContent = (ar.it.value / total * 100).toFixed(1) + "%"; t2.style.fill = "#fff"; t2.style.fontSize = "11.5px";
      svg.appendChild(t2);
    });
  }

  function scatterChart(el, pts) {
    if (!pts.length) return empty(el);
    const W = 780, H = 340, P = { l: 58, r: 24, t: 18, b: 42 };
    const svg = mkSvg(W, H, el);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const x0 = Math.min(...xs) * 0.96, x1 = Math.max(...xs) * 1.04;
    const y0 = Math.min(...ys) * 0.92, y1 = Math.max(...ys) * 1.06;
    const X = v => P.l + (v - x0) / (x1 - x0 || 1) * (W - P.l - P.r);
    const Y = v => H - P.b - (v - y0) / (y1 - y0 || 1) * (H - P.t - P.b);
    for (let t = 0; t <= 4; t++) {
      const y = H - P.b - t / 4 * (H - P.t - P.b);
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
      const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
      tx.textContent = fmtPct1(y0 + (y1 - y0) * t / 4); svg.appendChild(tx);
    }
    for (let t = 0; t <= 4; t++) {
      const x = P.l + t / 4 * (W - P.l - P.r);
      svg.appendChild(svgEl("line", { x1: x, x2: x, y1: P.t, y2: H - P.b, class: "grid-line", opacity: .5 }));
      const tx = svgEl("text", { x, y: H - 18, "text-anchor": "middle", class: "axis-label" });
      tx.textContent = fmtCompact(x0 + (x1 - x0) * t / 4); svg.appendChild(tx);
    }
    const maxN = Math.max(...pts.map(p => p.n));
    const cx0 = pts.reduce((s, p) => s + X(p.x), 0) / pts.length;
    const cy0 = pts.reduce((s, p) => s + Y(p.y), 0) / pts.length;
    pts.forEach((p, i) => {
      const rad = 5 + 12 * Math.sqrt(p.n / maxN);
      const color = PALETTE[i % PALETTE.length];
      const px = X(p.x), py = Y(p.y);
      const c = svgEl("circle", { cx: px, cy: py, r: rad, fill: color, "fill-opacity": .26,
                                  stroke: color, "stroke-width": 2, class: "bar" });
      c.setAttribute("data-tip", `<b>${esc(p.label)}</b><br><span class="muted">Avg reach:</span> ${fmtInt(p.x)}<br><span class="muted">Avg engagement:</span> ${fmtPct(p.y)}<br><span class="muted">Posts:</span> ${fmtInt(p.n)}`);
      svg.appendChild(c);
      let ang = Math.atan2(py - cy0, px - cx0);
      if (!isFinite(ang) || (Math.abs(px - cx0) < 1 && Math.abs(py - cy0) < 1)) ang = -Math.PI / 2 + i * 0.7;
      const off = rad + 10 + (i % 3) * 8;
      const lx = Math.max(P.l + 4, Math.min(W - P.r - 4, px + Math.cos(ang) * off));
      const ly = Math.max(P.t + 8, Math.min(H - P.b - 6, py + Math.sin(ang) * off));
      const anchor = Math.cos(ang) > .25 ? "start" : Math.cos(ang) < -.25 ? "end" : "middle";
      const t = svgEl("text", { x: lx, y: ly, "text-anchor": anchor, class: "axis-label" });
      t.textContent = p.label; t.style.fill = "#c8d5ea"; t.style.fontSize = "9.5px";
      t.style.paintOrder = "stroke"; t.style.stroke = "#0b1222"; t.style.strokeWidth = "3px";
      t.style.strokeLinejoin = "round";
      svg.appendChild(t);
    });
    const ax = svgEl("text", { x: W / 2, y: H - 2, "text-anchor": "middle", class: "axis-label" });
    ax.textContent = "Average reach per post"; svg.appendChild(ax);
    const ay = svgEl("text", { x: 14, y: H / 2, "text-anchor": "middle", transform: `rotate(-90 14 ${H / 2})`, class: "axis-label" });
    ay.textContent = "Average engagement rate"; svg.appendChild(ay);
  }

  function groupedBars(el, groups, series, opt = {}) {
    const W = 780, H = 280, P = { l: 46, r: 16, t: 36, b: 42 };
    const svg = mkSvg(W, H, el);
    const max = Math.max(...groups.flatMap(g => series.map(s => s.get(g) || 0)), 1e-9) * 1.15;
    for (let t = 0; t <= 4; t++) {
      const y = H - P.b - t / 4 * (H - P.t - P.b);
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
      const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
      tx.textContent = fmtPct1(max * t / 4); svg.appendChild(tx);
    }
    const plotW = W - P.l - P.r;
    const gw = plotW / groups.length;
    const bw = Math.min(26, gw / (series.length + 1));
    groups.forEach((g, gi) => {
      const base = P.l + gi * gw + (gw - bw * series.length) / 2;
      series.forEach((s, si) => {
        const v = s.get(g) || 0;
        const h = Math.max(1, v / max * (H - P.t - P.b));
        const rect = svgEl("rect", { x: base + si * bw, y: H - P.b - h, width: bw - 2, height: h, rx: 4, fill: s.color, class: "bar" });
        rect.setAttribute("data-tip", `<b>${esc(g)} · ${esc(s.label)}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(v)}`);
        svg.appendChild(rect);
      });
      const lbl = svgEl("text", { x: P.l + gi * gw + gw / 2, y: H - 16, "text-anchor": "middle", class: "axis-label" });
      lbl.textContent = g; lbl.style.fill = "#b9c7df"; lbl.style.fontSize = "11px";
      svg.appendChild(lbl);
    });
    series.forEach((s, i) => {
      const x = P.l + i * 104;
      svg.appendChild(svgEl("rect", { x, y: 10, width: 10, height: 10, rx: 3, fill: s.color }));
      const t = svgEl("text", { x: x + 16, y: 19, class: "axis-label" });
      t.textContent = s.label; t.style.fill = "#b9c7df"; t.style.fontSize = "10.5px";
      svg.appendChild(t);
    });
  }

  function treemapLayout(items, x, y, w, h, out) {
    if (!items.length || w <= 0 || h <= 0) return;
    if (items.length === 1) { out.push({ item: items[0], x, y, w, h }); return; }
    const total = items.reduce((s, it) => s + it.value, 0) || 1;
    let acc = 0, split = 1;
    for (let i = 0; i < items.length - 1; i++) {
      acc += items[i].value;
      if (acc >= total / 2) { split = i + 1; break; }
    }
    split = Math.max(1, Math.min(items.length - 1, split));
    const a = items.slice(0, split), b = items.slice(split);
    const frac = a.reduce((s, it) => s + it.value, 0) / total;
    if (w >= h) {
      const aw = w * frac;
      treemapLayout(a, x, y, aw, h, out);
      treemapLayout(b, x + aw, y, w - aw, h, out);
    } else {
      const ah = h * frac;
      treemapLayout(a, x, y, w, ah, out);
      treemapLayout(b, x, y + ah, w, h - ah, out);
    }
  }

  function treemapChart(el, items, opt = {}) {
    const valid = items.filter(i => i.value > 0);
    if (!valid.length) return empty(el);
    const W = 780, H = opt.height || 300;
    const svg = mkSvg(W, H, el);
    const total = valid.reduce((s, i) => s + i.value, 0);
    const sorted = valid.slice().sort((a, b) => b.value - a.value);
    const rects = [];
    treemapLayout(sorted, 0, 0, W, H, rects);
    rects.forEach((r, idx) => {
      const pad = 2.5;
      const x = r.x + pad, y = r.y + pad, w = Math.max(0, r.w - pad * 2), h = Math.max(0, r.h - pad * 2);
      if (w < 3 || h < 3) return;
      const it = r.item;
      const color = it.color || PALETTE[idx % PALETTE.length];
      const pct = total ? it.value / total : 0;
      const rect = svgEl("rect", { x, y, width: w, height: h, rx: 7, fill: color,
                                   "fill-opacity": .86, stroke: "#0b1222", "stroke-width": 1.5, class: "bar" });
      rect.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">${esc(opt.label || "Reach")}:</span> ${fmtCompact(it.value)}<br><span class="muted">Share:</span> ${(pct * 100).toFixed(1)}%`);
      svg.appendChild(rect);
      if (w > 64 && h > 40) {
        const t1 = svgEl("text", { x: x + 9, y: y + 19, class: "axis-label" });
        t1.textContent = it.label; t1.style.fill = "#fff"; t1.style.fontSize = "11.5px"; t1.style.fontWeight = "700";
        svg.appendChild(t1);
        const t2 = svgEl("text", { x: x + 9, y: y + 34, class: "axis-label" });
        t2.textContent = fmtCompact(it.value) + " · " + (pct * 100).toFixed(1) + "%";
        t2.style.fill = "rgba(255,255,255,.78)"; t2.style.fontSize = "10px";
        svg.appendChild(t2);
      }
    });
  }

  function comboChart(el, cats, bars, line, opt = {}) {
    const barVals = bars.filter(v => v != null && isFinite(v));
    const lineVals = line.filter(v => v != null && isFinite(v));
    if (!cats.length || (!barVals.length && !lineVals.length)) return empty(el);
    const W = 780, H = opt.height || 300, P = { l: 52, r: 56, t: 30, b: 44 };
    const svg = mkSvg(W, H, el);
    const barMax = Math.max(...barVals, 1) * 1.15;
    const lmin = lineVals.length ? Math.min(...lineVals) : 0;
    const lmax = lineVals.length ? Math.max(...lineVals) : 1;
    const lpad = (lmax - lmin) * 0.3 || Math.max(lmax * 0.1, 0.001);
    const ly0 = Math.max(0, lmin - lpad), ly1 = lmax + lpad;
    const plotW = W - P.l - P.r;
    const BX = i => P.l + (i + .5) * plotW / cats.length;
    const LX = i => P.l + (cats.length === 1 ? plotW / 2 : i * plotW / (cats.length - 1));
    const YB = v => H - P.b - (v / barMax) * (H - P.t - P.b);
    const YL = v => H - P.b - ((v - ly0) / (ly1 - ly0 || 1)) * (H - P.t - P.b);
    const gid = "c" + Math.random().toString(36).slice(2, 8);
    const defs = svgEl("defs");
    const grad = svgEl("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse",
                                          x1: 0, y1: P.t, x2: 0, y2: H - P.b });
    grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": "#8b5cf6" }));
    grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": "#22d3ee" }));
    defs.appendChild(grad); svg.appendChild(defs);
    for (let t = 0; t <= 4; t++) {
      const y = H - P.b - t / 4 * (H - P.t - P.b);
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
      const l = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
      l.textContent = fmtCompact(barMax * t / 4); svg.appendChild(l);
      const r = svgEl("text", { x: W - P.r + 8, y: y + 3, class: "axis-label" });
      r.textContent = fmtPct1(ly0 + (ly1 - ly0) * t / 4); r.style.fill = "#fbbf24"; svg.appendChild(r);
    }
    const bw = Math.min(32, plotW / cats.length * 0.58);
    cats.forEach((c, i) => {
      const v = bars[i];
      if (v == null || !isFinite(v)) return;
      const h = Math.max(1, H - P.b - YB(v));
      const rect = svgEl("rect", { x: BX(i) - bw / 2, y: YB(v), width: bw, height: h, rx: 5,
                                   fill: `url(#${gid})`, class: "bar" });
      rect.setAttribute("data-tip", `<b>${esc(c)}</b><br><span class="muted">Posts:</span> ${fmtInt(v)}${line[i] != null ? `<br><span class="muted">Avg engagement:</span> ${fmtPct(line[i])}` : ""}`);
      svg.appendChild(rect);
    });
    const pts = [];
    line.forEach((v, i) => { if (v != null && isFinite(v)) pts.push({ x: LX(i), y: YL(v), i, v }); });
    if (pts.length > 1) {
      svg.appendChild(svgEl("path", {
        d: pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" "),
        fill: "none", stroke: "#fbbf24", "stroke-width": 2.6, "stroke-linejoin": "round", "stroke-linecap": "round"
      }));
    }
    pts.forEach(p => {
      const c = svgEl("circle", { cx: p.x, cy: p.y, r: 4, fill: "#fbbf24", stroke: "#0b1222", "stroke-width": 1.6 });
      c.setAttribute("data-tip", `<b>${esc(cats[p.i])}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(p.v)}<br><span class="muted">Posts:</span> ${fmtInt(bars[p.i] || 0)}`);
      svg.appendChild(c);
    });
    const step = Math.ceil(cats.length / 9);
    cats.forEach((c, i) => {
      if (i % step !== 0 && i !== cats.length - 1) return;
      const t = svgEl("text", { x: BX(i), y: H - 14, "text-anchor": "middle", class: "axis-label" });
      t.textContent = c; svg.appendChild(t);
    });
    svg.appendChild(svgEl("rect", { x: P.l, y: 9, width: 10, height: 10, rx: 3, fill: "#8b5cf6" }));
    const lt = svgEl("text", { x: P.l + 16, y: 18, class: "axis-label" });
    lt.textContent = opt.barLabel || "Posts"; lt.style.fill = "#b9c7df"; lt.style.fontSize = "10.5px";
    svg.appendChild(lt);
    svg.appendChild(svgEl("rect", { x: P.l + 78, y: 13, width: 14, height: 3, rx: 2, fill: "#fbbf24" }));
    const lt2 = svgEl("text", { x: P.l + 98, y: 18, class: "axis-label" });
    lt2.textContent = opt.lineLabel || "Avg engagement"; lt2.style.fill = "#b9c7df"; lt2.style.fontSize = "10.5px";
    svg.appendChild(lt2);
  }

  function funnelChart(el, items, opt = {}) {
    const valid = items.filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    if (!valid.length) return empty(el);
    const W = 780, H = opt.height || 300, P = { l: 20, r: 20, t: 22, b: 16 };
    const svg = mkSvg(W, H, el);
    const max = valid[0].value || 1;
    const cx = W / 2;
    const segH = (H - P.t - P.b) / valid.length;
    const maxW = W * 0.66;
    valid.forEach((it, i) => {
      const wTop = Math.max(40, (it.value / max) * maxW);
      const next = valid[i + 1];
      const wBot = next ? Math.max(40, (next.value / max) * maxW) : wTop * 0.5;
      const y0 = P.t + i * segH;
      const y1 = y0 + segH - 3;
      const poly = svgEl("polygon", {
        points: [cx - wTop / 2, y0, cx + wTop / 2, y0, cx + wBot / 2, y1, cx - wBot / 2, y1].join(" "),
        fill: it.color || PALETTE[i % PALETTE.length], "fill-opacity": .9,
        stroke: "#0b1222", "stroke-width": 1.5, class: "bar"
      });
      poly.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Total:</span> ${fmtCompact(it.value)}<br><span class="muted">vs previous step:</span> ${i === 0 ? "—" : (it.value / valid[i - 1].value * 100).toFixed(1) + "%"}`);
      svg.appendChild(poly);
      const t1 = svgEl("text", { x: cx, y: y0 + segH / 2 - 3, "text-anchor": "middle", class: "axis-label" });
      t1.textContent = it.label; t1.style.fill = "#fff"; t1.style.fontSize = "12px"; t1.style.fontWeight = "700";
      svg.appendChild(t1);
      const t2 = svgEl("text", { x: cx, y: y0 + segH / 2 + 13, "text-anchor": "middle", class: "axis-label" });
      t2.textContent = fmtCompact(it.value); t2.style.fill = "rgba(255,255,255,.82)"; t2.style.fontSize = "10.5px";
      svg.appendChild(t2);
    });
  }

  function stackedBars(el, groups, series, opt = {}) {
    if (!groups.length) return empty(el);
    const W = 780, rowH = 46, P = { l: 110, r: 22, t: 42, b: 14 };
    const H = groups.length * rowH + P.t + P.b;
    const svg = mkSvg(W, H, el);
    const x0 = P.l, x1 = W - P.r, plotW = x1 - x0;
    series.forEach((s, i) => {
      const lx = P.l + i * 132;
      svg.appendChild(svgEl("rect", { x: lx, y: 10, width: 10, height: 10, rx: 3, fill: s.color }));
      const t = svgEl("text", { x: lx + 16, y: 19, class: "axis-label" });
      t.textContent = s.label; t.style.fill = "#b9c7df"; t.style.fontSize = "10.5px";
      svg.appendChild(t);
    });
    groups.forEach((g, gi) => {
      const y = P.t + gi * rowH + 10;
      const total = series.reduce((s, se) => s + (se.get(g) || 0), 0) || 1;
      const lbl = svgEl("text", { x: x0 - 12, y: y + 14, "text-anchor": "end", class: "axis-label" });
      lbl.textContent = g; lbl.style.fill = "#c8d5ea"; lbl.style.fontSize = "12px";
      svg.appendChild(lbl);
      let acc = 0;
      series.forEach(se => {
        const v = se.get(g) || 0;
        const w = plotW * v / total;
        if (w < 0.5) return;
        const rect = svgEl("rect", { x: x0 + acc, y, width: Math.max(0, w), height: 22, rx: 4,
                                     fill: se.color, class: "bar" });
        rect.setAttribute("data-tip", `<b>${esc(g)} · ${esc(se.label)}</b><br><span class="muted">Count:</span> ${fmtCompact(v)}<br><span class="muted">Share:</span> ${(v / total * 100).toFixed(1)}%`);
        svg.appendChild(rect);
        if (w > 46) {
          const t = svgEl("text", { x: x0 + acc + w / 2, y: y + 15, "text-anchor": "middle", class: "axis-label" });
          t.textContent = Math.round(v / total * 100) + "%"; t.style.fill = "#0b1222"; t.style.fontSize = "9.5px"; t.style.fontWeight = "700";
          svg.appendChild(t);
        }
        acc += w;
      });
    });
  }

  const polarPoint = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const arcPath = (cx, cy, r, a0, a1) => {
    const [x0, y0] = polarPoint(cx, cy, r, a0);
    const [x1, y1] = polarPoint(cx, cy, r, a1);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };

  function radialGauges(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const W = 780, H = 300;
    const svg = mkSvg(W, H, el);
    const cx = 220, cy = 150, maxR = 120, minR = 54;
    const n = items.length;
    const step = n > 1 ? (maxR - minR) / (n - 1) : 0;
    const max = Math.max(...items.map(i => i.value), 1e-9);
    const a0 = -Math.PI / 2;
    const sw = Math.min(18, Math.max(11, step * 0.58));
    const best = items.reduce((b, it) => (it.value > b.value ? it : b), items[0]);

    items.forEach((it, i) => {
      const r = maxR - i * step;
      const color = it.color || PALETTE[i % PALETTE.length];
      svg.appendChild(svgEl("circle", { cx, cy, r, fill: "none",
        stroke: "rgba(126,150,190,.14)", "stroke-width": sw }));
      const frac = Math.max(0.03, Math.min(0.999, it.value / max));
      const path = svgEl("path", { d: arcPath(cx, cy, r, a0, a0 + frac * Math.PI * 2),
        fill: "none", stroke: color, "stroke-width": sw, "stroke-linecap": "round",
        class: "bar" + (opt.onClick ? " clickable" : "") });
      path.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(it.value)}<br><span class="muted">Posts:</span> ${fmtInt(it.n || 0)}`);
      if (opt.onClick) path.addEventListener("click", () => opt.onClick(it));
      svg.appendChild(path);
    });

    const c1 = svgEl("text", { x: cx, y: cy - 10, "text-anchor": "middle", class: "axis-label" });
    c1.textContent = opt.centerLabel || "BEST";
    c1.style.fill = "#8ea1c2"; c1.style.fontSize = "9px"; c1.style.letterSpacing = "1.5px";
    svg.appendChild(c1);
    const c2 = svgEl("text", { x: cx, y: cy + 10, "text-anchor": "middle" });
    c2.textContent = best.label; c2.style.fill = "#fff"; c2.style.fontSize = "16px"; c2.style.fontWeight = "750";
    svg.appendChild(c2);
    const c3 = svgEl("text", { x: cx, y: cy + 28, "text-anchor": "middle", class: "axis-label" });
    c3.textContent = fmtPct(best.value); c3.style.fill = best.color || "#ff4d8d"; c3.style.fontSize = "12px";
    svg.appendChild(c3);

    items.forEach((it, i) => {
      const x = 438, y = 76 + i * 50;
      const color = it.color || PALETTE[i % PALETTE.length];
      svg.appendChild(svgEl("circle", { cx: x + 6, cy: y - 4, r: 6, fill: color }));
      const l1 = svgEl("text", { x: x + 22, y: y + 1, class: "axis-label" });
      l1.textContent = it.label; l1.style.fill = "#dbe4f5"; l1.style.fontSize = "13px"; l1.style.fontWeight = "600";
      svg.appendChild(l1);
      const l2 = svgEl("text", { x: x + 22, y: y + 18, class: "axis-label" });
      l2.textContent = `${fmtInt(it.n || 0)} posts`; l2.style.fill = "#8ea1c2"; l2.style.fontSize = "10px";
      svg.appendChild(l2);
      const v = svgEl("text", { x: W - 14, y: y + 3, "text-anchor": "end" });
      v.textContent = fmtPct(it.value); v.style.fill = color; v.style.fontSize = "15px"; v.style.fontWeight = "750";
      svg.appendChild(v);
      if (opt.onClick) {
        const hit = svgEl("rect", { x: 430, y: y - 22, width: W - 444, height: 42, fill: "transparent", class: "clickable" });
        hit.addEventListener("click", () => opt.onClick(it));
        svg.appendChild(hit);
      }
    });
  }

  function rankedBars(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const sorted = items.slice().sort((a, b) => b.value - a.value);
    const W = 780, rowH = 34, P = { l: 14, r: 86, t: 12, b: 12 };
    const H = sorted.length * rowH + P.t + P.b;
    const svg = mkSvg(W, H, el);
    const max = Math.max(...sorted.map(i => i.value), 1e-9);
    const x0 = 190, x1 = W - P.r;
    const rankColors = ["#fbbf24", "#cbd5e1", "#f59e0b"];
    sorted.forEach((it, i) => {
      const y = P.t + i * rowH + 7;
      const color = it.color || PALETTE[i % PALETTE.length];
      const rc = rankColors[i] || "rgba(126,150,190,.45)";
      svg.appendChild(svgEl("circle", { cx: P.l + 12, cy: y + 10, r: 11, fill: rc, "fill-opacity": i < 3 ? .95 : .5 }));
      const rk = svgEl("text", { x: P.l + 12, y: y + 14, "text-anchor": "middle" });
      rk.textContent = i + 1; rk.style.fill = i < 3 ? "#0b1222" : "#dbe4f5"; rk.style.fontSize = "10.5px"; rk.style.fontWeight = "800";
      svg.appendChild(rk);
      const lbl = svgEl("text", { x: P.l + 32, y: y + 14, class: "axis-label" });
      lbl.textContent = it.label; lbl.style.fill = "#dbe4f5"; lbl.style.fontSize = "12.5px"; lbl.style.fontWeight = "600";
      svg.appendChild(lbl);
      svg.appendChild(svgEl("rect", { x: x0, y, width: x1 - x0, height: 20, rx: 10, fill: "rgba(126,150,190,.08)" }));
      const gid = "rb" + Math.random().toString(36).slice(2, 8);
      const defs = svgEl("defs");
      const grad = svgEl("linearGradient", { id: gid, x1: "0%", y1: "0%", x2: "100%", y2: "0%" });
      grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": .98 }));
      grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": .42 }));
      defs.appendChild(grad); svg.appendChild(defs);
      const bw = Math.max(6, (it.value / max) * (x1 - x0));
      const bar = svgEl("rect", { x: x0, y, width: bw, height: 20, rx: 10,
        fill: `url(#${gid})`, class: "bar" + (opt.onClick ? " clickable" : "") });
      bar.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(it.value)}<br><span class="muted">Posts:</span> ${fmtInt(it.n || 0)}`);
      if (opt.onClick) bar.addEventListener("click", () => opt.onClick(it));
      svg.appendChild(bar);
      const v = svgEl("text", { x: W - 12, y: y + 14, "text-anchor": "end" });
      v.textContent = fmtPct(it.value); v.style.fill = "#fff"; v.style.fontSize = "11.5px"; v.style.fontWeight = "700";
      svg.appendChild(v);
    });
  }

  function roseChart(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const W = 780, H = 300;
    const svg = mkSvg(W, H, el);
    const cx = 215, cy = 150, maxR = 112;
    const max = Math.max(...items.map(i => i.value), 1e-9);
    const n = items.length;
    const seg = Math.PI * 2 / n;
    const gap = Math.min(0.05, seg * 0.14);
    for (let g = 1; g <= 3; g++) {
      svg.appendChild(svgEl("circle", { cx, cy, r: maxR * g / 3, fill: "none",
        stroke: "rgba(126,150,190,.12)", "stroke-width": 1 }));
    }
    items.forEach((it, i) => {
      const color = it.color || PALETTE[i % PALETTE.length];
      const r = Math.max(26, (it.value / max) * maxR);
      const a0 = -Math.PI / 2 + i * seg + gap / 2;
      const a1 = -Math.PI / 2 + (i + 1) * seg - gap / 2;
      const [x0, y0] = polarPoint(cx, cy, r, a0);
      const [x1, y1] = polarPoint(cx, cy, r, a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const path = svgEl("path", {
        d: `M ${cx} ${cy} L ${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`,
        fill: color, "fill-opacity": .84, stroke: "#0b1222", "stroke-width": 1.6,
        class: "bar" + (opt.onClick ? " clickable" : "")
      });
      path.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(it.value)}<br><span class="muted">Posts:</span> ${fmtInt(it.n || 0)}`);
      if (opt.onClick) path.addEventListener("click", () => opt.onClick(it));
      svg.appendChild(path);
    });
    svg.appendChild(svgEl("circle", { cx, cy, r: 34, fill: "#0b1222", stroke: "rgba(126,150,190,.28)", "stroke-width": 1.5 }));
    const best = items.reduce((b, it) => (it.value > b.value ? it : b), items[0]);
    const c1 = svgEl("text", { x: cx, y: cy - 8, "text-anchor": "middle", class: "axis-label" });
    c1.textContent = "BEST SOURCE"; c1.style.fill = "#8ea1c2"; c1.style.fontSize = "7.5px"; c1.style.letterSpacing = "1px";
    svg.appendChild(c1);
    const c2 = svgEl("text", { x: cx, y: cy + 7, "text-anchor": "middle" });
    c2.textContent = best.label; c2.style.fill = "#fff"; c2.style.fontSize = "11px"; c2.style.fontWeight = "750";
    svg.appendChild(c2);
    const c3 = svgEl("text", { x: cx, y: cy + 22, "text-anchor": "middle" });
    c3.textContent = fmtPct(best.value); c3.style.fill = best.color || "#ff4d8d"; c3.style.fontSize = "10px"; c3.style.fontWeight = "700";
    svg.appendChild(c3);

    items.forEach((it, i) => {
      const x = 410, y = 52 + i * 38;
      const color = it.color || PALETTE[i % PALETTE.length];
      svg.appendChild(svgEl("rect", { x, y: y - 7, width: 8, height: 8, rx: 2, fill: color }));
      const l = svgEl("text", { x: x + 16, y: y, class: "axis-label" });
      l.textContent = it.label; l.style.fill = "#dbe4f5"; l.style.fontSize = "12px";
      svg.appendChild(l);
      const v = svgEl("text", { x: W - 12, y: y, "text-anchor": "end" });
      v.textContent = fmtPct(it.value); v.style.fill = color; v.style.fontSize = "12px"; v.style.fontWeight = "700";
      svg.appendChild(v);
      if (opt.onClick) {
        const hit = svgEl("rect", { x: x - 4, y: y - 16, width: W - x - 8, height: 30, fill: "transparent", class: "clickable" });
        hit.addEventListener("click", () => opt.onClick(it));
        svg.appendChild(hit);
      }
    });
  }

  function columnGlow(el, items, opt = {}) {
    if (!items.length) return empty(el);
    const W = 780, H = 300, P = { l: 46, r: 18, t: 42, b: 48 };
    const svg = mkSvg(W, H, el);
    const max = Math.max(...items.map(i => i.value), 1e-9) * 1.18;
    const plotW = W - P.l - P.r, plotH = H - P.t - P.b;
    const Y = v => H - P.b - (v / max) * plotH;
    const fid = "gl" + Math.random().toString(36).slice(2, 8);
    const defs = svgEl("defs");
    const filter = svgEl("filter", { id: fid, x: "-60%", y: "-60%", width: "220%", height: "220%" });
    filter.appendChild(svgEl("feGaussianBlur", { stdDeviation: "6", result: "blur" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "blur" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    filter.appendChild(merge);
    defs.appendChild(filter); svg.appendChild(defs);
    for (let t = 0; t <= 4; t++) {
      const y = H - P.b - t / 4 * plotH;
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, class: "grid-line" }));
      const tx = svgEl("text", { x: P.l - 8, y: y + 3, "text-anchor": "end", class: "axis-label" });
      tx.textContent = fmtPct1(max * t / 4); svg.appendChild(tx);
    }
    if (opt.avg != null) {
      const y = Y(opt.avg);
      svg.appendChild(svgEl("line", { x1: P.l, x2: W - P.r, y1: y, y2: y, stroke: "#e8eefb",
        "stroke-width": 1.2, "stroke-dasharray": "5 5", opacity: .45 }));
      const lx = W - P.r;
      svg.appendChild(svgEl("line", { x1: lx - 66, x2: lx - 52, y1: P.t + 6, y2: P.t + 6,
        stroke: "#e8eefb", "stroke-width": 1.4, "stroke-dasharray": "4 3", opacity: .7 }));
      const t = svgEl("text", { x: lx, y: P.t + 10, "text-anchor": "end", class: "axis-label" });
      t.textContent = "avg " + fmtPct1(opt.avg); t.style.fill = "#e8eefb"; t.style.fontSize = "10.5px";
      svg.appendChild(t);
    }
    const bestIdx = items.reduce((bi, it, i) => (it.value > items[bi].value ? i : bi), 0);
    const bw = Math.min(62, plotW / items.length * 0.56);
    items.forEach((it, i) => {
      const cx = P.l + (i + 0.5) * plotW / items.length;
      const h = Math.max(3, (it.value / max) * plotH);
      const y = H - P.b - h;
      const color = it.color || PALETTE[i % PALETTE.length];
      const gid = "cg" + Math.random().toString(36).slice(2, 8);
      const grad = svgEl("linearGradient", { id: gid, gradientUnits: "userSpaceOnUse", x1: 0, y1: y, x2: 0, y2: H - P.b });
      grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": color, "stop-opacity": .98 }));
      grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": color, "stop-opacity": .22 }));
      defs.appendChild(grad);
      const bar = svgEl("rect", { x: cx - bw / 2, y, width: bw, height: h, rx: 10,
        fill: `url(#${gid})`, class: "bar" });
      if (i === bestIdx) bar.setAttribute("filter", `url(#${fid})`);
      bar.setAttribute("data-tip", `<b>${esc(it.label)}</b><br><span class="muted">Avg engagement:</span> ${fmtPct(it.value)}<br><span class="muted">Posts:</span> ${fmtInt(it.n || 0)}`);
      svg.appendChild(bar);
      const v = svgEl("text", { x: cx, y: y - 8, "text-anchor": "middle" });
      v.textContent = fmtPct(it.value); v.style.fill = "#e8eefb"; v.style.fontSize = "9.5px"; v.style.fontWeight = "700";
      v.style.paintOrder = "stroke"; v.style.stroke = "#0b1222"; v.style.strokeWidth = "3px"; v.style.strokeLinejoin = "round";
      svg.appendChild(v);
      const lbl = svgEl("text", { x: cx, y: H - 18, "text-anchor": "middle", class: "axis-label" });
      lbl.textContent = it.label; lbl.style.fill = "#c8d5ea"; lbl.style.fontSize = "11.5px";
      svg.appendChild(lbl);
      if (i === bestIdx) {
        const pillW = 40, pillH = 16, py = Math.max(6, y - 30);
        svg.appendChild(svgEl("rect", { x: cx - pillW / 2, y: py, width: pillW, height: pillH, rx: 8, fill: color }));
        const pt = svgEl("text", { x: cx, y: py + 11.5, "text-anchor": "middle" });
        pt.textContent = "BEST"; pt.style.fill = "#0b1222"; pt.style.fontSize = "8.5px"; pt.style.fontWeight = "800";
        svg.appendChild(pt);
      }
    });
  }

  // ---------- rendering ----------
  function renderKpis(rows, a) {
    const items = [
      { label: "Total posts", value: fmtInt(a.n), sub: `${((a.n / DATA.length) * 100).toFixed(1)}% of dataset`, accent: "#ff4d8d" },
      { label: "Impressions", value: fmtCompact(a.impressions), sub: `${fmtCompact(a.reach)} reach`, accent: "#22d3ee" },
      { label: "Total interactions", value: fmtCompact(a.interactions), sub: `${fmtCompact(a.saves)} saves · ${fmtCompact(a.shares)} shares`, accent: "#f59e0b" },
      { label: "Avg engagement rate", value: fmtPct(a.avgEr), sub: "likes + comments + shares + saves", accent: "#8b5cf6" },
      { label: "Followers gained", value: fmtCompact(a.gained), sub: `${a.avgGained.toFixed(1)} per post`, accent: "#34d399" },
      { label: "Avg reach per post", value: fmtCompact(a.avgReach), sub: `across ${fmtInt(a.n)} posts`, accent: "#f472b6" }
    ];
    $("kpis").innerHTML = items.map(i => `
      <div class="kpi" style="--accent:${i.accent}">
        <div class="k-label">${i.label}</div>
        <div class="k-value">${i.value}</div>
        <div class="k-sub">${i.sub}</div>
      </div>`).join("");
    $("filteredPill").textContent = `${fmtInt(a.n)} posts selected`;
  }

  function renderInsights(rows, a) {
    const mediaAgg = [...groupBy(rows, d => d.media)].map(([k, v]) => ({ label: k, ...agg(v) }));
    const catAgg = [...groupBy(rows, d => d.cat)].map(([k, v]) => ({ label: k, ...agg(v) }));
    const hourAgg = [...groupBy(rows, d => d.hour)].map(([k, v]) => ({ label: k, ...agg(v) }));
    const bestM = mediaAgg.sort((x, y) => y.avgEr - x.avgEr)[0];
    const bestC = catAgg.sort((x, y) => y.avgEr - x.avgEr)[0];
    const bestH = hourAgg.sort((x, y) => y.avgEr - x.avgEr)[0];
    const ctaOn = agg(rows.filter(d => d.cta === 1));
    const ctaOff = agg(rows.filter(d => d.cta === 0));
    const delta = (ctaOn.avgEr - ctaOff.avgEr) * 100;
    $("insightStrip").innerHTML = bestM ? `
      <span class="dot"></span>
      <span><b>${bestM.label}</b> leads media engagement at <b>${fmtPct(bestM.avgEr)}</b></span>
      <span>·</span><span><b>${bestC ? bestC.label : "—"}</b> is the top category (<b>${bestC ? fmtPct(bestC.avgEr) : "—"}</b>)</span>
      <span>·</span><span>Best hour <b>${bestH ? String(bestH.label).padStart(2, "0") + ":00" : "—"}</b></span>
      <span>·</span><span>CTA lift <b>${delta >= 0 ? "+" : ""}${delta.toFixed(2)} pp</b></span>` : "<span>No posts match the current filters.</span>";
    return { mediaAgg, catAgg, hourAgg, ctaOn, ctaOff };
  }

  function renderOverview(rows) {
    const a = agg(rows);
    renderKpis(rows, a);
    const ins = renderInsights(rows, a);

    // trend
    const months = [];
    for (let i = state.from; i <= state.to; i++) {
      const mrows = rows.filter(d => d.m === i);
      months.push({ label: monthShort(i), value: mrows.length ? agg(mrows).avgEr : null,
                    meta: `<span class="muted">Posts:</span> ${fmtInt(mrows.length)}` });
    }
    lineChart($("chartTrend"), months, { gradient: ["#22d3ee", "#8b5cf6", "#ff4d8d"],
                                         label: "Avg engagement", fmt: fmtPct });

    // bucket donut
    const bAgg = [...groupBy(rows, d => d.bucket)].map(([k, v]) => ({ label: k, value: v.length }));
    const bOrder = ["viral", "high", "medium", "low"];
    bAgg.sort((x, y) => bOrder.indexOf(x.label) - bOrder.indexOf(y.label));
    donutChart($("chartBucket"), bAgg, {
      colorFn: it => BUCKET_COLORS[it.label] || "#8b5cf6",
      centerLabel: "posts", centerValue: fmtCompact(rows.length),
      onClick: it => { state.bucket = state.bucket === it.label ? "All" : it.label; $("fBucket").value = state.bucket; renderAll(); }
    });

    radialGauges($("chartMedia"), ins.mediaAgg.slice().sort((x, y) => y.avgEr - x.avgEr).map(m => ({
      label: m.label, value: m.avgEr, n: m.n, color: MEDIA_COLORS[m.label] || "#8b5cf6" })),
      { centerLabel: "BEST MEDIA",
        onClick: it => { state.media = new Set([it.label]); syncMediaChips(); renderAll(); } });

    rankedBars($("chartCategory"), ins.catAgg.map(c => ({
      label: c.label, value: c.avgEr, n: c.n, color: CATEGORY_COLORS[c.label] || "#8b5cf6" })),
      { onClick: it => { state.cat = it.label; $("fCategory").value = it.label; renderAll(); } });

    const trafficAgg = [...groupBy(rows, d => d.traffic)].map(([k, v]) => ({ label: k, ...agg(v) }))
      .sort((x, y) => y.avgEr - x.avgEr);
    roseChart($("chartTraffic"), trafficAgg.map(t => ({
      label: t.label, value: t.avgEr, n: t.n, color: TRAFFIC_COLORS[t.label] || "#8b5cf6" })),
      { onClick: it => { state.traffic = it.label; $("fTraffic").value = it.label; renderAll(); } });

    const dowAgg = DOW.map(day => ({ label: day.slice(0, 3), full: day, value: rows.filter(d => d.dow === day) }))
      .map(x => ({ label: x.label, value: x.value.length ? agg(x.value).avgEr : 0,
                   n: x.value.length, color: DOW_COLORS[x.full] }));
    columnGlow($("chartDow"), dowAgg, { avg: a.avgEr });

    const comboLabels = [], comboBars = [], comboLine = [];
    for (let i = state.from; i <= state.to; i++) {
      const mrows = rows.filter(d => d.m === i);
      comboLabels.push(monthShort(i));
      comboBars.push(mrows.length);
      comboLine.push(mrows.length ? agg(mrows).avgEr : null);
    }
    comboChart($("chartCombo"), comboLabels, comboBars, comboLine,
      { barLabel: "Posts", lineLabel: "Avg engagement" });

    const reachByCat = [...groupBy(rows, d => d.cat)].map(([k, v]) => ({
      label: k, value: agg(v).reach, color: CATEGORY_COLORS[k] || "#8b5cf6"
    }));
    treemapChart($("chartTreemap"), reachByCat, { label: "Total reach" });
  }

  function renderContent(rows) {
    const a = agg(rows);
    const ins = renderInsights(rows, a);
    $("ctaOn").textContent = ins.ctaOn.n ? fmtPct(ins.ctaOn.avgEr) : "—";
    $("ctaOff").textContent = ins.ctaOff.n ? fmtPct(ins.ctaOff.avgEr) : "—";
    $("ctaOnNote").textContent = `${fmtInt(ins.ctaOn.n)} posts · ${fmtCompact(ins.ctaOn.avgReach)} avg reach`;
    $("ctaOffNote").textContent = `${fmtInt(ins.ctaOff.n)} posts · ${fmtCompact(ins.ctaOff.avgReach)} avg reach`;
    const bestM = ins.mediaAgg.slice().sort((a, b) => b.avgEr - a.avgEr)[0];
    const bestC = ins.catAgg.slice().sort((a, b) => b.avgEr - a.avgEr)[0];
    $("bestMedia").textContent = bestM ? `${bestM.label} · ${fmtPct(bestM.avgEr)}` : "—";
    $("bestCategory").textContent = bestC ? `${bestC.label} · ${fmtPct(bestC.avgEr)}` : "—";

    scatterChart($("chartScatter"), ins.catAgg.map(c => ({
      label: c.label, x: c.avgReach, y: c.avgEr, n: c.n
    })).filter(p => p.n > 0));

    const catTable = ins.catAgg.slice().sort((a, b) => b.avgEr - a.avgEr).map(c => `
      <tr>
        <td>${esc(c.label)}</td>
        <td class="num">${fmtInt(c.n)}</td>
        <td class="num">${fmtPct(c.avgEr)}</td>
        <td class="num">${fmtCompact(c.avgReach)}</td>
      </tr>`).join("");
    $("categoryTable").innerHTML = `<table><thead><tr><th>Category</th><th class="num">Posts</th><th class="num">Avg ER</th><th class="num">Avg reach</th></tr></thead><tbody>${catTable}</tbody></table>`;

    const getMap = (dim) => {
      const m = new Map();
      for (const d of rows) {
        const key = d[dim];
        if (!m.has(key)) m.set(key, new Map());
        const inner = m.get(key);
        inner.set(d.bucket, (inner.get(d.bucket) || 0) + d.er);
      }
      return m;
    };
    const erMap = new Map();
    for (const d of rows) {
      const k = d.media + "|" + d.bucket;
      const cur = erMap.get(k) || { sum: 0, n: 0 };
      cur.sum += d.er; cur.n++; erMap.set(k, cur);
    }
    groupedBars($("chartMediaBand"), MEDIA,
      BUCKETS.map(b => ({ label: b, color: BUCKET_COLORS[b], get: m => {
        const v = erMap.get(m + "|" + b);
        return v && v.n ? v.sum / v.n : 0;
      } })));

    const acctStats = ACCTS.map(a => ({ name: a, ...agg(rows.filter(d => d.acct === a)) }));
    $("audienceCards").innerHTML = acctStats.map((s, i) => `
      <div class="account-col" style="--accent:${PALETTE[i]}">
        <div class="account-head"><span class="dot"></span>${esc(s.name)}</div>
        <div class="account-row"><span>Posts</span><b>${fmtInt(s.n)}</b></div>
        <div class="account-row"><span>Avg engagement</span><b>${fmtPct(s.avgEr)}</b></div>
        <div class="account-row"><span>Avg reach</span><b>${fmtCompact(s.avgReach)}</b></div>
        <div class="account-row"><span>Avg impressions</span><b>${fmtCompact(s.n ? s.impressions / s.n : 0)}</b></div>
        <div class="account-row"><span>Followers / post</span><b>${s.avgGained.toFixed(1)}</b></div>
        <div class="account-row"><span>Avg saves / post</span><b>${fmtCompact(s.n ? s.saves / s.n : 0)}</b></div>
        <div class="account-row"><span>Interactions</span><b>${fmtCompact(s.interactions)}</b></div>
      </div>`).join("");

    funnelChart($("chartFunnel"), [
      { label: "Impressions", value: a.impressions, color: "#8b5cf6" },
      { label: "Reach", value: a.reach, color: "#22d3ee" },
      { label: "Interactions", value: a.interactions, color: "#f59e0b" },
      { label: "Saves", value: a.saves, color: "#34d399" }
    ]);

    const mediaMix = new Map();
    for (const d of rows) {
      const cur = mediaMix.get(d.media) || { likes: 0, comments: 0, shares: 0, saves: 0 };
      cur.likes += d.likes; cur.comments += d.comments;
      cur.shares += d.shares; cur.saves += d.saves;
      mediaMix.set(d.media, cur);
    }
    const mixSeries = [
      { label: "Likes", color: "#ff4d8d", get: g => (mediaMix.get(g) || {}).likes || 0 },
      { label: "Comments", color: "#22d3ee", get: g => (mediaMix.get(g) || {}).comments || 0 },
      { label: "Shares", color: "#f59e0b", get: g => (mediaMix.get(g) || {}).shares || 0 },
      { label: "Saves", color: "#34d399", get: g => (mediaMix.get(g) || {}).saves || 0 }
    ];
    stackedBars($("chartMix"), MEDIA, mixSeries);
  }

  function renderTiming(rows) {
    const ins = renderInsights(rows, agg(rows));
    const hourPts = [];
    for (let h = 0; h < 24; h++) {
      const hr = rows.filter(d => d.hour === h);
      hourPts.push({ label: String(h).padStart(2, "0"), value: hr.length ? agg(hr).avgEr : null,
                     meta: `<span class="muted">Posts:</span> ${fmtInt(hr.length)}` });
    }
    lineChart($("chartHour"), hourPts, { gradient: ["#34d399", "#22d3ee", "#8b5cf6"],
                                          label: "Avg engagement", fmt: fmtPct });

    const combos = [];
    for (const day of DOW) {
      for (let h = 0; h < 24; h++) {
        const cr = rows.filter(d => d.dow === day && d.hour === h);
        if (cr.length >= 20) combos.push({ day, h, n: cr.length, er: agg(cr).avgEr });
      }
    }
    combos.sort((a, b) => b.er - a.er);
    $("bestTimes").innerHTML = combos.slice(0, 6).map((c, i) => `
      <li><b>${esc(c.day)} · ${String(c.h).padStart(2, "0")}:00</b> — ${fmtPct(c.er)}
        <small>${fmtInt(c.n)} posts</small></li>`).join("") || "<li>No combinations with enough posts.</li>";

    // heatmap
    const cells = new Map();
    for (const d of rows) {
      const k = d.dow + "|" + d.hour;
      const cur = cells.get(k) || { sum: 0, n: 0 };
      cur.sum += d.er; cur.n++; cells.set(k, cur);
    }
    const vals = [...cells.values()].filter(v => v.n).map(v => v.sum / v.n);
    const vmin = Math.min(...vals), vmax = Math.max(...vals);
    const heat = $("heatmap");
    heat.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "heat-grid";
    grid.appendChild(document.createElement("div"));
    for (let h = 0; h < 24; h++) {
      const lab = document.createElement("div");
      lab.className = "heat-hour"; lab.textContent = String(h).padStart(2, "0");
      grid.appendChild(lab);
    }
    for (const day of DOW) {
      const lab = document.createElement("div");
      lab.className = "heat-label"; lab.textContent = day.slice(0, 3);
      grid.appendChild(lab);
      for (let h = 0; h < 24; h++) {
        const c = cells.get(day + "|" + h) || { sum: 0, n: 0 };
        const v = c.n ? c.sum / c.n : null;
        const cell = document.createElement("div");
        cell.className = "heat-cell";
        if (v != null && vmax > vmin) {
          const t = (v - vmin) / (vmax - vmin);
          const r = Math.round(34 + (255 - 34) * t);
          const g = Math.round(211 + (77 - 211) * t);
          const b = Math.round(238 + (141 - 238) * t);
          cell.style.background = `rgba(${r},${g},${b},${0.22 + t * 0.68})`;
        }
        cell.setAttribute("data-tip", v == null
          ? `<b>${esc(day)} ${String(h).padStart(2, "0")}:00</b><br><span class="muted">No posts</span>`
          : `<b>${esc(day)} ${String(h).padStart(2, "0")}:00</b><br><span class="muted">Avg engagement:</span> ${fmtPct(v)}<br><span class="muted">Posts:</span> ${fmtInt(c.n)}`);
        grid.appendChild(cell);
      }
    }
    heat.appendChild(grid);
  }

  function renderData(rows) {
    let list = rows.slice();
    const q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter(d => [d.cat, d.media, d.traffic, d.acct, d.bucket, d.date].join(" ").toLowerCase().includes(q));
    }
    list.sort((a, b) => b.er - a.er);
    const top = list.slice(0, 150);
    const body = top.map(d => `
      <tr>
        <td>${esc(d.date)}</td>
        <td>${esc(d.media)}</td>
        <td>${esc(d.cat)}</td>
        <td>${esc(d.traffic)}</td>
        <td class="num">${fmtInt(d.reach)}</td>
        <td class="num">${fmtInt(d.impressions)}</td>
        <td class="num">${fmtPct(d.er)}</td>
        <td class="num">${fmtInt(d.gained)}</td>
        <td><span class="badge ${d.bucket}">${d.bucket}</span></td>
      </tr>`).join("");
    $("postsTable").innerHTML = `
      <table>
        <thead><tr><th>Date</th><th>Media</th><th>Category</th><th>Traffic</th><th class="num">Reach</th><th class="num">Impressions</th><th class="num">Engagement</th><th class="num">Followers</th><th>Band</th></tr></thead>
        <tbody>${body || '<tr><td colspan="9" style="text-align:center;color:#8ea1c2">No matching posts.</td></tr>'}</tbody>
      </table>`;
    $("postsTable").dataset.count = list.length;
  }

  function renderAll() {
    const rows = filtered();
    renderOverview(rows);
    renderContent(rows);
    renderTiming(rows);
    renderData(rows);
    $("filteredPill").textContent = `${fmtInt(rows.length)} posts selected`;
  }

  // ---------- controls ----------
  function fillSelect(el, values, labels, allLabel) {
    el.innerHTML = "";
    if (allLabel) {
      const o = document.createElement("option");
      o.value = "All"; o.textContent = allLabel; el.appendChild(o);
    }
    values.forEach((v, i) => {
      const o = document.createElement("option");
      o.value = v; o.textContent = labels ? labels[i] : v;
      el.appendChild(o);
    });
  }

  function initControls() {
    const from = $("fromMonth"), to = $("toMonth");
    MONTHS.forEach((m, i) => {
      const lab = monthLabel(i);
      from.insertAdjacentHTML("beforeend", `<option value="${i}">${lab}</option>`);
      to.insertAdjacentHTML("beforeend", `<option value="${i}">${lab}</option>`);
    });
    from.value = "0"; to.value = String(MONTHS.length - 1);
    from.addEventListener("change", () => {
      state.from = Number(from.value);
      if (state.from > state.to) { state.to = state.from; to.value = String(state.to); }
      renderAll();
    });
    to.addEventListener("change", () => {
      state.to = Number(to.value);
      if (state.to < state.from) { state.from = state.to; from.value = String(state.from); }
      renderAll();
    });

    fillSelect($("fCategory"), CATS, null, "All categories");
    fillSelect($("fTraffic"), TRAFFIC, null, "All sources");
    fillSelect($("fAccount"), ACCTS, null, "All accounts");
    fillSelect($("fBucket"), BUCKETS, null, "All bands");

    $("fCategory").addEventListener("change", e => { state.cat = e.target.value; renderAll(); });
    $("fTraffic").addEventListener("change", e => { state.traffic = e.target.value; renderAll(); });
    $("fAccount").addEventListener("change", e => { state.account = e.target.value; renderAll(); });
    $("fBucket").addEventListener("change", e => { state.bucket = e.target.value; renderAll(); });
    $("fCta").addEventListener("change", e => { state.cta = e.target.value; renderAll(); });

    document.querySelectorAll("#mediaChips .chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const m = chip.dataset.media;
        if (state.media.has(m)) state.media.delete(m); else state.media.add(m);
        syncMediaChips();
        renderAll();
      });
    });

    $("resetBtn").addEventListener("click", () => {
      state.from = 0; state.to = MONTHS.length - 1;
      state.media = new Set(MEDIA); state.cat = "All"; state.traffic = "All";
      state.account = "All"; state.bucket = "All"; state.cta = "all"; state.search = "";
      from.value = "0"; to.value = String(MONTHS.length - 1);
      $("fCategory").value = "All"; $("fTraffic").value = "All"; $("fAccount").value = "All";
      $("fBucket").value = "All"; $("fCta").value = "all"; $("postSearch").value = "";
      syncMediaChips(); renderAll();
    });

    document.querySelectorAll(".tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        $("tab-" + tab.dataset.tab).classList.add("active");
      });
    });

    $("postSearch").addEventListener("input", e => { state.search = e.target.value; renderData(filtered()); });
    $("downloadBtn").addEventListener("click", downloadCsv);
  }

  function syncMediaChips() {
    document.querySelectorAll("#mediaChips .chip").forEach(chip => {
      chip.classList.toggle("active", state.media.has(chip.dataset.media));
    });
  }

  function downloadCsv() {
    const rows = filtered();
    const head = ["post_date", "media_type", "content_category", "traffic_source", "account_type",
                  "has_call_to_action", "post_hour", "day_of_week", "likes", "comments", "shares", "saves",
                  "reach", "impressions", "engagement_rate", "followers_gained", "caption_length",
                  "hashtags_count", "performance_bucket_label"];
    const lines = [head.join(",")];
    for (const d of rows) {
      lines.push([d.date, d.media, d.cat, d.traffic, d.acct, d.cta ? "True" : "False", d.hour, d.dow,
                  d.likes, d.comments, d.shares, d.saves, d.reach, d.impressions, d.er, d.gained,
                  d.caption, d.tags, d.bucket].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "instagram_filtered.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  initControls();
  renderAll();
})();
