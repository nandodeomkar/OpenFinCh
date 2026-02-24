import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# I am going to find the parts I injected and manually double their braces
# Since I only know roughly where they are, let's find the exact strings and replace them.

# 1. CSS part
old_css = """  #data-panel {
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

  #data-panel-close {
    background: none; border: none; color: #787b86; cursor: pointer;
    font-size: 16px; padding: 8px 12px; line-height: 1;
  }
  #data-panel-close:hover { color: #ef5350; }"""

new_css = old_css.replace('{', '{{').replace('}', '}}')

text = text.replace(old_css, new_css)


# 2. JS top part
old_js1 = """const urlParams = new URLSearchParams(window.location.search);
const isPopout = urlParams.get('popout') === 'true';
const initialTab = urlParams.get('tab');
if (urlParams.get('symbol')) {
  currentSymbol = urlParams.get('symbol').toUpperCase();
}
if (isPopout) {
  document.body.classList.add('is-popout');
}"""

new_js1 = old_js1.replace('{', '{{').replace('}', '}}')
text = text.replace(old_js1, new_js1)


# 3. JS bottom part
old_js2 = """const dataPanelResizer = document.getElementById('data-panel-resizer');
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
});"""

new_js2 = old_js2.replace('{', '{{').replace('}', '}}').replace('${currentSymbol}', '${{currentSymbol}}').replace('${tabName}', '${{tabName}}')
text = text.replace(old_js2, new_js2)


# 4. JS popout run
old_js3 = """  if (isPopout) {
    // Open panel automatically
    openDataTab(initialTab || 'news');
    document.title = currentSymbol + " - Data Panel";
    return; // Optionally skip chart loading or we can just let it load in background
  }"""
new_js3 = old_js3.replace('{', '{{').replace('}', '}}')
text = text.replace(old_js3, new_js3)

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Fixed braces")
