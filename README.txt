RS HUDLife / LilHudLife
======================
Reality Sucks RP
Release 1.4.18

A customizable FiveM HUD with 25 selectable speedometer styles, live vehicle telemetry,
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

No external compatibility resource is required. The HUD uses its own
Qbox/QBCore/ESX detection and read-only display adapters.

QBOX NOTES
----------
HUDLife supports both common Qbox configurations:
- QB compatibility bridge enabled: uses the compatible qb-core facade/events.
- QB compatibility bridge disabled: obtains the local player's limited HUD
  display snapshot through the included server adapter using the supported
  qbx_core:GetPlayer(source) export, with Qbox money/job events for updates.

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
- 25 selectable speedometer styles, including HALO LOGO and VEHICLE HEALTH,
  plus needle, digital, drift, racing, neon and experimental instrument layouts.
  The HALO and VEHICLE HEALTH styles are retained as established designs.
  Styles are selected from the F9 Speedometer menu.
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

The included vehicle library contains 921 PNG images keyed to vehicle
spawn names. You may also add your own PNG/WEBP artwork. Only redistribute
art for which you hold the appropriate rights or permissions.

F9 MENU
-------
Default keybind:

    F9

Command:

    /rshudlife

Players can configure speedometer style, positions, scale, units, status
layout/style, money HUD, audio, NOS display, and boot behavior. The F9 menu
also includes orbital quick navigation, collapsible setting cards, an optional
floating/dockable live workspace, and menu-only hover/particle effects.
Visible build-version labels have been replaced by status/profile information. Values are
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
This package includes 921 PNG vehicle images in `html/assets/vehicles/`.
Images are selected by vehicle spawn name, with built-in class silhouettes as
a fallback. Additional custom PNG/WEBP artwork can be placed in the folder
using the vehicle spawn code as filename. Redistribution rights for included
artwork must be verified independently of the software license.

LICENSE
-------
This full-source release includes an MIT LICENSE file. See LICENSE.
The license does not grant third-party rights to separately sourced artwork.

VISUAL INSPIRATION AND THIRD-PARTY ATTRIBUTION
---------------------------------------------
The interface uses original local FiveM NUI HTML/CSS/JavaScript techniques
inspired by public reference projects. These projects are NOT bundled as
runtime dependencies or copied into this release:
- CircularProgress (Sindre Sorhus): https://github.com/sindresorhus/CircularProgress
- GradientProgressBar (fxm90): https://github.com/fxm90/GradientProgressBar
- CircularProgressIndicator (Anton Kozyriatskyi):
   https://github.com/antonKozyriatskyi/CircularProgressIndicator
- react-native-loader-kit (maitrungduc1410):
   https://github.com/maitrungduc1410/react-native-loader-kit
- SpeedView (anastr): https://github.com/anastr/SpeedView
- SpeedSync (ahansardar): https://github.com/ahansardar/SpeedSync
- Orbital UI (kuyio): https://github.com/kuyio/orbital_ui
- 3D Animated Menu (Abdallah Sekrafi):
   https://github.com/abdallahsekrafi/3D-animated-menu
- Android RoundProgressBar (Qusion):
   https://github.com/Qusion/android-roundprogressbar
- Loop window manager (MrKai77): https://github.com/mrkai77/Loop
- Android Material Progress Indicators:
   https://github.com/material-components/material-components-android

These are inspiration credits, not claims of endorsement or a grant to
redistribute those projects' source or artwork. Loop is GPL-3.0 and is used
only as a conceptual design reference. The MIT license included here covers
this resource's owned source code, not independently sourced images.

RELEASE NOTES
-------------
- Full source, no FiveM Asset Escrow declaration, no SQL import required.
- 921 bundled PNG vehicle-art files, with class-image fallback.
- No added NUI frameworks or hard dependencies for menu appearance.
- Menu includes a safer 2D hover treatment; no document-wide translateZ.
- Static checks do not substitute for a real FiveM Legacy/Enhanced test.
- Verify redistribution rights for any third-party vehicle artwork before
  public distribution, including a free Tebex release.

Credits: Reality Sucks RP

SOURCE DISTRIBUTION
--------------------------------------------------------
This archive is full-source, unencrypted and not Asset Escrow protected.

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

SERVER COMPATIBILITY CHECKLIST
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

This v1.4.8 update changes only weapon HUD visibility for holstered or
zero-hash weapons and all vehicle entry/occupancy states. The remaining HUD
features are preserved. Live server testing
and asset-rights verification remain the publisher's responsibility.

WEAPON HUD - v1.4.8
--------------------
Open /rshudlife or press F9 (default) > WEAPON HUD to choose arc/minimal,
size, opacity, visibility, reserve count, ammo label, and optional ox_inventory
weapon artwork. Go to LAYOUT and drag the WEAPON marker on the screen map,
or move it with Weapon X/Y sliders. Close or Save Changes to persist to
this player's existing KVP settings.

ALL EQUIPPED WEAPONS: Firearms, launchers, throwables, melee weapons (including
machete, bat, knife, axe, etc.), and utility items now display. Fists/unarmed
are hidden. Unknown/add-on weapons can use their GTA weapon group and label;
when an image is missing a built-in, category-specific silhouette is used.
Melee and utility items show their names without inventing magazine ammo.

AMMO: Big number = rounds currently loaded; small RESERVE number = rounds
available to reload. For ox_inventory the reserve is read from the actual
inventory ammo item, NOT the weapon's GTA ammo total. This uses the equipped
item's .ammo name when available, then Config.WeaponHud.InventoryAmmoItems
for custom overrides, then a list of standard ox_inventory weapon/ammo items.
The HUD reads ammo only; it never refills or removes ammo. When ox_inventory
is absent or the ammo item cannot be resolved, the native GTA total-minus-
loaded value is used, which is appropriate for GTA-native ammo systems. In
custom inventories, verify your reload script's actual item semantics.

WARNING STATES: cyan normal; amber for low magazine, reload needed, and last
magazine; bright blue while reloading or just reloaded; pulsing red when
empty with no remaining reloadable rounds. Weapon switching, shooting and
reloading trigger CSS 3D/light and small contained particle effects. Effects
never obscure the world, request NUI focus, or alter the player's controls.
Set Config.WeaponHud.Effects = false to disable particles and animation;
reduced-motion system preferences also suppress them.

CONFIGURATION: Customize ammo text per weapon with
Config.WeaponHud.AmmoLabelOverrides; GTA does not define universal real-world
calibers. Set LowAmmoRatio = 0.25 to tune the amber warning. Set
InventoryAmmoItems['WEAPON_CUSTOM'] = 'ammo-youritem' if a custom firearm
uses a different ox_inventory ammo item. No hard dependency on ox_inventory
or a framework has been added. Existing weapon menu/settings remain intact.

TESTING: Equip an ox_inventory pistol with known ammo in the magazine and
several ammo items in inventory, shoot, reload, and exhaust all reserves.
Check melee/machete, throwables, an unarmed player and a weapon switch. Run
/rshudweapondebug in F8 to see the current clip, resolved reserve, ammo
item name, ammo source, and gating. Restart only this resource after install
(`ensure rs-lilhudlife` from your server console if it was not running;
`restart rs-lilhudlife` if it was). Live inventory behavior must be tested
on your server to confirm compatibility with custom item names.

WEAPON HUD AUTO-HIDE - v1.4.8
-----------------------------
The weapon panel displays on foot when a weapon is selected (including melee).
It hides with WEAPON_UNARMED or an invalid/empty selected-weapon hash, and
automatically while entering or sitting in any vehicle. This keeps the
vehicle boot/photo display clear. It returns when the player is on foot
with a weapon selected again. All other HUD elements remain unchanged.

Set Config.WeaponHud.HideInVehicles = false to allow the weapon display while
in a vehicle. This option defaults to true.


V1.4.13 - KINETIC SPEEDOMETER PATCH (11-18-2026)
------------------------------------------------
This drop-in patch redraws eight existing selectable speedometers using original
CSS/DOM kinetic ornaments and live normalized speed, RPM and fuel telemetry.
The existing data API, saved style identifiers, MPH/KMH handling, speed warning
thresholds, seatbelt/harness indicators, NOS controls, vehicle damage calculation,
status/weapon UI, and all menu callbacks remain unchanged. No dependencies added.

Protected baseline styles: HALO LOGO and VEHICLE HEALTH. They receive no new
visual elements or CSS styling. Their speedometer behavior and layouts are intact.
Other eight (the saved setting ids remain unchanged):
- apex      APEX VECTOR: diagonal telemetry racing strip
- classic   CHRONO TAPE: art-deco punched mechanical instrument
- neon      NEON PRISM: asymmetric split-spectrum speed display
- minimal   MOTION TICKET: compact, perforated digital receipt
- turbo     TURBO ROTOR: centrifuge and RPM-pulse instrument
- volt      VOLT CELL: electric-wave energy monitor
- survival  SURVIVAL SCANNER: faceted danger array
- cluster   SURVIVAL FLIGHT DECK: vector cockpit + existing player status dock

Credits / design inspiration (no third-party source copied or included):
- Sindre Sorhus, CircularProgress (MIT; macOS/Swift):
  https://github.com/sindresorhus/CircularProgress
- fxm90, GradientProgressBar (MIT; iOS/Swift):
  https://github.com/fxm90/GradientProgressBar
- antonKozyriatskyi, CircularProgressIndicator (Apache-2.0; Android/Java):
  https://github.com/antonKozyriatskyi/CircularProgressIndicator
- maitrungduc1410, react-native-loader-kit (MIT; React Native):
  https://github.com/maitrungduc1410/react-native-loader-kit
- ahansardar, SpeedSync (repository license not declared; reference only):
  https://github.com/ahansardar/SpeedSync
- anastr, SpeedView (Apache-2.0; Android/Kotlin):
  https://github.com/anastr/SpeedView
- Dribbble speedometer-3d gallery (design browsing/reference only):
  https://dribbble.com/search/speedometer-3d
- Vecteezy digital-speed-meter gallery (reference only; no artwork used):
  https://www.vecteezy.com/free-vector/digital-speed-meter

The CSS graphics, animations and DOM above are independently written for NUI.
No native Swift/Kotlin/React libraries, third-party binaries, screenshot graphics,
vector assets or copied code are shipped. Gallery artwork is not relicensed.

INSTALL (patch-only ZIP)
------------------------
Copy the files in this ZIP over the matching paths inside rs-lilhudlife/.
Keep your existing config.lua, client/server/bridge scripts, assets, and images.
Restart rs-lilhudlife. Existing saved style IDs and player preferences persist.

Validation: JavaScript parse, HTML CSS references, manifest registration, ZIP CRC
and static protected-style DOM checks. Live FiveM/CEF rendering requires in-game
verification. The new motion layer stays inside each instrument, not fullscreen.


V1.4.14 - ORBITAL MENU WORKSPACE (11-18-2026)
------------------------------------------------
HUDLife v1.4.13 eight kinetic instrument designs remain intact. No changes to
HALO LOGO or VEHICLE HEALTH speedometer markup, styles, or telemetry handlers.
This update adds only a separate menu-scoped CSS/JavaScript presentation layer.

- ORBIT quick navigation: new topbar ORBIT button or Ctrl+K while the F9 menu
  is open. The ten original sidebar tabs are duplicated as a radial selector;
  selecting one simply clicks its original tab, preserving all menu callbacks.
  Use arrow keys, Enter, or the mouse. Escape dismisses ORBIT first.
- Float/dock LIVE HUD WORKSPACE: the right-hand live readout can detach into a
  draggable preview window contained *inside* the HUDLife menu frame. Drag its
  title bar or use Alt+arrow keys while its header is focused. Dock it with
  the same button. Minimize and restore the panel with the -/+ control.
  The original position editor, HUD map, and NOS controls remain unchanged.
- Original orbital/radar micro-animation in the live workspace, integrated
  with the existing theme primary/secondary palette. No fake in-game values.
- Expand/collapse settings cards using the header mini-buttons. No setting
  changes are made by collapsing cards; the controls remain intact.
- Segmented, animated progress styling for menu-only slider tracks, with
  original input/change listeners, native keyboard semantics, and values.
- Increased menu label clarity and visual focus states without altering
  gameplay-HUD visuals, drag-to-position map, or NUI focus contracts.
- Entirely authored in local CSS/JS. No new libraries, fonts, APIs, external
  graphics, or runtime resource dependencies were added. Motion can be reduced
  using the existing Menu Effects/3D Depth controls or OS reduced-motion mode.

Menu UI inspiration and attribution (NO external code or assets bundled):
- kuyio, orbital_ui (MIT; Rails design-system structure / accessible controls):
  https://github.com/kuyio/orbital_ui
- Abdallah Sekrafi, 3D-animated-menu (project README states MIT; motion ideas):
  https://github.com/abdallahsekrafi/3D-animated-menu
- mrkai77, Loop (GPL-3.0; radial navigation and preview concepts ONLY):
  https://github.com/mrkai77/Loop
- antonKozyriatskyi, CircularProgressIndicator (Apache-2.0; ring ideas):
  https://github.com/antonKozyriatskyi/CircularProgressIndicator
- Qusion, android-roundprogressbar (MIT; segmented/round progress ideas):
  https://github.com/Qusion/android-roundprogressbar
- maitrungduc1410, react-native-loader-kit (MIT; loaders/motion ideas):
  https://github.com/maitrungduc1410/react-native-loader-kit
- Google Material Components, ProgressIndicator documentation (reference only):
  https://github.com/material-components/material-components-android/blob/master/docs/components/ProgressIndicator.md

COPYRIGHT NOTE: All new HUDLife menu code is original HTML, CSS, and JS. In
particular, no GPL-licensed Loop implementation or assets were incorporated.

INSTALL: This is a *cumulative patch* on the original rs-lilhudlife ZIP. It
includes the files from v1.4.13 and adds v1.4.14. Copy files into the matching
rs-lilhudlife/ resource directory, keep your config/client/server/assets, and
restart rs-lilhudlife. Existing player KVP preferences remain unchanged.

VERIFY IN GAME: Open F9, test ORBIT and Escape, tab choices, right-hand live
workspace float/drag/dock/minimize, Ctrl+K, layout map positioning, save/close,
NUI keyboard/controller focus, and HUD transparency; test both protected
speedometers. Browser/static checks do not constitute a live FiveM test.
