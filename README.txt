RS HUDLife / rs-lilhudlife
==========================
Reality Sucks RP | Version 1.4.6 | Full editable source

OVERVIEW
--------
RS HUDLife is a configurable FiveM HUD for driving, character status, vehicle
condition, money/job information, voice and weapon ammunition. Players can
customize the visual layout in-game and save their preferences.

MAIN FEATURES
-------------
- 10 speedometer layouts: Halo Logo, Vehicle Health, Apex Race, Classic,
  Neon Digital, Minimal, Turbo RPM, Volt EV, Survival Arc, Survival Cluster.
- Live vehicle speed, RPM, gear, fuel, lights and seatbelt/harness status.
- Vehicle condition indicators for engine, body, tires, doors and windows;
  optional additional mechanical condition integration.
- Vehicle-specific image library (921 PNG vehicle images included) with
  class-based silhouette fallback for missing vehicle models.
- Status display: health, armor, hunger, thirst, stamina, oxygen, and
  optional nitrous/NOS indicator.
- Money, bank, job/rank, player ID and voice-related HUD information, with
  framework-dependent data sources.
- Weapon HUD: weapon silhouette or optional ox_inventory image, bullets in
  magazine, spare ammunition, ammo class label and curved ammo meter.
- Weapon HUD styles: Arc and Minimal. Move, scale, fade and toggle the HUD
  through the built-in menu. Ammo labels can be customized per weapon.
- In-game F9 settings menu with draggable layout editor, per-player settings,
  audio options and vehicle reveal/boot animation.
- Built-in bridge/adapters for supported frameworks; no external compatibility
  resource is required.

FRAMEWORK SUPPORT
-----------------
Designed for QBCore, Qbox/qbx_core and ESX Legacy; it also has a native-only
standalone mode. Some display information (e.g. bank, hunger and thirst) must
come from the active framework or its status system. Behavior may vary with
custom forks and installed inventory/voice providers.

INSTALLATION
------------
1. Extract the ZIP and put the included `rs-lilhudlife` folder directly into
   your FiveM server resources directory. Do not rename it.
2. Add the following to your server.cfg after the framework (if any):

       ensure rs-lilhudlife

3. Leave Config.Framework = 'auto' to detect the framework automatically.
4. Restart the server/resource. Open the HUD editor with F9 or /rshudlife.
5. Equip a weapon, fire and reload to check magazine/spare values. Enter a
   vehicle to verify the speedometer and optional vehicle images.

CONFIGURATION
-------------
- Main defaults: config.lua
- Framework: Config.Framework = 'auto' | 'qbox' | 'qbcore' | 'esx' | 'standalone'
- Weapon HUD: Config.WeaponHud (enabled, position, scale, opacity, styles,
  ammo labels, native ammo hiding and optional ox_inventory artwork)
- Menu: F9 by default; /rshudlife command
- Layout: open F9 > LAYOUT and drag the WEAPON marker or adjust X/Y settings
- Weapon panel: open F9 > WEAPON HUD and set Arc/Minimal, size and visibility
- Per-player layout choices persist in the player's settings.

WEAPON AMMUNITION DISPLAY
-------------------------
Magazine count uses FiveM/GTA weapon natives. Reserve ammunition is native
weapon total minus current magazine count. Ammo type labels are native
categories (e.g. RIFLE AMMO), not automatic real-world caliber detection.
Use Config.WeaponHud.AmmoLabelOverrides with weapon names such as
WEAPON_CARBINERIFLE if you want a custom label (for example 5.56MM).
The HUD hides when unarmed, and respects the main HUD visibility settings.
If ox_inventory is running, it can attempt to display the corresponding
weapon image; original built-in silhouettes serve as a fallback.

OPTIONAL INTEGRATIONS
---------------------
- ox_inventory or qb-inventory for relevant money/inventory display sources
- pma-voice for talk/range indicators
- qbx_mechanicjob for additional mechanical values, when supported
- qbx_seatbelt or other compatible seatbelt/harness status sources
- ESX status/needs integrations
- Configured NOS providers or statebag/event integration

CUSTOM STATUS PROVIDERS
-----------------------
See HEALTH_SYSTEM_BRIDGE.txt for supported display-only events, exports and
statebag integration. HUDLife does not authorize or modify player account,
medical, inventory or job data; it renders data from the owning system.

VEHICLE ART LIBRARY
-------------------
This package INCLUDES 921 vehicle images in html/assets/vehicles.
Image filenames use vehicle spawn names, and the HUD falls back to an
in-browser vehicle-class silhouette when artwork is unavailable.

The generated lookup table is at html/js/vehicle-art-index.js. If you add,
remove or rename vehicle PNG/WEBP files, regenerate this index with:

    python tools/build_vehicle_art_index.py

To distribute replacement images, make sure you have the rights to do so.

TROUBLESHOOTING
---------------
- Use /rshuddiag for HUD/provider diagnostics.
- Use /rshudveh in a vehicle to diagnose vehicle name/image lookup.
- Use /rshudnoscheck in a vehicle for NOS provider details.
- Use /rshudweapondebug with a firearm equipped to inspect weapon data.
- If weapon images are missing, use built-in silhouettes or check the optional
  ox_inventory image paths and the weapon's registered item image.
- If money/needs display is incorrect, confirm the active framework and
  inventory/status configuration instead of modifying balances in this HUD.
- If the game background becomes obstructed by another UI resource, ensure
  that resource's NUI layer is transparent when closed.

SOURCE AND RIGHTS
-----------------
This release includes editable Lua, JavaScript, CSS and HTML, plus visual
assets and audio. LICENSE covers the MIT-licensed software. Distribution
rights for separately sourced art, logos, sounds and images may differ;
verify redistribution permission before publishing the package.

No runtime activation key or external compatibility dependency is needed.

Reality Sucks RP
