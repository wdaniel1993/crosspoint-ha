# CrossPoint Home Assistant

Control Home Assistant from a CrossPoint e-reader (e.g. Xteink X4 Pro) —
browse, search, and toggle your entities straight from the reader. No
companion app, no extra service: the reader talks to Home Assistant's own
REST API.

*Status: v0.4 — device-proven on an Xteink X4 Pro (CrossPoint SD-plugin beta
line; HA 2026.9). Verified end-to-end: folder picker, two-hop row actions,
AC control page, inline ± step rows.*

## How it works

Two small pieces, both plain text you can read and modify:

1. **An HA script** (`ha/crosspoint_ha_catalog.yaml`) that acts as the
   catalog **and** action endpoint. The reader POSTs to it via

   `POST /api/services/script/crosspoint_ha_catalog?return_response`

   - **Browsing**: `{"page": N, "limit": M, "query": "...", "area": "...",
     "kind": "...", "control": "..."}` → `{"service_response": {"items":
     [...]}}` — one page of rows (display name, an `Area · state` line,
     entity_id, action path). Paging, search, folder filters and the AC
     control page are computed in the script.
   - **Acting**: `{"act": "<entity_id | cmd:...>", "base": "<ha-url>"}` —
     executes the tap and answers `{"ack": "<ha-url>/auth/providers"}`. The
     `ack` hop exists because the firmware's post-tap fetch is always a GET
     (it streams the response to the SD card): the reader GETs that public
     URL as its acknowledgement file (`/ha/ack.json`).

2. **A device plugin** (`home-assistant/`) — a declarative `device.json` for
   the on-device catalog screen, plus `plugin.js`, which renders the setup
   card in the reader's web interface (server URL + long-lived token →
   stored on the SD card).

A tap on a row performs a normal HA service call — e.g.
`POST /api/services/homeassistant/toggle {"entity_id": "light.kitchen"}` —
via the two-hop pattern above, and the list refreshes when you return to it.

## Requirements

- **Home Assistant 2023.7+** (script response data; tested on 2026.9)
- A **CrossPoint build with SD-card plugins** — the vocabulary used here
  (authenticated JSON browse with POST body, on-device search, token files,
  templated downloads) matches the `feat-sd-plugins` development line.
- Reader and HA reachable from each other (same network is the simple case).
- A Home Assistant long-lived access token (see [Security](#security)).

## Install

### 1. The catalog script on Home Assistant

- Settings → Scripts → **Create Script** → **Edit in YAML** → replace
  everything with the contents of `ha/crosspoint_ha_catalog.yaml`.
- Confirm the service name under **Developer Tools → Actions**: search for
  `crosspoint` — it should read `script.crosspoint_ha_catalog`. Keep the
  alias/key unchanged, or update `device.json`'s URL to match.

Quick check:

```bash
curl -s -X POST "http://homeassistant.local:8123/api/services/script/crosspoint_ha_catalog?return_response" \
  -H "Authorization: Bearer $HA_TOKEN" -H "Content-Type: application/json" \
  -d '{"page": 1, "limit": 13}' | head -c 400
```

### 2. The plugin on the reader

Copy the `home-assistant/` folder onto the SD card so the device sees
`…/plugins/home-assistant/device.json` (roots: `/.crosspoint/plugins/`,
`/plugins/`, `/.plugins/`). File manager or USB mass storage both work.

### 3. Configure

Reader web interface → **Settings** → **Home Assistant** card: enter your HA
URL and the long-lived token, **Save**, then **Test connection**.

On the device: **Home → Plugins → Home Assistant**.

## Usage

- The catalog opens with a picker: **Scenes / Scripts / AC / one entry per
  room / All entities**.
- Rows show the entity name plus an `Area · state` line.
- **Tap** = toggle (lights, switches, fans, covers, climate, media players),
  activate (scenes), run (scripts), refresh (sensors).
- **Non-binary controls** — relative step rows appear right under their
  entity:
  - lights: `<name> +` / `<name> -` steps brightness by ~10% (stepping down
    past the floor turns the light off; stepping up from off turns it on
    dim);
  - media players with volume: steps volume by one `volume_step`;
  - the subtitle previews the effect, e.g. `brightness 80% -> 90%`.
  - The **AC page** (picker → AC) offers on/off, mode, target temperature
    ± step (clamped to the unit's min/max), and fan mode rows.
- **Search** — from any list, the top of the list opens the on-device
  keyboard; matching runs in HA and spans the whole catalog. Step rows are
  not injected into search results.
- **Paging** — “Next page” / “Previous page” rows at the page edges.
- Each tap also writes the service-call result to `/ha/ack.json` on the SD
  card (overwritten every time; safe to ignore).
- E-ink reality: states are a snapshot from when the list was fetched;
  re-enter the list to refresh.

## Customize

In the HA script:

- `domains` — which entity kinds appear (default: `light`, `switch`, `fan`,
  `input_boolean`, `cover`, `climate`, `media_player`, `scene`, `script`,
  `sensor`, `binary_sensor`). Trim `sensor`/`binary_sensor` for a
  controls-only catalog.
- `exclude` — entity_ids to hide.
- Step rows are capability-driven (dimmable lights, volume-reporting media
  players); extending to more entity types is a small change to the script.

In `device.json`:

- `page_size` — rows per page (max 16).
- `lists` — the picker entries (which rooms to show, or
  `control: "climate"` for the AC page).

## Security

- The token is stored **in plain text on the SD card**
  (`/.crosspoint/homeassistant.json`). Use a **dedicated Home Assistant
  user** for the reader so it can be revoked independently. HA long-lived
  tokens carry full rights for their user; there is no finer scope.
- `lock`, `alarm_control_panel`, and friends are **not** in the default
  `domains` list — every tap fires immediately, with no confirmation step in
  the plugin vocabulary. Add them only deliberately.
- Plain HTTP on your LAN is the common setup; HTTPS works if the device can
  validate the certificate. The plugin does not bypass certificate checks.

## Roadmap

- Favorites / pinned entities (label-driven)
- More step domains (cover position, fan speed, color temperature)
- Event hooks (`reader.open` → HA scene, e.g. reading light)
- Plugin-store listing (`catalog.json` is already prepared)

## Repo layout

- `home-assistant/` — the SD-card plugin (`device.json`, `plugin.js`,
  `manifest.json`, on-device `README.md`)
- `ha/` — the Home Assistant catalog script
- `catalog.json` — plugin-store catalog entry

## Development notes

- Iterate on the script: edit in HA → *Reload scripts* (Developer Tools), then
  re-run the curl above.
- The picker is a single flat level (firmware constraint); search always
  spans the whole catalog, not the current list.
- The firmware logs plugin catalog traffic on the serial console under
  `[PCAT]` (HTTP status, parse/truncation flags) — useful when a browse or
  download misbehaves.

## Credits

Built on the CrossPoint community's SD-plugin system
([crosspoint-reader](https://github.com/crosspoint-reader/crosspoint-reader),
[sd-plugins](https://github.com/itsthisjustin/sd-plugins)). The menu concept
takes cues from [pebble-home-assistant-ws](https://github.com/skylord123/pebble-home-assistant-ws).

MIT — see [LICENSE](LICENSE).
