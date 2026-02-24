import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add #data-panel-resizer, popout button
html_data_panel_header = """    <div id="data-panel-header">
      <div class="tab-bar">
        <button class="data-tab" data-tab="news">News</button>
        <button class="data-tab" data-tab="insiders">Insiders</button>
        <button class="data-tab" data-tab="profile">Profile</button>
        <button class="data-tab" data-tab="analysts">Analysts</button>
        <button class="data-tab" data-tab="financials">Financials</button>
      </div>
      <button id="data-panel-popout" title="Popout">&#8599;</button>
      <button id="data-panel-close">&times;</button>
    </div>"""
text = re.sub(r'<div id="data-panel-header">.*?<button id="data-panel-close">&times;</button>\s*</div>', html_data_panel_header, text, flags=re.DOTALL)

text = text.replace('<div id="data-panel">', '<div id="data-panel">\n    <div id="data-panel-resizer"></div>')

# 2. Add CSS
css_data_panel = """  #data-panel {
    width: 0; overflow: hidden; background: #111118;
    border-left: 1px solid #1e1e28; display: flex; flex-direction: column;
    transition: width 0.25s ease;
    flex-shrink: 0;
    position: relative;
  }
  #data-panel.open { width: 400px; }
  #data-panel-resizer {
    position: absolute; left: 0; top: 0; bottom: 0; width: 6px;
    cursor: col-resize; z-index: 101; background: transparent;
  }
  #data-panel-resizer:hover, #data-panel-resizer.dragging { background: rgba(41,98,255,0.5); }
  
  #data-panel-popout {
    background: none; border: none; color: #787b86; cursor: pointer;
    font-size: 16px; padding: 8px 4px; line-height: 1; margin-left: auto;
  }
  #data-panel-popout:hover { color: #e0e0e0; }

  /* Popout mode hiding */
  body.is-popout #header, 
  body.is-popout #chart-area > :not(#data-panel),
  body.is-popout #right-toolbar,
  body.is-popout #identifiers-panel { display: none !important; }
  
  body.is-popout #data-panel { width: 100% !important; border-left: none; transition: none; display: flex; }
  body.is-popout #data-panel-resizer, body.is-popout #data-panel-popout, body.is-popout #data-panel-close { display: none !important; }
"""

# Replace old #data-panel CSS
# Actually it's safer to just sub #data-panel up to #data-panel-close
text = re.sub(
    r'#data-panel\s*\{.*?#data-panel-close:hover\s*\{\s*color:\s*#ef5350;\s*\}', 
    css_data_panel + '\n  #data-panel-close {\n    background: none; border: none; color: #787b86; cursor: pointer;\n    font-size: 16px; padding: 8px 12px; line-height: 1;\n  }\n  #data-panel-close:hover { color: #ef5350; }', 
    text, 
    flags=re.DOTALL
)

# 3. Add JS for popout parameters near top of script
js_popout_init = """let currentInterval = '{default_interval}';
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
"""
text = text.replace("let currentInterval = '{default_interval}';\nlet currentSymbol = '{default_symbol}';", js_popout_init)

# 4. Add Resize JS and Popout JS
js_addons = """
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
"""

# Insert JS before "// ========== INIT =========="
text = text.replace("// ========== INIT ==========", js_addons + "\n// ========== INIT ==========")

# 5. Automatically open the panel and correct tab if in popout mode
js_popout_run = """
  if (isPopout) {
    // Open panel automatically
    openDataTab(initialTab || 'news');
    document.title = currentSymbol + " - Data Panel";
    return; // Optionally skip chart loading or we can just let it load in background
  }
"""
text = text.replace("document.getElementById('ticker-input').value = detectedSymbol;", "document.getElementById('ticker-input').value = detectedSymbol;\n" + js_popout_run)

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Applied features")
