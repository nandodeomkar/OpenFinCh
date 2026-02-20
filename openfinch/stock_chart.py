"""HTML chart page generator for OpenFinCh.

This module only generates the HTML/CSS/JS for the chart page.
Data is fetched dynamically via AJAX from the local server.
"""

from openfinch.intervals import get_interval_buttons


def build_chart_html(default_symbol: str) -> str:
    """Generate the chart HTML page with an editable ticker and interval toggles."""

    buttons = get_interval_buttons()
    interval_options_html = "\n      ".join(
        f'<option value="{b["key"]}">{b["label"]}</option>'
        for b in buttons
    )
    default_interval = buttons[0]["key"] if buttons else "1h"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{default_symbol} — OpenFinCh</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ height: 100%; overflow: hidden; }}
  body {{ background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; }}
  a[href*="tradingview"] {{ display: none !important; }}

  #header {{
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: #111118; border-bottom: 1px solid #1e1e28;
  }}

  #ticker-input {{
    background: transparent; border: 1px solid transparent; border-radius: 4px;
    color: #e0e0e0; font-size: 18px; font-weight: 700; width: 100px;
    padding: 2px 6px; font-family: inherit; outline: none;
    transition: border-color 0.2s, background 0.2s;
  }}
  #ticker-input:hover {{ border-color: #2a2a36; }}
  #ticker-input:focus {{ border-color: #f0b90b; background: #1a1a24; }}

  #header .ohlc {{ display: flex; gap: 14px; font-size: 13px; }}
  #header .ohlc span {{ color: #787b86; }}
  #header .ohlc .val {{ color: #e0e0e0; font-weight: 500; }}
  #header .ohlc .up {{ color: #26a69a; }}
  #header .ohlc .down {{ color: #ef5350; }}

  #interval-select {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 8px; font-size: 13px;
    font-family: inherit; cursor: pointer; outline: none;
  }}
  #interval-select option {{ background: #1a1a24; color: #e0e0e0; }}

  .custom-interval {{
    display: none; align-items: center; gap: 4px;
  }}
  .custom-interval.visible {{ display: flex; }}
  #custom-value {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 6px; font-size: 13px;
    font-family: inherit; width: 48px; text-align: center; outline: none;
  }}
  #custom-value:focus {{ border-color: #f0b90b; }}
  #custom-unit {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 6px; font-size: 13px;
    font-family: inherit; cursor: pointer; outline: none;
  }}
  #custom-unit option {{ background: #1a1a24; color: #e0e0e0; }}
  #custom-apply {{
    background: #f0b90b; color: #0a0a0f; border: none;
    border-radius: 4px; padding: 4px 8px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
  }}
  #custom-apply:hover {{ background: #d4a30a; }}

  #chart-type {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 8px; font-size: 13px;
    font-family: inherit; cursor: pointer; outline: none; margin-left: auto;
  }}
  #chart-type option {{ background: #1a1a24; color: #e0e0e0; }}

  #chart-area {{ flex: 1; min-height: 0; display: flex; }}
  #charts-container {{
    flex: 1; display: flex; flex-direction: column; min-width: 0;
  }}
  .chart-pane {{ position: relative; min-height: 0; }}
  .chart-pane .pane-chart {{ position: absolute; inset: 0; z-index: 0; }}
  .pane-divider {{
    height: 4px; background: #1e1e28; cursor: row-resize;
    flex-shrink: 0; position: relative; z-index: 15;
  }}
  .pane-divider:hover, .pane-divider.dragging {{ background: #2962ff; }}
  .pane-label {{
    position: absolute; top: 4px; left: 8px; z-index: 6;
    color: #787b86; font-size: 10px; pointer-events: none;
    text-transform: uppercase; letter-spacing: 0.5px;
  }}

  #btn-indicators-toggle {{
    background: #1a1a24; color: #787b86;
    border: 1px solid #2a2a36; border-radius: 4px; padding: 4px 10px;
    cursor: pointer; font-size: 12px; font-family: inherit;
    transition: color 0.15s, background 0.15s; white-space: nowrap;
  }}
  #btn-indicators-toggle:hover {{ color: #e0e0e0; background: #28283a; }}
  #btn-indicators-toggle.open {{ color: #2962ff; border-color: rgba(41,98,255,0.4); }}
  #indicators-panel {{
    display: none; padding: 8px 16px; background: #111118;
    border-bottom: 1px solid #1e1e28;
    gap: 12px; align-items: center; flex-wrap: wrap;
  }}
  #indicator-select {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 8px; font-size: 13px;
    font-family: inherit; cursor: pointer; outline: none;
  }}
  #indicator-select option {{ background: #1a1a24; color: #e0e0e0; }}
  .active-indicator {{
    display: inline-flex; align-items: center; gap: 6px;
    background: #1a1a24; border: 1px solid #2a2a36; border-radius: 4px;
    padding: 4px 8px; font-size: 12px; color: #c8c8d0;
  }}
  .active-indicator input[type="number"], .active-indicator input[type="text"] {{
    background: #0a0a0f; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 3px; padding: 2px 4px; width: 42px; font-size: 12px;
    font-family: inherit; text-align: center; outline: none;
  }}
  .active-indicator input[type="number"]:focus, .active-indicator input[type="text"]:focus {{ border-color: #f0b90b; }}
  .active-indicator .swatch {{
    width: 10px; height: 10px; border-radius: 2px; display: inline-block;
  }}
  .active-indicator .remove-ind {{
    background: none; border: none; color: #787b86; cursor: pointer;
    font-size: 14px; padding: 0 2px; line-height: 1;
  }}
  .active-indicator .remove-ind:hover {{ color: #ef5350; }}

  /* Loading overlay */
  #loading {{
    display: none; position: fixed; inset: 0; z-index: 100;
    background: rgba(10,10,15,0.85); align-items: center; justify-content: center;
  }}
  #loading.active {{ display: flex; }}
  .spinner {{
    width: 36px; height: 36px; border: 3px solid #2a2a36;
    border-top-color: #f0b90b; border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }}
  @keyframes spin {{ to {{ transform: rotate(360deg); }} }}

  /* Error toast */
  #toast {{
    display: none; position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    z-index: 200; background: #ef5350; color: #fff; padding: 8px 20px;
    border-radius: 6px; font-size: 13px; font-weight: 500;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }}
  #toast.show {{ display: block; }}
</style>
</head>
<body>

<div id="loading"><div class="spinner"></div></div>
<div id="toast"></div>

<div id="header">
  <input id="ticker-input" type="text" value="{default_symbol}" spellcheck="false" autocomplete="off">
  <select id="interval-select">
    {interval_options_html}
    <option value="custom">Custom…</option>
  </select>
  <div class="custom-interval" id="custom-interval-group">
    <input id="custom-value" type="number" min="1" value="7" placeholder="#">
    <select id="custom-unit">
      <option value="min">min</option>
      <option value="hours">hours</option>
      <option value="days">days</option>
      <option value="weeks">weeks</option>
      <option value="months">months</option>
    </select>
    <button id="custom-apply">&#9654;</button>
  </div>
  <div class="ohlc" id="legend">
    <span>O <span class="val" id="lo">&mdash;</span></span>
    <span>H <span class="val" id="lh">&mdash;</span></span>
    <span>L <span class="val" id="ll">&mdash;</span></span>
    <span>C <span class="val" id="lc">&mdash;</span></span>
    <span id="vol-legend">Vol <span class="val" id="lv">&mdash;</span></span>
  </div>
  <button id="btn-indicators-toggle">&#128202; Indicators &#9660;</button>
  <select id="chart-type">
    <option value="candles" selected>Candles</option>
    <option value="line">Line</option>
    <option value="area">Area</option>
  </select>
</div>
<div id="indicators-panel">
  <select id="indicator-select">
    <option value="" selected disabled>+ Add indicator…</option>
    <option value="volume">Volume</option>
    <option value="sma">SMA (Simple Moving Average)</option>
    <option value="ema">EMA (Exponential Moving Average)</option>
    <option value="atr">ATR (Average True Range)</option>
    <option value="macd">MACD (Moving Average Convergence Divergence)</option>
    <option value="bb">Bollinger Bands</option>
    <option value="adx">ADX (Average Directional Index)</option>
    <option value="aroon">Aroon</option>
    <option value="aroon_osc">Aroon Oscillator</option>
    <option value="supertrend">SuperTrend</option>
    <option value="vwma">VWMA (Volume Weighted Moving Average)</option>
  </select>
  <div id="active-indicators"></div>
</div>

<div id="chart-area">
  <div id="charts-container">
    <div id="main-pane" class="chart-pane" style="flex:1">
      <div id="chart" class="pane-chart"></div>
    </div>
  </div>
</div>

<script src="https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js"></script>
<script>
// ========== STATE ==========
let DATASETS = null;
let currentInterval = '{default_interval}';
let currentSymbol = '{default_symbol}';

let ALL_CANDLES = [];
let ALL_VOLUME  = [];
let ALL_LINE    = [];

// ========== CHART SETUP ==========
const container = document.getElementById('chart');
const chart = LightweightCharts.createChart(container, {{
  autoSize: true,
  layout: {{ background: {{ type: 'solid', color: '#0a0a0f' }}, textColor: '#e0e0e0' }},
  grid: {{ vertLines: {{ color: '#1a1a24' }}, horzLines: {{ color: '#1a1a24' }} }},
  crosshair: {{ mode: LightweightCharts.CrosshairMode.Normal }},
  rightPriceScale: {{ borderColor: '#1e1e28' }},
  timeScale: {{ borderColor: '#1e1e28', timeVisible: true, secondsVisible: false }},
  watermark: {{ visible: false }},
}});

const candleSeries = chart.addCandlestickSeries({{
  upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
}});
const lineSeries = chart.addLineSeries({{
  color: '#f0b90b', lineWidth: 2, visible: false, crosshairMarkerRadius: 4,
}});
const areaSeries = chart.addAreaSeries({{
  lineColor: '#f0b90b', lineWidth: 2,
  topColor: 'rgba(240, 185, 11, 0.35)',
  bottomColor: 'rgba(240, 185, 11, 0.02)',
  visible: false, crosshairMarkerRadius: 4,
}});

let volumeSeries = null;
let chartMode = 'candles';

// ========== DATA LOADING ==========
const loadingEl = document.getElementById('loading');
const toastEl = document.getElementById('toast');

function showLoading() {{ loadingEl.classList.add('active'); }}
function hideLoading() {{ loadingEl.classList.remove('active'); }}

function showToast(msg) {{
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}}

async function fetchSymbol(symbol) {{
  showLoading();
  try {{
    const resp = await fetch('/api/data', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ symbol }}),
    }});
    const data = await resp.json();
    if (!resp.ok) {{
      showToast(data.error || 'Failed to fetch data');
      hideLoading();
      return;
    }}
    currentSymbol = data.symbol;
    DATASETS = data.datasets;
    document.title = currentSymbol + ' — OpenFinCh';
    applyInterval(currentInterval);
  }} catch (e) {{
    showToast('Network error: ' + e.message);
  }}
  hideLoading();
}}

function applyInterval(interval) {{
  if (!DATASETS || !DATASETS[interval]) return;
  currentInterval = interval;
  const ds = DATASETS[interval];
  ALL_CANDLES = ds.candles;
  ALL_VOLUME  = ds.volume;
  ALL_LINE    = ALL_CANDLES.map(c => ({{ time: c.time, value: c.close }}));

  chart.applyOptions({{
    timeScale: {{ timeVisible: ds.intraday, secondsVisible: false }},
  }});

  candleSeries.setData(ALL_CANDLES);
  lineSeries.setData(ALL_LINE);
  areaSeries.setData(ALL_LINE);
  if (volumeSeries) {{
    volumeSeries.setData(ALL_VOLUME);
    // Also update sub-pane time scale visibility
    const sp = subPanes['volume'];
    if (sp && sp.chart) {{
      sp.chart.applyOptions({{
        timeScale: {{ timeVisible: ds.intraday, secondsVisible: false }},
      }});
    }}
  }}
  chart.timeScale().fitContent();

  Object.values(subPanes).forEach(sp => {{
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) sp.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
  }});

  document.getElementById('interval-select').value = interval;
}}

// ========== TICKER INPUT ==========
const tickerInput = document.getElementById('ticker-input');

tickerInput.addEventListener('keydown', e => {{
  if (e.key === 'Enter') {{
    e.preventDefault();
    const sym = tickerInput.value.trim().toUpperCase();
    if (sym && sym !== currentSymbol) {{
      tickerInput.value = sym;
      fetchSymbol(sym);
    }}
    tickerInput.blur();
  }}
}});

tickerInput.addEventListener('focus', () => tickerInput.select());

// ========== INTERVAL DROPDOWN ==========
const intervalSelect = document.getElementById('interval-select');
const customGroup = document.getElementById('custom-interval-group');

intervalSelect.addEventListener('change', (e) => {{
  if (e.target.value === 'custom') {{
    customGroup.classList.add('visible');
  }} else {{
    customGroup.classList.remove('visible');
    applyInterval(e.target.value);
  }}
}});

// ========== CUSTOM INTERVAL ==========
async function applyCustomInterval() {{
  const value = parseInt(document.getElementById('custom-value').value, 10);
  const unit = document.getElementById('custom-unit').value;
  if (!value || value < 1) {{ showToast('Enter a value ≥ 1'); return; }}

  showLoading();
  try {{
    const resp = await fetch('/api/custom_interval', {{
      method: 'POST',
      headers: {{ 'Content-Type': 'application/json' }},
      body: JSON.stringify({{ symbol: currentSymbol, value, unit }}),
    }});
    const data = await resp.json();
    if (!resp.ok) {{ showToast(data.error || 'Failed'); hideLoading(); return; }}

    const ds = data.dataset;
    ALL_CANDLES = ds.candles;
    ALL_VOLUME  = ds.volume;
    ALL_LINE    = ALL_CANDLES.map(c => ({{ time: c.time, value: c.close }}));

    chart.applyOptions({{ timeScale: {{ timeVisible: ds.intraday, secondsVisible: false }} }});
    candleSeries.setData(ALL_CANDLES);
    lineSeries.setData(ALL_LINE);
    areaSeries.setData(ALL_LINE);
    if (volumeSeries) {{
      volumeSeries.setData(ALL_VOLUME);
      const sp = subPanes['volume'];
      if (sp && sp.chart) sp.chart.applyOptions({{ timeScale: {{ timeVisible: ds.intraday, secondsVisible: false }} }});
    }}
    chart.timeScale().fitContent();
    currentInterval = 'custom';
  }} catch (e) {{
    showToast('Error: ' + e.message);
  }}
  hideLoading();
}}

document.getElementById('custom-apply').addEventListener('click', applyCustomInterval);
document.getElementById('custom-value').addEventListener('keydown', e => {{
  if (e.key === 'Enter') {{ e.preventDefault(); applyCustomInterval(); }}
}});

// ========== CHART TYPE ==========
const chartTypeSelect = document.getElementById('chart-type');

function setChartMode(mode) {{
  chartMode = mode;
  candleSeries.applyOptions({{ visible: mode === 'candles' }});
  lineSeries.applyOptions({{ visible: mode === 'line' }});
  areaSeries.applyOptions({{ visible: mode === 'area' }});
  chartTypeSelect.value = mode;
}}

chartTypeSelect.addEventListener('change', () => setChartMode(chartTypeSelect.value));

// ========== OHLC LEGEND ==========
const lo = document.getElementById('lo');
const lh = document.getElementById('lh');
const ll = document.getElementById('ll');
const lc = document.getElementById('lc');
const lv = document.getElementById('lv');

function formatVol(v) {{
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}}

chart.subscribeCrosshairMove(param => {{
  if (!param || !param.time) return;
  const candle = param.seriesData.get(candleSeries);
  const vol = param.seriesData.get(volumeSeries);
  if (chartMode === 'candles' && candle) {{
    const cls = candle.close >= candle.open ? 'up' : 'down';
    lo.textContent = candle.open.toFixed(2); lo.className = 'val ' + cls;
    lh.textContent = candle.high.toFixed(2); lh.className = 'val ' + cls;
    ll.textContent = candle.low.toFixed(2);  ll.className = 'val ' + cls;
    lc.textContent = candle.close.toFixed(2); lc.className = 'val ' + cls;
  }} else if (chartMode === 'line' || chartMode === 'area') {{
    const pt = param.seriesData.get(chartMode === 'line' ? lineSeries : areaSeries);
    if (pt) {{
      lo.textContent = '—'; lo.className = 'val';
      lh.textContent = '—'; lh.className = 'val';
      ll.textContent = '—'; ll.className = 'val';
      lc.textContent = pt.value.toFixed(2); lc.className = 'val';
    }}
  }}
  if (volumeSeries && vol) {{ lv.textContent = formatVol(vol.value); }}
}});

// ========== MULTI-PANE SYSTEM ==========
const chartsContainer = document.getElementById('charts-container');
const subPanes = {{}};
let syncingTimeScale = false;

chart.timeScale().subscribeVisibleLogicalRangeChange(range => {{
  if (syncingTimeScale) return;
  syncingTimeScale = true;
  Object.values(subPanes).forEach(sp => {{
    if (sp.chart) sp.chart.timeScale().setVisibleLogicalRange(range);
  }});
  syncingTimeScale = false;
}});

function createSubPane(id, label, height) {{
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
  const subChart = LightweightCharts.createChart(chartDiv, {{
    autoSize: true,
    layout: {{ background: {{ type: 'solid', color: '#0a0a0f' }}, textColor: '#e0e0e0' }},
    grid: {{ vertLines: {{ color: '#1a1a24' }}, horzLines: {{ color: '#1a1a24' }} }},
    crosshair: {{ mode: LightweightCharts.CrosshairMode.Normal }},
    rightPriceScale: {{ borderColor: '#1e1e28' }},
    timeScale: {{ borderColor: '#1e1e28', timeVisible: isIntraday, secondsVisible: false, visible: true }},
  }});

  subChart.timeScale().subscribeVisibleLogicalRangeChange(range => {{
    if (syncingTimeScale) return;
    syncingTimeScale = true;
    chart.timeScale().setVisibleLogicalRange(range);
    Object.values(subPanes).forEach(sp => {{
      if (sp.chart && sp.chart !== subChart) sp.chart.timeScale().setVisibleLogicalRange(range);
    }});
    syncingTimeScale = false;
  }});

  let startY = 0, startH = 0;
  divider.addEventListener('mousedown', e => {{
    startY = e.clientY;
    startH = paneDiv.offsetHeight;
    divider.classList.add('dragging');
    const onMove = ev => {{
      const newH = Math.max(60, startH - (ev.clientY - startY));
      paneDiv.style.height = newH + 'px';
    }};
    const onUp = () => {{
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }};
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }});

  const pane = {{ chart: subChart, series: null, container: paneDiv, divider, chartDiv }};
  subPanes[id] = pane;
  return pane;
}}

function destroySubPane(id) {{
  const sp = subPanes[id];
  if (!sp) return;
  sp.chart.remove();
  sp.container.remove();
  sp.divider.remove();
  delete subPanes[id];
}}

// ========== INDICATORS PANEL ==========
document.getElementById('btn-indicators-toggle').addEventListener('click', () => {{
  const panel = document.getElementById('indicators-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'flex';
  const btn = document.getElementById('btn-indicators-toggle');
  btn.classList.toggle('open', !isOpen);
  btn.innerHTML = isOpen ? '&#128202; Indicators &#9660;' : '&#128202; Indicators &#9650;';
}});

// ========== SMA CALCULATION ==========
function computeSMA(candles, period) {{
  const result = [];
  for (let i = 0; i < candles.length; i++) {{
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {{
      sum += candles[j].close;
    }}
    result.push({{ time: candles[i].time, value: sum / period }});
  }}
  return result;
}}

// ========== EMA CALCULATION ==========
function computeEMA(candles, period) {{
  if (candles.length === 0) return [];
  const k = 2 / (1 + period); // smoothing factor
  const result = [];
  // First EMA value = SMA of first 'period' values
  let sum = 0;
  for (let i = 0; i < Math.min(period, candles.length); i++) {{
    sum += candles[i].close;
  }}
  let ema = sum / Math.min(period, candles.length);
  result.push({{ time: candles[Math.min(period - 1, candles.length - 1)].time, value: ema }});
  // Subsequent values use EMA formula
  for (let i = period; i < candles.length; i++) {{
    ema = (candles[i].close * k) + (ema * (1 - k));
    result.push({{ time: candles[i].time, value: ema }});
  }}
  return result;
}}

// ========== ATR CALCULATION ==========
function computeATR(candles, period) {{
  if (candles.length < 2) return [];
  const trs = [];
  // Calculate TR for all candles
  // First TR is just High - Low
  trs.push({{ time: candles[0].time, value: candles[0].high - candles[0].low }});
  
  for (let i = 1; i < candles.length; i++) {{
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i].close; // Previous close is actually candles[i-1].close
    // Correct logic: High - Low, |High - PrevClose|, |Low - PrevClose|
    const prevClose = candles[i-1].close;
    const tr = Math.max(h - l, Math.abs(h - prevClose), Math.abs(l - prevClose));
    trs.push({{ time: candles[i].time, value: tr }});
  }}

  // Calculate ATR using RMA (Wilder's Smoothing)
  // First ATR = SMA of first 'period' TRs
  const result = [];
  let sum = 0;
  if (trs.length < period) return [];

  for (let i = 0; i < period; i++) {{
    sum += trs[i].value;
  }}
  let atr = sum / period;
  result.push({{ time: trs[period - 1].time, value: atr }});

  // Subsequent ATR: (PrevATR * (period - 1) + CurrentTR) / period
  for (let i = period; i < trs.length; i++) {{
    atr = (atr * (period - 1) + trs[i].value) / period;
    result.push({{ time: trs[i].time, value: atr }});
  }}
  return result;
}}

// ========== MACD CALCULATION ==========
function calculateEMAValues(data, period) {{
  if (data.length === 0) return [];
  const k = 2 / (1 + period);
  const result = [];
  let sum = 0;
  const startIdx = Math.min(period, data.length);
  for (let i = 0; i < startIdx; i++) {{
    sum += data[i].value;
  }}
  let ema = sum / startIdx;
  result.push({{ time: data[Math.min(period - 1, data.length - 1)].time, value: ema }});
  
  for (let i = period; i < data.length; i++) {{
    ema = (data[i].value * k) + (ema * (1 - k));
    result.push({{ time: data[i].time, value: ema }});
  }}
  return result;
}}

function computeMACD(candles, fastPeriod, slowPeriod, signalPeriod) {{
  if (candles.length === 0) return null;
  const closeSeries = candles.map(c => ({{ time: c.time, value: c.close }}));
  
  const fastEMA = calculateEMAValues(closeSeries, fastPeriod);
  const slowEMA = calculateEMAValues(closeSeries, slowPeriod);
  
  // Align series
  const macdLine = [];
  // We need to map by time. Since both come from same candles, times are unique and sorted.
  // Efficient way: iterate and match.
  const fastMap = new Map(fastEMA.map(i => [i.time, i.value]));
  const slowMap = new Map(slowEMA.map(i => [i.time, i.value]));
  
  // MACD = Fast - Slow
  for (const item of slowEMA) {{ // Slow starts later usually
    if (fastMap.has(item.time)) {{
      macdLine.push({{ time: item.time, value: fastMap.get(item.time) - item.value }});
    }}
  }}
  
  const signalLine = calculateEMAValues(macdLine, signalPeriod);
  
  // Histogram = MACD - Signal
  const histogram = [];
  const signalMap = new Map(signalLine.map(i => [i.time, i.value]));
  for (const item of macdLine) {{
    if (signalMap.has(item.time)) {{
      const sig = signalMap.get(item.time);
      const histVal = item.value - sig;
      // Color based on value and growth could be added here, but simple green/red is fine for now
      // Actually standard: Bright Green (grow up), Dark Green (fall up), Bright Red (grow down), Dark Red (fall down)
      // For simplicity: Green if >= 0, Red if < 0.
      const color = histVal >= 0 ? '#26a69a' : '#ef5350';
      histogram.push({{ time: item.time, value: histVal, color: color }});
    }}
  }}
  
  return {{ macd: macdLine, signal: signalLine, histogram }};
}}

// ========== VWMA CALCULATION ==========
function computeVWMA(candles, volumes, period) {{
  // VWMA = Sum(Close * Volume) / Sum(Volume)
  if (candles.length === 0 || volumes.length === 0) return [];
  if (candles.length !== volumes.length) {{
    return []; // Should align or fail silently
  }}
  const result = [];
  
  for (let i = 0; i < candles.length; i++) {{
    if (i < period - 1) continue;
    
    let sumPriceVolume = 0;
    let sumVolume = 0;
    for (let j = i - period + 1; j <= i; j++) {{
      sumPriceVolume += candles[j].close * volumes[j].value;
      sumVolume += volumes[j].value;
    }}
    if (sumVolume === 0) {{
      result.push({{ time: candles[i].time, value: 0 }}); // Avoid division by zero
    }} else {{
      result.push({{ time: candles[i].time, value: sumPriceVolume / sumVolume }});
    }}
  }}
  return result;
}}

// ========== BOLLINGER BANDS CALCULATION ==========
function computeBB(candles, period, stdDevMult) {{
  if (candles.length < period) return null;
  
  const result = {{ upper: [], middle: [], lower: [] }};
  
  for (let i = 0; i < candles.length; i++) {{
    if (i < period - 1) continue;
    
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {{
      sum += candles[j].close;
    }}
    const sma = sum / period;
    
    let sumSqDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {{
      const diff = candles[j].close - sma;
      sumSqDiff += diff * diff;
    }}
    const stdDev = Math.sqrt(sumSqDiff / period);
    
    const time = candles[i].time;
    result.middle.push({{ time, value: sma }});
    result.upper.push({{ time, value: sma + (stdDev * stdDevMult) }});
    result.lower.push({{ time, value: sma - (stdDev * stdDevMult) }});
  }}
  
  return result;
}}

// ========== ADX CALCULATION ==========
function computeADX(candles, period) {{
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
  
  for (let i = 1; i < candles.length; i++) {{
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
    
    if (upMove > downMove && upMove > 0) {{
      pDM = upMove;
    }}
    if (downMove > upMove && downMove > 0) {{
      mDM = downMove;
    }}
    
    plusDMs.push(pDM);
    minusDMs.push(mDM);
  }}
  
  // 2. Smooth TR, +DM, -DM using Wilder's Smoothing (RMA)
  // First value = Sum of first N
  // Subsequent = (Prev * (N-1) + Curr) / N
  
  const smoothTR = [];
  const smoothPDM = [];
  const smoothMDM = [];
  
  // Helper for RMA array generation
  // We need to start from index 'period' (1-based count in Logic, so index period)
  // Logic: First valid smoothed value is at index 'period'.
  
  function calculateRMA(values, n) {{
    const smooth = new Array(values.length).fill(0);
    if (values.length <= n) return smooth;
    
    let sum = 0;
    for(let i = 1; i <= n; i++) sum += values[i];
    
    smooth[n] = sum;
    
    for(let i = n + 1; i < values.length; i++) {{
      smooth[i] = smooth[i-1] - (smooth[i-1] / n) + values[i];
    }}
    return smooth;
  }}
  
  const atr = calculateRMA(trs, period);
  const admP = calculateRMA(plusDMs, period); // ADM+
  const admM = calculateRMA(minusDMs, period); // ADM-
  
  // 3. Calculate +DI, -DI, DX
  // +DI = 100 * (ADM+ / ATR)
  // -DI = 100 * (ADM- / ATR)
  // DX = 100 * |+DI - -DI| / (+DI + -DI)
  
  const dxs = new Array(candles.length).fill(0);
  
  // Valid DX starts from index 'period'
  for(let i = period; i < candles.length; i++) {{
    if (atr[i] === 0) continue;
    
    const pDI = 100 * (admP[i] / atr[i]);
    const mDI = 100 * (admM[i] / atr[i]);
    
    const sumDI = pDI + mDI;
    if (sumDI === 0) {{
      dxs[i] = 0;
    }} else {{
      dxs[i] = 100 * Math.abs(pDI - mDI) / sumDI;
    }}
  }}
  
  // 4. ADX = RMA of DX
  // First ADX at index 2*period - 1 ? 
  // Wilder says ADX is smoothed DX.
  // First ADX = Average of first N DXs (where DXs are valid)
  // Valid DXs start at index 'period'. So first ADX is at index period + period - 1 = 2*period - 1.
  
  const adx = new Array(candles.length).fill(0);
  
  // Sum first 'period' DX values starting from 'period'
  let sumDX = 0;
  for(let i = period; i < period + period; i++) {{
    if(i >= dxs.length) break;
    sumDX += dxs[i];
  }}
  
  const startIdx = 2 * period - 1;
  if(startIdx < dxs.length) {{
    adx[startIdx] = sumDX / period; // Is first ADX just SMA? Wilder often uses SMA to seed.
    // Actually typically Standard logic: First ADX = Mean(DX over period). Subsequent = ((Prev * (N-1)) + Curr) / N
    
    for(let i = startIdx + 1; i < candles.length; i++) {{
      adx[i] = ((adx[i-1] * (period - 1)) + dxs[i]) / period;
    }}
  }}
  
  // 5. Result
  const result = [];
  for(let i = startIdx; i < candles.length; i++) {{
    result.push({{ time: candles[i].time, value: adx[i] }});
  }}
  
    return result;
}}

// ========== AROON CALCULATION ==========
function computeAroon(candles, period) {{
  if (candles.length < period) return null;
  const upLine = [];
  const downLine = [];
  
  // Aroon Up = ((Period - Days Since High) / Period) * 100
  // Aroon Down = ((Period - Days Since Low) / Period) * 100
  // "Days Since" means 0 if current is High.
  
  for (let i = period; i < candles.length; i++) {{
    let highest = -Infinity;
    let lowest = Infinity;
    let highIdx = -1;
    let lowIdx = -1;
    
    // Look back 'period' candles + 1 (period+1 window is standard? Or 0 to period?)
    // Standard is: Look at last N candles (including current).
    // e.g. 14 period. Look at i, i-1, ... i-14? No, window size is period + 1 usually?
    // TradingView says "measures how many periods have passed since price has recorded an n-period high".
    // If High is today, days since is 0.
    
    for (let j = 0; j <= period; j++) {{
      const idx = i - j;
      if (idx < 0) continue;
      const c = candles[idx];
      if (c.high > highest) {{
        highest = c.high;
        highIdx = j; // days since
      }}
      if (c.low < lowest) {{
        lowest = c.low;
        lowIdx = j; // days since
      }}
    }}
    
    // But Aroon calculation usually excludes current bar? 
    // Tradingview: "14 Day Aroon-Up will take the number of days since price last recorded a 14 day high".
    // If High is today, days since is 0.
    
    const aroonUp = ((period - highIdx) / period) * 100;
    const aroonDown = ((period - lowIdx) / period) * 100;
    
    upLine.push({{ time: candles[i].time, value: aroonUp }});
    downLine.push({{ time: candles[i].time, value: aroonDown }});
  }}
  
  return {{ up: upLine, down: downLine }};
}}

function computeAroonOsc(candles, period) {{
  const aroon = computeAroon(candles, period);
  if (!aroon) return null;
  
  const result = [];
  // Arrays should be same length and aligned by time
  for(let i = 0; i < aroon.up.length; i++) {{
    const val = aroon.up[i].value - aroon.down[i].value;
    result.push({{ time: aroon.up[i].time, value: val }});
  }}
  return result;
}}

// ========== SUPERTREND CALCULATION ==========
function computeSuperTrend(candles, period, mult) {{
  if (candles.length < period + 1) return null;
  const atrValues = computeATR(candles, period);
  if (atrValues.length === 0) return null;

  const atrMap = new Map(atrValues.map(a => [a.time, a.value]));

  const line = [];     // continuous line: {{ time, value, trend }}
  const signals = [];  // trend change markers: {{ time, value, direction }}

  let upperBand = 0;
  let lowerBand = 0;
  let prevUpperBand = 0;
  let prevLowerBand = 0;
  let trend = 1;
  let prevTrend = 1;
  let first = true;

  for (let i = 0; i < candles.length; i++) {{
    const c = candles[i];
    const atr = atrMap.get(c.time);
    if (atr === undefined) continue;

    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + (mult * atr);
    const basicLower = hl2 - (mult * atr);

    if (first) {{
      upperBand = basicUpper;
      lowerBand = basicLower;
      trend = c.close > hl2 ? 1 : -1;
      prevTrend = trend;
      first = false;
    }} else {{
      lowerBand = (basicLower > prevLowerBand || candles[i - 1].close < prevLowerBand)
        ? basicLower : prevLowerBand;
      upperBand = (basicUpper < prevUpperBand || candles[i - 1].close > prevUpperBand)
        ? basicUpper : prevUpperBand;

      prevTrend = trend;
      if (trend === 1 && c.close < lowerBand) {{
        trend = -1;
      }} else if (trend === -1 && c.close > upperBand) {{
        trend = 1;
      }}
    }}

    const value = trend === 1 ? lowerBand : upperBand;
    line.push({{ time: c.time, value, trend }});

    if (prevTrend !== trend && !first) {{
      signals.push({{
        time: c.time,
        value: value,
        direction: trend  // +1 = buy, -1 = sell
      }});
    }}

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
  }}

  return {{ line, signals }};
}}

// ========== SUPERTREND RENDER HELPER ==========
function renderSuperTrend(ind, data) {{
  // 1. Remove previous segment series and area series
  if (ind.segmentSeries) {{
    ind.segmentSeries.forEach(s => chart.removeSeries(s));
  }}
  if (ind.areaSeries) {{
    ind.areaSeries.forEach(s => chart.removeSeries(s));
  }}
  ind.segmentSeries = [];
  ind.areaSeries = [];

  if (!data || !data.line || data.line.length === 0) {{
    candleSeries.setMarkers([]);
    return;
  }}

  // 2. Split line into contiguous same-trend segments with overlap points
  const segments = [];
  let currentSeg = [data.line[0]];
  let currentTrend = data.line[0].trend;

  for (let i = 1; i < data.line.length; i++) {{
    const pt = data.line[i];
    if (pt.trend !== currentTrend) {{
      // Add this point as overlap (end of prev segment)
      currentSeg.push(pt);
      segments.push({{ trend: currentTrend, points: currentSeg }});
      // Start new segment from this overlap point
      currentSeg = [pt];
      currentTrend = pt.trend;
    }} else {{
      currentSeg.push(pt);
    }}
  }}
  if (currentSeg.length > 0) {{
    segments.push({{ trend: currentTrend, points: currentSeg }});
  }}

  // 3. Create line series + area series for each segment
  const upColor = '#00E676';
  const downColor = '#FF5252';
  const upFill = 'rgba(0, 230, 118, 0.15)';
  const downFill = 'rgba(255, 82, 82, 0.15)';

  // Build a map of time -> close price for area fill
  const closeMap = new Map(ALL_CANDLES.map(c => [c.time, c.close]));

  segments.forEach(seg => {{
    const color = seg.trend === 1 ? upColor : downColor;
    const fillColor = seg.trend === 1 ? upFill : downFill;

    // Line series for this segment
    const ls = chart.addLineSeries({{
      color: color,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
      priceScaleId: 'right',
    }});
    ls.setData(seg.points.map(p => ({{ time: p.time, value: p.value }})));
    ind.segmentSeries.push(ls);
  }});

  // 4. Set markers on candleSeries for trend reversals
  const markers = data.signals.map(sig => ({{
    time: sig.time,
    position: sig.direction === 1 ? 'belowBar' : 'aboveBar',
    color: sig.direction === 1 ? upColor : downColor,
    shape: sig.direction === 1 ? 'arrowUp' : 'arrowDown',
    text: sig.direction === 1 ? 'Buy' : 'Sell',
    size: 2,
  }}));
  // Sort markers by time
  markers.sort((a, b) => {{
    if (a.time < b.time) return -1;
    if (a.time > b.time) return 1;
    return 0;
  }});
  candleSeries.setMarkers(markers);
}}

// ========== INDICATOR MANAGEMENT ==========
const activeIndicators = {{}};
let indicatorIdCounter = 0;
const MA_COLORS = ['#2962ff', '#e040fb', '#00bcd4', '#ff9800', '#4caf50', '#f44336'];
let maColorIdx = 0;

function addIndicator(type) {{
  const id = 'ind_' + (indicatorIdCounter++);
  if (type === 'volume') {{
    if (activeIndicators['volume']) return; // only one volume
    const pane = createSubPane('volume', 'Volume', 150);
    volumeSeries = pane.chart.addHistogramSeries({{
      priceFormat: {{ type: 'volume' }},
      priceScaleId: 'vol',
    }});
    pane.series = volumeSeries;
    if (ALL_VOLUME.length) volumeSeries.setData(ALL_VOLUME);
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    document.getElementById('vol-legend').style.display = '';
    activeIndicators['volume'] = {{ type: 'volume', id: 'volume' }};
    renderActiveIndicators();
  }} else if (type === 'sma' || type === 'ema') {{
    const color = MA_COLORS[maColorIdx % MA_COLORS.length];
    maColorIdx++;
    const period = 9;
    const series = chart.addLineSeries({{
      color: color,
      lineWidth: 2,
      crosshairMarkerRadius: 3,
      priceScaleId: 'right',
      lastValueVisible: true,
      priceLineVisible: true,
    }});
    const computeFn = type === 'ema' ? computeEMA : computeSMA;
    const data = computeFn(ALL_CANDLES, period);
    series.setData(data);
    activeIndicators[id] = {{ type, id, series, period, color }};
    renderActiveIndicators();
  }} else if (type === 'vwma') {{
     if (activeIndicators['vwma']) return;
     const color = '#9C27B0'; // Purple for VWMA
     const period = 20;
     const series = chart.addLineSeries({{
       color: color,
       lineWidth: 2,
       crosshairMarkerRadius: 3,
       priceScaleId: 'right',
       lastValueVisible: true,
       priceLineVisible: true,
       title: 'VWMA'
     }});
     const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, period);
     series.setData(data);
     activeIndicators['vwma'] = {{ type: 'vwma', id: 'vwma', series, period, color }};
     renderActiveIndicators();
  }} else if (type === 'atr') {{
    if (activeIndicators['atr']) return; // single ATR pane for now implementation-wise
    const pane = createSubPane('atr', 'ATR', 150);
    const series = pane.chart.addLineSeries({{
      color: '#b71c1c', lineWidth: 2,
      priceScaleId: 'atr',
      lastValueVisible: true,
      priceLineVisible: true,
    }});
    const period = 14; 
    const data = computeATR(ALL_CANDLES, period);
    series.setData(data);
    
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    
    activeIndicators['atr'] = {{ type: 'atr', id: 'atr', pane, series, period }};
    renderActiveIndicators();
  }} else if (type === 'macd') {{
    if (activeIndicators['macd']) return;
    const pane = createSubPane('macd', 'MACD', 150);
    
    // Histogram
    const histSeries = pane.chart.addHistogramSeries({{ priceScaleId: 'macd' }});
    // MACD Line (Fast) - Blue
    const macdSeries = pane.chart.addLineSeries({{
      color: '#2962ff', lineWidth: 2, priceScaleId: 'macd'
    }});
    // Signal Line (Slow) - Orange
    const signalSeries = pane.chart.addLineSeries({{
      color: '#ff6d00', lineWidth: 2, priceScaleId: 'macd'
    }});
    
    const config = {{ fast: 12, slow: 26, signal: 9 }};
    const data = computeMACD(ALL_CANDLES, config.fast, config.slow, config.signal);
    
    if (data) {{
      histSeries.setData(data.histogram);
      macdSeries.setData(data.macd);
      signalSeries.setData(data.signal);
    }}

    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}

    activeIndicators['macd'] = {{ 
      type: 'macd', id: 'macd', pane, 
      histSeries, macdSeries, signalSeries, 
      config 
    }};
    renderActiveIndicators();
  }} else if (type === 'bb') {{
    const color = '#2962ff'; // Default BB color
    const middleSeries = chart.addLineSeries({{
      color: '#ff6d00', lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    }});
    const upperSeries = chart.addLineSeries({{
      color: color, lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    }});
    const lowerSeries = chart.addLineSeries({{
      color: color, lineWidth: 1, crosshairMarkerVisible: false, priceLineVisible: true, lastValueVisible: true
    }});
    
    const config = {{ period: 20, mult: 2 }};
    const data = computeBB(ALL_CANDLES, config.period, config.mult);
    
    if (data) {{
      middleSeries.setData(data.middle);
      upperSeries.setData(data.upper);
      lowerSeries.setData(data.lower);
    }}
    
    activeIndicators[id] = {{ 
      type: 'bb', id, 
      middleSeries, upperSeries, lowerSeries,
      config 
    }};
    renderActiveIndicators();
  }} else if (type === 'supertrend') {{
    if (activeIndicators['supertrend']) return;
    const config = {{ period: 10, mult: 3 }};
    const ind = {{ 
      type: 'supertrend', id: 'supertrend', config, 
      segmentSeries: [], areaSeries: [] 
    }};
    const data = computeSuperTrend(ALL_CANDLES, config.period, config.mult);
    renderSuperTrend(ind, data);
    activeIndicators['supertrend'] = ind;
    renderActiveIndicators();
  }} else if (type === 'adx') {{
    if (activeIndicators['adx']) return;
    const pane = createSubPane('adx', 'ADX', 150);
    const series = pane.chart.addLineSeries({{
      color: '#ff4081', lineWidth: 2, priceScaleId: 'adx'
    }});
    const period = 14; 
    const data = computeADX(ALL_CANDLES, period);
    series.setData(data);
    
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    
    activeIndicators['adx'] = {{ type: 'adx', id: 'adx', pane, series, period }};
    renderActiveIndicators();
  }} else if (type === 'aroon') {{
    if (activeIndicators['aroon']) return;
    const pane = createSubPane('aroon', 'Aroon', 150);
    const upSeries = pane.chart.addLineSeries({{
      color: '#ff6d00', lineWidth: 2, priceScaleId: 'aroon', title: 'Aroon Up'
    }});
    const downSeries = pane.chart.addLineSeries({{
      color: '#2962ff', lineWidth: 2, priceScaleId: 'aroon', title: 'Aroon Down'
    }});
    
    const period = 14;
    const data = computeAroon(ALL_CANDLES, period);
    if (data) {{
      upSeries.setData(data.up);
      downSeries.setData(data.down);
    }}
    
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    
    activeIndicators['aroon'] = {{ type: 'aroon', id: 'aroon', pane, upSeries, downSeries, period }};
    renderActiveIndicators();
  }} else if (type === 'aroon_osc') {{
    if (activeIndicators['aroon_osc']) return;
    const pane = createSubPane('aroon_osc', 'Aroon Osc', 150);
    const series = pane.chart.addLineSeries({{
      color: '#9c27b0', lineWidth: 2, priceScaleId: 'aroon_osc'
    }});
    // Add zero line?
    // Lightweight charts doesn't have direct horizontal lines, but we can add a primitive or just rely on grid.
    // Actually we can add a PriceLine if we want, but it's attached to a series.
    // Let's just create a zero line series or use createPriceLine on the series.
    series.createPriceLine({{
      price: 0, color: '#787b86', lineWidth: 1, lineStyle: 2, axisLabelVisible: false
    }});
    
    const period = 14;
    const data = computeAroonOsc(ALL_CANDLES, period);
    if (data) series.setData(data);
    
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    
    activeIndicators['aroon_osc'] = {{ type: 'aroon_osc', id: 'aroon_osc', pane, series, period }};
    renderActiveIndicators();
  }}
}}

function removeIndicator(id) {{
  const ind = activeIndicators[id];
  if (!ind) return;
  if (ind.type === 'volume') {{
    volumeSeries = null;
    destroySubPane('volume');
    document.getElementById('vol-legend').style.display = 'none';
  }} else if (ind.type === 'sma' || ind.type === 'ema' || ind.type === 'vwma') {{
    chart.removeSeries(ind.series);
  }} else if (ind.type === 'atr') {{
    destroySubPane('atr');
  }} else if (ind.type === 'macd') {{
    destroySubPane('macd');
  }} else if (ind.type === 'bb') {{
    chart.removeSeries(ind.middleSeries);
    chart.removeSeries(ind.upperSeries);
    chart.removeSeries(ind.lowerSeries);
  }} else if (ind.type === 'supertrend') {{
    if (ind.segmentSeries) ind.segmentSeries.forEach(s => chart.removeSeries(s));
    if (ind.areaSeries) ind.areaSeries.forEach(s => chart.removeSeries(s));
    candleSeries.setMarkers([]);
  }} else if (ind.type === 'adx') {{
    destroySubPane('adx');
  }} else if (ind.type === 'aroon') {{
    destroySubPane('aroon');
  }} else if (ind.type === 'aroon_osc') {{
    destroySubPane('aroon_osc');
  }}
  delete activeIndicators[id];
  renderActiveIndicators();
}}

function updateIndicatorPeriod(id, newVal) {{
  const ind = activeIndicators[id];
  if (!ind) return;
  
  if (ind.type === 'macd') {{
    const parts = String(newVal).split(',').map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
    if (parts.length === 3) {{
      ind.config = {{ fast: parts[0], slow: parts[1], signal: parts[2] }};
      const data = computeMACD(ALL_CANDLES, ind.config.fast, ind.config.slow, ind.config.signal);
      if (data) {{
        ind.histSeries.setData(data.histogram);
        ind.macdSeries.setData(data.macd);
        ind.signalSeries.setData(data.signal);
      }}
    }}
    return;
  }} else if (ind.type === 'bb') {{
    // Parse "20, 2"
    const parts = String(newVal).split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (parts.length >= 2) {{
      ind.config = {{ period: Math.round(parts[0]), mult: parts[1] }};
      const data = computeBB(ALL_CANDLES, ind.config.period, ind.config.mult);
      if (data) {{
        ind.middleSeries.setData(data.middle);
        ind.upperSeries.setData(data.upper);
        ind.lowerSeries.setData(data.lower);
      }}
    }}
    return;
  }} else if (ind.type === 'supertrend') {{
    const parts = String(newVal).split(',').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
    if (parts.length >= 2) {{
      ind.config = {{ period: Math.round(parts[0]), mult: parts[1] }};
      const data = computeSuperTrend(ALL_CANDLES, ind.config.period, ind.config.mult);
      renderSuperTrend(ind, data);
    }}
    return;
  }}

  // Single value indicators
  const newPeriod = parseInt(newVal, 10);
  if (isNaN(newPeriod) || newPeriod < 1) return;

  if (ind.type === 'sma' || ind.type === 'ema') {{
    ind.period = newPeriod;
    const computeFn = ind.type === 'ema' ? computeEMA : computeSMA;
    const data = computeFn(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  }} else if (ind.type === 'vwma') {{
    ind.period = newPeriod;
    const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, newPeriod);
    ind.series.setData(data);
  }} else if (ind.type === 'atr') {{
    ind.period = newPeriod;
    const data = computeATR(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  }} else if (ind.type === 'adx') {{
    ind.period = newPeriod;
    const data = computeADX(ALL_CANDLES, newPeriod);
    ind.series.setData(data);
  }} else if (ind.type === 'aroon') {{
    ind.period = newPeriod;
    const data = computeAroon(ALL_CANDLES, newPeriod);
    if (data) {{
      ind.upSeries.setData(data.up);
      ind.downSeries.setData(data.down);
    }}
  }} else if (ind.type === 'aroon_osc') {{
    ind.period = newPeriod;
    const data = computeAroonOsc(ALL_CANDLES, newPeriod);
    if (data) ind.series.setData(data);
  }}
}}

function refreshAllIndicators() {{
  // Called after data changes (ticker or interval switch)
  Object.values(activeIndicators).forEach(ind => {{
    if (ind.type === 'sma' || ind.type === 'ema') {{
      const computeFn = ind.type === 'ema' ? computeEMA : computeSMA;
      const data = computeFn(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    }} else if (ind.type === 'vwma') {{
      const data = computeVWMA(ALL_CANDLES, ALL_VOLUME, ind.period);
      ind.series.setData(data);
    }} else if (ind.type === 'atr') {{
      const data = computeATR(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    }} else if (ind.type === 'macd') {{
      const data = computeMACD(ALL_CANDLES, ind.config.fast, ind.config.slow, ind.config.signal);
      if (data) {{
        ind.histSeries.setData(data.histogram);
        ind.macdSeries.setData(data.macd);
        ind.signalSeries.setData(data.signal);
      }}
    }} else if (ind.type === 'bb') {{
      const data = computeBB(ALL_CANDLES, ind.config.period, ind.config.mult);
      if (data) {{
        ind.middleSeries.setData(data.middle);
        ind.upperSeries.setData(data.upper);
        ind.lowerSeries.setData(data.lower);
      }}
    }} else if (ind.type === 'adx') {{
      const data = computeADX(ALL_CANDLES, ind.period);
      ind.series.setData(data);
    }} else if (ind.type === 'aroon') {{
      const data = computeAroon(ALL_CANDLES, ind.period);
      if (data) {{
        ind.upSeries.setData(data.up);
        ind.downSeries.setData(data.down);
      }}
    }} else if (ind.type === 'aroon_osc') {{
      const data = computeAroonOsc(ALL_CANDLES, ind.period);
      if (data) ind.series.setData(data);
    }} else if (ind.type === 'supertrend') {{
      const data = computeSuperTrend(ALL_CANDLES, ind.config.period, ind.config.mult);
      renderSuperTrend(ind, data);
    }}
  }});
}}

function renderActiveIndicators() {{
  const container = document.getElementById('active-indicators');
  container.innerHTML = '';
  Object.values(activeIndicators).forEach(ind => {{
    const el = document.createElement('div');
    el.className = 'active-indicator';
    if (ind.type === 'volume') {{
      el.innerHTML = '<span>Vol</span><button class="remove-ind" title="Remove">&times;</button>';
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator('volume'));
    }} else if (ind.type === 'sma' || ind.type === 'ema') {{
      const label = ind.type.toUpperCase();
      el.innerHTML = `<span class="swatch" style="background:${{ind.color}}"></span>${{label}} <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'vwma') {{
      const label = 'VWMA';
      el.innerHTML = `<span class="swatch" style="background:${{ind.color}}"></span>${{label}} <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'atr') {{
      el.innerHTML = `<span class="swatch" style="background:#b71c1c"></span>ATR <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'macd') {{
      el.innerHTML = `MACD <input type="text" value="${{ind.config.fast}}, ${{ind.config.slow}}, ${{ind.config.signal}}" title="Fast, Slow, Signal" style="width:60px"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'bb') {{
      el.innerHTML = `BB <input type="text" value="${{ind.config.period}}, ${{ind.config.mult}}" title="Period, StdDev" style="width:40px"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'adx') {{
      el.innerHTML = `<span class="swatch" style="background:#ff4081"></span>ADX <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'aroon') {{
      // Show two swatches for Up/Down
      el.innerHTML = `<span class="swatch" style="background:#ff6d00" title="Up"></span><span class="swatch" style="background:#2962ff" title="Down"></span>Aroon <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'aroon_osc') {{
      el.innerHTML = `<span class="swatch" style="background:#9c27b0"></span>Aroon Osc <input type="text" value="${{ind.period}}" title="Period"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }} else if (ind.type === 'supertrend') {{
      el.innerHTML = `<span class="swatch" style="background:#00E676" title="Up"></span><span class="swatch" style="background:#FF5252" title="Down"></span>ST <input type="text" value="${{ind.config.period}}, ${{ind.config.mult}}" title="Period, Multiplier" style="width:40px"><button class="remove-ind" title="Remove">&times;</button>`;
      const input = el.querySelector('input');
      input.addEventListener('change', () => updateIndicatorPeriod(ind.id, input.value));
      input.addEventListener('keydown', (e) => {{
        if (e.key === 'Enter') {{ e.preventDefault(); input.blur(); }}
      }});
      el.querySelector('.remove-ind').addEventListener('click', () => removeIndicator(ind.id));
    }}
    container.appendChild(el);
  }});
}}

document.getElementById('indicator-select').addEventListener('change', (e) => {{
  const val = e.target.value;
  if (val) addIndicator(val);
  e.target.value = '';
}});

// Patch applyInterval and applyCustomInterval to refresh indicators after data load
const _origApplyInterval = applyInterval;
applyInterval = function(interval) {{
  _origApplyInterval(interval);
  refreshAllIndicators();
}};

const _origFetchSymbol = fetchSymbol;
fetchSymbol = async function(symbol) {{
  await _origFetchSymbol(symbol);
  refreshAllIndicators();
}};

// ========== INIT ==========
// Add volume by default, then fetch data
addIndicator('volume');
fetchSymbol('{default_symbol}');

</script>
</body>
</html>"""
