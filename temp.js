
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
// ========== TICKER INPUT + AUTOCOMPLETE ==========
const tickerInput = document.getElementById('ticker-input');
const tickerDropdown = document.getElementById('ticker-dropdown');
let searchTimer = null;
let ddIndex = -1;

function closeTicker() {
  tickerDropdown.classList.remove('open');
  tickerDropdown.innerHTML = '';
  ddIndex = -1;
}

function selectSuggestion(symbol) {
  tickerInput.value = symbol;
  closeTicker();
  tickerInput.blur();
  if (symbol !== currentSymbol) fetchSymbol(symbol);
}

function renderSuggestions(results) {
  tickerDropdown.innerHTML = '';
  ddIndex = -1;
  if (!results.length) { closeTicker(); return; }
  results.forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'ticker-suggestion';
    div.innerHTML = `<span class="ts-symbol">${r.symbol}</span><span class="ts-name">${r.name}</span><span class="ts-exchange">${r.exchange}</span>`;
    div.addEventListener('mousedown', e => { e.preventDefault(); selectSuggestion(r.symbol); });
    div.addEventListener('mouseenter', () => {
      ddIndex = i;
      updateDDHighlight();
    });
    tickerDropdown.appendChild(div);
  });
  tickerDropdown.classList.add('open');
}

function updateDDHighlight() {
  const items = tickerDropdown.querySelectorAll('.ticker-suggestion');
  items.forEach((el, i) => el.classList.toggle('active', i === ddIndex));
}

tickerInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = tickerInput.value.trim();
  if (q.length < 2) { closeTicker(); return; }
  searchTimer = setTimeout(async () => {
    try {
      const resp = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await resp.json();
      if (tickerInput.value.trim() === q) renderSuggestions(data.results || []);
    } catch(e) {}
  }, 300);
});

tickerInput.addEventListener('keydown', e => {
  const items = tickerDropdown.querySelectorAll('.ticker-suggestion');
  if (tickerDropdown.classList.contains('open') && items.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ddIndex = (ddIndex + 1) % items.length;
      updateDDHighlight();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      ddIndex = ddIndex <= 0 ? items.length - 1 : ddIndex - 1;
      updateDDHighlight();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (ddIndex >= 0 && ddIndex < items.length) {
        const sym = items[ddIndex].querySelector('.ts-symbol').textContent;
        selectSuggestion(sym);
      } else {
        const sym = tickerInput.value.trim().toUpperCase();
        closeTicker();
        if (sym && sym !== currentSymbol) { tickerInput.value = sym; fetchSymbol(sym); }
        tickerInput.blur();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); closeTicker(); return; }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const sym = tickerInput.value.trim().toUpperCase();
    closeTicker();
    if (sym && sym !== currentSymbol) { tickerInput.value = sym; fetchSymbol(sym); }
    tickerInput.blur();
  } else if (e.key === 'Escape') {
    closeTicker();
  }
});

tickerInput.addEventListener('focus', () => tickerInput.select());
tickerInput.addEventListener('blur', () => closeTicker());
document.addEventListener('click', e => {
  if (!e.target.closest('#ticker-wrap')) closeTicker();
});

// ========== INTERVAL DROPDOWN ==========
const intervalSelect = document.getElementById('interval-select');
const customGroup = document.getElementById('custom-interval-group');

intervalSelect.addEventListener('change', (e) => {
  if (e.target.value === 'custom') {
    customGroup.classList.add('visible');
  } else {
    customGroup.classList.remove('visible');
    applyInterval(e.target.value);
  }
});

// ========== CUSTOM INTERVAL ==========
async function applyCustomInterval() {
  const value = parseInt(document.getElementById('custom-value').value, 10);
  const unit = document.getElementById('custom-unit').value;
  if (!value || value < 1) { showToast('Enter a value ≥ 1'); return; }

  showLoading();
  try {
    const resp = await fetch('/api/custom_interval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: currentSymbol, value, unit }),
    });
    const data = await resp.json();
    if (!resp.ok) { showToast(data.error || 'Failed'); hideLoading(); return; }

    const ds = data.dataset;
    ALL_CANDLES = ds.candles;
    ALL_VOLUME  = ds.volume;
    ALL_LINE    = ALL_CANDLES.map(c => ({ time: c.time, value: c.close }));

    chart.applyOptions({ timeScale: { timeVisible: ds.intraday, secondsVisible: false } });
    candleSeries.setData(ALL_CANDLES);
    lineSeries.setData(ALL_LINE);
    areaSeries.setData(ALL_LINE);
    if (volumeSeries) {
      volumeSeries.setData(ALL_VOLUME);
      const sp = subPanes['volume'];
      if (sp && sp.chart) sp.chart.applyOptions({ timeScale: { timeVisible: ds.intraday, secondsVisible: false } });
    }
    chart.timeScale().fitContent();
    currentInterval = 'custom';
  } catch (e) {
    showToast('Error: ' + e.message);
  }
  hideLoading();
}

document.getElementById('custom-apply').addEventListener('click', applyCustomInterval);
document.getElementById('custom-value').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); applyCustomInterval(); }
});

// ========== CHART TYPE ==========
const chartTypeSelect = document.getElementById('chart-type');

function setChartMode(mode) {
  chartMode = mode;
  candleSeries.applyOptions({ visible: mode === 'candles' });
  lineSeries.applyOptions({ visible: mode === 'line' });
  areaSeries.applyOptions({ visible: mode === 'area' });
  chartTypeSelect.value = mode;
}

chartTypeSelect.addEventListener('change', () => setChartMode(chartTypeSelect.value));

// ========== OHLC LEGEND ==========
const lo = document.getElementById('lo');
const lh = document.getElementById('lh');
const ll = document.getElementById('ll');
const lc = document.getElementById('lc');
const lv = document.getElementById('lv');

function formatVol(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

chart.subscribeCrosshairMove(param => {
  if (!param || !param.time) return;
  const candle = param.seriesData.get(candleSeries);
  const vol = param.seriesData.get(volumeSeries);
  if (chartMode === 'candles' && candle) {
    const cls = candle.close >= candle.open ? 'up' : 'down';
    lo.textContent = candle.open.toFixed(2); lo.className = 'val ' + cls;
    lh.textContent = candle.high.toFixed(2); lh.className = 'val ' + cls;
    ll.textContent = candle.low.toFixed(2);  ll.className = 'val ' + cls;
    lc.textContent = candle.close.toFixed(2); lc.className = 'val ' + cls;
  } else if (chartMode === 'line' || chartMode === 'area') {
    const pt = param.seriesData.get(chartMode === 'line' ? lineSeries : areaSeries);
    if (pt) {
      lo.textContent = '—'; lo.className = 'val';
      lh.textContent = '—'; lh.className = 'val';
      ll.textContent = '—'; ll.className = 'val';
      lc.textContent = pt.value.toFixed(2); lc.className = 'val';
    }
  }
  if (volumeSeries && vol) { lv.textContent = formatVol(vol.value); }
});

// ========== CLOCK & TIMEZONE ==========
// Update the global timezone and force all charts to re-render their time axes.
window.updateChartTimezone = function(tz) {
  if (!tz) return;
  chartTimezone = tz;
  // Force main chart to re-render tick marks by toggling a benign option
  try {
    const range = chart.timeScale().getVisibleLogicalRange();
    chart.applyOptions({ localization: { timeFormatter: tzTimeFormatter } });
    // Re-apply tick mark formatter (forces label recalculation)
    chart.timeScale().applyOptions({ tickMarkFormatter: tzTickMarkFormatter });
    if (range) chart.timeScale().setVisibleLogicalRange(range);
  } catch(e) {}
  // Same for all sub-panes
  Object.values(subPanes).forEach(pane => {
    if (!pane.chart) return;
    try {
      const range = pane.chart.timeScale().getVisibleLogicalRange();
      pane.chart.applyOptions({ localization: { timeFormatter: tzTimeFormatter } });
      pane.chart.timeScale().applyOptions({ tickMarkFormatter: tzTickMarkFormatter });
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
  });
};

(function() {
  const wrapper = document.getElementById('clock-wrapper');
  const clockEl = document.getElementById('clock');
  const timeEl = document.getElementById('clock-time');
  const tzEl = document.getElementById('clock-tz');
  const picker = document.getElementById('tz-picker');
  const searchInput = document.getElementById('tz-search');
  const listEl = document.getElementById('tz-list');

  let selectedTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function getUTCOffset(tz) {
    try {
      const now = new Date();
      const str = now.toLocaleString('en-US', { timeZone: tz });
      const there = new Date(str);
      const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
      const utc = new Date(utcStr);
      const diffMin = Math.round((there - utc) / 60000);
      const sign = diffMin >= 0 ? '+' : '-';
      const abs = Math.abs(diffMin);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return 'UTC' + sign + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    } catch(e) {
      return 'UTC+00:00';
    }
  }

  function getTimeInTZ(tz) {
    return new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: tz
    });
  }

  // Grouped timezone data: group label -> list of IANA tz names
  const tzGroups = [
    ['Major Markets', [
      'America/New_York','America/Chicago','Europe/London','Europe/Berlin',
      'Europe/Paris','Asia/Tokyo','Asia/Hong_Kong','Asia/Shanghai',
      'Asia/Singapore','Asia/Kolkata','Australia/Sydney','America/Sao_Paulo'
    ]],
    ['Americas', [
      'Pacific/Honolulu','America/Anchorage','America/Los_Angeles','America/Vancouver',
      'America/Denver','America/Phoenix','America/Mexico_City',
      'America/Winnipeg','America/Bogota','America/Lima',
      'America/Toronto','America/Detroit','America/Havana',
      'America/Panama','America/Caracas','America/Halifax',
      'America/Santiago','America/Argentina/Buenos_Aires',
      'America/Montevideo','America/St_Johns'
    ]],
    ['Europe & Africa', [
      'Atlantic/Reykjavik','Europe/Dublin','Europe/Lisbon',
      'Africa/Casablanca','Europe/Amsterdam','Europe/Brussels',
      'Europe/Madrid','Europe/Rome','Europe/Stockholm','Europe/Oslo',
      'Europe/Vienna','Europe/Prague','Europe/Warsaw','Europe/Zurich',
      'Europe/Budapest','Europe/Athens','Europe/Bucharest',
      'Europe/Helsinki','Europe/Istanbul','Europe/Moscow',
      'Europe/Minsk','Africa/Cairo','Africa/Lagos',
      'Africa/Johannesburg','Africa/Nairobi'
    ]],
    ['Asia & Pacific', [
      'Asia/Jerusalem','Asia/Beirut','Asia/Baghdad',
      'Asia/Riyadh','Asia/Dubai','Asia/Tehran',
      'Asia/Baku','Asia/Tbilisi','Asia/Yerevan',
      'Asia/Kabul','Asia/Karachi','Asia/Tashkent',
      'Asia/Colombo','Asia/Kathmandu','Asia/Dhaka',
      'Asia/Rangoon','Asia/Bangkok','Asia/Ho_Chi_Minh',
      'Asia/Jakarta','Asia/Kuala_Lumpur','Asia/Manila',
      'Asia/Taipei','Asia/Seoul','Australia/Perth',
      'Australia/Adelaide','Australia/Darwin',
      'Australia/Brisbane','Australia/Melbourne',
      'Pacific/Guam','Pacific/Auckland','Pacific/Fiji'
    ]]
  ];

  // Flatten for search
  const allTZ = [];
  tzGroups.forEach(([, tzs]) => tzs.forEach(tz => { if (!allTZ.includes(tz)) allTZ.push(tz); }));
  // Add UTC if missing
  if (!allTZ.includes('UTC')) allTZ.push('UTC');

  // Pre-compute entries
  const tzEntries = allTZ.map(tz => {
    const offset = getUTCOffset(tz);
    const city = tz === 'UTC' ? 'UTC' : tz.split('/').pop().replace(/_/g, ' ');
    return { tz, offset, city, search: (tz + ' ' + city + ' ' + offset).toLowerCase() };
  });
  const tzMap = new Map(tzEntries.map(e => [e.tz, e]));

  function tick() {
    const time = getTimeInTZ(selectedTZ);
    const city = selectedTZ === 'UTC' ? 'UTC' : selectedTZ.split('/').pop().replace(/_/g, ' ');
    const offset = getUTCOffset(selectedTZ);
    timeEl.textContent = time;
    tzEl.textContent = city + ' ' + offset;
  }
  tick();
  setInterval(tick, 1000);

  setTimeout(() => window.updateChartTimezone(selectedTZ), 100);

  function renderGrouped() {
    listEl.innerHTML = '';
    tzGroups.forEach(([groupName, tzs]) => {
      const header = document.createElement('div');
      header.className = 'tz-group-label';
      header.textContent = groupName;
      listEl.appendChild(header);

      tzs.forEach(tz => {
        const entry = tzMap.get(tz);
        if (!entry) return;
        const li = document.createElement('li');
        li.className = 'tz-item' + (tz === selectedTZ ? ' active' : '');
        li.innerHTML = '<span class="tz-city">' + entry.city + '</span>'
          + '<span class="tz-offset">' + entry.offset + '</span>'
          + '<span class="tz-time">' + getTimeInTZ(tz) + '</span>';
        li.addEventListener('click', () => selectTZ(tz));
        listEl.appendChild(li);
      });
    });
  }

  function renderFiltered(q) {
    listEl.innerHTML = '';
    const matches = tzEntries.filter(e => e.search.includes(q));
    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tz-group-label';
      empty.textContent = 'No results';
      empty.style.padding = '16px 14px';
      empty.style.textAlign = 'center';
      listEl.appendChild(empty);
      return;
    }
    matches.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'tz-item' + (entry.tz === selectedTZ ? ' active' : '');
      li.innerHTML = '<span class="tz-city">' + entry.city + '</span>'
        + '<span class="tz-offset">' + entry.offset + '</span>'
        + '<span class="tz-time">' + getTimeInTZ(entry.tz) + '</span>';
      li.addEventListener('click', () => selectTZ(entry.tz));
      listEl.appendChild(li);
    });
  }

  function selectTZ(tz) {
    selectedTZ = tz;
    tick();
    window.updateChartTimezone(selectedTZ);
    closePicker();
  }

  function openPicker() {
    wrapper.classList.add('open');
    searchInput.value = '';
    renderGrouped();
    setTimeout(() => searchInput.focus(), 50);
  }

  function closePicker() {
    wrapper.classList.remove('open');
  }

  clockEl.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains('open')) closePicker();
    else openPicker();
  });

  picker.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closePicker);

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (q) renderFiltered(q);
    else renderGrouped();
  });
})();
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


// ========== COLOR PICKER IMPLEMENTATION ==========
let currentDrawingColor = '#2962FF'; // Default
let cpActiveCallback = null;
let cpState = { h: 226, s: 84, v: 100, a: 1 };

const cpPopover = document.getElementById('color-picker-popover');
const cpSvMap = document.getElementById('cp-sv-map');
const cpSvThumb = document.getElementById('cp-sv-thumb');
const cpHueSlider = document.getElementById('cp-hue-slider');
const cpHueThumb = document.getElementById('cp-hue-thumb');
const cpAlphaSlider = document.getElementById('cp-alpha-slider');
const cpAlphaThumb = document.getElementById('cp-alpha-thumb');
const cpPreview = document.getElementById('cp-preview-swatch');

const inHex = document.getElementById('cp-hex');
const inR = document.getElementById('cp-r'), inG = document.getElementById('cp-g'), inB = document.getElementById('cp-b');
const inA = document.getElementById('cp-a');
const swatchGrid = document.getElementById('cp-swatch-grid');
const PRESET_COLORS = ['#2962FF','#FF5252','#00E676','#FFD600','#E040FB','#00BCD4','#FF9800','#4CAF50','#F44336','#FFFFFF','#B2B5BE','#000000'];

function hsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => v - v * s * Math.max(Math.min(k(n), 4 - k(n), 1), 0);
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : Math.round((d / max) * 100), v: Math.round(max * 100) };
}

function rgbToHex(r, g, b) {
  return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
}
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
}

function getRgbString() {
  const [r, g, b] = hsvToRgb(cpState.h, cpState.s, cpState.v);
  if (cpState.a === 1) return rgbToHex(r, g, b);
  return `rgba(${r}, ${g}, ${b}, ${cpState.a.toFixed(2)})`;
}

function parseColorToState(colorStr) {
  if (!colorStr) return;
  if (colorStr.startsWith('rgba')) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
      cpState.a = match[4] ? parseFloat(match[4]) : 1;
      const hsv = rgbToHsv(r, g, b);
      cpState.h = hsv.h; cpState.s = hsv.s; cpState.v = hsv.v;
    }
  } else if (colorStr.startsWith('#')) {
    const rgb = hexToRgb(colorStr);
    if (rgb) {
      cpState.a = 1;
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      cpState.h = hsv.h; cpState.s = hsv.s; cpState.v = hsv.v;
    }
  }
}

function updateCpUI() {
  // Update SV map
  cpSvMap.style.backgroundColor = `hsl(${cpState.h}, 100%, 50%)`;
  cpSvThumb.style.left = `${cpState.s}%`;
  cpSvThumb.style.top = `${100 - cpState.v}%`;

  // Update Hue slider
  cpHueThumb.style.left = `${(cpState.h / 360) * 100}%`;

  // Update Alpha slider background
  const [r, g, b] = hsvToRgb(cpState.h, cpState.s, cpState.v);
  cpAlphaSlider.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`;
  cpAlphaThumb.style.left = `${cpState.a * 100}%`;

  // Update inputs & preview
  const hex = rgbToHex(r, g, b);
  inHex.value = hex;
  inR.value = r; inG.value = g; inB.value = b;
  inA.value = Math.round(cpState.a * 100);
  
  const finalColor = getRgbString();
  cpPreview.style.background = finalColor;

  if (cpActiveCallback) cpActiveCallback(finalColor);
}

function initPresets() {
  swatchGrid.innerHTML = '';
  PRESET_COLORS.forEach(c => {
    const el = document.createElement('div');
    el.className = 'cp-swatch-cell';
    el.style.background = c;
    el.addEventListener('click', () => {
      parseColorToState(c);
      updateCpUI();
    });
    swatchGrid.appendChild(el);
  });
}

// Drag Helpers
function handleDrag(elem, onChange) {
  const onMove = (e) => {
    const rect = elem.getBoundingClientRect();
    let x = e.clientX - rect.left, y = e.clientY - rect.top;
    x = Math.max(0, Math.min(x, rect.width));
    y = Math.max(0, Math.min(y, rect.height));
    onChange(x / rect.width, y / rect.height);
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  elem.addEventListener('mousedown', (e) => {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    onMove(e);
  });
}

handleDrag(cpSvMap, (xPct, yPct) => {
  cpState.s = Math.round(xPct * 100);
  cpState.v = Math.round((1 - yPct) * 100);
  updateCpUI();
});
handleDrag(cpHueSlider, (xPct) => {
  cpState.h = Math.round(xPct * 360);
  updateCpUI();
});
handleDrag(cpAlphaSlider, (xPct) => {
  cpState.a = xPct;
  updateCpUI();
});

// Input Event Listeners
inHex.addEventListener('change', () => {
  parseColorToState(inHex.value); updateCpUI();
});
[inR, inG, inB].forEach(inp => inp.addEventListener('change', () => {
  const hsv = rgbToHsv(inR.value, inG.value, inB.value);
  cpState.h = hsv.h; cpState.s = hsv.s; cpState.v = hsv.v; updateCpUI();
}));
inA.addEventListener('change', () => {
  cpState.a = Math.max(0, Math.min(100, inA.value)) / 100; updateCpUI();
});

window.openColorPicker = function(anchorEl, currentColor, onChange) {
  cpActiveCallback = onChange;
  parseColorToState(currentColor);
  updateCpUI();

  cpPopover.style.display = 'block';
  const rect = anchorEl.getBoundingClientRect();
  
  // Position it
  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + cpPopover.offsetHeight > window.innerHeight) top = rect.top - cpPopover.offsetHeight - 8;
  if (left + cpPopover.offsetWidth > window.innerWidth) left = window.innerWidth - cpPopover.offsetWidth - 8;

  cpPopover.style.top = top + 'px';
  cpPopover.style.left = left + 'px';
};

// Close picker when clicking outside
document.addEventListener('mousedown', (e) => {
  if (!cpPopover.contains(e.target) && !e.target.closest('#toolbar-color-btn') && !e.target.closest('.swatch')) {
    cpPopover.style.display = 'none';
  }
});
initPresets();

// Drawing Toolbar Color Swatch logic
const toolbarColorBtn = document.getElementById('toolbar-color-btn');
const toolbarColorSwatch = document.getElementById('toolbar-color-swatch');

toolbarColorBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  let startColor = currentDrawingColor;
  let activeDrawing = null;
  
  if (selectedDrawingId != null) {
    activeDrawing = drawingsList.find(d => d.id === selectedDrawingId);
    if (activeDrawing) startColor = activeDrawing.color;
  }

  openColorPicker(toolbarColorBtn, startColor, (newColor) => {
    if (activeDrawing) {
      activeDrawing.color = newColor;
      if (drawingsOverlay) drawingsOverlay.requestUpdate();
    } else {
      currentDrawingColor = newColor;
    }
    toolbarColorSwatch.style.background = newColor;
  });
});
// ========== INDICATORS PANEL ==========
document.getElementById('btn-indicators-toggle').addEventListener('click', () => {
  const panel = document.getElementById('indicators-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'flex';
  const btn = document.getElementById('btn-indicators-toggle');
  btn.classList.toggle('open', !isOpen);
  btn.innerHTML = isOpen ? '&#128202; Indicators &#9660;' : '&#128202; Indicators &#9650;';
});

// ========== SMA CALCULATION ==========
function computeSMA(candles, period) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

// ========== EMA CALCULATION ==========
function computeEMA(candles, period) {
  if (candles.length === 0) return [];
  const k = 2 / (1 + period); // smoothing factor
  const result = [];
  // First EMA value = SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {
    sum += candles[i].close;
  }
  let ema = sum / Math.min(period, candles.length);
  result.push({ time: candles[Math.min(period - 1, candles.length - 1)].time, value: ema });
  // Subsequent values use EMA formula
  for (let i = period; i < candles.length; i++) {
    ema = (candles[i].close * k) + (ema * (1 - k));
    result.push({ time: candles[i].time, value: ema });
  }
  return result;
}

// ========== ATR CALCULATION ==========
function computeATR(candles, period) {
  if (candles.length < 2) return [];
  const trs = [];
  // Calculate TR for all candles
  // First TR is just High - Low
  trs.push({ time: candles[0].time, value: candles[0].high - candles[0].low });
  
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i].close; // Previous close is actually candles[i-1].close
    // Correct logic: High - Low, |High - PrevClose|, |Low - PrevClose|
    const prevClose = candles[i-1].close;
    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    trs.push({ time: candles[i].time, value: tr });
  }

  // Calculate ATR using RMA (Wilder's Smoothing)
  // First ATR = SMA of first 'period' TRs
  const result = [];
  let sum = 0;
  if (trs.length < period) return [];

  for (let i = 0; i < period; i++) {
    sum += trs[i].value;
  }
  let atr = sum / period;
  result.push({ time: trs[period - 1].time, value: atr });

  // Subsequent ATR: (PrevATR * (period - 1) + CurrentTR) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i].value) / period;
    result.push({ time: trs[i].time, value: atr });
  }
  return result;
}

// ========== MACD CALCULATION ==========
function calculateEMAValues(data, period) {
  if (data.length === 0) return [];
  const k = 2 / (1 + period);
  const result = [];
  let sum = 0;
  const startIdx = Math.min(period, data.length);
  for (let i = 0; i < startIdx; i++) {
    sum += data[i].value;
  }
  let ema = sum / startIdx;
  result.push({ time: data[Math.min(period - 1, data.length - 1)].time, value: ema });
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i].value * k) + (ema * (1 - k));
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function computeMACD(candles, fastPeriod, slowPeriod, signalPeriod) {
  if (candles.length === 0) return null;
  const closeSeries = candles.map(c => ({ time: c.time, value: c.close }));
  
  const fastEMA = calculateEMAValues(closeSeries, fastPeriod);
  const slowEMA = calculateEMAValues(closeSeries, slowPeriod);
  
  // Align series
  const macdLine = [];
  // We need to map by time. Since both come from same candles, times are unique and sorted.
  // Efficient way: iterate and match.
  const fastMap = new Map(fastEMA.map(i => [i.time, i.value]));
  const slowMap = new Map(slowEMA.map(i => [i.time, i.value]));
  
  // MACD = Fast - Slow
  for (const item of slowEMA) { // Slow starts later usually
    if (fastMap.has(item.time)) {
      macdLine.push({ time: item.time, value: fastMap.get(item.time) - item.value });
    }
  }
  
  const signalLine = calculateEMAValues(macdLine, signalPeriod);
  
  // Histogram = MACD - Signal
  const histogram = [];
  const signalMap = new Map(signalLine.map(i => [i.time, i.value]));
  for (const item of macdLine) {
    if (signalMap.has(item.time)) {
      const sig = signalMap.get(item.time);
      const histVal = item.value - sig;
      // Color based on value and growth could be added here, but simple green/red is fine for now
      // Actually standard: Bright Green (grow up), Dark Green (fall up), Bright Red (grow down), Dark Red (fall down)
      // For simplicity: Green if >= 0, Red if < 0.
      const color = histVal >= 0 ? '#26a69a' : '#ef5350';
      histogram.push({ time: item.time, value: histVal, color: color });
    }
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

// ========== VWMA CALCULATION ==========
function computeVWMA(candles, volumes, period) {
  // VWMA = Sum(Close * Volume) / Sum(Volume)
  if (candles.length === 0 || volumes.length === 0) return [];
  if (candles.length !== volumes.length) {
    return []; // Should align or fail silently
  }
  const result = [];
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    
    let sumPriceVolume = 0;
    let sumVolume = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumPriceVolume += candles[j].close * volumes[j].value;
      sumVolume += volumes[j].value;
    }
    if (sumVolume === 0) {
      result.push({ time: candles[i].time, value: 0 }); // Avoid division by zero
    } else {
      result.push({ time: candles[i].time, value: sumPriceVolume / sumVolume });
    }
  }
  return result;
}

// ========== BOLLINGER BANDS CALCULATION ==========
function computeBB(candles, period, stdDevMult) {
  if (candles.length < period) return null;
  
  const result = { upper: [], middle: [], lower: [] };
  
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].close;
    }
    const sma = sum / period;
    
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].close - sma;
      sumSqDiff += diff * diff;
    }
    const stdDev = Math.sqrt(sumSqDiff / period);
    
    const time = candles[i].time;
    result.middle.push({ time, value: sma });
    result.upper.push({ time, value: sma + (stdDev * stdDevMult) });
    result.lower.push({ time, value: sma - (stdDev * stdDevMult) });
  }
  
  return result;
}

// ========== ADX CALCULATION ==========
function computeADX(candles, period) {
  if (candles.length < 2 * period) return []; // Need enough data for initial smoothing
  
  // 1. Calculate TR, +DM, -DM
  // TR = Max(H-L, |H-Cp|, |L-Cp|)
  // +DM = (H - Hp) > (Lp - L) ? Max(H - Hp, 0) : 0
  // -DM = (Lp - L) > (H - Hp) ? Max(Lp - L, 0) : 0
  
  const trs = [];
  const plusDMs = [];
  const minusDMs = [];
  
  // First candle has no prior, so skip or seed with 0? 
  // Wilder starts calc from 2nd period.
  // We align arrays so index i corresponds to candles[i]
  
  trs.push(0); // padded
  plusDMs.push(0);
  minusDMs.push(0);
  
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i-1];
    
    const h = curr.high;
    const l = curr.low;
    const ph = prev.high;
    const pl = prev.low;
    const pc = prev.close;
    
    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trs.push(tr);
    
    const upMove = h - ph;
    const downMove = pl - l;
    
    let pDM = 0;
    let mDM = 0;
    
    if (upMove > downMove && upMove > 0) {
      pDM = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      mDM = downMove;
    }
    
    plusDMs.push(pDM);
    minusDMs.push(mDM);
  }
  
  // 2. Smooth TR, +DM, -DM using Wilder's Smoothing (RMA)
  // First value = Sum of first N
  // Subsequent = (Prev * (N-1) + Curr) / N
  
  const smoothTR = [];
  const smoothPDM = [];
  const smoothMDM = [];
  
  // Helper for RMA array generation
  // We need to start from index 'period' (1-based count in Logic, so index period)
  // Logic: First valid smoothed value is at index 'period'.
  
  function calculateRMA(values, n) {
    const smooth = new Array(values.length).fill(0);
    if (values.length <= n) return smooth;
    
    let sum = 0;
    for(let i = 1; i <= n; i++) sum += values[i];
    
    smooth[n] = sum;
    
    for(let i = n + 1; i < values.length; i++) {
      smooth[i] = smooth[i-1] - (smooth[i-1] / n) + values[i];
    }
    return smooth;
  }
  
  const atr = calculateRMA(trs, period);
  const admP = calculateRMA(plusDMs, period); // ADM+
  const admM = calculateRMA(minusDMs, period); // ADM-
  
  // 3. Calculate +DI, -DI, DX
  // +DI = 100 * (ADM+ / ATR)
  // -DI = 100 * (ADM- / ATR)
  // DX = 100 * |+DI - -DI| / (+DI + -DI)
  
  const dxs = new Array(candles.length).fill(0);
  
  // Valid DX starts from index 'period'
  for(let i = period; i < candles.length; i++) {
    if (atr[i] === 0) continue;
    
    const pDI = 100 * (admP[i] / atr[i]);
    const mDI = 100 * (admM[i] / atr[i]);
    
    const sumDI = pDI + mDI;
    if (sumDI === 0) {
      dxs[i] = 0;
    } else {
      dxs[i] = 100 * Math.abs(pDI - mDI) / sumDI;
    }
  }
  
  // 4. ADX = RMA of DX
  // First ADX at index 2*period - 1 ? 
  // Wilder says ADX is smoothed DX.
  // First ADX = Average of first N DXs (where DXs are valid)
  // Valid DXs start at index 'period'. So first ADX is at index period + period - 1 = 2*period - 1.
  
  const adx = new Array(candles.length).fill(0);
  
  // Sum first 'period' DX values starting from 'period'
  let sumDX = 0;
  for(let i = period; i < period + period; i++) {
    if(i >= dxs.length) break;
    sumDX += dxs[i];
  }
  
  const startIdx = 2 * period - 1;
  if(startIdx < dxs.length) {
    adx[startIdx] = sumDX / period; // Is first ADX just SMA? Wilder often uses SMA to seed.
    // Actually typically Standard logic: First ADX = Mean(DX over period). Subsequent = ((Prev * (N-1)) + Curr) / N
    
    for(let i = startIdx + 1; i < candles.length; i++) {
      adx[i] = ((adx[i-1] * (period - 1)) + dxs[i]) / period;
    }
  }
  
  // 5. Result
  const result = [];
  for(let i = startIdx; i < candles.length; i++) {
    result.push({ time: candles[i].time, value: adx[i] });
  }
  
    return result;
}

// ========== AROON CALCULATION ==========
function computeAroon(candles, period) {
  if (candles.length < period) return null;
  const upLine = [];
  const downLine = [];
  
  // Aroon Up = ((Period - Days Since High) / Period) * 100
  // Aroon Down = ((Period - Days Since Low) / Period) * 100
  // "Days Since" means 0 if current is High.
  
  for (let i = period; i < candles.length; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    let highIdx = -1;
    let lowIdx = -1;
    
    // Look back 'period' candles + 1 (period+1 window is standard? Or 0 to period?)
    // Standard is: Look at last N candles (including current).
    // e.g. 14 period. Look at i, i-1, ... i-14? No, window size is period + 1 usually?
    // TradingView says "measures how many periods have passed since price has recorded an n-period high".
    // If High is today, days since is 0.
    
    for (let j = 0; j <= period; j++) {
      const idx = i - j;
      if (idx < 0) continue;
      const c = candles[idx];
      if (c.high > highest) {
        highest = c.high;
        highIdx = j; // days since
      }
      if (c.low < lowest) {
        lowest = c.low;
        lowIdx = j; // days since
      }
    }
    
    // But Aroon calculation usually excludes current bar? 
    // Tradingview: "14 Day Aroon-Up will take the number of days since price last recorded a 14 day high".
    // If High is today, days since is 0.
    
    const aroonUp = ((period - highIdx) / period) * 100;
    const aroonDown = ((period - lowIdx) / period) * 100;
    
    upLine.push({ time: candles[i].time, value: aroonUp });
    downLine.push({ time: candles[i].time, value: aroonDown });
  }
  
  return { up: upLine, down: downLine };
}

function computeAroonOsc(candles, period) {
  const aroon = computeAroon(candles, period);
  if (!aroon) return null;
  
  const result = [];
  // Arrays should be same length and aligned by time
  for(let i = 0; i < aroon.up.length; i++) {
    const val = aroon.up[i].value - aroon.down[i].value;
    result.push({ time: aroon.up[i].time, value: val });
  }
  return result;
}

// ========== SUPERTREND CALCULATION ==========
function computeSuperTrend(candles, period, mult) {
  if (candles.length < period + 1) return null;
  const atrValues = computeATR(candles, period);
  if (atrValues.length === 0) return null;

  const atrMap = new Map(atrValues.map(a => [a.time, a.value]));

  const line = [];     // continuous line: { time, value, trend }
  const signals = [];  // trend change markers: { time, value, direction }

  let upperBand = 0;
  let lowerBand = 0;
  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let trend = 1;
  let prevTrend = 1;
  let first = true;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const atr = atrMap.get(c.time);
    if (atr === undefined) continue;

    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + (mult * atr);
    const basicLower = hl2 - (mult * atr);

    if (first) {
      upperBand = basicUpper;
      lowerBand = basicLower;
      trend = c.close > hl2 ? 1 : -1;
      prevTrend = trend;
      first = false;
    } else {
      lowerBand = (basicLower > prevLowerBand || candles[i - 1].close < prevLowerBand)
        ? basicLower : prevLowerBand;
      upperBand = (basicUpper < prevUpperBand || candles[i - 1].close > prevUpperBand)
        ? basicUpper : prevUpperBand;

      prevTrend = trend;
      if (trend === 1 && c.close < lowerBand) {
        trend = -1;
      } else if (trend === -1 && c.close > upperBand) {
        trend = 1;
      }
    }

    const value = trend === 1 ? lowerBand : upperBand;
    line.push({ time: c.time, value, trend });

    if (prevTrend !== trend && !first) {
      signals.push({
        time: c.time,
        value: value,
        direction: trend  // +1 = buy, -1 = sell
      });
    }

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
  }

  return { line, signals };
}

// ========== SUPERTREND RENDER HELPER ==========
function renderSuperTrend(ind, data) {
  // 1. Remove previous segment series and area series
  if (ind.segmentSeries) {
    ind.segmentSeries.forEach(s => chart.removeSeries(s));
  }
  if (ind.areaSeries) {
    ind.areaSeries.forEach(s => chart.removeSeries(s));
  }
  ind.segmentSeries = [];
  ind.areaSeries = [];

  if (!data || !data.line || data.line.length === 0) {
    candleSeries.setMarkers([]);
    return;
  }

  // 2. Split line into contiguous same-trend segments with overlap points
  const segments = [];
  let currentSeg = [data.line[0]];
  let currentTrend = data.line[0].trend;

  for (let i = 1; i < data.line.length; i++) {
    const pt = data.line[i];
    if (pt.trend !== currentTrend) {
      // Add this point as overlap (end of prev segment)
      currentSeg.push(pt);
      segments.push({ trend: currentTrend, points: currentSeg });
      // Start new segment from this overlap point
      currentSeg = [pt];
      currentTrend = pt.trend;
    } else {
      currentSeg.push(pt);
    }
  }
  if (currentSeg.length > 0) {
    segments.push({ trend: currentTrend, points: currentSeg });
  }

  // 3. Create line series + area series for each segment
  const upColor = '#00E676';
  const downColor = '#FF5252';
  const upFill = 'rgba(0, 230, 118, 0.15)';
  const downFill = 'rgba(255, 82, 82, 0.15)';

  // Build a map of time -> close price for area fill
  const closeMap = new Map(ALL_CANDLES.map(c => [c.time, c.close]));

  segments.forEach(seg => {
    const color = seg.trend === 1 ? upColor : downColor;
    const fillColor = seg.trend === 1 ? upFill : downFill;

    // Line series for this segment
    const ls = chart.addLineSeries({
      color: color,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
      priceScaleId: 'right',
    });
    ls.setData(seg.points.map(p => ({ time: p.time, value: p.value })));
    ind.segmentSeries.push(ls);
  });

  // 4. Set markers on candleSeries for trend reversals
  const markers = data.signals.map(sig => ({
    time: sig.time,
    position: sig.direction === 1 ? 'belowBar' : 'aboveBar',
    color: sig.direction === 1 ? upColor : downColor,
    shape: sig.direction === 1 ? 'arrowUp' : 'arrowDown',
    text: sig.direction === 1 ? 'Buy' : 'Sell',
    size: 2,
  }));
  // Sort markers by time
  markers.sort((a, b) => {
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  });
  candleSeries.setMarkers(markers);
}

// ========== INDICATOR MANAGEMENT ==========
const activeIndicators = {};
let indicatorIdCounter = 0;
const MA_COLORS = ['#2962ff', '#e040fb', '#00bcd4', '#ff9800', '#4caf50', '#f44336'];
let maColorIdx = 0;

function addIndicator(type) {
  const id = 'ind_' + (indicatorIdCounter++);
  if (type === 'volume') {
    if (activeIndicators['volume']) return; // only one volume
    const pane = createSubPane('volume', 'Volume', 150);
    volumeSeries = pane.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    pane.series = volumeSeries;
    if (ALL_VOLUME.length) volumeSeries.setData(ALL_VOLUME);
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
    document.getElementById('vol-legend').style.display = '';
    activeIndicators['volume'] = { type: 'volume', id: 'volume' };
    renderActiveIndicators();
  } else if (type === 'sma' || type === 'ema') {
    const color = MA_COLORS[maColorIdx % MA_COLORS.length];
    maColorIdx++;
    const period = 9;
    const series = chart.addLineSeries({
      color: color,
      lineWidth: 2,
      crosshairMarkerRadius: 3,
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: true,
    });
    const computeFn = type === 'ema' ? computeEMA : computeSMA;
    const data = computeFn(ALL_CANDLES, period);
    series.setData(data);
    activeIndicators[id] = { type, id, series, period, color };
    renderActiveIndicators();
  } else if (type === 'vwma') {
     if (activeIndicators['vwma']) return;
     const color = '#9C27B0'; // Purple for VWMA
     const period = 20;
     const series = chart.addLineSeries({
       color: color,
       lineWidth: 2,
       crosshairMarkerRadius: 3,
       priceScaleId: 'right',
       lastValueVisible: true,
       priceLineVisible: true,
       title: 'VWMA'
     });
     const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, period);
     series.setData(data);
     activeIndicators['vwma'] = { type: 'vwma', id: 'vwma', series, period, color };
     renderActiveIndicators();
  } else if (type === 'atr') {
    if (activeIndicators['atr']) return; // single ATR pane for now implementation-wise
    const pane = createSubPane('atr', 'ATR', 150);
    const series = pane.chart.addLineSeries({
      color: '#b71c1c', lineWidth: 2,
      priceScaleId: 'atr',
      lastValueVisible: true,
      priceLineVisible: true,
    });
    const period = 14; 
    const data = computeATR(ALL_CANDLES, period);
    series.setData(data);
    
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
    
    activeIndicators['atr'] = { type: 'atr', id: 'atr', pane, series, period };
    renderActiveIndicators();
  } else if (type === 'macd') {
    if (activeIndicators['macd']) return;
    const pane = createSubPane('macd', 'MACD', 150);
    
    // Histogram
    const histSeries = pane.chart.addHistogramSeries({ priceScaleId: 'macd' });
    // MACD Line (Fast) - Blue
    const macdSeries = pane.chart.addLineSeries({
      color: '#2962ff', lineWidth: 2, priceScaleId: 'macd'
    });
    // Signal Line (Slow) - Orange
    const signalSeries = pane.chart.addLineSeries({
      color: '#ff6d00', lineWidth: 2, priceScaleId: 'macd'
    });
    
    const config = { fast: 12, slow: 26, signal: 9 };
    const data = computeMACD(ALL_CANDLES, config.fast, config.slow, config.signal);
    
    if (data) {
      histSeries.setData(data.histogram);
      macdSeries.setData(data.macd);
      signalSeries.setData(data.signal);
    }

    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}

    activeIndicators['macd'] = { 
      type: 'macd', id: 'macd', pane, 
      histSeries, macdSeries, signalSeries, 
      config 
    };
    renderActiveIndicators();
  } else if (type === 'bb') {
    const color = '#2962ff'; // Default BB color
    const middleSeries = chart.addLineSeries({
      color: '#ff6d00', lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    });
    const upperSeries = chart.addLineSeries({
      color: color, lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    });
    const lowerSeries = chart.addLineSeries({
      color: color, lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    });
    
    const config = { period: 20, mult: 2 };
    const data = computeBB(ALL_CANDLES, config.period, config.mult);
    
    if (data) {
      middleSeries.setData(data.middle);
      upperSeries.setData(data.upper);
      lowerSeries.setData(data.lower);
    }
    
    activeIndicators[id] = { 
      type: 'bb', id, 
      middleSeries, upperSeries, lowerSeries,
      config 
    };
    renderActiveIndicators();
  } else if (type === 'supertrend') {
    if (activeIndicators['supertrend']) return;
    const config = { period: 10, mult: 3 };
    const ind = { 
      type: 'supertrend', id: 'supertrend', config, 
      segmentSeries: [], areaSeries: [] 
    };
    const data = computeSuperTrend(ALL_CANDLES, config.period, config.mult);
    renderSuperTrend(ind, data);
    activeIndicators['supertrend'] = ind;
    renderActiveIndicators();
  } else if (type === 'adx') {
    if (activeIndicators['adx']) return;
    const pane = createSubPane('adx', 'ADX', 150);
    const series = pane.chart.addLineSeries({
      color: '#ff4081', lineWidth: 2, priceScaleId: 'adx'
    });
    const period = 14; 
    const data = computeADX(ALL_CANDLES, period);
    series.setData(data);
    
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
    
    activeIndicators['adx'] = { type: 'adx', id: 'adx', pane, series, period };
    renderActiveIndicators();
  } else if (type === 'aroon') {
    if (activeIndicators['aroon']) return;
    const pane = createSubPane('aroon', 'Aroon', 150);
    const upSeries = pane.chart.addLineSeries({
      color: '#ff6d00', lineWidth: 2, priceScaleId: 'aroon', title: 'Aroon Up'
    });
    const downSeries = pane.chart.addLineSeries({
      color: '#2962ff', lineWidth: 2, priceScaleId: 'aroon', title: 'Aroon Down'
    });
    
    const period = 14;
    const data = computeAroon(ALL_CANDLES, period);
    if (data) {
      upSeries.setData(data.up);
      downSeries.setData(data.down);
    }
    
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
    
    activeIndicators['aroon'] = { type: 'aroon', id: 'aroon', pane, upSeries, downSeries, period };
    renderActiveIndicators();
  } else if (type === 'aroon_osc') {
    if (activeIndicators['aroon_osc']) return;
    const pane = createSubPane('aroon_osc', 'Aroon Osc', 150);
    const series = pane.chart.addLineSeries({
      color: '#9c27b0', lineWidth: 2, priceScaleId: 'aroon_osc'
    });
    // Add zero line?
    // Lightweight charts doesn't have direct horizontal lines, but we can add a primitive or just rely on grid.
    // Actually we can add a PriceLine if we want, but it's attached to a series.
    // Let's just create a zero line series or use createPriceLine on the series.
    series.createPriceLine({
      price: 0, color: '#787b86', lineWidth: 1, lineStyle: 2, axisLabelVisible: false
    });
    
    const period = 14;
    const data = computeAroonOsc(ALL_CANDLES, period);
    if (data) series.setData(data);
    
    try {
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    } catch(e) {}
    
    activeIndicators['aroon_osc'] = { type: 'aroon_osc', id: 'aroon_osc', pane, series, period };
    renderActiveIndicators();
  }
}

function removeIndicator(id) {
  const ind = activeIndicators[id];
  if (!ind) return;
  if (ind.type === 'volume') {
    volumeSeries = null;
    destroySubPane('volume');
    document.getElementById('vol-legend').style.display = 'none';
  } else if (ind.type === 'sma' || ind.type === 'ema' || ind.type === 'vwma') {
    chart.removeSeries(ind.series);
  } else if (ind.type === 'atr') {
    destroySubPane('atr');
  } else if (ind.type === 'macd') {
    destroySubPane('macd');
  } else if (ind.type === 'bb') {
    chart.removeSeries(ind.middleSeries);
    chart.removeSeries(ind.upperSeries);
    chart.removeSeries(ind.lowerSeries);
  } else if (ind.type === 'supertrend') {
    if (ind.segmentSeries) ind.segmentSeries.forEach(s => chart.removeSeries(s));
    if (ind.areaSeries) ind.areaSeries.forEach(s => chart.removeSeries(s));
    candleSeries.setMarkers([]);
  } else if (ind.type === 'adx') {
    destroySubPane('adx');
  } else if (ind.type === 'aroon') {
    destroySubPane('aroon');
  } else if (ind.type === 'aroon_osc') {
    destroySubPane('aroon_osc');
  }
  delete activeIndicators[id];
  renderActiveIndicators();
}

function updateIndicatorPeriod(id, newVal) {
  const ind = activeIndicators[id];
  if (!ind) return;
  
  if (ind.type === 'macd') {
    const parts = String(newVal).split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
    if (parts.length === 3) {
      ind.config = { fast: parts[0], slow: parts[1], signal: parts[2] };
      const data = computeMACD(ALL_CANDLES, ind.config.fast, ind.config.slow, ind.config.signal);
      if (data) {
        ind.histSeries.setData(data.histogram);
        ind.macdSeries.setData(data.macd);
        ind.signalSeries.setData(data.signal);
      }
    }
    return;
  } else if (ind.type === 'bb') {
    // Parse "20, 2"
    const parts = String(newVal).split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (parts.length >= 2) {
      ind.config = { period: Math.round(parts[0]), mult: parts[1] };
      const data = computeBB(ALL_CANDLES, ind.config.period, ind.config.mult);
      if (data) {
        ind.middleSeries.setData(data.middle);
        ind.upperSeries.setData(data.upper);
        ind.lowerSeries.setData(data.lower);
      }
    }
    return;
  } else if (ind.type === 'supertrend') {
    const parts = String(newVal).split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (parts.length >= 2) {
      ind.config = { period: Math.round(parts[0]), mult: parts[1] };
      const data = computeSuperTrend(ALL_CANDLES, ind.config.period, ind.config.mult);
      renderSuperTrend(ind, data);
    }
    return;
  }

  // Single value indicators
  const newPeriod = parseInt(newVal, 10);
  if (isNaN(newPeriod) || newPeriod < 1) return;

  if (ind.type === 'sma' || ind.type === 'ema') {
    ind.period = newPeriod;
    const computeFn = ind.type === 'ema' ? computeEMA : computeSMA;
    const data = computeFn(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  } else if (ind.type === 'vwma') {
    ind.period = newPeriod;
    const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, newPeriod);
    ind.series.setData(data);
  } else if (ind.type === 'atr') {
    ind.period = newPeriod;
    const data = computeATR(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  } else if (ind.type === 'adx') {
    ind.period = newPeriod;
    const data = computeADX(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  } else if (ind.type === 'aroon') {
    ind.period = newPeriod;
    const data = computeAroon(ALL_CANDLES, newPeriod);
    if (data) {
      ind.upSeries.setData(data.up);
      ind.downSeries.setData(data.down);
    }
  } else if (ind.type === 'aroon_osc') {
    ind.period = newPeriod;
    const data = computeAroonOsc(ALL_CANDLES, newPeriod);
    if (data) ind.series.setData(data);
  }
}

function refreshAllIndicators() {
  // Called after data changes (ticker or interval switch)
  Object.values(activeIndicators).forEach(ind => {
    if (ind.type === 'sma' || ind.type === 'ema') {
      const computeFn = ind.type === 'ema' ? computeEMA : computeSMA;
      const data = computeFn(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    } else if (ind.type === 'vwma') {
      const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, ind.period);
      ind.series.setData(data);
    } else if (ind.type === 'atr') {
      const data = computeATR(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    } else if (ind.type === 'macd') {
      const data = computeMACD(ALL_CANDLES, ind.config.fast, ind.config.slow, ind.config.signal);
      if (data) {
        ind.histSeries.setData(data.histogram);
        ind.macdSeries.setData(data.macd);
        ind.signalSeries.setData(data.signal);
      }
    } else if (ind.type === 'bb') {
      const data = computeBB(ALL_CANDLES, ind.config.period, ind.config.mult);
      if (data) {
        ind.middleSeries.setData(data.middle);
        ind.upperSeries.setData(data.upper);
        ind.lowerSeries.setData(data.lower);
      }
    } else if (ind.type === 'adx') {
      const data = computeADX(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    } else if (ind.type === 'aroon') {
      const data = computeAroon(ALL_CANDLES, ind.period);
      if (data) {
        ind.upSeries.setData(data.up);
        ind.downSeries.setData(data.down);
      }
    } else if (ind.type === 'aroon_osc') {
      const data = computeAroonOsc(ALL_CANDLES, ind.period);
      if (data) ind.series.setData(data);
    } else if (ind.type === 'supertrend') {
      const data = computeSuperTrend(ALL_CANDLES, ind.config.period, ind.config.mult);
      renderSuperTrend(ind, data);
    }
  });
}

function renderActiveIndicators() {
  const container = document.getElementById('active-indicators');
  container.innerHTML = '';
  Object.values(activeIndicators).forEach(ind => {
    const el = document.createElement('div');
    el.className = 'active-indicator';
    
    // Helper function to bind color picker to a swatch element and update a specific series
    const bindColorPicker = (swatchEl, initialColor, seriesToUpdate, colorSubKey = 'color') => {
      swatchEl.addEventListener('click', (e) => {
        e.stopPropagation();
        openColorPicker(swatchEl, initialColor, (newColor) => {
          swatchEl.style.background = newColor;
          if (colorSubKey) ind[colorSubKey] = newColor; // update local state
          if (seriesToUpdate) seriesToUpdate.applyOptions({ color: newColor });
          
          // Exception for supertrend: requires full re-render
          if (ind.type === 'supertrend') {
            ind.config[colorSubKey] = newColor;
            const data = computeSuperTrend(ALL_CANDLES, ind.config.period, ind.config.mult);
            renderSuperTrend(ind, data);
          }
        });
      });
    };

    if (ind.type === 'volume') {
      el.innerHTML = '<span>Vol</span><button class="remove-ind" title="Remove">&times;</button>';
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator('volume'));
    } else if (ind.type === 'sma' || ind.type === 'ema' || ind.type === 'vwma' || ind.type === 'atr' || ind.type === 'adx' || ind.type === 'aroon_osc') {
      let label = ind.type.toUpperCase();
      if (ind.type === 'aroon_osc') label = 'Aroon Osc';
      
      el.innerHTML = `<span class="swatch" style="background:${ind.color}"></span>${label} <input type="text" value="${ind.period}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      
      const swatch = el.querySelector('.swatch');
      bindColorPicker(swatch, ind.color, ind.series, 'color');

      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
      
    } else if (ind.type === 'macd') {
      el.innerHTML = `MACD <input type="text" value="${ind.config.fast}, ${ind.config.slow}, ${ind.config.signal}" style="width:60px"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
      
    } else if (ind.type === 'bb') {
      el.innerHTML = `BB <input type="text" value="${ind.config.period}, ${ind.config.mult}" style="width:40px"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
      
    } else if (ind.type === 'aroon') {
      // Aroon has Up and Down colors
      let upC = ind.upSeries.options().color;
      let downC = ind.downSeries.options().color;
      el.innerHTML = `<span class="swatch swatch-up" style="background:${upC}"></span><span class="swatch swatch-down" style="background:${downC}"></span>Aroon <input type="text" value="${ind.period}"><button class="remove-ind">&times;</button>`;
      
      bindColorPicker(el.querySelector('.swatch-up'), upC, ind.upSeries, null);
      bindColorPicker(el.querySelector('.swatch-down'), downC, ind.downSeries, null);

      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
      
    } else if (ind.type === 'supertrend') {
      let upC = ind.config.upColor || '#00E676';
      let downC = ind.config.downColor || '#FF5252';
      el.innerHTML = `<span class="swatch swatch-up" style="background:${upC}"></span><span class="swatch swatch-down" style="background:${downC}"></span>ST <input type="text" value="${ind.config.period}, ${ind.config.mult}" style="width:40px"><button class="remove-ind">&times;</button>`;
      
      bindColorPicker(el.querySelector('.swatch-up'), upC, null, 'upColor');
      bindColorPicker(el.querySelector('.swatch-down'), downC, null, 'downColor');

      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }
    
    container.appendChild(el);
  });
}

document.getElementById('indicator-select').addEventListener('change', (e) => {
  const val = e.target.value;
  if (val) addIndicator(val);
  e.target.value = '';
});

// Patch applyInterval and applyCustomInterval to refresh indicators after data load
const _origApplyInterval = applyInterval;
applyInterval = function(interval) {
  _origApplyInterval(interval);
  refreshAllIndicators();
};

const _origFetchSymbol = fetchSymbol;
fetchSymbol = async function(symbol) {
  await _origFetchSymbol(symbol);
  refreshAllIndicators();
};
// ========== UNIFIED DATA PANEL ==========
(function() {
  const panel = document.getElementById('data-panel');
  const closeBtn = document.getElementById('data-panel-close');
  const tabBtns = document.querySelectorAll('.data-tab');
  const headerBtns = document.querySelectorAll('.header-data-btn');
  const tabPanes = {
    news: document.getElementById('tab-news'),
    insiders: document.getElementById('tab-insiders'),
    profile: document.getElementById('tab-profile'),
    analysts: document.getElementById('tab-analysts'),
    financials: document.getElementById('tab-financials'),
  };

  let panelOpen = false;
  let activeTab = '';
  const cache = {};  // key: tab+symbol -> data
  let finFreq = 'annual';
  let newsStart = 0;
  let newsHasMore = false;
  let newsLoading = false;
  let newsObserver = null;

  function cacheKey(tab, sym) { return tab + ':' + sym; }

  function switchTab(tabName) {
    activeTab = tabName;
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    headerBtns.forEach(b => b.classList.toggle('open', b.dataset.tab === tabName));
    Object.entries(tabPanes).forEach(([k, el]) => el.classList.toggle('active', k === tabName));
    // Lazy-load data
    const key = cacheKey(tabName, currentSymbol);
    if (!cache[key]) loadTabData(tabName, currentSymbol);
  }

  function openPanel(tabName) {
    panelOpen = true;
    panel.classList.add('open');
    switchTab(tabName);
  }

  function closePanel() {
    panelOpen = false;
    panel.classList.remove('open');
    headerBtns.forEach(b => b.classList.remove('open'));
    activeTab = '';
  }

  // Header buttons
  headerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (panelOpen && activeTab === tab) closePanel();
      else openPanel(tab);
    });
  });

  // Tab bar clicks
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  closeBtn.addEventListener('click', closePanel);

  // Expose openPanel to global scope for the popout logic
  window.openFinChDataPanel = openPanel;

  // Resizing logic
  const dataPanelResizer = document.getElementById('data-panel-resizer');
  const rightToolbar = document.getElementById('right-toolbar');
  let isResizingDataPanel = false;

  dataPanelResizer.addEventListener('mousedown', (e) => {
    isResizingDataPanel = true;
    dataPanelResizer.classList.add('dragging');
    panel.style.transition = 'none'; // smoother dragging
    document.body.style.userSelect = 'none'; // prevent text selection
  });

  window.addEventListener('mousemove', (e) => {
    if (!isResizingDataPanel) return;
    const toolbarWidth = rightToolbar.offsetWidth;
    const rightEdge = window.innerWidth - toolbarWidth;
    let newWidth = rightEdge - e.clientX;
    newWidth = Math.max(250, Math.min(newWidth, window.innerWidth - toolbarWidth - 60)); 
    panel.style.width = newWidth + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (isResizingDataPanel) {
      isResizingDataPanel = false;
      dataPanelResizer.classList.remove('dragging');
      panel.style.transition = '';
      document.body.style.userSelect = '';
      // We don't have syncAllPanes in this scope immediately, but window.dispatchEvent(new Event('resize')) will trigger lightweight-charts resize
      window.dispatchEvent(new Event('resize')); 
    }
  });

  // Popout logic
  document.getElementById('data-panel-popout').addEventListener('click', () => {
    const activeTabObj = document.querySelector('.data-tab.active') || document.querySelector('.data-tab');
    const tabName = activeTabObj ? activeTabObj.dataset.tab : 'news';
    window.open(`/?popout=true&symbol=${currentSymbol}&tab=${tabName}`, 'OpenFinChPopout_' + Date.now(), 'width=450,height=800');
    closePanel();
  });

  // ---- Helpers ----
  function relativeTime(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return '';
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + 'm ago';
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return diffDay + 'd ago';
    return Math.floor(diffDay / 30) + 'mo ago';
  }

  function formatShares(n) {
    if (n == null) return '\u2014';
    return Math.abs(n).toLocaleString();
  }

  function formatMoney(v) {
    if (v == null) return '';
    return '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function esc(s) { return (s || '').replace(/</g, '&lt;'); }

  function fmtBigNum(v) {
    if (v == null) return '\u2014';
    const n = Number(v);
    if (isNaN(n)) return '\u2014';
    if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  }

  function fmtPct(v) {
    if (v == null) return '\u2014';
    return (Number(v) * 100).toFixed(2) + '%';
  }

  function fmtNum(v) {
    if (v == null) return '\u2014';
    const n = Number(v);
    if (isNaN(n)) return '\u2014';
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ---- Render: News ----
  function renderNews(pane, articles, append) {
    if (!append) {
      pane.innerHTML = '';
      if (newsObserver) { newsObserver.disconnect(); newsObserver = null; }
    } else {
      const oldSentinel = pane.querySelector('#news-sentinel');
      if (oldSentinel) oldSentinel.remove();
    }
    if (!articles || articles.length === 0) {
      if (!append) pane.innerHTML = '<div class="panel-empty">No news available.</div>';
      return;
    }
    articles.forEach(a => {
      const card = document.createElement('div');
      card.className = 'news-card';
      const thumbHtml = a.thumbnail
        ? '<img class="news-thumb" src="' + a.thumbnail.replace(/"/g, '&quot;') + '" alt="" loading="lazy">'
        : '';
      const time = relativeTime(a.pubDate);
      card.innerHTML = '<div class="news-card-inner">'
        + thumbHtml
        + '<div class="news-text">'
        + '<div class="news-title">' + esc(a.title) + '</div>'
        + '<div class="news-meta">'
        + '<span>' + esc(a.source) + '</span>'
        + (time ? '<span class="dot">&middot;</span><span>' + time + '</span>' : '')
        + '</div></div></div>';
      if (a.url) card.addEventListener('click', () => window.open(a.url, '_blank'));
      pane.appendChild(card);
    });

    if (newsHasMore) {
      const sentinel = document.createElement('div');
      sentinel.id = 'news-sentinel';
      sentinel.style.cssText = 'text-align:center;padding:12px;color:#888;font-size:13px;';
      sentinel.textContent = 'Loading more...';
      pane.appendChild(sentinel);
      newsObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting && !newsLoading && newsHasMore) {
          loadMoreNews();
        }
      }, { root: pane, threshold: 0.1 });
      newsObserver.observe(sentinel);
    }
  }

  // ---- Render: Insiders ----
  function txnType(txn) {
    if (!txn) return 'other';
    const t = txn.toLowerCase();
    if (t.includes('purchase') || t.includes('buy') || t.includes('acquisition')) return 'buy';
    if (t.includes('sale') || t.includes('sell') || t.includes('disposition')) return 'sell';
    return 'other';
  }

  function renderInsiders(pane, rows) {
    pane.innerHTML = '';
    if (!rows || rows.length === 0) {
      pane.innerHTML = '<div class="panel-empty">No insider transactions found.</div>';
      return;
    }
    rows.forEach(r => {
      const el = document.createElement('div');
      el.className = 'insider-row';
      const type = txnType(r.transaction);
      const tagClass = type === 'buy' ? 'buy' : type === 'sell' ? 'sell' : 'other';
      const valueStr = formatMoney(r.value);
      el.innerHTML =
        '<div class="insider-name">' + esc(r.insider) + '</div>'
        + '<div class="insider-position">' + esc(r.position) + '</div>'
        + '<div class="insider-details">'
        + '<span class="tag ' + tagClass + '">' + esc(r.transaction || 'Unknown') + '</span>'
        + '<span>' + formatShares(r.shares) + ' shares</span>'
        + (valueStr ? '<span class="dot">&middot;</span><span>' + valueStr + '</span>' : '')
        + '<span class="dot">&middot;</span><span>' + formatDate(r.date) + '</span>'
        + '</div>';
      pane.appendChild(el);
    });
  }

  // ---- Render: Profile ----
  function renderProfile(pane, data) {
    pane.innerHTML = '';
    if (!data) { pane.innerHTML = '<div class="panel-empty">No profile data available.</div>'; return; }
    let html = '';

    // Company info
    html += '<div class="profile-section">';
    html += '<div class="profile-section-title">Company Info</div>';
    if (data.longBusinessSummary) html += '<div class="profile-summary">' + esc(data.longBusinessSummary) + '</div>';
    html += '<div class="profile-grid">';
    const infoFields = [
      ['Name', data.longName || data.shortName],
      ['Sector', data.sector],
      ['Industry', data.industry],
      ['Country', data.country],
      ['Exchange', data.exchange],
      ['Employees', data.fullTimeEmployees ? Number(data.fullTimeEmployees).toLocaleString() : null],
      ['Website', data.website ? '<a href="' + esc(data.website) + '" target="_blank" style="color:#2962ff">' + esc(data.website) + '</a>' : null],
    ];
    infoFields.forEach(([l, v]) => {
      if (v != null) html += '<div class="profile-item"><span class="profile-label">' + l + '</span><span class="profile-value">' + v + '</span></div>';
    });
    html += '</div></div>';

    // Valuation
    html += '<div class="profile-section">';
    html += '<div class="profile-section-title">Valuation</div>';
    html += '<div class="profile-grid">';
    const valFields = [
      ['Market Cap', data.marketCap ? fmtBigNum(data.marketCap) : null],
      ['Enterprise Value', data.enterpriseValue ? fmtBigNum(data.enterpriseValue) : null],
      ['Trailing P/E', data.trailingPE ? fmtNum(data.trailingPE) : null],
      ['Forward P/E', data.forwardPE ? fmtNum(data.forwardPE) : null],
      ['PEG Ratio', data.pegRatio ? fmtNum(data.pegRatio) : null],
      ['Price/Book', data.priceToBook ? fmtNum(data.priceToBook) : null],
    ];
    valFields.forEach(([l, v]) => {
      if (v != null) html += '<div class="profile-item"><span class="profile-label">' + l + '</span><span class="profile-value">' + v + '</span></div>';
    });
    html += '</div></div>';

    // Profitability
    html += '<div class="profile-section">';
    html += '<div class="profile-section-title">Profitability</div>';
    html += '<div class="profile-grid">';
    const profFields = [
      ['Profit Margin', data.profitMargins != null ? fmtPct(data.profitMargins) : null],
      ['Operating Margin', data.operatingMargins != null ? fmtPct(data.operatingMargins) : null],
      ['Gross Margin', data.grossMargins != null ? fmtPct(data.grossMargins) : null],
      ['ROE', data.returnOnEquity != null ? fmtPct(data.returnOnEquity) : null],
      ['ROA', data.returnOnAssets != null ? fmtPct(data.returnOnAssets) : null],
      ['Revenue Growth', data.revenueGrowth != null ? fmtPct(data.revenueGrowth) : null],
      ['Earnings Growth', data.earningsGrowth != null ? fmtPct(data.earningsGrowth) : null],
    ];
    profFields.forEach(([l, v]) => {
      if (v != null) html += '<div class="profile-item"><span class="profile-label">' + l + '</span><span class="profile-value">' + v + '</span></div>';
    });
    html += '</div></div>';

    // Dividends
    if (data.dividendYield != null || data.dividendRate != null) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section-title">Dividends</div>';
      html += '<div class="profile-grid">';
      if (data.dividendYield != null) html += '<div class="profile-item"><span class="profile-label">Yield</span><span class="profile-value">' + fmtPct(data.dividendYield) + '</span></div>';
      if (data.dividendRate != null) html += '<div class="profile-item"><span class="profile-label">Rate</span><span class="profile-value">$' + fmtNum(data.dividendRate) + '</span></div>';
      if (data.payoutRatio != null) html += '<div class="profile-item"><span class="profile-label">Payout Ratio</span><span class="profile-value">' + fmtPct(data.payoutRatio) + '</span></div>';
      html += '</div></div>';
    }

    // Trading
    html += '<div class="profile-section">';
    html += '<div class="profile-section-title">Trading</div>';
    html += '<div class="profile-grid">';
    const tradFields = [
      ['Current Price', data.currentPrice ? '$' + fmtNum(data.currentPrice) : null],
      ['Beta', data.beta ? fmtNum(data.beta) : null],
      ['52W High', data.fiftyTwoWeekHigh ? '$' + fmtNum(data.fiftyTwoWeekHigh) : null],
      ['52W Low', data.fiftyTwoWeekLow ? '$' + fmtNum(data.fiftyTwoWeekLow) : null],
      ['50D Avg', data.fiftyDayAverage ? '$' + fmtNum(data.fiftyDayAverage) : null],
      ['200D Avg', data.twoHundredDayAverage ? '$' + fmtNum(data.twoHundredDayAverage) : null],
      ['Avg Volume', data.averageVolume ? fmtBigNum(data.averageVolume) : null],
    ];
    tradFields.forEach(([l, v]) => {
      if (v != null) html += '<div class="profile-item"><span class="profile-label">' + l + '</span><span class="profile-value">' + v + '</span></div>';
    });
    html += '</div></div>';

    // Calendar
    if (data.calendar && Object.keys(data.calendar).length) {
      html += '<div class="profile-section">';
      html += '<div class="profile-section-title">Calendar</div>';
      html += '<div class="profile-grid">';
      Object.entries(data.calendar).forEach(([k, v]) => {
        const label = k.replace(/([A-Z])/g, ' $1').trim();
        const val = Array.isArray(v) ? v.join(', ') : String(v);
        html += '<div class="profile-item"><span class="profile-label">' + esc(label) + '</span><span class="profile-value">' + esc(val) + '</span></div>';
      });
      html += '</div></div>';
    }

    pane.innerHTML = html;
  }

  // ---- Render: Analysts ----
  function renderAnalysts(pane, data) {
    pane.innerHTML = '';
    if (!data) { pane.innerHTML = '<div class="panel-empty">No analyst data available.</div>'; return; }
    let html = '';

    // Price targets
    if (data.priceTargets) {
      const pt = data.priceTargets;
      html += '<div class="analyst-section">';
      html += '<div class="analyst-section-title">Price Targets</div>';
      html += '<div class="price-targets">';
      [['Current', pt.current], ['Mean', pt.mean], ['Median', pt.median], ['Low', pt.low], ['High', pt.high]].forEach(([l, v]) => {
        html += '<div class="price-target-item"><div class="price-target-label">' + l + '</div><div class="price-target-value">' + (v != null ? '$' + fmtNum(v) : '\u2014') + '</div></div>';
      });
      html += '</div></div>';
    }

    // Recommendations
    if (data.recommendations) {
      const rec = data.recommendations;
      html += '<div class="analyst-section">';
      html += '<div class="analyst-section-title">Recommendations</div>';
      const keys = ['strongBuy', 'buy', 'hold', 'sell', 'strongSell'];
      const colors = ['#00897b', '#26a69a', '#787b86', '#ef5350', '#b71c1c'];
      const labels = ['Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'];
      const vals = keys.map(k => Number(rec[k]) || 0);
      const total = vals.reduce((s, v) => s + v, 0);
      if (total > 0) {
        html += '<div class="rec-bar">';
        vals.forEach((v, i) => {
          if (v > 0) {
            const pct = ((v / total) * 100).toFixed(1);
            html += '<span style="background:' + colors[i] + ';width:' + pct + '%" title="' + labels[i] + ': ' + v + '">' + v + '</span>';
          }
        });
        html += '</div>';
      }
      html += '</div>';
    }

    // Upgrades/downgrades
    if (data.upgrades && data.upgrades.length > 0) {
      html += '<div class="analyst-section">';
      html += '<div class="analyst-section-title">Recent Upgrades/Downgrades</div>';
      data.upgrades.forEach(u => {
        html += '<div class="upgrade-row">';
        html += '<div><span class="upgrade-firm">' + esc(u.firm) + '</span> <span class="upgrade-date">' + formatDate(u.date) + '</span></div>';
        html += '<div class="upgrade-grades">' + esc(u.action) + ': ' + esc(u.fromGrade) + ' \u2192 ' + esc(u.toGrade) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // Institutional holders
    if (data.institutional && data.institutional.length > 0) {
      html += '<div class="analyst-section">';
      html += '<div class="analyst-section-title">Top Institutional Holders</div>';
      html += '<table class="holder-table"><tr><th>Holder</th><th>Shares</th><th>Value</th></tr>';
      data.institutional.forEach(h => {
        const name = h['Holder'] || h['holder'] || Object.values(h)[0] || '';
        const shares = h['Shares'] || h['shares'] || '';
        const value = h['Value'] || h['value'] || '';
        html += '<tr><td>' + esc(String(name)) + '</td><td>' + esc(String(shares)) + '</td><td>' + esc(String(value)) + '</td></tr>';
      });
      html += '</table></div>';
    }

    // Mutual fund holders
    if (data.mutualFund && data.mutualFund.length > 0) {
      html += '<div class="analyst-section">';
      html += '<div class="analyst-section-title">Top Mutual Fund Holders</div>';
      html += '<table class="holder-table"><tr><th>Holder</th><th>Shares</th><th>Value</th></tr>';
      data.mutualFund.forEach(h => {
        const name = h['Holder'] || h['holder'] || Object.values(h)[0] || '';
        const shares = h['Shares'] || h['shares'] || '';
        const value = h['Value'] || h['value'] || '';
        html += '<tr><td>' + esc(String(name)) + '</td><td>' + esc(String(shares)) + '</td><td>' + esc(String(value)) + '</td></tr>';
      });
      html += '</table></div>';
    }

    // SEC EDGAR 13F full institutional holdings
    html += '<div class="analyst-section">';
    html += '<div class="analyst-section-title">Full 13F Institutional Holdings (SEC EDGAR)</div>';
    html += '<div id="sec-holders-container">';
    html += '<button id="load-sec-holders" style="background:#1a1a24;color:#e0e0e0;border:1px solid #2a2a36;border-radius:4px;padding:8px 16px;cursor:pointer;font-size:13px;font-family:inherit">Load SEC 13F Data</button>';
    html += '<div style="color:#787b86;font-size:11px;margin-top:6px">First load downloads ~100MB from SEC EDGAR (one-time)</div>';
    html += '</div>';
    html += '</div>';

    if (!html) html = '<div class="panel-empty">No analyst data available.</div>';
    pane.innerHTML = html;

    // Wire up SEC holders button
    const secBtn = pane.querySelector('#load-sec-holders');
    if (secBtn) {
      secBtn.addEventListener('click', async () => {
        const container = pane.querySelector('#sec-holders-container');
        container.innerHTML = '<div class="panel-loading" style="padding:12px 0">Loading SEC 13F data\u2026 This may take a moment on first load.</div>';
        try {
          const resp = await fetch('/api/holders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: currentSymbol }),
          });
          const result = await resp.json();
          if (!resp.ok) {
            container.innerHTML = '<div class="panel-empty">' + esc(result.error || 'Failed to load SEC data.') + '</div>';
            return;
          }
          let h = '';
          if (result.quarter) {
            h += '<div style="color:#787b86;font-size:11px;margin-bottom:8px">Quarter: ' + esc(result.quarter) + ' \u2022 ' + result.total + ' holders found</div>';
          }
          if (result.holders && result.holders.length > 0) {
            h += '<div style="max-height:400px;overflow-y:auto">';
            h += '<table class="holder-table"><tr><th>Holder</th><th>Shares</th><th>Value ($)</th><th>Filed</th></tr>';
            result.holders.forEach(r => {
              const shares = r.shares != null ? Number(r.shares).toLocaleString() : '\u2014';
              const value = r.value != null ? '$' + Number(r.value).toLocaleString() : '\u2014';
              h += '<tr><td>' + esc(r.holder) + '</td><td>' + shares + '</td><td>' + value + '</td><td>' + esc(r.filingDate || '') + '</td></tr>';
            });
            h += '</table></div>';
          } else {
            h += '<div class="panel-empty">No 13F holders found for this security.</div>';
          }
          container.innerHTML = h;
        } catch (e) {
          container.innerHTML = '<div class="panel-empty">Network error loading SEC data.</div>';
        }
      });
    }
  }

  // ---- Render: Financials ----
  function renderFinancials(pane, data) {
    pane.innerHTML = '';
    if (!data) { pane.innerHTML = '<div class="panel-empty">No financial data available.</div>'; return; }

    let html = '';

    // Freq toggle + sub-tabs
    html += '<div class="fin-controls">';
    html += '<button class="fin-toggle' + (finFreq === 'annual' ? ' active' : '') + '" data-freq="annual">Annual</button>';
    html += '<button class="fin-toggle' + (finFreq === 'quarterly' ? ' active' : '') + '" data-freq="quarterly">Quarterly</button>';
    html += '<span style="width:1px;height:16px;background:#2a2a36;margin:0 4px"></span>';
    html += '<button class="fin-sub-tab active" data-sub="income">Income</button>';
    html += '<button class="fin-sub-tab" data-sub="balance">Balance</button>';
    html += '<button class="fin-sub-tab" data-sub="cashflow">Cash Flow</button>';
    html += '<button class="fin-sub-tab" data-sub="earnings">Earnings</button>';
    html += '</div>';

    html += '<div id="fin-content" style="flex:1;overflow-y:auto;padding:0"></div>';
    pane.innerHTML = html;

    const finContent = pane.querySelector('#fin-content');
    let activeSub = 'income';

    function renderStatement(stmtData) {
      if (!stmtData) return '<div class="panel-empty">No data available.</div>';
      const cols = Object.keys(stmtData);
      if (cols.length === 0) return '<div class="panel-empty">No data available.</div>';
      // Rows = union of all row keys
      const rowSet = new Set();
      cols.forEach(c => Object.keys(stmtData[c]).forEach(r => rowSet.add(r)));
      const rows = Array.from(rowSet);
      if (rows.length === 0) return '<div class="panel-empty">No data available.</div>';

      let t = '<table class="fin-table"><thead><tr><th>Item</th>';
      cols.forEach(c => {
        // Shorten date column headers
        const label = c.length > 10 ? c.substring(0, 10) : c;
        t += '<th>' + esc(label) + '</th>';
      });
      t += '</tr></thead><tbody>';
      rows.forEach(r => {
        t += '<tr><td style="color:#e0e0e0;font-weight:500">' + esc(r) + '</td>';
        cols.forEach(c => {
          const v = stmtData[c][r];
          t += '<td>' + fmtBigNum(v) + '</td>';
        });
        t += '</tr>';
      });
      t += '</tbody></table>';
      return t;
    }

    function renderEarnings(dates) {
      if (!dates || dates.length === 0) return '<div class="panel-empty">No earnings dates available.</div>';
      let t = '<table class="earnings-table"><thead><tr><th>Date</th><th>EPS Est.</th><th>EPS Actual</th><th>Surprise %</th></tr></thead><tbody>';
      dates.forEach(d => {
        const dateStr = formatDate(d.date);
        const est = d['EPS Estimate'] != null ? fmtNum(d['EPS Estimate']) : '\u2014';
        const actual = d['Reported EPS'] != null ? fmtNum(d['Reported EPS']) : '\u2014';
        const surprise = d['Surprise(%)'] != null ? d['Surprise(%)'] : null;
        let surpriseStr = '\u2014';
        let surpriseClass = '';
        if (surprise != null) {
          surpriseStr = fmtNum(surprise) + '%';
          surpriseClass = Number(surprise) >= 0 ? 'surprise-pos' : 'surprise-neg';
        }
        t += '<tr><td>' + dateStr + '</td><td>' + est + '</td><td>' + actual + '</td><td class="' + surpriseClass + '">' + surpriseStr + '</td></tr>';
      });
      t += '</tbody></table>';
      return t;
    }

    function showSub(sub) {
      activeSub = sub;
      pane.querySelectorAll('.fin-sub-tab').forEach(b => b.classList.toggle('active', b.dataset.sub === sub));
      if (sub === 'income') finContent.innerHTML = renderStatement(data.income);
      else if (sub === 'balance') finContent.innerHTML = renderStatement(data.balance);
      else if (sub === 'cashflow') finContent.innerHTML = renderStatement(data.cashflow);
      else if (sub === 'earnings') finContent.innerHTML = renderEarnings(data.earningsDates);
    }

    showSub('income');

    // Sub-tab clicks
    pane.querySelectorAll('.fin-sub-tab').forEach(b => {
      b.addEventListener('click', () => showSub(b.dataset.sub));
    });

    // Freq toggle
    pane.querySelectorAll('.fin-toggle').forEach(b => {
      b.addEventListener('click', () => {
        const newFreq = b.dataset.freq;
        if (newFreq === finFreq) return;
        finFreq = newFreq;
        // Clear cache for this tab and reload
        delete cache[cacheKey('financials', currentSymbol)];
        loadTabData('financials', currentSymbol);
      });
    });
  }

  // ---- Data loading ----
  async function loadMoreNews() {
    if (newsLoading || !newsHasMore) return;
    newsLoading = true;
    const pane = tabPanes['news'];
    const symbol = currentSymbol;
    try {
      const resp = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, start: newsStart }),
      });
      if (activeTab !== 'news' || currentSymbol !== symbol) return;
      const result = await resp.json();
      if (!resp.ok) return;
      newsHasMore = !!result.hasMore;
      newsStart += (result.news || []).length;
      renderNews(pane, result.news, true);
    } catch (e) {
      // silently fail for load-more
    } finally {
      newsLoading = false;
    }
  }

  async function loadTabData(tabName, symbol) {
    const pane = tabPanes[tabName];
    if (!pane) return;
    const key = cacheKey(tabName, symbol);

    if (tabName === 'news') {
      newsStart = 0;
      newsHasMore = false;
      newsLoading = false;
      if (newsObserver) { newsObserver.disconnect(); newsObserver = null; }
    }

    pane.innerHTML = '<div class="panel-loading">Loading...</div>';

    const endpoints = {
      news: '/api/news',
      insiders: '/api/insiders',
      profile: '/api/profile',
      analysts: '/api/analysts',
      financials: '/api/financials',
    };

    try {
      const body = { symbol };
      if (tabName === 'financials') body.freq = finFreq;
      if (tabName === 'news') body.start = 0;
      const resp = await fetch(endpoints[tabName], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      // Stale check
      if (activeTab !== tabName || currentSymbol !== symbol) return;
      const result = await resp.json();
      if (!resp.ok) {
        pane.innerHTML = '<div class="panel-empty">Failed to load data.</div>';
        return;
      }
      if (tabName !== 'news') cache[key] = result;

      if (tabName === 'news') {
        newsHasMore = !!result.hasMore;
        newsStart = (result.news || []).length;
        renderNews(pane, result.news, false);
      }
      else if (tabName === 'insiders') renderInsiders(pane, result.insiders);
      else if (tabName === 'profile') renderProfile(pane, result.profile);
      else if (tabName === 'analysts') renderAnalysts(pane, result);
      else if (tabName === 'financials') renderFinancials(pane, result);
    } catch (e) {
      pane.innerHTML = '<div class="panel-empty">Network error.</div>';
    }
  }

  // Hook into fetchSymbol to refresh active panel on symbol change
  const _origFetchSymbolForPanels = fetchSymbol;
  fetchSymbol = async function(symbol) {
    if (typeof clearAllDrawings === 'function') clearAllDrawings();
    if (typeof deactivateDrawingTool === 'function') deactivateDrawingTool();
    await _origFetchSymbolForPanels(symbol);
    // Clear cache for new symbol
    Object.keys(cache).forEach(k => { if (k.endsWith(':' + symbol) === false) { /* keep */ } });
    if (panelOpen && activeTab) {
      delete cache[cacheKey(activeTab, currentSymbol)];
      loadTabData(activeTab, currentSymbol);
    }
  };
})();

const dataPanelResizer = document.getElementById('data-panel-resizer');
const rightToolbar = document.getElementById('right-toolbar');
let isResizingDataPanel = false;

dataPanelResizer.addEventListener('mousedown', (e) => {
  isResizingDataPanel = true;
  dataPanelResizer.classList.add('dragging');
  dataPanel.style.transition = 'none'; // smoother dragging
  document.body.style.userSelect = 'none'; // prevent text selection
});

window.addEventListener('mousemove', (e) => {
  if (!isResizingDataPanel) return;
  const toolbarWidth = rightToolbar.offsetWidth;
  // Chart container area bounds right side
  const rightEdge = window.innerWidth - toolbarWidth;
  let newWidth = rightEdge - e.clientX;
  newWidth = Math.max(250, Math.min(newWidth, window.innerWidth - toolbarWidth - 60)); // max out leaving some space
  dataPanel.style.width = newWidth + 'px';
});

window.addEventListener('mouseup', () => {
  if (isResizingDataPanel) {
    isResizingDataPanel = false;
    dataPanelResizer.classList.remove('dragging');
    dataPanel.style.transition = '';
    document.body.style.userSelect = '';
    syncAllPanes(); // Resize chart properly after layout change
  }
});

document.getElementById('data-panel-popout').addEventListener('click', () => {
  const activeTab = document.querySelector('.data-tab.active') || document.querySelector('.data-tab');
  const tabName = activeTab ? activeTab.dataset.tab : 'news';
  window.open(`/?popout=true&symbol=${currentSymbol}&tab=${tabName}`, 'OpenFinChPopout_' + Date.now(), 'width=450,height=800');
  document.getElementById('data-panel-close').click();
});
// ========== AUTO-DETECT LOCAL INDEX ==========
function detectLocalIndex() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const region = tz.split('/')[0];
  const city = tz.split('/').pop();

  // Timezone → [primary index, secondary index] (pick first; secondary is fallback context)
  const tzMap = {
    // India
    'Asia/Kolkata':      '^NSEI',
    'Asia/Calcutta':     '^NSEI',
    // US
    'America/New_York':  '^GSPC',
    'America/Chicago':   '^GSPC',
    'America/Denver':    '^GSPC',
    'America/Los_Angeles': '^GSPC',
    'America/Phoenix':   '^GSPC',
    'America/Anchorage': '^GSPC',
    'Pacific/Honolulu':  '^GSPC',
    // UK
    'Europe/London':     '^FTSE',
    // Europe
    'Europe/Berlin':     '^STOXX50E',
    'Europe/Paris':      '^STOXX50E',
    'Europe/Madrid':     '^STOXX50E',
    'Europe/Rome':       '^STOXX50E',
    'Europe/Amsterdam':  '^STOXX50E',
    'Europe/Zurich':     '^STOXX50E',
    'Europe/Brussels':   '^STOXX50E',
    'Europe/Vienna':     '^STOXX50E',
    // Japan
    'Asia/Tokyo':        '^N225',
    // China
    'Asia/Shanghai':     '000001.SS',
    'Asia/Hong_Kong':    '^HSI',
    // South Korea
    'Asia/Seoul':        '^KS11',
    // Australia
    'Australia/Sydney':  '^AXJO',
    'Australia/Melbourne': '^AXJO',
    // Canada
    'America/Toronto':   '^GSPTSE',
    // Brazil
    'America/Sao_Paulo': '^BVSP',
    // Singapore
    'Asia/Singapore':    '^STI',
    // Taiwan
    'Asia/Taipei':       '^TWII',
  };

  if (tzMap[tz]) return tzMap[tz];

  // Fallback by region
  const regionMap = {
    'America': '^GSPC',
    'Europe':  '^STOXX50E',
    'Asia':    '^NSEI',
    'Australia': '^AXJO',
    'Pacific': '^GSPC',
    'Africa':  '^GSPC',
  };

  return regionMap[region] || '^GSPC';
}

// ========== INIT ==========
const detectedSymbol = detectLocalIndex();
document.getElementById('ticker-input').value = detectedSymbol;

if (typeof isPopout !== 'undefined' && isPopout) {
  document.title = currentSymbol + " - Data Panel";
  openDataTab(initialTab || 'news');
  setTimeout(() => { if (window.openFinChDataPanel) window.openFinChDataPanel(initialTab || 'news'); }, 100);
} else {
  fetchSymbol(detectedSymbol);
}

