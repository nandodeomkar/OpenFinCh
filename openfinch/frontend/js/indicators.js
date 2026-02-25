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
