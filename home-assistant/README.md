# Home Assistant

Control your Home Assistant entities from this device.

## Setup (one-time)

1. Install the `crosspoint_ha_catalog` script on your Home Assistant
   (see this plugin's GitHub repo, `ha/` folder).
2. In this reader's web interface → Settings → Home Assistant card:
   enter your HA URL and a long-lived access token, press **Save**, then
   **Test connection**.

## Use

- Open: **Home → Plugins → Home Assistant**
- Rows show the entity name and its `Area · state`; tap to toggle, activate
  (scenes), run (scripts), or refresh (sensors).
- **Search** at the top of the list opens the keyboard; matching runs on the
  Home Assistant side and spans the whole catalog.
- "Next page" / "Previous page" rows move through the catalog.
- States refresh whenever the list reloads (leave and re-enter).
