/* ===== Config ===== */
var CONFIG = (function () {
  try { return JSON.parse(document.getElementById("init-config").textContent || "{}"); }
  catch (e) { return {}; }
})();

/* ===== Flags ===== */
const AUTOCALC_Y_ON_LOAD = true; // calcular Y por orden XML al cargar

/* ===== Layout/Estilo ===== */
const DIAGRAM_CONFIG = {
  layout: {
    MIN_GAP: Number(CONFIG.MIN_GAP || 140),   // gap mínimo base
    MAX_GAP: Number(CONFIG.MAX_GAP || 520),
    MIN_Y_GAP: Number(CONFIG.MIN_Y_GAP || 60),
    LIFELINE_H: Number(CONFIG.LIFELINE_H || 700),
    TOP_PAD: 90,
    LEFT_PAD: 30,
    HEAD_MIN_W: 240,
    HEAD_PAD_X: 16,
    SAFETY_MARGIN: 24,
    BOTTOM_PAD: 170,
    MIN_LIFELINE_H: 480,
    NEIGHBOR_PAD: Number(CONFIG.NEIGHBOR_PAD || 12)
  },
  style: {
    BADGE_COLOR: CONFIG.BADGE_COLOR || "#2563EB",
    HEADER_FILL: CONFIG.HEADER_FILL || "#FFFFFF",
    HEADER_STROKE: CONFIG.HEADER_STROKE || "#CFCFCF",
    HEADER_FONT_SIZE: Number(CONFIG.HEADER_FONT_SIZE || 20),
    HEADER_FONT_WEIGHT: CONFIG.HEADER_FONT_WEIGHT || "700",
    LABEL_FONT_SIZE: Number(CONFIG.LABEL_FONT_SIZE || 14)
  },
  selfLoop: { MIN_H: 32, MAX_H: 220, DEFAULT_H: 78 },
  labels: { MAX_CAP: 440, MARGIN: 32, USED_RATIO: 0.72, PAD_X: 8, PAD_Y: 4 },
  activation: { HEIGHT: 28, WIDTH: 9, RADIUS: 4, MERGE_GAP: 6 },
  badge: { RADIUS: 12 }
};

const FIRST_MSG_MIN_Y = DIAGRAM_CONFIG.layout.TOP_PAD + 48;
const FIRST_OFFSET = 12;

/* ===== Límites separados ===== */
// ancho fijo del tramo horizontal del self-loop (solo self)
const STUB_LIMIT_SELF = Number((CONFIG && CONFIG.STUB_LIMIT_SELF) || 160);

// gap mínimo entre vecinos si NO hay self en la pareja
const MIN_GAP_NONSELF = Number((CONFIG && CONFIG.MIN_GAP_NONSELF) || DIAGRAM_CONFIG.layout.MIN_GAP);

// gap mínimo entre vecinos si SÍ hay self en la pareja
const MIN_GAP_SELF = Number((CONFIG && CONFIG.MIN_GAP_SELF) || Math.max(DIAGRAM_CONFIG.layout.MIN_GAP, DIAGRAM_CONFIG.layout.MIN_GAP + 40));

/* ===== Pasadas múltiples ===== */
const AUTOLAYOUT_PASSES = Number(CONFIG.AUTOLAYOUT_PASSES || 3);
const SPACEV_PASSES = Number(CONFIG.SPACEV_PASSES || 3);

/* ===== CSS vars (para altura) ===== */
document.documentElement.style.setProperty("--header-fill", DIAGRAM_CONFIG.style.HEADER_FILL);
document.documentElement.style.setProperty("--header-stroke", DIAGRAM_CONFIG.style.HEADER_STROKE);
document.documentElement.style.setProperty("--lifeline-height", DIAGRAM_CONFIG.layout.LIFELINE_H + "px");

/* ===== Util ===== */
var svg = document.getElementById("svg");
var viewport = document.getElementById("viewport");
var zoom = 1;

function clearSVG() { if (svg) svg.replaceChildren(); }
function SVGe(tag, attrs, cls) { var el = document.createElementNS("http://www.w3.org/2000/svg", tag); if (attrs) for (var k in attrs) el.setAttribute(k, String(attrs[k])); if (cls) el.setAttribute("class", cls); return el; }
function rect(x, y, w, h, rx, ry, cls) { return SVGe("rect", { x: x, y: y, width: w, height: h, rx: rx || 10, ry: ry || 10 }, cls); }
function textEl(x, y, txt, cls) { var t = SVGe("text", { x: x, y: y }, cls); t.textContent = txt || ""; return t; }
function line(x1, y1, x2, y2, cls) { return SVGe("line", { x1: x1, y1: y1, x2: x2, y2: y2 }, cls); }
function clamp(v, min, max) { return Math.max(min, Math.min(v, max)); }

function marker(id, color) {
  var m = SVGe("marker", { id: id, markerWidth: 8, markerHeight: 8, refX: 7, refY: 3.5, orient: "auto-start-reverse" });
  var p = SVGe("path", { d: "M0,0 L7,3.5 L0,7 Z" }); p.setAttribute("fill", color); m.appendChild(p); return m;
}

function clampY(y, loopH) {
  var minY = DIAGRAM_CONFIG.layout.TOP_PAD + FIRST_OFFSET;
  var maxY = DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H - (loopH || 0) - 6;
  return Math.max(minY, Math.min(y, maxY));
}

function parseXML(str) {
  var dom = new DOMParser().parseFromString(str, "application/xml");
  var err = dom.querySelector("parsererror");
  if (err) throw new Error(err.textContent || "XML inválido");
  return dom.documentElement;
}

/* ===== Medición ===== */
var measureSvg = SVGe("svg", { id: "measure-layer" });
document.body.appendChild(measureSvg);
function measureHeaderWidth(text) {
  var t = textEl(0, 0, text, "header-text");
  t.setAttribute("style", "font-size:" + DIAGRAM_CONFIG.style.HEADER_FONT_SIZE + "px;font-weight:" + DIAGRAM_CONFIG.style.HEADER_FONT_WEIGHT + ";font-family:Arial,Helvetica,sans-serif");
  measureSvg.appendChild(t);
  var w = t.getBBox().width;
  measureSvg.removeChild(t);
  return w;
}

/* ===== THEME dinámico ===== */
function injectThemeStyles() {
  var st = document.createElementNS("http://www.w3.org/2000/svg", "style");
  st.id = "dyn-theme";
  st.textContent = `
    .badge circle{ fill:${DIAGRAM_CONFIG.style.BADGE_COLOR} !important; stroke:${DIAGRAM_CONFIG.style.BADGE_COLOR} !important; }
    g.head rect{ fill:${DIAGRAM_CONFIG.style.HEADER_FILL} !important; stroke:${DIAGRAM_CONFIG.style.HEADER_STROKE} !important; }
    text.header-text{ font-size:${DIAGRAM_CONFIG.style.HEADER_FONT_SIZE}px; font-weight:${DIAGRAM_CONFIG.style.HEADER_FONT_WEIGHT}; }
    text.label-text{ font-size:${DIAGRAM_CONFIG.style.LABEL_FONT_SIZE}px; }
  `;
  return st;
}

/* ===== Modelo ===== */
var model = null;
function buildModel(root) {
  var ps = [].map.call(root.querySelectorAll("participants > p"), function (p, i) {
    var id = (p.getAttribute("id") || "").trim();
    var label = (p.getAttribute("label") || id).trim();
    return {
      id: id,
      label: label,
      highlight: p.getAttribute("highlight") === "true",
      x: DIAGRAM_CONFIG.layout.LEFT_PAD + i * DIAGRAM_CONFIG.layout.MIN_GAP,
      headW: DIAGRAM_CONFIG.layout.HEAD_MIN_W,
      centerX: 0
    };
  });
  var validIds = {}; ps.forEach(function (p) { validIds[p.id] = true; });

  var auto = 1;
  var msgs = [].map.call(root.querySelectorAll("messages > m"), function (m, idx) {
    var from = (m.getAttribute("from") || "").trim();
    var to = (m.getAttribute("to") || "").trim();
    var st = (m.getAttribute("step") || "").trim();
    var txt = (m.getAttribute("text") || "").trim();
    return {
      from: from, to: to, y: 0, text: txt,
      step: st ? st : String(auto++),
      endStep: null,
      ret: m.getAttribute("return") === "true",
      _idx: idx,
      _order: idx,
      _fromOk: !!validIds[from], _toOk: !!validIds[to],
      _loopH: DIAGRAM_CONFIG.selfLoop.DEFAULT_H
    };
  });

  return { participants: ps, messages: msgs, title: (root.getAttribute("title") || "Diagrama de Secuencia") };
}

/* ===== Badges ===== */
function drawBadge(cx, cy, label) {
  var g = SVGe("g", {}, "badge");
  var c = SVGe("circle", { cx: cx, cy: cy, r: DIAGRAM_CONFIG.badge.RADIUS });
  var tt = textEl(cx, cy + 4, String(label || ""), "");
  tt.setAttribute("text-anchor", "middle");
  tt.setAttribute("style", "font-weight:800; font-size:11px; fill:#fff");
  g.appendChild(c);
  g.appendChild(tt);
  svg.appendChild(g);
  return g;
}

/* ===== Orden & helpers ===== */
function stableSortByY(msgs) { return msgs.slice().sort(function (a, b) { return a.y === b.y ? a._idx - b._idx : a.y - b.y; }); }

function cascadeShiftDown(changedMsg) {
  try {
    var valid = model.messages.filter(function (m) { return m && m._fromOk && m._toOk; });
    var sorted = stableSortByY(valid);
    var startIdx = sorted.findIndex(function (m) { return m._idx === changedMsg._idx; });
    if (startIdx < 0) return;
    sorted[startIdx].y = clampY(sorted[startIdx].y, sorted[startIdx].from === sorted[startIdx].to ? (sorted[startIdx]._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H) : 0);
    for (var i = startIdx + 1; i < sorted.length; i++) {
      var prev = sorted[i - 1], cur = sorted[i];
      var prevExtra = (prev.from === prev.to) ? (prev._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H) : 0;
      var minYForCur = prev.y + prevExtra + DIAGRAM_CONFIG.layout.MIN_Y_GAP;
      var clamped = clampY(cur.y, (cur.from === cur.to) ? (cur._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H) : 0);
      cur.y = (clamped < minYForCur) ? minYForCur : clamped;
    }
  } catch (e) { console.error("cascadeShiftDown error", e); }
}

/* ===== Barreras por self-loop ===== */
function requiredStubFor(part) {
  // 0 si no hay self-loops para ese participante
  var req = 0;
  if (model && Array.isArray(model.messages)) {
    for (var i = 0; i < model.messages.length; i++) {
      var m = model.messages[i];
      if (!m || !m._fromOk || !m._toOk) continue;
      if (m.from === part.id && m.to === part.id) {
        var s = STUB_LIMIT_SELF; // ancho fijo para self
        if (s > req) req = s;
      }
    }
  }
  return req;
}

function minGapBetween(a, b) {
  var stubReq = Math.max(requiredStubFor(a), requiredStubFor(b)); // 0 si ninguno tiene self
  var baseGap = (stubReq > 0) ? MIN_GAP_SELF : MIN_GAP_NONSELF;
  var needed = (stubReq > 0) ? Math.max(baseGap, stubReq) : baseGap;
  return needed + DIAGRAM_CONFIG.layout.NEIGHBOR_PAD;
}

/* ===== Auto layout (ancho) ===== */
function autoLayoutParticipants() {
  var n = model.participants.length; if (n < 1) return;

  model.participants.forEach(function (p) {
    var tw = Math.ceil(measureHeaderWidth(p.label)) + 6;
    p.headW = tw - 80;
  });

  var x = DIAGRAM_CONFIG.layout.LEFT_PAD;
  for (var i = 0; i < n; i++) {
    var p = model.participants[i];
    p.x = x;
    p.centerX = p.x + p.headW / 2;

    var rightPad = 0;
    if (i < n - 1) {
      var a = p;
      var b = model.participants[i + 1];
      rightPad = minGapBetween(a, b);
    }
    x += p.headW + rightPad;
  }
}

/* ===== Espaciado vertical por orden ===== */
function recomputeYByOrder() {
  var msgs = model.messages.filter(m => m && m._fromOk && m._toOk).sort((a, b) => a._order - b._order);
  if (!msgs.length) return;
  var baseGap = DIAGRAM_CONFIG.layout.MIN_Y_GAP;
  var curY = FIRST_MSG_MIN_Y;
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i];
    var loopH = m._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H;
    m.y = clampY(curY, (m.from === m.to) ? loopH : 0);
    var blockH = (m.from === m.to) ? loopH + 34 : 34;
    var prev = (i > 0) ? msgs[i - 1] : null;
    var dynGap = baseGap;
    if (prev && prev.from === prev.to) {
      var prevLoopH = prev._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H;
      dynGap = Math.max(90, baseGap + prevLoopH + 44);
    }
    if (m.from === m.to) dynGap = Math.max(dynGap, 110);
    curY = (m.y + blockH + dynGap);
  }
}

/* ===== Renumerar por Y visible ===== */
function renumberAll(opts) {
  opts = opts || { selfLoopCountsAsTwo: true };
  var valid = model.messages.filter(m => m && m._fromOk && m._toOk);
  var sorted = stableSortByY(valid);
  var k = 1;
  sorted.forEach(function (m) {
    m.step = String(k++);
    if (m.from === m.to) m.endStep = (opts.selfLoopCountsAsTwo ? String(k++) : String(m.step));
    else m.endStep = null;
  });
}

/* ===== Export XML (limpio) ===== */
function xmlEscape(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function modelToXML() {
  var pXML = model.participants.map(function (p) {
    return '    <p id="' + xmlEscape(p.id) + '" label="' + xmlEscape(p.label) + '"' + (p.highlight ? ' highlight="true"' : "") + "/>";
  }).join("\n");

  var mXML = model.messages.map(function (m) {
    return '    <m from="' + xmlEscape(m.from) + '" to="' + xmlEscape(m.to) + '"' +
      (m.step ? ' step="' + xmlEscape(m.step) + '"' : "") +
      (m.endStep ? ' endStep="' + xmlEscape(m.endStep) + '"' : "") +
      ' text="' + xmlEscape(m.text) + '"' +
      (m.ret ? ' return="true"' : "") +
      "/>";
  }).join("\n");

  return '<sequence title="' + xmlEscape(model.title || "") + '">\n' +
    "  <participants>\n" + pXML + "\n  </participants>\n" +
    "  <messages>\n" + mXML + "\n  </messages>\n" +
    "</sequence>";
}

/* ===== Wrap texto ===== */
function wrapTextCenter(t, text, maxWidth) {
  t.textContent = "";
  var words = String(text || "").split(/\s+/).filter(Boolean);
  var x = parseFloat(t.getAttribute("x")) || 0;
  if (!words.length) return t.getBBox();
  var meas = SVGe("text", {}, "label-text");
  document.getElementById("measure-layer").appendChild(meas);
  var lineTxt = "", lines = [];
  for (var i = 0; i < words.length; i++) {
    var w = words[i];
    var test = lineTxt ? (lineTxt + " " + w) : w;
    meas.textContent = test;
    if (meas.getBBox().width <= maxWidth) lineTxt = test;
    else { if (lineTxt) lines.push(lineTxt); lineTxt = w; }
  }
  if (lineTxt) lines.push(lineTxt);
  meas.remove();
  lines.forEach(function (ln, i) {
    var s = SVGe("tspan"); s.setAttribute("x", x); if (i > 0) s.setAttribute("dy", 14); s.textContent = ln; t.appendChild(s);
  });
  return t.getBBox();
}

/* ===== Render ===== */
var rafId = null;
function scheduleRender() { if (!rafId) { rafId = requestAnimationFrame(function () { rafId = null; renderFromModel(); }); } }

function renderFromModel() {
  clearSVG();

  // Altura dinámica generosa
  (function () {
    var msgs = model.messages.filter(m => m && m._fromOk && m._toOk);
    var maxY = DIAGRAM_CONFIG.layout.TOP_PAD;
    var countLoops = 0;
    msgs.forEach(function (m) {
      if (m.from === m.to) {
        var loopH = m._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H;
        countLoops++;
        maxY = Math.max(maxY, m.y + loopH + 52);
      } else {
        maxY = Math.max(maxY, m.y + 34);
      }
    });
    var baseHeight = maxY + DIAGRAM_CONFIG.layout.BOTTOM_PAD;
    var extra = countLoops * 50 + Math.max(0, msgs.length - 6) * 24;
    var need = Math.max(DIAGRAM_CONFIG.layout.MIN_LIFELINE_H, baseHeight + extra);
    DIAGRAM_CONFIG.layout.LIFELINE_H = need;
    document.documentElement.style.setProperty("--lifeline-height", need + "px");
  })();

  // defs + theme
  var defs = SVGe("defs");
  defs.appendChild(marker("arrowTip", "#111"));
  var styleTxt = (function () {
    var styleTag = document.querySelector('link[rel="stylesheet"]') ? null : document.querySelector("style");
    return styleTag ? styleTag.innerHTML : "";
  })();
  var styleNode = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleNode.textContent = styleTxt + "\n text,svg{font-family:Arial,'Helvetica Neue',Helvetica,sans-serif!important}";
  defs.appendChild(styleNode);
  defs.appendChild(injectThemeStyles());
  svg.appendChild(defs);

  // título
  var title = textEl(20, 28, model.title); title.setAttribute("style", "font-weight:700;font-size:16px"); svg.appendChild(title);

  // precálculo headers
  model.participants.forEach(function (p) {
    var tw = Math.ceil(measureHeaderWidth(p.label)) + 6;
    p.headW = Math.max(DIAGRAM_CONFIG.layout.HEAD_MIN_W, tw + DIAGRAM_CONFIG.layout.HEAD_PAD_X * 2);
    p.centerX = p.x + p.headW / 2;
  });

  // headers + lifelines (DRAG habilitado con límites; no cruza vecinos)
  model.participants.forEach(function (p) {
    var w = p.headW, h = 34, y = 50, x = p.x;
    var g = SVGe("g", {}, "head"); g.dataset.pid = p.id;
    var header = rect(x, y, w, h, 10, 10);
    var tx = textEl(x + w / 2, y + 22, p.label, "header-text"); tx.setAttribute("text-anchor", "middle");
    var ll = line(p.centerX, DIAGRAM_CONFIG.layout.TOP_PAD, p.centerX, DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H, "lifeline");
    g.appendChild(header); g.appendChild(tx); svg.appendChild(g); svg.appendChild(ll);

    var dragState = { active: false, startX: 0, startPx: 0 };
    g.style.cursor = "grab";
    function startDrag(e) { dragState.active = true; dragState.startX = e.clientX; dragState.startPx = p.x; g.classList.add("dragging"); g.style.cursor = "grabbing"; e.preventDefault(); }
    function onDrag(e) {
      if (!dragState.active) return;
      var dx = e.clientX - dragState.startX;
      var newX = dragState.startPx + dx;
      var idx = model.participants.findIndex(function (pp) { return pp.id === p.id; });

      var minX = DIAGRAM_CONFIG.layout.LEFT_PAD;
      var maxX = Infinity;
      if (idx > 0) {
        var left = model.participants[idx - 1];
        var gapLeft = minGapBetween(left, p);
        minX = left.x + left.headW + gapLeft - p.headW;
      } else {
        minX = DIAGRAM_CONFIG.layout.LEFT_PAD;
      }
      if (idx < model.participants.length - 1) {
        var right = model.participants[idx + 1];
        var gapRight = minGapBetween(p, right);
        maxX = right.x - gapRight;
      }

      p.x = Math.max(minX, Math.min(maxX, newX));
      p.centerX = p.x + p.headW / 2;
      scheduleRender();
    }
    function endDrag() { dragState.active = false; g.classList.remove("dragging"); g.style.cursor = "grab"; scheduleRender(); }
    g.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", onDrag, { passive: true });
    window.addEventListener("mouseup", endDrag);
  });

  // activations
  var acts = {};
  function pushSeg(pid, start, end) { (acts[pid] = acts[pid] || []).push({ start, end }); }
  (function buildActivationSegments() {
    var half = DIAGRAM_CONFIG.activation.HEIGHT / 2;
    model.messages.forEach(function (m) {
      if (!m || !m._fromOk || !m._toOk) return;
      if (m.from === m.to) {
        var loopH = m._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H;
        var start = m.y - half;
        var end = m.y + loopH + half;
        pushSeg(m.from, start, end);
        return;
      }
      pushSeg(m.from, m.y - half, m.y + half);
      pushSeg(m.to, m.y - half, m.y + half);
    });
  })();

  function hasForeignActivationBetween(ownerPid, y1, y2) {
    for (var pid in acts) {
      if (!acts.hasOwnProperty(pid) || pid === ownerPid) continue;
      var segs = acts[pid];
      for (var i = 0; i < segs.length; i++) {
        var s = segs[i];
        if (s.end > y1 && s.start < y2) return true;
      }
    }
    return false;
  }

  model.participants.forEach(function (p) {
    var segs = (acts[p.id] || []).sort(function (a, b) { return a.start - b.start; });
    if (!segs.length) return;

    var merged = [];
    var cur = { start: segs[0].start, end: segs[0].end };

    for (var i = 1; i < segs.length; i++) {
      var s = segs[i];
      var gapStart = cur.end, gapEnd = s.start;
      var canMerge = !hasForeignActivationBetween(p.id, gapStart, gapEnd);
      if (canMerge) { cur.end = Math.max(cur.end, s.end); }
      else { merged.push(cur); cur = { start: s.start, end: s.end }; }
    }
    merged.push(cur);

    for (var k = 0; k < merged.length; k++) {
      var sg = merged[k];
      var y = Math.max(DIAGRAM_CONFIG.layout.TOP_PAD, sg.start);
      var h = Math.min(DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H, sg.end) - y;
      if (h > 0) svg.appendChild(
        rect(
          p.centerX - DIAGRAM_CONFIG.activation.WIDTH / 2, y,
          DIAGRAM_CONFIG.activation.WIDTH, h,
          DIAGRAM_CONFIG.activation.RADIUS, DIAGRAM_CONFIG.activation.RADIUS,
          "activation"
        )
      );
    }
  });

  // reserva de slots para labels
  var labelSlots = [];
  function reserve(y, x1, x2, h) {
    var newY = y;
    for (var i = 0; i < labelSlots.length; i++) {
      var s = labelSlots[i];
      var ox = Math.max(0, Math.min(x2, s.x2) - Math.max(x1, s.x1));
      if (ox > 0 && newY < s.yBottom + 16) newY = s.yBottom + 16;
    }
    labelSlots.push({ x1: x1, x2: x2, yBottom: newY + h });
    return newY;
  }

  // primer mensaje (para clamp inicial)
  var FIRST_MSG = (function () {
    var valid = (model.messages || []).filter(function (mm) { return mm && mm._fromOk && mm._toOk; });
    if (!valid.length) return null;
    valid.sort(function (a, b) { return (a.y === b.y) ? (a._order - b._order) : (a.y - b.y); });
    return valid[0];
  })();

  /* ===== MENSAJES ===== */
  model.messages.forEach(function (m) {
    if (!m._fromOk || !m._toOk) return;
    if (m === FIRST_MSG && m.y < FIRST_MSG_MIN_Y) m.y = FIRST_MSG_MIN_Y;

    var from = model.participants.find(function (p) { return p.id === m.from; });
    var to = model.participants.find(function (p) { return p.id === m.to; });

    /* ===== SELF-LOOP ===== */
    if (from.id === to.id) {
      var startX = from.centerX;
      var startY = m.y;
      var loopHeight = clamp(m._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H, DIAGRAM_CONFIG.selfLoop.MIN_H, DIAGRAM_CONFIG.selfLoop.MAX_H);
      var endY = startY + loopHeight;

      var stubLength = STUB_LIMIT_SELF; // solo self usa su stub
      var stubEndX = startX + stubLength;
      var pathData = [
        "M " + startX + " " + startY,
        "L " + stubEndX + " " + startY,
        "L " + stubEndX + " " + endY,
        "L " + startX + " " + endY
      ].join(" ");
      var selfPath = SVGe("path", { d: pathData }, "msg");
      selfPath.setAttribute("marker-end", "url(#arrowTip)");
      svg.appendChild(selfPath);

      // texto
      var textCenterX = startX + (stubLength * 0.5);
      var textY = startY - 8;
      var selfText = textEl(textCenterX, textY, "", "label-text");
      selfText.setAttribute("text-anchor", "middle");
      svg.appendChild(selfText);
      var availableTextWidth = Math.min(DIAGRAM_CONFIG.labels.MAX_CAP, Math.abs(stubLength) * 0.8);
      wrapTextCenter(selfText, m.text, availableTextWidth);

      var finalTextBBox = selfText.getBBox();
      var minTextY = DIAGRAM_CONFIG.layout.TOP_PAD + 20;
      if (finalTextBBox.y < minTextY) {
        var adjustment = minTextY - finalTextBBox.y;
        var originalY = parseFloat(selfText.getAttribute("y")) || 0;
        selfText.setAttribute("y", originalY + adjustment);
        var tspans = selfText.querySelectorAll("tspan");
        for (var ti = 0; ti < tspans.length; ti++) if (ti > 0) tspans[ti].setAttribute("dy", 14);
        finalTextBBox = selfText.getBBox();
      }

      var textBubble = rect(
        finalTextBBox.x - DIAGRAM_CONFIG.labels.PAD_X,
        finalTextBBox.y - DIAGRAM_CONFIG.labels.PAD_Y,
        finalTextBBox.width + DIAGRAM_CONFIG.labels.PAD_X * 2,
        finalTextBBox.height + DIAGRAM_CONFIG.labels.PAD_Y * 2,
        6, 6, "label-bubble"
      );
      svg.insertBefore(textBubble, selfText);

      // terminales (UI; invisibles al exportar)
      var terminalWidth = 3, terminalHeight = 12;
      var startTerminal = rect(startX - terminalWidth / 2, startY - terminalHeight / 2, terminalWidth, terminalHeight, 2, 2, "endpoint");
      var endTerminal = rect(startX - terminalWidth / 2, endY - terminalHeight / 2, terminalWidth, terminalHeight, 2, 2, "endpoint");
      startTerminal.style.pointerEvents = "none";
      endTerminal.style.pointerEvents = "none";
      svg.appendChild(startTerminal);
      svg.appendChild(endTerminal);

      // handle vertical (mover o redimensionar con Shift)
      var handleX = startX + (stubLength * 0.75);
      var handleY = endY;
      var handle = SVGe("circle", { cx: handleX, cy: handleY, r: 8 }, "handle");
      var handleHalo = SVGe("circle", { cx: handleX, cy: handleY, r: 16 }, "handle-halo");
      handle.style.cursor = "ns-resize";
      handleHalo.style.cursor = "ns-resize";
      svg.appendChild(handleHalo);
      svg.appendChild(handle);

      var selfDragState = { startMouseY: 0, startMsgY: startY, startLoopH: loopHeight, moving: false, resizing: false };
      function onSelfMove(e) {
        if (!selfDragState.moving && !selfDragState.resizing) return;
        var dy = e.clientY - selfDragState.startMouseY;
        if (selfDragState.resizing) {
          m._loopH = clamp(selfDragState.startLoopH + dy, DIAGRAM_CONFIG.selfLoop.MIN_H, DIAGRAM_CONFIG.selfLoop.MAX_H);
        } else {
          var minY = (m === FIRST_MSG) ? FIRST_MSG_MIN_Y : (DIAGRAM_CONFIG.layout.TOP_PAD + FIRST_OFFSET);
          var maxY = DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H - (m._loopH || loopHeight) - 6;
          m.y = clamp(selfDragState.startMsgY + dy, minY, maxY);
        }
        scheduleRender();
      }
      function startSelfDrag(e) {
        selfDragState.startMouseY = e.clientY;
        selfDragState.startMsgY = m.y;
        selfDragState.startLoopH = m._loopH || DIAGRAM_CONFIG.selfLoop.DEFAULT_H;
        selfDragState.resizing = e.shiftKey;
        selfDragState.moving = !selfDragState.resizing;
        e.preventDefault(); e.stopPropagation();
      }
      function endSelfDrag() {
        selfDragState.moving = false; selfDragState.resizing = false;
        try {
          cascadeShiftDown(m);
          var validMsgs = model.messages.filter(mm => mm._fromOk && mm._toOk);
          var sorted = stableSortByY(validMsgs);
          // aplica una pasada de spacing
          var baseGap = DIAGRAM_CONFIG.layout.MIN_Y_GAP;
          if (sorted.length) {
            var prevY = sorted[0].y;
            for (var i = 1; i < sorted.length; i++) {
              var cur = sorted[i];
              cur.y = Math.max(cur.y, prevY + baseGap);
              prevY = cur.y;
            }
          }
          renumberAll();
        } catch (e) { }
        scheduleRender();
      }
      handleHalo.addEventListener("mousedown", startSelfDrag);
      handle.addEventListener("mousedown", startSelfDrag);
      window.addEventListener("mousemove", onSelfMove, { passive: true });
      window.addEventListener("mouseup", endSelfDrag);

      if (m.step) {
        var gapSL = 8;
        var badgeCXsl = finalTextBBox.x + finalTextBBox.width / 2;
        var badgeCYsl = finalTextBBox.y - gapSL - DIAGRAM_CONFIG.badge.RADIUS;
        var gsl = drawBadge(badgeCXsl, badgeCYsl, m.step);
        svg.appendChild(gsl);
      }
      return;
    }

    /* ===== MENSAJE NORMAL ===== */
    var x1 = from.centerX, x2 = to.centerX, y = m.y, mid = (x1 + x2) / 2;
    var normalPath = SVGe("path", { d: "M " + x1 + " " + y + " L " + x2 + " " + y }, "msg");
    normalPath.setAttribute("marker-end", "url(#arrowTip)");
    svg.appendChild(normalPath);

    var normalHalo = SVGe("circle", { cx: mid, cy: y, r: 16 }, "handle-halo");
    var normalHandle = SVGe("circle", { cx: mid, cy: y, r: 8 }, "handle");
    normalHalo.style.cursor = "ns-resize";
    normalHandle.style.cursor = "ns-resize";
    svg.appendChild(normalHalo);
    svg.appendChild(normalHandle);

    var normalDragState = { startMouseY: 0, startMsgY: y, active: false };
    function startNormalDrag(e) { normalDragState.startMouseY = e.clientY; normalDragState.startMsgY = m.y; normalDragState.active = true; e.preventDefault(); e.stopPropagation(); }
    function onNormalDragMove(e) {
      if (!normalDragState.active) return;
      var dy = e.clientY - normalDragState.startMouseY;
      var minY = (m === FIRST_MSG) ? FIRST_MSG_MIN_Y : (DIAGRAM_CONFIG.layout.TOP_PAD + FIRST_OFFSET);
      var maxY = DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H - 6;
      m.y = clamp(normalDragState.startMsgY + dy, minY, maxY);
      scheduleRender();
    }
    function endNormalDrag() {
      normalDragState.active = false;
      try {
        cascadeShiftDown(m);
        var validMsgs = model.messages.filter(mm => mm._fromOk && mm._toOk);
        var sorted = stableSortByY(validMsgs);
        var baseGap = DIAGRAM_CONFIG.layout.MIN_Y_GAP;
        if (sorted.length) {
          var prevY = sorted[0].y;
          for (var i = 1; i < sorted.length; i++) {
            var cur = sorted[i];
            cur.y = Math.max(cur.y, prevY + baseGap);
            prevY = cur.y;
          }
        }
        renumberAll();
      } catch (e) { }
      scheduleRender();
    }
    normalHalo.addEventListener("mousedown", startNormalDrag);
    normalHandle.addEventListener("mousedown", startNormalDrag);
    window.addEventListener("mousemove", onNormalDragMove, { passive: true });
    window.addEventListener("mouseup", endNormalDrag);

    var maxLabelW = Math.min(DIAGRAM_CONFIG.labels.MAX_CAP, Math.max(60, Math.abs(x2 - x1) * DIAGRAM_CONFIG.labels.USED_RATIO) - DIAGRAM_CONFIG.labels.MARGIN);
    var normalText = textEl(mid, y - 8, "", "label-text");
    normalText.setAttribute("text-anchor", "middle");
    svg.appendChild(normalText);
    wrapTextCenter(normalText, m.text, maxLabelW);
    var normalTextBBox = normalText.getBBox();
    var maxTopAllowed = m.y - normalTextBBox.height - 8;
    var requestedY = Math.min(normalTextBBox.y, maxTopAllowed);
    var reservedTextY = reserve(requestedY, Math.min(x1, x2) + 6, Math.max(x1, x2) - 6, normalTextBBox.height);
    reservedTextY = Math.min(reservedTextY, maxTopAllowed);
    var normalTextDeltaY = reservedTextY - normalTextBBox.y;
    if (normalTextDeltaY !== 0) {
      var normalOriginalY = parseFloat(normalText.getAttribute("y")) || 0;
      normalText.setAttribute("y", normalOriginalY + normalTextDeltaY);
      var normalTspans = normalText.querySelectorAll("tspan");
      for (var nti = 0; nti < normalTspans.length; nti++) if (nti > 0) normalTspans[nti].setAttribute("dy", 14);
    }
    var finalNormalTextBBox = normalText.getBBox();
    var normalTextBubble = rect(
      finalNormalTextBBox.x - DIAGRAM_CONFIG.labels.PAD_X,
      finalNormalTextBBox.y - DIAGRAM_CONFIG.labels.PAD_Y,
      finalNormalTextBBox.width + DIAGRAM_CONFIG.labels.PAD_X * 2,
      finalNormalTextBBox.height + DIAGRAM_CONFIG.labels.PAD_Y * 2,
      6, 6, "label-bubble"
    );
    svg.insertBefore(normalTextBubble, normalText);

    if (m.step) {
      var gap = 8;
      var badgeCX = mid;
      var badgeCY = finalNormalTextBBox.y - gap - DIAGRAM_CONFIG.badge.RADIUS;
      var g = drawBadge(badgeCX, badgeCY, m.step);
      svg.appendChild(g);
    }
  });

  // ajustar viewBox
  var last = model.participants[model.participants.length - 1];
  var endX = last ? (last.x + last.headW + 200) : 1200;
  var endY = DIAGRAM_CONFIG.layout.TOP_PAD + DIAGRAM_CONFIG.layout.LIFELINE_H + 40;
  svg.setAttribute("viewBox", "0 0 " + Math.max(endX, 900) + " " + Math.max(endY, 800));
}

/* ===== Bootstrap + util ===== */
function render(xmlStr) {
  try {
    var root = parseXML(xmlStr);
    model = buildModel(root);

    // varias pasadas: espacio vertical + auto-ancho
    for (var k = 0; k < Math.max(AUTOLAYOUT_PASSES, 1); k++) {
      for (var i = 0; i < Math.max(SPACEV_PASSES, 1); i++) recomputeYByOrder();
      autoLayoutParticipants();
    }
    renumberAll();
    renderFromModel();
  } catch (e) {
    console.error("Error en render:", e);
    alert("Error al procesar XML: " + (e.message || e));
  }
}

function svgString(hideHandles) {
  var clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  var vb = clone.viewBox.baseVal;
  var w = vb.width || 1200, h = vb.height || 800;
  if (hideHandles) {
    clone.querySelectorAll(".handle, .handle-halo, .endpoint").forEach(function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }
  clone.style.fontFamily = "Arial,'Helvetica Neue',Helvetica,sans-serif";
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  return new XMLSerializer().serializeToString(clone);
}

function download(url, filename) {
  var a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

function exportImage(mime) {
  var str = svgString(true);
  var img = new Image();
  var vb = svg.viewBox.baseVal;
  var scale = parseInt(document.getElementById("scaleSel").value || "2", 10);
  var w = (vb.width || 1200) * scale, h = (vb.height || 800) * scale;
  img.onload = function () {
    var canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext("2d", { alpha: false });
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    if (mime === "image/png") canvas.toBlob(function (b) { download(URL.createObjectURL(b), "diagrama.png"); }, "image/png");
    else canvas.toBlob(function (b) { download(URL.createObjectURL(b), "diagrama.jpg"); }, "image/jpeg", 0.98);
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(str);
}

/* ===== Botones ===== */
var autoBtn = document.getElementById("autoBtn");
var spaceVBtn = document.getElementById("spaceVBtn");
var autoHBtn = document.getElementById("autoHBtn");
var reNumBtn = document.getElementById("reNumBtn");

if (autoBtn) autoBtn.onclick = function () {
  for (var k = 0; k < AUTOLAYOUT_PASSES; k++) {
    autoLayoutParticipants();
  }
  renderFromModel();
};
if (reNumBtn) reNumBtn.onclick = function () { renumberAll(); renderFromModel(); };
if (spaceVBtn) spaceVBtn.onclick = function () {
  for (var i = 0; i < SPACEV_PASSES; i++) recomputeYByOrder();
  renumberAll();
  renderFromModel();
};
if (autoHBtn) autoHBtn.onclick = function () { for (var k = 0; k < AUTOLAYOUT_PASSES; k++) autoLayoutParticipants(); renderFromModel(); };

document.getElementById("exportBtn").onclick = function () {
  var out = modelToXML(); var blob = new Blob([out], { type: "application/xml" });
  download(URL.createObjectURL(blob), "diagrama.xml");
};
document.getElementById("tplBtn").onclick = function () {
  var tpl = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sequence title="Mi Diagrama de Secuencia — Plantilla">\n' +
    '  <participants>\n' +
    '    <p id="oic" label="OIC"/>\n' +
    '    <p id="ftp" label="FTP"/>\n' +
    '    <p id="oci" label="OCI Object Storage"/>\n' +
    '    <p id="erp" label="ERP"/>\n' +
    '  </participants>\n' +
    '  <messages>\n' +
    '    <m from="oic" to="ftp" text="Paso 1"/>\n' +
    '    <m from="ftp" to="ftp" text="Self-loop (ejemplo)"/>\n' +
    '  </messages>\n' +
    '</sequence>';
  var blob = new Blob([tpl], { type: "application/xml" });
  download(URL.createObjectURL(blob), "plantilla_diagrama.xml");
};
document.getElementById("exportPngBtn").onclick = function () { exportImage("image/png"); };
document.getElementById("exportJpgBtn").onclick = function () { exportImage("image/jpeg"); };

/* ===== Zoom ===== */
function applyZoom() { viewport.style.transform = "scale(" + zoom + ")"; }
document.getElementById("zoomInBtn").onclick = function () { zoom = Math.min(2.5, zoom + 0.1); applyZoom(); };
document.getElementById("zoomOutBtn").onclick = function () { zoom = Math.max(0.4, zoom - 0.1); applyZoom(); };
document.getElementById("zoomResetBtn").onclick = function () { zoom = 1; applyZoom(); };

/* ===== Init ===== */
(function () {
  try {
    var xmlStrInitial = document.getElementById("initial-xml").textContent.trim();
    render(xmlStrInitial);
  } catch (e) { console.error("init", e); }
})();

