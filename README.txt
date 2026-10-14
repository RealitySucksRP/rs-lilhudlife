RS HUDLife / LilHudLife
======================
Reality Sucks RP
Version 1.4.3

A compact FiveM HUD with ten selectable speedometers, live vehicle telemetry,
player status rings, money/job/voice information, a configurable F9 menu, a
vehicle boot/reveal sequence, and optional NOS integration.

SUPPORTED FRAMEWORKS
--------------------
Official targets for this release:
- QBCore
- Qbox / qbx_core
- ESX Legacy

The HUD also has a standalone/native fallback for vehicle and ped telemetry,
but full framework money/job/needs integration is tested by code path against
the three targets above.

Framework selection is controlled by:

    Config.Framework = 'auto'

Allowed values:

    'auto'       Detect Qbox, QBCore, or ESX
    'qbox'       Force qbx_core/Qbox path
    'qbcore'     Force QBCore path
    'esx'        Force ESX path
    'standalone' Native-only fallback

rs_bridge is optional. When it is running, HUDLife prefers it. Without
rs_bridge the resource falls back directly to Qbox, QBCore, or ESX.

QBOX NOTES
----------
HUDLife supports both common Qbox configurations:
- QB compatibility bridge enabled: uses the compatible qb-core facade/events.
- QB compatibility bridge disabled: falls back to native qbx_core player-data
  exports while continuing to listen to Qbox's documented money/job events.

The HUD does not declare qbx_core as a hard dependency because the same
resource is also intended to run on QBCore and ESX.

MONEY / INVENTORY AUTO-DETECTION
--------------------------------
Config.Money.CashAsItem defaults to 'auto'.

Auto mode does not assume that an inventory resource automatically makes cash
an item.

- qb-inventory:
  HUDLife uses the cash-as-item exports when that inventory provides them.
  Stock qb-inventory without those exports falls back to framework cash.

- ox_inventory:
  HUDLife reads the server's `inventory:accounts` convar. Cash is read from an
  inventory account only when the configured account is actually present.
  Standard Qbox/ox_inventory normally maps framework cash to the `money` item.

- Otherwise:
  HUDLife uses the framework cash balance.

Custom physical-cash servers can override both values:

    Config.Money.CashAsItem = true
    Config.Money.CashItem = 'your_cash_item'

FEATURES
--------
- Ten speedometer layouts:
  HALO LOGO
  VEHICLE HEALTH
  APEX RACE
  CLASSIC
  NEON DIGITAL
  MINIMAL
  TURBO RPM
  VOLT EV
  SURVIVAL ARC
  SURVIVAL CLUSTER

- Fast live telemetry:
  speed, RPM, gear/reverse, lights, ignition, seatbelt/harness state.

- Throttled condition telemetry:
  fuel, engine/body health, burst tires, broken windows, damaged doors, and
  optional qbx_mechanicjob component health. Slow condition checks are cached
  for 250 ms so the 20 Hz speed display does not rescan every damage component
  on every frame update.

- Status HUD:
  health, armor, hunger, thirst, stamina, oxygen, and NOS support.

- Status sources:
  GTA/FiveM native values, QBCore/Qbox metadata/events, ESX status events,
  statebags, client exports, and public compatibility events.

- Money / identity HUD:
  server label, cash, bank, player ID, job/rank, and live voice state.

- Voice integration:
  pma-voice range/talking information when available, with safe native fallback.

- NOS integration:
  statebags, decorators, compatibility events/exports, optional RS Customs
  integration, and read-only auto-calibration from client-visible NOS configs.

- Persistent player settings:
  localStorage plus FiveM KVP with bounded/validated NUI settings.

INSTALLATION
------------
1. Put the folder in your FiveM resources directory as:

       rs-lilhudlife

2. Add this to server.cfg:

       ensure rs-lilhudlife

3. Keep Config.Framework = 'auto' unless you intentionally want to force one
   framework path.

4. Restart the resource/server.

There are no mandatory framework dependencies in fxmanifest.lua because the
same release supports QBCore, Qbox, and ESX.

OPTIONAL INTEGRATIONS
---------------------
- rs_bridge
- ox_inventory
- qb-inventory
- pma-voice
- qbx_mechanicjob
- qbx_seatbelt
- ESX status/needs resources
- RS LS Customs / RS Zombie LS Customs NOS providers

VEHICLE ART
-----------
The runtime can display a vehicle-specific PNG/WEBP when one is present under:

    html/assets/vehicles/<spawnname>.png
    html/assets/vehicles/<spawnname>.webp

If no specific image is available, the NUI automatically renders its built-in
vehicle-class silhouette. No vehicle-image pack is required for the HUD to run.

This release includes the creator's curated per-vehicle image library so the
vehicle reveal can show matching artwork instead of a generic silhouette. Keep
the filenames matched to spawn codes. For public Cfx/Tebex distribution, only
add or replace art with assets you created or have permission to redistribute.

F9 MENU
-------
Default keybind:

    F9

Command:

    /rshudlife

Players can configure speedometer style, positions, scale, units, status
layout/style, money HUD, audio, NOS display, and boot behavior. Values are
validated on the Lua side before being applied and saved.

HEALTH / STATUS BRIDGE
----------------------
See HEALTH_SYSTEM_BRIDGE.txt for integration examples.

PUBLIC EVENTS / EXPORTS
-----------------------
Examples from another client resource:

    TriggerEvent('rs-lilhudlife:client:SetStatus', {
        hunger = 80,
        thirst = 70,
        stamina = 95
    })

    TriggerEvent('rs-lilhudlife:client:SetNOS', 75)

    exports['rs-lilhudlife']:SetStatus({ hunger = 80, thirst = 70 })
    exports['rs-lilhudlife']:SetNOS(75)
    exports['rs-lilhudlife']:RefreshStatus()

These interfaces affect the local HUD display; they do not grant money, items,
jobs, permissions, or other server-authoritative state.

PERFORMANCE DESIGN
------------------
- Speed/RPM/gear/lights update at the configured vehicle interval (50 ms by
  default).
- Damage/fuel/mechanical condition scans are cached for 250 ms.
- Native status polling defaults to 500 ms.
- Hunger/thirst source polling defaults to 2000 ms.
- Voice refresh defaults to 120 ms.
- Expensive NOS provider discovery/calibration runs once and uses cached data.
- Idle/out-of-vehicle loops back off instead of using permanent Wait(0) loops.

Cfx release posts should still include a real resource-monitor/profiler capture
from a running server; do not invent a performance number from static review.

VEHICLE IMAGE LIBRARY
---------------------
The HUD ships with the creator's curated per-vehicle artwork plus built-in
silhouette fallbacks for vehicles without a matching spawn-name image. PNG and
WEBP artwork can be used under `html/assets/vehicles/`; keep filenames matched
to the vehicle spawn code. See `html/assets/vehicles/README.txt`.

LICENSE
-------
This free source release is licensed under the MIT License. See LICENSE.

SUPPORT / RELEASE NOTES
-----------------------
See WHAT_CHANGED_v1.4.3.txt for this production audit/fix update.

Credits: Reality Sucks RP

FREE TEBEX DISTRIBUTION / 10-13-2026 RELEASE HARDENING
--------------------------------------------------------
This archive is a regular, unencrypted source ZIP. Upload it as a Tebex
File Download for a free ($0) package. Merely uploading this ZIP does NOT
protect the files with Cfx Asset Escrow. If you want escrow delivery, use
the official Cfx Portal escrow workflow on a supported game platform;
DO NOT advertise this ordinary ZIP as escrow-protected.

The HUD now releases its own NUI mouse/keyboard focus immediately when the
F9 menu is closed, an inventory hides the HUD, the pause menu takes over,
a character logs out, or the resource stops. Browser callbacks carry a menu
session identifier so a delayed close cannot dismiss a newer F9 menu. Radar
restoration happens only if HUDLife actually forced the radar visible.

F8 DIAGNOSTICS
--------------
/rshuddiag  Prints framework and money provider, menu, radar, vehicle,
            pause, external visibility, and boot state. Read-only.
/rshudveh   Vehicle art / spawn-name diagnostics (in a vehicle).
/rshudnoscheck  NOS provider diagnostics (in a vehicle).
/hudmech    Optional qbx_mechanicjob condition diagnostics.

LIVE VALIDATION REQUIRED BEFORE PUBLISHING
-----------------------------------------
- Exercise Qbox (QB bridge on and off), QBCore, ESX and standalone server
  configurations that you actually intend to advertise.
- Test Legacy and Enhanced separately, especially voice range, vehicle art
  name resolution and in-world smoke effects. The static/browser audit is NOT
  an in-game runtime test or proof of compatibility on every artifact.
- F9: open, close, spam, pause, hide via SetHUDLifeVisible(false), show again,
  switch characters, restart the resource and re-run /rshuddiag.
- Test ox_inventory/qb-inventory money accounts against your server's actual
  inventory/account configuration; custom cash-as-item configurations vary.
- Check script/resource monitor in-game. No FPS or resmon claim is supplied.
- Confirm you own or have redistribution permission for every vehicle PNG,
  logo, icon and .ogg sound in this archive. The MIT software license cannot
  grant rights to any third-party artwork without the owner's permission.

See RELEASE_AUDIT_10-13-2026.txt for the exact audit scope and results.
