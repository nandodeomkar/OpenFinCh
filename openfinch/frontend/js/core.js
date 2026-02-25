
// ========== STATE ==========
let DATASETS = null;
let currentInterval = '{default_interval}';
let currentSymbol = '{default_symbol}';

const urlParams = new URLSearchParams(window.location.search);
const isPopout = urlParams.get('popout') === 'true';
const initialTab = urlParams.get('tab');
if (urlParams.get('symbol')) {
  currentSymbol = urlParams.get('symbol').toUpperCase();
}
if (isPopout) {
  document.body.classList.add('is-popout');
}


let ALL_CANDLES = [];
let ALL_VOLUME  = [];
let ALL_LINE    = [];

// ========== TIMEZONE STATE ==========
let chartTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Custom tick mark formatter that respects the selected timezone.
// TickMarkType: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
function tzTickMarkFormatter(time, tickMarkType, locale) {
  // Business day object (daily data) — no timezone conversion needed
  if (typeof time === 'object' && time.year) {
    const d = new Date(time.year, time.month - 1, time.day);
    switch (tickMarkType) {
      case 0: return d.getFullYear().toString();
      case 1: return d.toLocaleDateString(locale, { month: 'short' });
      case 2: return d.getDate().toString();
      default: return d.toLocaleDateString(locale);
    }
  }
  // String date (daily data)
  if (typeof time === 'string') return time;
  // Unix timestamp (intraday data) — apply timezone
  const date = new Date(time * 1000);
  const tz = chartTimezone;
  switch (tickMarkType) {
    case 0: return date.toLocaleDateString(locale, { year: 'numeric', timeZone: tz });
    case 1: return date.toLocaleDateString(locale, { month: 'short', timeZone: tz });
    case 2: return date.toLocaleDateString(locale, { day: 'numeric', timeZone: tz });
    case 3: return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    case 4: return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz });
    default: return date.toLocaleString(locale, { hour12: false, timeZone: tz });
  }
}

// Format time for crosshair bottom label
function tzTimeFormatter(time) {
  if (typeof time === 'object' && time.year) {
    const d = new Date(time.year, time.month - 1, time.day);
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  if (typeof time === 'string') return time;
  const date = new Date(time * 1000);
  const tz = chartTimezone;
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', timeZone: tz })
    + ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
}

// ========== CHART SETUP ==========
const container = document.getElementById('chart');
const chart = LightweightCharts.createChart(container, {
  autoSize: true,
  layout: { background: { type: 'solid', color: '#0a0a0f' }, textColor: '#e0e0e0' },
  grid: { vertLines: { color: '#1a1a24' }, horzLines: { color: '#1a1a24' } },
  crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#1e1e28' },
  timeScale: { borderColor: '#1e1e28', timeVisible: true, secondsVisible: false, tickMarkFormatter: tzTickMarkFormatter },
  localization: { timeFormatter: tzTimeFormatter },
  watermark: { visible: false },
});

const candleSeries = chart.addCandlestickSeries({
  upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
});
const lineSeries = chart.addLineSeries({
  color: '#f0b90b', lineWidth: 2, visible: false, crosshairMarkerRadius: 4,
});
const areaSeries = chart.addAreaSeries({
  lineColor: '#f0b90b', lineWidth: 2,
  topColor: 'rgba(240, 185, 11, 0.35)',
  bottomColor: 'rgba(240, 185, 11, 0.02)',
  visible: false, crosshairMarkerRadius: 4,
});

let volumeSeries = null;
let chartMode = 'candles';

// ========== DATA LOADING ==========
const loadingEl = document.getElementById('loading');
const toastEl = document.getElementById('toast');

function showLoading() { loadingEl.classList.add('active'); }
function hideLoading() { loadingEl.classList.remove('active'); }

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

async function fetchInterval(symbol, interval) {
  const resp = await fetch('/api/interval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, interval }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.detail || 'Failed to fetch data');
  return data.dataset;
}

async function fetchSymbol(symbol) {
  showLoading();
  try {
    const ds = await fetchInterval(symbol, currentInterval);
    currentSymbol = symbol.toUpperCase();
    DATASETS = {};
    DATASETS[currentInterval] = ds;
    document.title = currentSymbol + ' — OpenFinCh';
    renderInterval(ds);
  } catch (e) {
    showToast(e.message || 'Network error');
  }
  hideLoading();
}

function renderInterval(ds) {
  ALL_CANDLES = ds.candles;
  ALL_VOLUME  = ds.volume;
  ALL_LINE    = ALL_CANDLES.map(c => ({ time: c.time, value: c.close }));

  chart.applyOptions({
    timeScale: { timeVisible: ds.intraday, secondsVisible: false },
  });

  candleSeries.setData(ALL_CANDLES);
  lineSeries.setData(ALL_LINE);
  areaSeries.setData(ALL_LINE);
  if (volumeSeries) {
    volumeSeries.setData(ALL_VOLUME);
    const sp = subPanes['volume'];
    if (sp && sp.chart) {
      sp.chart.applyOptions({
        timeScale: { timeVisible: ds.intraday, secondsVisible: false },
      });
    }
  }
  chart.timeScale().fitContent();

  Object.values(subPanes).forEach(sp => {
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) sp.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
  });
}

async function applyInterval(interval) {
  if (typeof clearAllDrawings === 'function') clearAllDrawings();
  deactivateDrawingTool && deactivateDrawingTool();
  currentInterval = interval;
  document.getElementById('interval-select').value = interval;

  if (DATASETS && DATASETS[interval]) {
    renderInterval(DATASETS[interval]);
    return;
  }

  showLoading();
  try {
    const ds = await fetchInterval(currentSymbol, interval);
    if (!DATASETS) DATASETS = {};
    DATASETS[interval] = ds;
    renderInterval(ds);
  } catch (e) {
    showToast(e.message || 'Failed to load interval');
  }
  hideLoading();
}

// ========== MULTI-PANE SYSTEM ==========
const chartsContainer = document.getElementById('charts-container');
const subPanes = {};
let syncingTimeScale = false;

chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
  if (syncingTimeScale) return;
  syncingTimeScale = true;
  Object.values(subPanes).forEach(sp => {
    if (sp.chart) sp.chart.timeScale().setVisibleLogicalRange(range);
  });
  syncingTimeScale = false;
});

function createSubPane(id, label, height) {
  const divider = document.createElement('div');
  divider.className = 'pane-divider';
  chartsContainer.appendChild(divider);

  const paneDiv = document.createElement('div');
  paneDiv.className = 'chart-pane';
  paneDiv.id = 'pane-' + id;
  paneDiv.style.height = height + 'px';
  paneDiv.style.flexShrink = '0';
  chartsContainer.appendChild(paneDiv);

  const lbl = document.createElement('div');
  lbl.className = 'pane-label';
  lbl.textContent = label;
  paneDiv.appendChild(lbl);

  const chartDiv = document.createElement('div');
  chartDiv.className = 'pane-chart';
  paneDiv.appendChild(chartDiv);

  const isIntraday = DATASETS && DATASETS[currentInterval] ? DATASETS[currentInterval].intraday : true;
  const subChart = LightweightCharts.createChart(chartDiv, {
    autoSize: true,
    layout: { background: { type: 'solid', color: '#0a0a0f' }, textColor: '#e0e0e0' },
    grid: { vertLines: { color: '#1a1a24' }, horzLines: { color: '#1a1a24' } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: '#1e1e28' },
    timeScale: { borderColor: '#1e1e28', timeVisible: isIntraday, secondsVisible: false, visible: true, tickMarkFormatter: tzTickMarkFormatter },
    localization: { timeFormatter: tzTimeFormatter },
  });

  subChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (syncingTimeScale) return;
    syncingTimeScale = true;
    chart.timeScale().setVisibleLogicalRange(range);
    Object.values(subPanes).forEach(sp => {
      if (sp.chart && sp.chart !== subChart) sp.chart.timeScale().setVisibleLogicalRange(range);
    });
    syncingTimeScale = false;
  });

  let startY = 0, startH = 0;
  divider.addEventListener('mousedown', e => {
    startY = e.clientY;
    startH = paneDiv.offsetHeight;
    divider.classList.add('dragging');
    const onMove = ev => {
      const newH = Math.max(60, startH - (ev.clientY - startY));
      paneDiv.style.height = newH + 'px';
    };
    const onUp = () => {
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  const pane = { chart: subChart, series: null, container: paneDiv, divider, chartDiv };
  subPanes[id] = pane;
  return pane;
}

function destroySubPane(id) {
  const sp = subPanes[id];
  if (!sp) return;
  sp.chart.remove();
  sp.container.remove();
  sp.divider.remove();
  delete subPanes[id];
}
