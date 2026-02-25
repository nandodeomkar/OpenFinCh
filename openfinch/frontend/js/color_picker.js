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
