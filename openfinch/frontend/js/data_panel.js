// ========== UNIFIED DATA PANEL ==========
(function () {
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
  fetchSymbol = async function (symbol) {
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
const dataPanel = document.getElementById('data-panel');
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
