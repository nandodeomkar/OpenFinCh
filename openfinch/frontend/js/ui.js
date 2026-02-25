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
