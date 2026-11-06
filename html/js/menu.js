// ============================================================
// RS-HUDLIFE - NEON MENU
// Settings interface with localStorage persistence
// ============================================================

const RSMenu = (function() {
    'use strict';

    let initialized = false;
    let overlay;
    const STORAGE_KEY = 'rs-hudlife-settings-v2';
    const LAYOUT_VERSION = 3;
    let isMenuOpen = false;
    let settingsDirty = false;
    let editorContext = { inVehicle: false };
    let activeSessionId = 0;

    const defaults = {
        // Speedo: X=% from left (42=center), Y=% from BOTTOM (4=near bottom)
        speedoX: 20, speedoY: 4,
        unit: 'MPH',
        scale: 88,
        sound: true,
        volume: 50,
        boot: true,
        // Status rings: same X as speedo, Y=1% from bottom (row just below speedo)
        statusEnabled: true,
        statusX: 2, statusY: 18,
        statusShape: 'circle',
        statusIconStyle: 'vivid',
        statusScale: 88,
        statusOpacity: 100,
        statusGlow: true,
        statusPulse: true,
        statusFadeFull: false,
        statusDynamic: false,
        ringHealth: true,
        ringArmor: true,
        ringHunger: true,
        ringThirst: true,
        ringStamina: true,
        ringOxygen: false,
        ringNos: false,
        hideStandaloneStatusInCluster: true,
        // Dashboard + NOS panel
        hudEnabled: true,
        iconLayout: 'horizontal',
        nosEnabled: true,
        nosStyle: 'bottle',
        nosWarning: 20,
        // Money: X=% from RIGHT edge (1=corner), Y=% from top (1=corner)
        moneyEnabled: true,
        moneyX: 1, moneyY: 1,
        moneyScale: 100,
        moneyStyle: 'glass',
        // Weapon: X from RIGHT, Y from BOTTOM; independent from speedo
        weaponEnabled: true, weaponX: 3, weaponY: 9,
        weaponScale: 100, weaponOpacity: 95, weaponStyle: 'arc',
        weaponShowAmmoType: true, weaponShowReserve: true, weaponUseInventoryArt: true,
        pillServer: true,
        pillCash: true,
        pillBank: true,
        pillId: true,
        pillJob: true,
        pillVoice: true,
        speedoStyle: 'cluster',
        speedoMinimized: false,
        layoutVersion: LAYOUT_VERSION
    };


    function normalizeSpeedoStyle(style) {
        const map = {
            cyber: 'halo', velocity: 'halo',
            katana: 'apex', street: 'apex',
            ghost: 'classic', luxe: 'classic',
            reactor: 'neon', overdrive: 'neon',
            oni: 'vehicle', inferno: 'vehicle'
        };
        const val = String(style || '').toLowerCase();
        return map[val] || val || 'halo';
    }

    function normalizeStatusIconStyle(style) {
        const val = String(style || '').toLowerCase();
        if (val === 'emoji' || val === 'svg') return 'crystal';
        return ['crystal', 'neon', 'mono', 'vivid'].includes(val) ? val : 'crystal';
    }

    let settings = Object.assign({}, defaults);

    const SPEEDO_LABELS = {
        halo: 'HALO LOGO', vehicle: 'VEHICLE HEALTH', apex: 'APEX RACE', classic: 'CLASSIC',
        neon: 'NEON DIGITAL', minimal: 'MINIMAL', turbo: 'TURBO RPM', volt: 'VOLT EV',
        survival: 'SURVIVAL ARC', cluster: 'SURVIVAL CLUSTER'
    };
    const LAYOUT_LABELS = { horizontal: 'HORIZONTAL', stacked: 'STACKED', compact: 'COMPACT' };

    function clamp(value, min, max, fallback) {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    }

    function normalizeSettings(source) {
        const next = Object.assign({}, defaults, source || {});
        next.speedoStyle = normalizeSpeedoStyle(next.speedoStyle);
        next.statusIconStyle = normalizeStatusIconStyle(next.statusIconStyle);
        next.iconLayout = ['horizontal', 'stacked', 'compact'].includes(next.iconLayout) ? next.iconLayout : 'horizontal';
        next.scale = Math.round(clamp(next.scale, 75, 110, 88));
        next.statusScale = Math.round(clamp(next.statusScale, 70, 105, 88));
        next.moneyScale = Math.round(clamp(next.moneyScale, 75, 110, 100));
        next.speedoX = Math.round(clamp(next.speedoX, 0, 95, 20));
        next.speedoY = Math.round(clamp(next.speedoY, 0, 95, 4));
        next.statusX = Math.round(clamp(next.statusX, 0, 95, 2));
        next.statusY = Math.round(clamp(next.statusY, 0, 95, 18));
        next.moneyX = Math.round(clamp(next.moneyX, 0, 95, 1));
        next.moneyY = Math.round(clamp(next.moneyY, 0, 95, 1));
        next.weaponX = Math.round(clamp(next.weaponX, 0, 95, 3));
        next.weaponY = Math.round(clamp(next.weaponY, 0, 95, 9));
        next.weaponScale = Math.round(clamp(next.weaponScale, 65, 140, 100));
        next.weaponOpacity = Math.round(clamp(next.weaponOpacity, 20, 100, 95));
        next.weaponStyle = ['arc','minimal'].includes(next.weaponStyle) ? next.weaponStyle : 'arc';
        next.weaponEnabled = next.weaponEnabled !== false;
        next.weaponShowAmmoType = next.weaponShowAmmoType !== false;
        next.weaponShowReserve = next.weaponShowReserve !== false;
        next.weaponUseInventoryArt = next.weaponUseInventoryArt !== false;
        next.speedoMinimized = next.speedoMinimized === true;

        // One-time migration from the v1.3.6 bottom-center icon defaults.
        if ((Number(source && source.layoutVersion) || 0) < LAYOUT_VERSION) {
            if (Number(next.statusX) === 38 && Number(next.statusY) === 4) {
                next.statusX = 2;
                next.statusY = 18;
                next.statusScale = 88;
                next.iconLayout = 'horizontal';
            }
            next.layoutVersion = LAYOUT_VERSION;
        }
        return next;
    }

    // Whether this player has a layout of their own. When either is true the
    // server config.lua defaults must NOT override the player's saved choices.
    let hasSavedSettings = false;   // localStorage cache present
    let kvpLoaded = false;          // authoritative KVP restored from Lua

    // ============================================================
    //  STORAGE - KVP via Lua (persists forever) + localStorage
    //  as a session-level fallback for when Lua isn't ready yet
    // ============================================================
    function load() {
        // localStorage is the fast in-session cache
        // KVP from Lua is the authoritative persistent store
        // loadFromServer() handles the KVP path (called via 'loadSettings' NUI message)
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                settings = normalizeSettings(parsed);
                hasSavedSettings = true;
            }
        } catch (e) {}
    }

    function save() {
        // While the editor is open, changes are live-preview only. They become
        // persistent when the player closes or presses Save Changes.
        if (isMenuOpen) {
            settingsDirty = true;
            return;
        }
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {}
        _saveKVP();
        settingsDirty = false;
    }

    function _saveKVP() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveKVP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: JSON.stringify(settings) })
        }).catch(() => {});
    }

    // Called by app.js when Lua pushes 'loadSettings' on player login
    // This is the authoritative restore - overrides any localStorage cache
    function loadFromServer(json) {
        if (!json || json === '') return;
        try {
            const parsed = JSON.parse(json);
            settings = normalizeSettings(parsed);
            kvpLoaded = true;
            // Update localStorage cache too
            try { localStorage.setItem(STORAGE_KEY, json); } catch(e) {}
            applySettings();
            // Mirror restored per-player choices into this client's Lua config
            // before the regular status/money payloads begin refreshing.
            syncToLua();
            syncStatusToLua();
            syncMoneyToLua();
            syncAudioToLua();
            syncSystemToLua();
            syncNosToLua();
            syncWeaponToLua();
        } catch (e) {}
    }

    // ============================================================
    //  CONFIG DEFAULTS FROM LUA
    //  config.lua seeds the layout/style for players who have not
    //  customized anything yet. A player's own saved settings win.
    // ============================================================
    function applyConfigDefaults(cfg) {
        if (!cfg) return;
        // Fold server defaults into the baseline defaults object.
        Object.keys(cfg).forEach(k => {
            if (cfg[k] !== undefined && cfg[k] !== null) defaults[k] = cfg[k];
        });
        // Respect any existing player customization.
        if (hasSavedSettings || kvpLoaded) return;

        settings = normalizeSettings(defaults);

        // Push to the live components without persisting (no save()/KVP write),
        // so config stays the default until the player actually customizes.
        if (window.RSSpeedo) {
            window.RSSpeedo.applyConfig({
                enabled: settings.hudEnabled !== false,
                speedoStyle: settings.speedoStyle,
                speedoMinimized: settings.speedoMinimized,
                hideStandaloneStatusInCluster: settings.hideStandaloneStatusInCluster,
                nosLowThreshold: settings.nosWarning,
                nosStyle: settings.nosStyle
            });
            window.RSSpeedo.setPosition(settings.speedoX, settings.speedoY);
            window.RSSpeedo.setScale(settings.scale / 100);
        }
        if (window.RSStatus) {
            window.RSStatus.applyConfig({
                enabled: settings.hudEnabled !== false && settings.statusEnabled,
                x: settings.statusX, y: settings.statusY,
                scale: settings.statusScale / 100,
                shape: settings.statusShape,
                iconStyle: settings.statusIconStyle
            });
        }
        if (window.RSWeapon) {
            window.RSWeapon.applyConfig(weaponConfig());
        }
        if (window.RSMoney) {
            window.RSMoney.applyConfig({
                enabled: settings.hudEnabled !== false && settings.moneyEnabled,
                x: settings.moneyX, y: settings.moneyY,
                scale: settings.moneyScale / 100,
                style: settings.moneyStyle
            });
        }
        // Reflect into the menu controls if they are already built.
        if (initialized) {
            document.querySelectorAll('.menu-opt-btn').forEach(b => {
                const setting = b.dataset.setting;
                const value = b.dataset.value;
                if (setting && value !== undefined) b.classList.toggle('active', settings[setting] == value);
            });
        }
    }

    function weaponConfig() {
        return { enabled: settings.hudEnabled !== false && settings.weaponEnabled !== false,
            x: settings.weaponX, y: settings.weaponY, scale: settings.weaponScale,
            opacity: settings.weaponOpacity, style: settings.weaponStyle,
            showAmmoType: settings.weaponShowAmmoType, showReserve: settings.weaponShowReserve,
            useInventoryArt: settings.weaponUseInventoryArt };
    }

    // ============================================================
    //  APPLY SETTINGS (to UI + speedo)
    // ============================================================
    function applySettings() {
        // Update menu controls to reflect current state
        document.querySelectorAll('.menu-opt-btn').forEach(b => {
            const setting = b.dataset.setting;
            const value = b.dataset.value;
            if (setting && value !== undefined) {
                b.classList.toggle('active', settings[setting] == value);
            }
        });

        // Speedo sliders
        const scaleSlider = document.getElementById('menu-scale-slider');
        if (scaleSlider) { scaleSlider.value = settings.scale; document.getElementById('menu-scale-value').textContent = settings.scale + '%'; }
        const layoutScaleSlider = document.getElementById('menu-layout-speedo-scale');
        if (layoutScaleSlider) { layoutScaleSlider.value = settings.scale; document.getElementById('menu-layout-speedo-scale-value').textContent = settings.scale + '%'; }

        const speedoX = document.getElementById('menu-speedo-x');
        if (speedoX) { speedoX.value = settings.speedoX; document.getElementById('menu-speedo-x-value').textContent = settings.speedoX + '%'; }
        const speedoY = document.getElementById('menu-speedo-y');
        if (speedoY) { speedoY.value = settings.speedoY; document.getElementById('menu-speedo-y-value').textContent = settings.speedoY + '%'; }

        // Audio
        const volSlider = document.getElementById('menu-volume-slider');
        if (volSlider) { volSlider.value = settings.volume; document.getElementById('menu-volume-value').textContent = settings.volume + '%'; }
        const soundToggle = document.getElementById('menu-sound-toggle');
        if (soundToggle) soundToggle.checked = settings.sound;

        // System
        const bootToggle = document.getElementById('menu-boot-toggle');
        if (bootToggle) bootToggle.checked = settings.boot;

        // Speedo minimized
        const speedoMinEl = document.getElementById('menu-speedo-minimized');
        if (speedoMinEl) speedoMinEl.checked = !!settings.speedoMinimized;

        // Status
        const statusEnabled = document.getElementById('menu-status-enabled');
        if (statusEnabled) statusEnabled.checked = settings.statusEnabled;
        const statusXEl = document.getElementById('menu-status-x');
        if (statusXEl) { statusXEl.value = settings.statusX; document.getElementById('menu-status-x-value').textContent = settings.statusX + '%'; }
        const statusYEl = document.getElementById('menu-status-y');
        if (statusYEl) { statusYEl.value = settings.statusY; document.getElementById('menu-status-y-value').textContent = settings.statusY + '%'; }
        const statusScale = document.getElementById('menu-status-scale');
        if (statusScale) { statusScale.value = settings.statusScale; document.getElementById('menu-status-scale-value').textContent = settings.statusScale + '%'; }
        const statusOpacity = document.getElementById('menu-status-opacity');
        if (statusOpacity) { statusOpacity.value = settings.statusOpacity; document.getElementById('menu-status-opacity-value').textContent = settings.statusOpacity + '%'; }
        const statusGlow = document.getElementById('menu-status-glow');
        if (statusGlow) statusGlow.checked = settings.statusGlow;
        const statusPulse = document.getElementById('menu-status-pulse');
        if (statusPulse) statusPulse.checked = settings.statusPulse;
        const statusFadeFull = document.getElementById('menu-status-fade-full');
        if (statusFadeFull) statusFadeFull.checked = settings.statusFadeFull;
        const statusDynamic = document.getElementById('menu-status-dynamic');
        if (statusDynamic) statusDynamic.checked = settings.statusDynamic;
        ['health', 'armor', 'hunger', 'thirst', 'stamina', 'oxygen', 'nos'].forEach(ring => {
            const t = document.getElementById('menu-ring-' + ring);
            if (t) t.checked = settings['ring' + ring.charAt(0).toUpperCase() + ring.slice(1)];
        });

        // NOS panel controls
        const hudEn = document.getElementById('menu-hud-enabled');
        if (hudEn) hudEn.checked = settings.hudEnabled !== false;
        const nosEn = document.getElementById('menu-nos-enabled');
        if (nosEn) nosEn.checked = settings.nosEnabled !== false;
        const nosWarn = document.getElementById('menu-nos-warning');
        if (nosWarn) { nosWarn.value = settings.nosWarning; var nw=document.getElementById('menu-nos-warning-value'); if(nw) nw.textContent = settings.nosWarning + '%'; }
        paintNosPanel();
        updateLiveWorkspace();
        mapPlaceAll();

        // Money
        const moneyEnabled = document.getElementById('menu-money-enabled');
        if (moneyEnabled) moneyEnabled.checked = settings.moneyEnabled;
        const moneyXEl = document.getElementById('menu-money-x');
        if (moneyXEl) { moneyXEl.value = settings.moneyX; document.getElementById('menu-money-x-value').textContent = settings.moneyX + '%'; }
        const moneyYEl = document.getElementById('menu-money-y');
        if (moneyYEl) { moneyYEl.value = settings.moneyY; document.getElementById('menu-money-y-value').textContent = settings.moneyY + '%'; }
        const moneyScale = document.getElementById('menu-money-scale');
        if (moneyScale) { moneyScale.value = settings.moneyScale; document.getElementById('menu-money-scale-value').textContent = settings.moneyScale + '%'; }
        ['server', 'cash', 'bank', 'id', 'job', 'voice'].forEach(p => {
            const t = document.getElementById('menu-pill-' + p);
            if (t) t.checked = settings['pill' + p.charAt(0).toUpperCase() + p.slice(1)];
        });

        // Apply to speedo
        if (window.RSSpeedo) {
            window.RSSpeedo.applyConfig({
                enabled: settings.hudEnabled !== false,
                speedoStyle: settings.speedoStyle,
                speedoMinimized: settings.speedoMinimized,
                hideStandaloneStatusInCluster: settings.hideStandaloneStatusInCluster,
                nosLowThreshold: settings.nosWarning,
                nosStyle: settings.nosStyle
            });
            window.RSSpeedo.setPosition(settings.speedoX, settings.speedoY);
            window.RSSpeedo.setScale(settings.scale / 100);
        }

        // Apply to status rings
        if (window.RSStatus) {
            window.RSStatus.applyConfig({
                enabled: settings.hudEnabled !== false && settings.statusEnabled,
                x: settings.statusX, y: settings.statusY,
                shape: settings.statusShape,
                iconStyle: settings.statusIconStyle,
                layout: settings.iconLayout,
                scale: settings.statusScale / 100,
                opacity: settings.statusOpacity / 100,
                glow: settings.statusGlow,
                lowPulse: settings.statusPulse,
                fadeWhenFull: settings.statusFadeFull,
                dynamicColor: settings.statusDynamic,
                nosLowThreshold: settings.nosWarning,
                nosStyle: settings.nosStyle,
                show: { health: settings.ringHealth, armor: settings.ringArmor, hunger: settings.ringHunger, thirst: settings.ringThirst, stamina: settings.ringStamina, oxygen: settings.ringOxygen, nos: (settings.nosEnabled && settings.ringNos) }
            });
        }

        // Weapon visual follows HUDLife master toggle, and its own settings.
        const weaponChecks = { 'menu-weapon-enabled': 'weaponEnabled', 'menu-weapon-ammo-type': 'weaponShowAmmoType',
            'menu-weapon-reserve': 'weaponShowReserve', 'menu-weapon-inventory-art': 'weaponUseInventoryArt' };
        Object.entries(weaponChecks).forEach(([id, key]) => {
            const el = document.getElementById(id); if (el) el.checked = settings[key] !== false;
        });
        [['weapon-scale', 'weaponScale'], ['layout-weapon-scale', 'weaponScale'],
         ['weapon-opacity', 'weaponOpacity'], ['weapon-x', 'weaponX'], ['weapon-y', 'weaponY'],
         ['layout-weapon-x', 'weaponX'], ['layout-weapon-y', 'weaponY']].forEach(([id, key]) => {
            const el = document.getElementById('menu-' + id);
            const out = document.getElementById('menu-' + id + '-value');
            if (el) el.value = settings[key];
            if (out) out.textContent = settings[key] + '%';
        });
        if (window.RSWeapon) window.RSWeapon.applyConfig(weaponConfig());

        // Apply to money pills
        if (window.RSMoney) {
            window.RSMoney.applyConfig({
                enabled: settings.hudEnabled !== false && settings.moneyEnabled,
                x: settings.moneyX, y: settings.moneyY,
                scale: settings.moneyScale / 100,
                style: settings.moneyStyle,
                show: { server: settings.pillServer, cash: settings.pillCash, bank: settings.pillBank, id: settings.pillId, job: settings.pillJob, voice: settings.pillVoice }
            });
        }

        save();
    }
    //  SEND SETTINGS TO LUA
    // ============================================================
    function syncToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveSettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                position: settings.position,
                x: settings.speedoX,
                y: settings.speedoY,
                style: settings.speedoStyle,
                scale: settings.scale / 100,
                unit: settings.unit
            })
        }).catch(() => {});
    }

    function syncStatusToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveStatusSettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: settings.statusEnabled,
                x: settings.statusX,
                y: settings.statusY,
                shape: settings.statusShape,
                iconStyle: settings.statusIconStyle,
                layout: settings.iconLayout,
                scale: settings.statusScale / 100,
                opacity: settings.statusOpacity / 100,
                glow: settings.statusGlow,
                lowPulse: settings.statusPulse,
                fadeWhenFull: settings.statusFadeFull,
                dynamicColor: settings.statusDynamic,
                show: {
                    health: settings.ringHealth, armor: settings.ringArmor,
                    hunger: settings.ringHunger, thirst: settings.ringThirst,
                    stamina: settings.ringStamina, oxygen: settings.ringOxygen,
                    nos: (settings.nosEnabled && settings.ringNos)
                }
            })
        }).catch(() => {});
    }

    function syncMoneyToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveMoneySettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: settings.moneyEnabled,
                position: settings.moneyPosition,
                x: settings.moneyX,
                y: settings.moneyY,
                scale: settings.moneyScale / 100,
                style: settings.moneyStyle,
                show: {
                    server: settings.pillServer,
                    cash: settings.pillCash,
                    bank: settings.pillBank,
                    id: settings.pillId,
                    job: settings.pillJob,
                    voice: settings.pillVoice
                }
            })
        }).catch(() => {});
    }

    // ============================================================
    //  NOS PANEL
    //  Mirrors the NOS settings into the right-rail status card and
    //  pushes them to Lua (Config.Nitrous).
    // ============================================================
    const NOS_STYLE_LABELS = { bottle: 'Classic Bottle', neon: 'Neon', mono: 'Mono' };

    function paintNosPanel() {
        const on = settings.nosEnabled !== false;

        const disp = document.getElementById('znos-display');
        if (disp) {
            disp.textContent = on ? 'Enabled' : 'Disabled';
            disp.classList.toggle('off', !on);
        }
        const styleEl = document.getElementById('znos-style');
        if (styleEl) styleEl.textContent = NOS_STYLE_LABELS[settings.nosStyle] || 'Classic Bottle';

        const warnEl = document.getElementById('znos-warning');
        if (warnEl) warnEl.textContent = (settings.nosWarning || 0) + '%';

        const statusEl = document.getElementById('znos-status');
        if (statusEl) {
            statusEl.textContent = on ? 'DISPLAY ON' : 'DISPLAY OFF';
            statusEl.classList.toggle('active', on);
            statusEl.classList.toggle('off', !on);
        }

        // Dim the NOS tile in the live preview when the gauge is disabled.
        const previewNos = document.getElementById('zpreview-nos');
        if (previewNos) previewNos.classList.toggle('zdim', !on);
    }

    function updateLiveWorkspace() {
        const speedo = document.getElementById('zlive-speedo-style');
        const layout = document.getElementById('zlive-icon-layout');
        const unit = document.getElementById('zlive-speed-unit');
        const nos = document.getElementById('zlive-nos-display');
        if (speedo) speedo.textContent = SPEEDO_LABELS[settings.speedoStyle] || String(settings.speedoStyle || 'HALO').toUpperCase();
        if (layout) layout.textContent = LAYOUT_LABELS[settings.iconLayout] || 'HORIZONTAL';
        if (unit) unit.textContent = settings.unit === 'KMH' ? 'KM/H' : 'MPH';
        if (nos) nos.textContent = settings.nosEnabled === false ? 'DISABLED' : 'ENABLED';
    }

    // ============================================================
    //  SCREEN POSITION MAP
    //  A mini screen you can drag HUD blocks around on. Dragging moves
    //  the REAL element live, so the game screen behind the menu is the
    //  preview - no fake mockup to drift out of sync.
    //
    //  Coordinate systems differ per element and must be respected:
    //    speedo / status -> X from LEFT,  Y from BOTTOM
    //    money           -> X from RIGHT, Y from TOP
    // ============================================================
    const MAP_ELS = {
        speedo: { xKey: 'speedoX', yKey: 'speedoY', anchor: 'bl', label: 'SPEEDO' },
        status: { xKey: 'statusX', yKey: 'statusY', anchor: 'bl', label: 'ICONS' },
        money:  { xKey: 'moneyX',  yKey: 'moneyY',  anchor: 'tr', label: 'MONEY' },
        weapon: { xKey: 'weaponX', yKey: 'weaponY', anchor: 'br', label: 'WEAPON' }
    };

    function mapPlaceChip(el) {
        const d = MAP_ELS[el];
        const chip = document.getElementById('zmap-' + el);
        if (!d || !chip) return;
        const x = Number(settings[d.xKey]) || 0;
        const y = Number(settings[d.yKey]) || 0;
        if (d.anchor === 'bl') {
            chip.style.left = x + '%'; chip.style.bottom = y + '%';
            chip.style.right = 'auto'; chip.style.top = 'auto';
        } else {
            chip.style.right = x + '%'; chip.style.top = d.anchor === 'tr' ? y + '%' : 'auto';
            chip.style.bottom = d.anchor === 'br' ? y + '%' : 'auto';
            chip.style.left = 'auto';
        }
    }

    function mapPlaceAll() { Object.keys(MAP_ELS).forEach(mapPlaceChip); }

    // Move the real HUD element so the game behind the menu updates live.
    function mapApplyLive(el) {
        if (el === 'speedo' && window.RSSpeedo) {
            window.RSSpeedo.setPosition(settings.speedoX, settings.speedoY);
        } else if (el === 'status' && window.RSStatus) {
            window.RSStatus.applyConfig({ x: settings.statusX, y: settings.statusY });
        } else if (el === 'money' && window.RSMoney) {
            window.RSMoney.applyConfig({ x: settings.moneyX, y: settings.moneyY });
        } else if (el === 'weapon' && window.RSWeapon) {
            window.RSWeapon.applyConfig(weaponConfig());
        }
    }

    // Keep the numeric sliders in step with the map.
    function mapSyncSliders(el) {
        const d = MAP_ELS[el];
        if (!d) return;
        const ids = { speedo: 'menu-speedo', status: 'menu-status', money: 'menu-money', weapon: 'menu-layout-weapon' }[el];
        [['x', d.xKey], ['y', d.yKey]].forEach(([axis, key]) => {
            const s = document.getElementById(ids + '-' + axis);
            const v = document.getElementById(ids + '-' + axis + '-value');
            if (s) s.value = settings[key];
            if (v) v.textContent = settings[key] + '%';
        });
    }

    function mapReadout(el) {
        const out = document.getElementById('zmap-readout');
        if (!out) return;
        const d = MAP_ELS[el];
        if (!d) { out.textContent = 'Drag a block, or use the sliders below.'; return; }
        const ax = d.anchor === 'bl' ? 'from left / from bottom' : d.anchor === 'br' ? 'from right / from bottom' : 'from right / from top';
        out.textContent = d.label + '  ' + settings[d.xKey] + '% , ' + settings[d.yKey] + '%   (' + ax + ')';
    }

    function initPositionMap() {
        const map = document.getElementById('zmap');
        if (!map || map.dataset.bound === '1') return;
        map.dataset.bound = '1';

        let dragging = null;

        function pointerToSettings(e) {
            const d = MAP_ELS[dragging];
            if (!d) return;
            const r = map.getBoundingClientRect();
            let px = ((e.clientX - r.left) / r.width) * 100;
            let py = ((e.clientY - r.top) / r.height) * 100;
            px = Math.max(0, Math.min(95, px));
            py = Math.max(0, Math.min(95, py));

            if (d.anchor === 'bl') {
                settings[d.xKey] = Math.round(px);
                settings[d.yKey] = Math.round(100 - py);
            } else {
                settings[d.xKey] = Math.round(100 - px);
                settings[d.yKey] = d.anchor === 'br' ? Math.round(100 - py) : Math.round(py);
            }
            mapPlaceChip(dragging);
            mapSyncSliders(dragging);
            if (dragging === 'weapon') {
                ['x','y'].forEach(axis => {
                    const v = settings[axis === 'x' ? 'weaponX' : 'weaponY'];
                    const slider = document.getElementById('menu-weapon-' + axis);
                    const label = document.getElementById('menu-weapon-' + axis + '-value');
                    if (slider) slider.value = v;
                    if (label) label.textContent = v + '%';
                });
            }
            mapApplyLive(dragging);
            mapReadout(dragging);
        }

        map.addEventListener('pointerdown', (e) => {
            const chip = e.target.closest('.zmap-chip');
            if (!chip) return;
            dragging = chip.dataset.el;
            chip.classList.add('zdragging');
            try { chip.setPointerCapture(e.pointerId); } catch (err) {}
            const tag = document.getElementById('zmap-live');
            if (tag) tag.textContent = 'MOVING ' + (MAP_ELS[dragging] || {}).label;
            pointerToSettings(e);
            e.preventDefault();
        });

        map.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            pointerToSettings(e);
            e.preventDefault();
        });

        function endDrag() {
            if (!dragging) return;
            const chip = document.getElementById('zmap-' + dragging);
            if (chip) chip.classList.remove('zdragging');
            const tag = document.getElementById('zmap-live');
            if (tag) tag.textContent = 'DRAG TO PLACE';
            dragging = null;
            save();
            syncToLua();
            syncStatusToLua();
            syncMoneyToLua();
            syncWeaponToLua();
        }
        map.addEventListener('pointerup', endDrag);
        map.addEventListener('pointercancel', endDrag);
        map.addEventListener('pointerleave', endDrag);

        mapPlaceAll();
    }

    function syncWeaponToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveWeaponSettings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled: settings.weaponEnabled !== false, hideNative: true })
        }).catch(() => {});
    }

    function syncNosToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveNosSettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: settings.nosEnabled,
                style: settings.nosStyle,
                warning: settings.nosWarning,
                alwaysShow: settings.ringNos
            })
        }).catch(() => {});
    }

    function syncAudioToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveAudioSettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                enabled: settings.sound,
                volume: (settings.volume || 0) / 100
            })
        }).catch(() => {});
    }

    function syncSystemToLua() {
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/saveSystemSettings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                boot: settings.boot,
                hudEnabled: settings.hudEnabled !== false
            })
        }).catch(() => {});
    }

    const LAYOUT_PRESETS = {
        above:   { iconLayout: 'horizontal', statusX: 2,  statusY: 18, statusScale: 88 },
        left:    { iconLayout: 'stacked',    statusX: 1,  statusY: 3,  statusScale: 82 },
        right:   { iconLayout: 'stacked',    statusX: 17, statusY: 3,  statusScale: 82 },
        compact: { iconLayout: 'compact',    statusX: 2,  statusY: 18, statusScale: 85 },
        reset:   { iconLayout: 'horizontal', statusX: 2,  statusY: 18, statusScale: 88, speedoX: 20, speedoY: 4, scale: 88, moneyX: 1, moneyY: 1, moneyScale: 100, weaponX: 3, weaponY: 9, weaponScale: 100 }
    };

    function applyLayoutPreset(name) {
        const preset = LAYOUT_PRESETS[name];
        if (!preset) return;
        Object.assign(settings, preset);
        applySettings();
        mapPlaceAll();
        syncToLua();
        syncStatusToLua();
        syncMoneyToLua();
        syncWeaponToLua();
    }

    // ============================================================
    //  INIT - attach listeners
    // ============================================================
    function init() {
        if (initialized) return;
        overlay = document.getElementById('menu-overlay');
        if (!overlay) return;

        // Build particles
        const particles = document.getElementById('menu-particles');
        if (particles) {
            for (let i = 0; i < 20; i++) {
                const p = document.createElement('div');
                p.className = 'menu-particle';
                p.style.left = (Math.random() * 100) + '%';
                p.style.top = (Math.random() * 100) + '%';
                p.style.background = i % 2 === 0 ? '#00e8ff' : '#ff60c0';
                p.style.boxShadow = `0 0 6px currentColor`;
                p.style.animationDelay = (Math.random() * 8) + 's';
                p.style.animationDuration = (6 + Math.random() * 4) + 's';
                particles.appendChild(p);
            }
        }

        // Tab switching
        overlay.dataset.activeTab = 'display';
        document.querySelectorAll('.menu-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                overlay.dataset.activeTab = tab || 'display';
                document.querySelectorAll('.menu-nav-btn').forEach(b => b.classList.toggle('active', b === btn));
                document.querySelectorAll('.menu-tab').forEach(t => t.classList.toggle('active', t.dataset.tabBody === tab));
                updateLiveWorkspace();
            });
        });

        // Option buttons (position, unit, shape, iconStyle, etc.)
        document.querySelectorAll('.menu-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const setting = btn.dataset.setting;
                const value = btn.dataset.value;
                if (!setting) return;
                // Deactivate siblings with same setting
                document.querySelectorAll(`.menu-opt-btn[data-setting="${setting}"]`).forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                settings[setting] = value;
                applySettings();
                // Route sync to the right endpoint based on setting name
                if (setting.startsWith('status') || setting === 'iconLayout') {
                    syncStatusToLua();
                } else if (setting.startsWith('weapon')) {
                    syncWeaponToLua();
                } else if (setting.startsWith('money')) {
                    syncMoneyToLua();
                } else if (setting.startsWith('nos')) {
                    syncNosToLua();
                    syncStatusToLua();
                } else {
                    syncToLua();
                }
            });
        });

        // Weapon HUD toggles and live layout sliders (also mirrored in Layout tab).
        const weaponToggles = { 'menu-weapon-enabled': 'weaponEnabled',
            'menu-weapon-ammo-type': 'weaponShowAmmoType', 'menu-weapon-reserve': 'weaponShowReserve',
            'menu-weapon-inventory-art': 'weaponUseInventoryArt' };
        Object.entries(weaponToggles).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                settings[key] = el.checked; applySettings(); syncWeaponToLua();
            });
        });
        [['weapon-x','weaponX'], ['weapon-y','weaponY'],
         ['layout-weapon-x','weaponX'], ['layout-weapon-y','weaponY'],
         ['weapon-scale','weaponScale'], ['layout-weapon-scale','weaponScale'],
         ['weapon-opacity','weaponOpacity']].forEach(([id, key]) => {
            const el = document.getElementById('menu-' + id);
            if (!el) return;
            el.addEventListener('input', () => {
                settings[key] = Math.round(Number(el.value));
                if (window.RSWeapon) window.RSWeapon.applyConfig(weaponConfig());
                // Mirror duplicated controls and position map without saving on each pixel.
                [['weapon-x','weaponX'], ['weapon-y','weaponY'],
                 ['layout-weapon-x','weaponX'], ['layout-weapon-y','weaponY'],
                 ['weapon-scale','weaponScale'], ['layout-weapon-scale','weaponScale'],
                 ['weapon-opacity','weaponOpacity']].forEach(([other, otherKey]) => {
                    const slider = document.getElementById('menu-' + other);
                    const text = document.getElementById('menu-' + other + '-value');
                    if (slider && slider !== el) slider.value = settings[otherKey];
                    if (text) text.textContent = settings[otherKey] + '%';
                });
                mapPlaceChip('weapon');
            });
            el.addEventListener('change', () => save());
        });

        // Speedo X/Y sliders
        ['speedo-x','speedo-y'].forEach(id => {
            const el = document.getElementById('menu-' + id);
            if (!el) return;
            const valEl = document.getElementById('menu-' + id + '-value');
            el.addEventListener('input', () => {
                const v = parseInt(el.value);
                if (valEl) valEl.textContent = v + '%';
                const key = id === 'speedo-x' ? 'speedoX' : 'speedoY';
                settings[key] = v;
                if (window.RSSpeedo) window.RSSpeedo.setPosition(settings.speedoX, settings.speedoY);
                mapPlaceChip('speedo');
            });
            el.addEventListener('change', () => { save(); syncToLua(); });
        });

        // Speedo scale sliders (Speedometer tab + mirrored Layout control)
        ['menu-scale-slider', 'menu-layout-speedo-scale'].forEach((sliderId) => {
            const slider = document.getElementById(sliderId);
            if (!slider) return;
            slider.addEventListener('input', (e) => {
                settings.scale = Math.round(clamp(e.target.value, 75, 110, 88));
                const mainValue = document.getElementById('menu-scale-value');
                const layoutValue = document.getElementById('menu-layout-speedo-scale-value');
                const mainSlider = document.getElementById('menu-scale-slider');
                const layoutSlider = document.getElementById('menu-layout-speedo-scale');
                if (mainValue) mainValue.textContent = settings.scale + '%';
                if (layoutValue) layoutValue.textContent = settings.scale + '%';
                if (mainSlider && mainSlider !== e.target) mainSlider.value = settings.scale;
                if (layoutSlider && layoutSlider !== e.target) layoutSlider.value = settings.scale;
                if (window.RSSpeedo) window.RSSpeedo.setScale(settings.scale / 100);
            });
            slider.addEventListener('change', () => { save(); syncToLua(); });
        });

        // Status X/Y sliders
        ['status-x','status-y'].forEach(id => {
            const el = document.getElementById('menu-' + id);
            if (!el) return;
            const valEl = document.getElementById('menu-' + id + '-value');
            el.addEventListener('input', () => {
                const v = parseInt(el.value);
                if (valEl) valEl.textContent = v + '%';
                const key = id === 'status-x' ? 'statusX' : 'statusY';
                settings[key] = v;
                if (window.RSStatus) window.RSStatus.applyConfig({ x: settings.statusX, y: settings.statusY });
                mapPlaceChip('status');
            });
            el.addEventListener('change', () => { save(); syncStatusToLua(); });
        });

        // Status scale slider
        const statusScaleSlider = document.getElementById('menu-status-scale');
        if (statusScaleSlider) {
            statusScaleSlider.addEventListener('input', (e) => {
                settings.statusScale = parseInt(e.target.value);
                document.getElementById('menu-status-scale-value').textContent = settings.statusScale + '%';
                if (window.RSStatus) window.RSStatus.applyConfig({ scale: settings.statusScale / 100 });
            });
            statusScaleSlider.addEventListener('change', () => { save(); syncStatusToLua(); });
        }

        // Money X/Y sliders
        ['money-x','money-y'].forEach(id => {
            const el = document.getElementById('menu-' + id);
            if (!el) return;
            const valEl = document.getElementById('menu-' + id + '-value');
            el.addEventListener('input', () => {
                const v = parseInt(el.value);
                if (valEl) valEl.textContent = v + '%';
                const key = id === 'money-x' ? 'moneyX' : 'moneyY';
                settings[key] = v;
                if (window.RSMoney) window.RSMoney.applyConfig({ x: settings.moneyX, y: settings.moneyY });
                mapPlaceChip('money');
            });
            el.addEventListener('change', () => { save(); syncMoneyToLua(); });
        });

        // Money scale slider
        const moneyScaleSlider = document.getElementById('menu-money-scale');
        if (moneyScaleSlider) {
            moneyScaleSlider.addEventListener('input', (e) => {
                settings.moneyScale = parseInt(e.target.value);
                document.getElementById('menu-money-scale-value').textContent = settings.moneyScale + '%';
                if (window.RSMoney) window.RSMoney.applyConfig({ scale: settings.moneyScale / 100 });
            });
            moneyScaleSlider.addEventListener('change', () => { save(); syncMoneyToLua(); });
        }

        // Volume slider
        const volSlider = document.getElementById('menu-volume-slider');
        if (volSlider) {
            volSlider.addEventListener('input', (e) => {
                settings.volume = parseInt(e.target.value);
                document.getElementById('menu-volume-value').textContent = settings.volume + '%';
            });
            volSlider.addEventListener('change', () => { save(); syncAudioToLua(); });
        }

        // Toggles - audio/system
        const soundToggle = document.getElementById('menu-sound-toggle');
        if (soundToggle) {
            soundToggle.addEventListener('change', () => {
                settings.sound = soundToggle.checked;
                save();
                syncAudioToLua();
            });
        }
        const bootToggle = document.getElementById('menu-boot-toggle');
        if (bootToggle) {
            bootToggle.addEventListener('change', () => {
                settings.boot = bootToggle.checked;
                save();
                syncSystemToLua();
            });
        }

        // Speedo minimized toggle
        const speedoMinToggle = document.getElementById('menu-speedo-minimized');
        if (speedoMinToggle) {
            speedoMinToggle.addEventListener('change', () => {
                settings.speedoMinimized = speedoMinToggle.checked;
                if (window.RSSpeedo) window.RSSpeedo.setMinimized(settings.speedoMinimized);
                save();
                syncToLua();
            });
        }

        // Status enable + effects toggles
        const statusEnabledToggle = document.getElementById('menu-status-enabled');
        if (statusEnabledToggle) {
            statusEnabledToggle.addEventListener('change', () => {
                settings.statusEnabled = statusEnabledToggle.checked;
                applySettings(); syncStatusToLua();
            });
        }

        const effectToggles = [
            { id: 'menu-status-glow',      key: 'statusGlow' },
            { id: 'menu-status-pulse',     key: 'statusPulse' },
            { id: 'menu-status-fade-full', key: 'statusFadeFull' },
            { id: 'menu-status-dynamic',   key: 'statusDynamic' },
        ];
        effectToggles.forEach(({ id, key }) => {
            const t = document.getElementById(id);
            if (t) t.addEventListener('change', () => {
                settings[key] = t.checked;
                applySettings(); syncStatusToLua();
            });
        });

        // Status opacity slider
        const statusOpacitySlider = document.getElementById('menu-status-opacity');
        if (statusOpacitySlider) {
            statusOpacitySlider.addEventListener('input', (e) => {
                settings.statusOpacity = parseInt(e.target.value);
                document.getElementById('menu-status-opacity-value').textContent = settings.statusOpacity + '%';
                if (window.RSStatus) window.RSStatus.applyConfig({ opacity: settings.statusOpacity / 100 });
            });
            statusOpacitySlider.addEventListener('change', () => { save(); syncStatusToLua(); });
        }

        // Ring visibility toggles
        ['health', 'armor', 'hunger', 'thirst', 'stamina', 'oxygen', 'nos'].forEach(ring => {
            const toggle = document.getElementById('menu-ring-' + ring);
            if (toggle) {
                const key = 'ring' + ring.charAt(0).toUpperCase() + ring.slice(1);
                toggle.addEventListener('change', () => {
                    settings[key] = toggle.checked;
                    applySettings();
                    syncStatusToLua();
                    if (ring === 'nos') syncNosToLua();
                });
            }
        });

        // ---- NOS panel ----
        const hudEnabledToggle = document.getElementById('menu-hud-enabled');
        if (hudEnabledToggle) {
            hudEnabledToggle.addEventListener('change', () => {
                settings.hudEnabled = hudEnabledToggle.checked;
                // Master switch: drives every HUD module at once.
                settings.statusEnabled = hudEnabledToggle.checked;
                settings.moneyEnabled = hudEnabledToggle.checked;
                applySettings();
                syncStatusToLua();
                syncMoneyToLua();
                syncSystemToLua();
                syncWeaponToLua();
            });
        }

        const nosEnabledToggle = document.getElementById('menu-nos-enabled');
        if (nosEnabledToggle) {
            nosEnabledToggle.addEventListener('change', () => {
                settings.nosEnabled = nosEnabledToggle.checked;
                applySettings();
                syncStatusToLua();
                syncNosToLua();
            });
        }

        const nosWarnSlider = document.getElementById('menu-nos-warning');
        if (nosWarnSlider) {
            nosWarnSlider.addEventListener('input', (e) => {
                settings.nosWarning = parseInt(e.target.value);
                const v = document.getElementById('menu-nos-warning-value');
                if (v) v.textContent = settings.nosWarning + '%';
                paintNosPanel();
            });
            nosWarnSlider.addEventListener('change', () => { save(); syncNosToLua(); });
        }

        // Money enable toggle
        const moneyEnabledToggle = document.getElementById('menu-money-enabled');
        if (moneyEnabledToggle) {
            moneyEnabledToggle.addEventListener('change', () => {
                settings.moneyEnabled = moneyEnabledToggle.checked;
                applySettings();
                syncMoneyToLua();
            });
        }

        // Pill visibility toggles
        ['server', 'cash', 'bank', 'id', 'job', 'voice'].forEach(pill => {
            const toggle = document.getElementById('menu-pill-' + pill);
            if (toggle) {
                const key = 'pill' + pill.charAt(0).toUpperCase() + pill.slice(1);
                toggle.addEventListener('change', () => {
                    settings[key] = toggle.checked;
                    applySettings();
                    syncMoneyToLua();
                });
            }
        });

        // Replay boot button
        const replayBtn = document.getElementById('menu-replay-boot');
        if (replayBtn) {
            replayBtn.addEventListener('click', () => {
                if (typeof GetParentResourceName === 'undefined') return;
                fetch(`https://${GetParentResourceName()}/replayBoot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                }).catch(() => {});
                close();
            });
        }

        // Minimap placement presets
        document.querySelectorAll('[data-layout-preset]').forEach((btn) => {
            btn.addEventListener('click', () => applyLayoutPreset(btn.dataset.layoutPreset));
        });

        // Hold-to-view: temporarily fade the control deck while keeping it open.
        const peekBtn = document.getElementById('menu-hud-peek');
        if (peekBtn) {
            const startPeek = (e) => { overlay.classList.add('hud-peek'); if (e) e.preventDefault(); };
            const stopPeek = () => overlay.classList.remove('hud-peek');
            peekBtn.addEventListener('pointerdown', startPeek);
            window.addEventListener('pointerup', stopPeek);
            window.addEventListener('pointercancel', stopPeek);
            window.addEventListener('blur', stopPeek);
        }

        // Reset
        const resetBtn = document.getElementById('menu-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                settings = Object.assign({}, defaults);
                applySettings();
                syncToLua();
                syncStatusToLua();
                syncMoneyToLua();
                syncAudioToLua();
                syncSystemToLua();
                syncNosToLua();
                syncWeaponToLua();
            });
        }

        // Save & Close
        const saveBtn = document.getElementById('menu-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', close);
        }

        // Close button
        const closeBtn = document.getElementById('menu-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', close);
        }

        // ESC key
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
                close();
            }
        });

        initPositionMap();
        initialized = true;
    }

    // ============================================================
    //  OPEN / CLOSE
    // ============================================================
    function open(config) {
        if (!initialized) init();
        load();
        editorContext.inVehicle = !!(config && config.inVehicle);
        activeSessionId = config && Number.isSafeInteger(config.sessionId) ? config.sessionId : 0;
        if (config) {
            if (config.position) settings.position = config.position;
            if (config.unit) settings.unit = config.unit;
            if (config.scale && !hasSavedSettings && !kvpLoaded) settings.scale = Math.round(config.scale * 100);
        }
        isMenuOpen = true;
        settingsDirty = false;
        if (window.RSSpeedo && typeof window.RSSpeedo.setEditorMode === 'function') window.RSSpeedo.setEditorMode(true);
        applySettings();
        if (window.RSSpeedo) window.RSSpeedo.show();
        if (window.RSStatus) window.RSStatus.show();
        if (window.RSMoney) window.RSMoney.show();
        if (window.RSWeapon) window.RSWeapon.setEditorMode(true);
        const activeNav = document.querySelector('.menu-nav-btn.active');
        overlay.dataset.activeTab = activeNav ? (activeNav.dataset.tab || 'display') : 'display';
        overlay.classList.remove('hidden');
    }

    function close() {
        // hideAll, pause guards and resource cleanup can all arrive after a
        // menu was already closed. Do not persist settings or POST again.
        if (!overlay || !isMenuOpen) return;
        const closingSessionId = activeSessionId;
        activeSessionId = 0;
        overlay.classList.add('hidden');
        overlay.classList.remove('hud-peek');
        isMenuOpen = false;
        if (window.RSSpeedo && typeof window.RSSpeedo.setEditorMode === 'function') window.RSSpeedo.setEditorMode(false);
        if (!editorContext.inVehicle && window.RSSpeedo) window.RSSpeedo.hide();
        if (window.RSWeapon) window.RSWeapon.setEditorMode(false);
        save();
        syncToLua();
        syncStatusToLua();
        syncMoneyToLua();
        syncAudioToLua();
        syncSystemToLua();
        syncNosToLua();
        syncWeaponToLua();
        if (typeof GetParentResourceName === 'undefined') return;
        fetch(`https://${GetParentResourceName()}/closeMenu`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: closingSessionId })
        }).catch(() => {});
    }

    function getSettings() {
        return Object.assign({}, settings);
    }

    return {
        init: init,
        open: open,
        close: close,
        getSettings: getSettings,
        isOpen: function() { return isMenuOpen; },
        load: load,
        save: save,
        loadFromServer: loadFromServer,
        applyConfigDefaults: applyConfigDefaults
    };
})();

window.RSMenu = RSMenu;
