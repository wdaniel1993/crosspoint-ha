// Home Assistant setup for the reader. Collects the HA base URL and a
// long-lived access token in the browser and stores them together in
// /.crosspoint/homeassistant.json. The on-device Home Assistant screen
// (device.json) then browses entities through the `crosspoint_ha_catalog`
// script (see the ha/ folder of this repo) and controls entities through
// direct REST service calls.
CrossPoint.registerPlugin(async (container, api) => {
  const CONFIG_PATH = '/.crosspoint/homeassistant.json';

  // Base64 that survives non-Latin1 (btoa alone does not).
  function b64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  container.innerHTML =
    '<h2>Home Assistant</h2>' +
    '<p id="ha-status">Checking configuration…</p>' +
    '<div class="setting-row"><span class="setting-name">Server URL</span>' +
    '<span class="setting-control"><input type="text" id="ha-url" placeholder="http://homeassistant.local:8123"></span></div>' +
    '<div class="setting-row"><span class="setting-name">Long-lived token</span>' +
    '<span class="setting-control"><input type="password" id="ha-token" autocomplete="off"></span></div>' +
    '<div class="setting-row">' +
    '<button type="button" class="btn-small btn-add" id="ha-save">Save</button> ' +
    '<button type="button" class="btn-small" id="ha-test">Test connection</button>' +
    '</div>' +
    '<p style="color:#666">Create the token in Home Assistant: click your profile → Security → ' +
    '"Create token" under <b>Long-lived access tokens</b>. Requires the <code>crosspoint_ha_catalog</code> ' +
    'script installed on your HA (see this repo\'s ha/ folder). ' +
    'The token is stored in plain text on the SD card — prefer a dedicated HA user.</p>';

  const el = (id) => document.getElementById(id);
  const status = (t) => { el('ha-status').textContent = t; };
  const trimUrl = (u) => u.trim().replace(/\/+$/, '');

  // Load existing configuration, if any.
  try {
    const r = await fetch('/download?path=' + encodeURIComponent(CONFIG_PATH));
    if (r.ok) {
      const cfg = JSON.parse(await r.text());
      el('ha-url').value = cfg.url || '';
      el('ha-token').value = cfg.token || '';
      status('Configured: ' + (cfg.url || '(missing URL)'));
    } else {
      status('Not configured yet.');
    }
  } catch (e) {
    status('Not configured yet.');
  }

  el('ha-save').addEventListener('click', async () => {
    const url = trimUrl(el('ha-url').value);
    const token = el('ha-token').value.trim();
    if (!/^https?:\/\//.test(url)) { status('URL must start with http:// or https://'); return; }
    if (!token) { status('Token is required.'); return; }
    try {
      await api.writeFile(CONFIG_PATH, b64(JSON.stringify({ url, token })));
      status('Saved ✓ — open it on the device: Home → Plugins → Home Assistant.');
    } catch (e) {
      status('Save failed: ' + e);
    }
  });

  el('ha-test').addEventListener('click', async () => {
    const url = trimUrl(el('ha-url').value);
    const token = el('ha-token').value.trim();
    status('Testing…');
    try {
      const res = await api.relay('GET', url + '/api/', [['Authorization', 'Bearer ' + token]]);
      if (res.status === 200) status('Connected ✓ (API reachable)');
      else if (res.status === 401) status('Reached HA, but the token was rejected (401).');
      else status('Unexpected response: HTTP ' + res.status);
    } catch (e) {
      status('Connection failed: ' + e);
    }
  });
});
