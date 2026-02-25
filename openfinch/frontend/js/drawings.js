// ========== DRAWING TOOLS ==========
let drawingsList = [];
let activeCursorMode = 'cross';
let drawingToolActive = null;   // e.g. 'trendline', 'hline', null
let drawingState = 'IDLE';      // IDLE | PLACING_A | PLACING_B
let drawingPendingA = null;     // {time, price}
let selectedDrawingId = null;
let dragState = null;
let drawingIdCounter = 0;
let drawingsOverlay = null;

const ONE_CLICK_TOOLS = ['hline','hray','vline','crossline'];
const TWO_CLICK_TOOLS = ['trendline','ray','infoline','extendedline','trendangle'];

// --- Geometry helpers ---
function pointToSegmentDist(px,py, x1,y1, x2,y2) {
  const dx = x2-x1, dy = y2-y1;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return Math.hypot(px-x1, py-y1);
  let t = ((px-x1)*dx + (py-y1)*dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}

function lineEdgeIntersections(x1,y1, x2,y2, w,h) {
  const pts = [];
  const dx = x2-x1, dy = y2-y1;
  if (dx !== 0) {
    let t;
    t = (0-x1)/dx; if (t >= 0 || t <= 0) { const yy = y1+t*dy; if (yy>=0 && yy<=h) pts.push({x:0,y:yy,t}); }
    t = (w-x1)/dx; { const yy = y1+t*dy; if (yy>=0 && yy<=h) pts.push({x:w,y:yy,t}); }
  }
  if (dy !== 0) {
    let t;
    t = (0-y1)/dy; { const xx = x1+t*dx; if (xx>=0 && xx<=w) pts.push({x:xx,y:0,t}); }
    t = (h-y1)/dy; { const xx = x1+t*dx; if (xx>=0 && xx<=w) pts.push({x:xx,y:h,t}); }
  }
  return pts;
}

function computeAngle(x1,y1, x2,y2) {
  return Math.atan2(-(y2-y1), x2-x1) * 180 / Math.PI;
}

// --- Single overlay primitive (renders ALL drawings in one canvas call) ---
function renderOneDrawing(ctx, d, w, h) {
  const px1 = d._px1, py1 = d._py1;
  const px2 = d._px2, py2 = d._py2;
  if (px1 == null || py1 == null) return;

  ctx.strokeStyle = d.color;
  ctx.lineWidth = d.selected ? d.lineWidth + 1 : d.lineWidth;
  ctx.setLineDash([]);

  const type = d.type;

  if (type === 'hline') {
    ctx.beginPath(); ctx.moveTo(0, py1); ctx.lineTo(w, py1); ctx.stroke();
  } else if (type === 'vline') {
    ctx.beginPath(); ctx.moveTo(px1, 0); ctx.lineTo(px1, h); ctx.stroke();
  } else if (type === 'crossline') {
    ctx.beginPath(); ctx.moveTo(0, py1); ctx.lineTo(w, py1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px1, 0); ctx.lineTo(px1, h); ctx.stroke();
  } else if (type === 'hray') {
    ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(w, py1); ctx.stroke();
  } else if (px2 != null && py2 != null) {
    // Two-click tools
    if (type === 'trendline') {
      ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
    } else if (type === 'ray') {
      ctx.beginPath(); ctx.moveTo(px1, py1);
      const edges = lineEdgeIntersections(px1,py1, px2,py2, w, h);
      const forward = edges.filter(e => e.t > 0).sort((a,b) => a.t - b.t);
      const end = forward.length ? forward[forward.length-1] : {x:px2, y:py2};
      ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (type === 'extendedline') {
      const edges = lineEdgeIntersections(px1,py1, px2,py2, w, h);
      const backward = edges.filter(e => e.t < 0).sort((a,b) => b.t - a.t);
      const forward = edges.filter(e => e.t > 0).sort((a,b) => a.t - b.t);
      const start = backward.length ? backward[backward.length-1] : {x:px1, y:py1};
      const end = forward.length ? forward[forward.length-1] : {x:px2, y:py2};
      ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
    } else if (type === 'infoline') {
      ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      const mx = (px1+px2)/2, my = (py1+py2)/2;
      const priceA = d.pointA.price, priceB = d.pointB.price;
      const delta = priceB - priceA;
      const pct = priceA !== 0 ? ((delta/priceA)*100).toFixed(2) : '0';
      const label = (delta>=0?'+':'')+delta.toFixed(2)+' ('+pct+'%)';
      ctx.font = '11px sans-serif';
      ctx.fillStyle = d.color;
      ctx.fillText(label, mx+6, my-6);
    } else if (type === 'trendangle') {
      ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
      const angle = d.angle != null ? d.angle : computeAngle(px1,py1, px2,py2);
      const label = angle.toFixed(1) + '°';
      const r = 20;
      ctx.beginPath();
      ctx.arc(px1, py1, r, 0, -angle*Math.PI/180, angle > 0);
      ctx.stroke();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = d.color;
      ctx.fillText(label, px1+r+4, py1-4);
    }

    // Endpoint circles for two-click tools
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(px1, py1, 4, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px2, py2, 4, 0, Math.PI*2); ctx.fill();
  }

  // Selection handles
  if (d.selected) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    const drawHandle = (x,y) => {
      ctx.fillRect(x-4, y-4, 8, 8);
      ctx.strokeRect(x-4, y-4, 8, 8);
    };
    drawHandle(px1, py1);
    if (px2 != null && py2 != null) drawHandle(px2, py2);
  }
}

class DrawingsOverlayRenderer {
  constructor() { this._drawings = null; }
  setDrawings(drawings) { this._drawings = drawings; }
  draw(target) {
    target.useMediaCoordinateSpace(scope => {
      const ctx = scope.context;
      const w = scope.mediaSize.width;
      const h = scope.mediaSize.height;
      if (!this._drawings) return;
      for (const d of this._drawings) {
        renderOneDrawing(ctx, d, w, h);
      }
    });
  }
}

class DrawingsOverlayPaneView {
  constructor() { this._renderer = new DrawingsOverlayRenderer(); }
  update(source) {
    const series = source._series;
    const chart = source._chart;
    if (!series || !chart) return;
    const ts = chart.timeScale();
    for (const d of drawingsList) {
      const x1 = ts.timeToCoordinate(d.pointA.time);
      const y1 = series.priceToCoordinate(d.pointA.price);
      if (x1 != null && y1 != null) {
        d._px1 = x1; d._py1 = y1;
      } else {
        d._px1 = null; d._py1 = null;
      }
      if (d.pointB) {
        const x2 = ts.timeToCoordinate(d.pointB.time);
        const y2 = series.priceToCoordinate(d.pointB.price);
        if (x2 != null && y2 != null) {
          d._px2 = x2; d._py2 = y2;
        } else {
          d._px2 = null; d._py2 = null;
        }
      } else {
        d._px2 = null; d._py2 = null;
      }
    }
    this._renderer.setDrawings(drawingsList);
  }
  renderer() { return this._renderer; }
  zOrder() { return 'top'; }
}

class DrawingsOverlayPrimitive {
  constructor() {
    this._paneView = new DrawingsOverlayPaneView();
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
  }
  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  updateAllViews() {
    this._paneView.update(this);
  }
  paneViews() {
    return [this._paneView];
  }
  requestUpdate() {
    if (this._requestUpdate) this._requestUpdate();
  }
}

// --- Core drawing functions ---
function ensureOverlay() {
  if (!drawingsOverlay) {
    drawingsOverlay = new DrawingsOverlayPrimitive();
    candleSeries.attachPrimitive(drawingsOverlay);
  }
}

function createDrawing(type, pointA, pointB) {
  ensureOverlay();
  const id = ++drawingIdCounter;
  const drawing = {
    id, type, pointA, pointB,
    color: currentDrawingColor, lineWidth: 2,
    selected: false,
    _px1: null, _py1: null, _px2: null, _py2: null,
  };
  drawingsList.push(drawing);
  drawingsOverlay.requestUpdate();
  return drawing;
}

function deleteDrawing(id) {
  const idx = drawingsList.findIndex(d => d.id === id);
  if (idx === -1) return;
  drawingsList.splice(idx, 1);
  if (selectedDrawingId === id) selectedDrawingId = null;
  if (drawingsOverlay) drawingsOverlay.requestUpdate();
}

function selectDrawing(id) {
  deselectAllDrawings();
  const d = drawingsList.find(d => d.id === id);
  if (d) {
    d.selected = true;
    selectedDrawingId = id;
  }
  if (drawingsOverlay) drawingsOverlay.requestUpdate();
}

function deselectAllDrawings() {
  drawingsList.forEach(d => { d.selected = false; });
  selectedDrawingId = null;
  if (drawingsOverlay) drawingsOverlay.requestUpdate();
}

function clearAllDrawings() {
  drawingsList.length = 0;
  selectedDrawingId = null;
  drawingIdCounter = 0;
  if (drawingsOverlay) drawingsOverlay.requestUpdate();
}

// --- Tool activation ---
function activateDrawingTool(type) {
  drawingToolActive = type;
  drawingState = 'PLACING_A';
  drawingPendingA = null;
  document.querySelectorAll('.dt-btn').forEach(b => b.classList.toggle('active', b.dataset.tool === type));
  container.style.cursor = 'crosshair';
}

function deactivateDrawingTool() {
  drawingToolActive = null;
  drawingState = 'IDLE';
  drawingPendingA = null;
  // Remove preview drawing from list
  const previewIdx = drawingsList.findIndex(d => d.id === -1);
  if (previewIdx !== -1) {
    drawingsList.splice(previewIdx, 1);
    if (drawingsOverlay) drawingsOverlay.requestUpdate();
  }
  document.querySelectorAll('.dt-btn').forEach(b => b.classList.remove('active'));
  container.style.cursor = '';
}

function toggleDrawingTool(type) {
  if (drawingToolActive === type) deactivateDrawingTool();
  else activateDrawingTool(type);
}

function setCursorMode(mode) {
  activeCursorMode = mode;
  deactivateDrawingTool();
  document.querySelectorAll('.cursor-btn').forEach(b => b.classList.toggle('active', b.dataset.cursor === mode));
  const activeBtn = document.querySelector('.cursor-btn[data-cursor="' + mode + '"]');
  if (activeBtn) {
    const mainBtn = document.getElementById('active-cursor-btn');
    mainBtn.innerHTML = activeBtn.innerHTML + '<div class="expand-arrow"></div>';
  }
  container.style.cursor = '';
  if (mode === 'cross') {
    chart.applyOptions({ crosshair: { mode: LightweightCharts.CrosshairMode.Normal } });
  } else if (mode === 'dot') {
    chart.applyOptions({ crosshair: { mode: LightweightCharts.CrosshairMode.Hidden } });
    container.style.cursor = 'crosshair';
  } else if (mode === 'arrow') {
    chart.applyOptions({ crosshair: { mode: LightweightCharts.CrosshairMode.Hidden } });
    container.style.cursor = 'default';
  }
}

document.querySelectorAll('.cursor-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setCursorMode(btn.dataset.cursor);
  });
});

// ========== DRAWING EVENT HANDLERS ==========

// Chart click for drawing placement & selection
chart.subscribeClick(param => {
  if (!param.time && !param.point) return;

  if (drawingToolActive) {
    // Get time and price from click
    const time = param.time;
    const price = candleSeries.coordinateToPrice(param.point.y);
    if (time == null || price == null) return;

    if (ONE_CLICK_TOOLS.includes(drawingToolActive)) {
      createDrawing(drawingToolActive, {time, price}, null);
      // Stay in PLACING_A for continuous placement
    } else if (TWO_CLICK_TOOLS.includes(drawingToolActive)) {
      if (drawingState === 'PLACING_A') {
        drawingPendingA = {time, price};
        ensureOverlay();
        // Add preview drawing to list
        const previewDrawing = {
          id: -1, type: drawingToolActive,
          pointA: drawingPendingA, pointB: {time, price},
          color: '#2962FF', lineWidth: 1.5,
          selected: false,
          _px1: null, _py1: null, _px2: null, _py2: null,
        };
        drawingsList.push(previewDrawing);
        drawingsOverlay.requestUpdate();
        drawingState = 'PLACING_B';
      } else if (drawingState === 'PLACING_B') {
        const pointB = {time, price};
        // Remove preview from list
        const previewIdx = drawingsList.findIndex(d => d.id === -1);
        if (previewIdx !== -1) drawingsList.splice(previewIdx, 1);
        const finalDrawing = createDrawing(drawingToolActive, drawingPendingA, pointB);
        if (drawingToolActive === 'trendangle') {
          const ts = chart.timeScale();
          const ax = ts.timeToCoordinate(drawingPendingA.time);
          const ay = candleSeries.priceToCoordinate(drawingPendingA.price);
          const bx = ts.timeToCoordinate(pointB.time);
          const by = candleSeries.priceToCoordinate(pointB.price);
          if (ax != null && ay != null && bx != null && by != null) {
            finalDrawing.angle = computeAngle(ax, ay, bx, by);
          }
        }
        drawingPendingA = null;
        drawingState = 'PLACING_A';
      }
    }
    return;
  }

  // Selection mode: hit-test drawings using cached pixel coords
  if (!param.point) return;
  const px = param.point.x, py = param.point.y;
  let bestDist = 12, bestId = null;

  for (const d of drawingsList) {
    if (d.id === -1) continue;
    const x1 = d._px1, y1 = d._py1;
    if (x1 == null || y1 == null) continue;

    let dist = Infinity;
    if (d.type === 'hline') {
      dist = Math.abs(py - y1);
    } else if (d.type === 'vline') {
      dist = Math.abs(px - x1);
    } else if (d.type === 'crossline') {
      dist = Math.min(Math.abs(py - y1), Math.abs(px - x1));
    } else if (d.type === 'hray') {
      dist = (px >= x1) ? Math.abs(py - y1) : Math.hypot(px-x1, py-y1);
    } else if (d._px2 != null && d._py2 != null) {
      dist = pointToSegmentDist(px,py, x1,y1, d._px2,d._py2);
    }
    if (dist < bestDist) { bestDist = dist; bestId = d.id; }
  }

  if (bestId != null) {
    selectDrawing(bestId);
  } else {
    deselectAllDrawings();
  }
});

// Crosshair move for preview update during PLACING_B
chart.subscribeCrosshairMove(param => {
  if (drawingState === 'PLACING_B' && param.point) {
    const preview = drawingsList.find(d => d.id === -1);
    if (!preview) return;
    const time = param.time;
    const price = candleSeries.coordinateToPrice(param.point.y);
    if (time != null && price != null) {
      preview.pointB = {time, price};
      if (drawingsOverlay) drawingsOverlay.requestUpdate();
    }
  }

  if (!drawingToolActive) {
    if (activeCursorMode === 'cross') {
      container.style.cursor = '';
    } else if (activeCursorMode === 'dot') {
      container.style.cursor = 'crosshair';
    } else if (activeCursorMode === 'arrow'){
      container.style.cursor = 'default';
    }
  }
});

// Drag support
const chartEl = document.getElementById('chart');
chartEl.addEventListener('mousedown', e => {
  if (drawingToolActive || selectedDrawingId == null) return;
  const rect = chartEl.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const d = drawingsList.find(dd => dd.id === selectedDrawingId);
  if (!d) return;

  // Use cached pixel coords
  const x1 = d._px1, y1 = d._py1;
  if (x1 == null || y1 == null) return;

  let handle = null;
  if (Math.hypot(px-x1, py-y1) < 10) handle = 'A';
  if (d._px2 != null && d._py2 != null) {
    if (Math.hypot(px-d._px2, py-d._py2) < 10) handle = 'B';
  }

  // Also check body hit for whole-drawing drag
  if (!handle) {
    let dist = Infinity;
    if (d.type === 'hline') dist = Math.abs(py - y1);
    else if (d.type === 'vline') dist = Math.abs(px - x1);
    else if (d.type === 'crossline') dist = Math.min(Math.abs(py-y1), Math.abs(px-x1));
    else if (d.type === 'hray') dist = px >= x1 ? Math.abs(py-y1) : Math.hypot(px-x1, py-y1);
    else if (d._px2 != null && d._py2 != null) {
      dist = pointToSegmentDist(px,py, x1,y1, d._px2,d._py2);
    }
    if (dist < 10) handle = 'body';
  }

  if (handle) {
    e.preventDefault();
    e.stopPropagation();
    dragState = {
      drawingId: d.id, handle,
      startX: px, startY: py,
      origA: { ...d.pointA },
      origB: d.pointB ? { ...d.pointB } : null,
      origAx: x1, origAy: y1,
      origBx: d._px2, origBy: d._py2,
    };
  }
}, true);

document.addEventListener('mousemove', e => {
  if (!dragState) return;
  const d = drawingsList.find(dd => dd.id === dragState.drawingId);
  if (!d) { dragState = null; return; }

  const rect = chartEl.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const ts = chart.timeScale();

  const coordToTimePrice = (x,y) => {
    const time = ts.coordinateToTime(x);
    const price = candleSeries.coordinateToPrice(y);
    return (time != null && price != null) ? {time, price} : null;
  };

  if (dragState.handle === 'A') {
    const tp = coordToTimePrice(px, py);
    if (tp) { d.pointA.time = tp.time; d.pointA.price = tp.price; }
  } else if (dragState.handle === 'B' && d.pointB) {
    const tp = coordToTimePrice(px, py);
    if (tp) { d.pointB.time = tp.time; d.pointB.price = tp.price; }
  } else if (dragState.handle === 'body') {
    const dx = px - dragState.startX, dy = py - dragState.startY;
    const origAx = dragState.origAx, origAy = dragState.origAy;
    if (origAx == null || origAy == null) return;
    const newA = coordToTimePrice(origAx + dx, origAy + dy);
    if (newA) { d.pointA.time = newA.time; d.pointA.price = newA.price; }
    if (dragState.origB && d.pointB) {
      const origBx = dragState.origBx, origBy = dragState.origBy;
      if (origBx != null && origBy != null) {
        const newB = coordToTimePrice(origBx + dx, origBy + dy);
        if (newB) { d.pointB.time = newB.time; d.pointB.price = newB.price; }
      }
    }
  }
  if (drawingsOverlay) drawingsOverlay.requestUpdate();
});

document.addEventListener('mouseup', () => {
  dragState = null;
});

// Context menu
const drawCtxMenu = document.getElementById('drawing-context-menu');
chartEl.addEventListener('contextmenu', e => {
  const rect = chartEl.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;

  let bestDist = 12, bestId = null;
  for (const d of drawingsList) {
    if (d.id === -1) continue;
    const x1 = d._px1, y1 = d._py1;
    if (x1 == null || y1 == null) continue;
    let dist = Infinity;
    if (d.type === 'hline') dist = Math.abs(py - y1);
    else if (d.type === 'vline') dist = Math.abs(px - x1);
    else if (d.type === 'crossline') dist = Math.min(Math.abs(py-y1), Math.abs(px-x1));
    else if (d.type === 'hray') dist = px >= x1 ? Math.abs(py-y1) : Math.hypot(px-x1, py-y1);
    else if (d._px2 != null && d._py2 != null) {
      dist = pointToSegmentDist(px,py, x1,y1, d._px2,d._py2);
    }
    if (dist < bestDist) { bestDist = dist; bestId = d.id; }
  }

  if (bestId != null) {
    e.preventDefault();
    selectDrawing(bestId);
    drawCtxMenu.style.left = e.clientX + 'px';
    drawCtxMenu.style.top = e.clientY + 'px';
    drawCtxMenu.classList.add('visible');
  }
});

document.getElementById('ctx-delete-drawing').addEventListener('click', () => {
  if (selectedDrawingId != null) deleteDrawing(selectedDrawingId);
  drawCtxMenu.classList.remove('visible');
});

document.addEventListener('click', () => {
  drawCtxMenu.classList.remove('visible');
});

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.key === 'Escape') {
    deactivateDrawingTool();
    deselectAllDrawings();
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId != null) {
    e.preventDefault();
    deleteDrawing(selectedDrawingId);
    return;
  }
  if (e.altKey) {
    switch (e.key.toLowerCase()) {
      case 't': e.preventDefault(); toggleDrawingTool('trendline'); break;
      case 'h': e.preventDefault(); toggleDrawingTool('hline'); break;
      case 'j': e.preventDefault(); toggleDrawingTool('hray'); break;
      case 'v': e.preventDefault(); toggleDrawingTool('vline'); break;
      case 'c': e.preventDefault(); toggleDrawingTool('crossline'); break;
    }
  }
});

// Toolbar button wiring
document.querySelectorAll('.dt-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const tool = btn.dataset.tool;
    if (tool) toggleDrawingTool(tool);
  });
});


