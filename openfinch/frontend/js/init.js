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
  if (window.openFinChDataPanel) window.openFinChDataPanel(initialTab || 'news');
  else setTimeout(() => { if (window.openFinChDataPanel) window.openFinChDataPanel(initialTab || 'news'); }, 100);
} else {
  fetchSymbol(detectedSymbol);
}

