// ============================================================
// RS-HUDLIFE V2 - APP ROUTER
// NUI message handler + audio pool
// ============================================================

(function() {
    'use strict';

    const VERSION = '1.4.6';
    const VERSION_FULL = 'V4.6';
    const RESOURCE_NAME = 'rs-lilhudlife';
    let hudSuppressed = false;

    // ============================================================
    //  BRAND THE UI WITH VERSION
    // ============================================================
    function applyBranding() {
        // NOTE: #menu-version-title is intentionally NOT set here. The menu
        // header owns its own two-line RS HUD LIFE branding markup, and writing
        // textContent to it would flatten that into a single plain string.
        const vEls = [
            { id: 'boot-version-label', text: VERSION_FULL },
            { id: 'menu-info-version', text: VERSION },
            { id: 'menu-info-resource', text: RESOURCE_NAME }
        ];
        vEls.forEach(e => {
            const el = document.getElementById(e.id);
            if (el) el.textContent = e.text;
        });
    }

    // ============================================================
    //  AUDIO POOL - pre-loads .ogg files for instant playback
    // ============================================================
    const audioPool = {};
    const POOL_FILES = [
        'boot_start', 'hologram_appear', 'hologram_collapse', 'hud_ready',
        'menu_open', 'menu_close', 'menu_select'
    ];

    function initAudioPool() {
        const pool = document.getElementById('audio-pool');
        if (!pool) return;
        POOL_FILES.forEach(key => {
            const a = new Audio();
            a.src = `sounds/${key}.ogg`;
            a.preload = 'auto';
            a.volume = 0.5;
            audioPool[key] = a;
            // Append to DOM so mobile / strict mode can keep reference
            pool.appendChild(a);
        });
    }

    function playSound(fileOrKey, volume) {
        if (!fileOrKey) return;
        // Strip path/ext to get key
        let key = String(fileOrKey).replace(/^sounds\//, '').replace(/\.ogg$/, '');
        const a = audioPool[key];
        if (!a) return;
        try {
            a.pause();
            a.currentTime = 0;
            a.volume = (typeof volume === 'number') ? Math.max(0, Math.min(1, volume)) : 0.5;
            a.play().catch(() => {});
        } catch (e) {}
    }

    // Browser-only preview harness. It is inert in FiveM because the NUI URL
    // has no `preview` query parameter, but makes visual QA reproducible.
    function startPreview() {
        const params = new URLSearchParams(window.location.search);
        const preview = params.get('preview');
        if (!preview) return;

        document.body.classList.add('preview-mode');
        if (preview === 'boot') {
            const samples = {
                nero: { name: 'Nero', spawnName: 'nero', classKey: 'car', className: 'Supercar', stats: { topSpeed: 99, acceleration: 33 } },
                sc1: { name: 'SC1', spawnName: 'sc1', classKey: 'car', className: 'Supercar', stats: { topSpeed: 98, acceleration: 31 } },
                buzzard2: { name: 'Buzzard', spawnName: 'buzzard2', classKey: 'helicopter', className: 'Helicopter', stats: { topSpeed: 129, acceleration: 53 } }
            };
            const vehicle = samples[params.get('vehicle')] || samples.nero;
            if (window.RSBoot) {
                window.RSBoot.render(vehicle, {
                    PlatformFadeIn: 400, RingsPulse: 600, HologramRise: 800,
                    HologramHold: 120000, HologramCollapse: 700
                }, { showName: true, showClass: true, showStats: true, scrim: .72 });
            }
            return;
        }
        if (preview === 'menu') {
            if (window.RSMenu) window.RSMenu.open({ unit: 'MPH', scale: 0.88 });
            return;
        }

        const speedoStyles = ['halo', 'vehicle', 'apex', 'classic', 'neon', 'minimal', 'turbo', 'volt', 'survival', 'cluster'];
        const style = speedoStyles.includes(preview) ? preview : 'vehicle';
        if (window.RSSpeedo) {
            window.RSSpeedo.setStyle(style, true);
            window.RSSpeedo.setPosition(5, 8);
            window.RSSpeedo.setScale(1);
            window.RSSpeedo.update({
                speed: 87, maxSpeed: 200, unit: 'MPH', fuel: 72,
                engine: 61, body: 43, rpm: 68, gear: 4,
                vehicleName: 'TYRANT', spawnName: 'tyrant', classKey: 'car',
                burstTyres: 1, brokenWindows: 1, damagedDoors: 1,
                seatbelt: true, harness: false, lightsOn: true, engineRunning: true,
                tires: 72, transmission: 84, brakes: 91, cooling: 78, fuelSystem: 93, mechanicLinked: true
            });
            window.RSSpeedo.show();
        }
        if (window.RSStatus) {
            window.RSStatus.applyConfig({
                enabled: true, x: 34, y: 8, iconStyle: params.get('icons') || 'crystal',
                shape: 'circle', glow: true, scale: 1,
                show: { health: true, armor: true, hunger: true, thirst: true, stamina: true, oxygen: true }
            });
            window.RSStatus.update({ health: 84, armor: 56, hunger: 72, thirst: 38, stamina: 91, oxygen: 100, nos: 40, showOxygen: false });
            window.RSStatus.show();
        }
        if (window.RSMoney) {
            window.RSMoney.applyConfig({ enabled: true, x: 3, y: 7, style: params.get('money') || 'glass', scale: 1 });
            window.RSMoney.update({ cash: 1585943, bank: 61000, id: 41, playerName: 'William', job: 'Civilian', jobGrade: 'Freelancer' });
            const previewVoiceLevel = ['soft', 'normal', 'loud'].includes(params.get('voice')) ? params.get('voice') : 'normal';
            const previewVoiceConnected = params.get('voice') !== 'offline';
            const previewVoiceTalking = previewVoiceConnected && params.get('talking') !== '0';
            const previewVoiceModes = { soft: ['Whisper', 3], normal: ['Normal', 7], loud: ['Shouting', 15] };
            window.RSMoney.updateVoice({
                connected: previewVoiceConnected,
                talking: previewVoiceTalking,
                radio: params.get('radio') === '1',
                level: previewVoiceLevel,
                mode: previewVoiceModes[previewVoiceLevel][0],
                distance: previewVoiceModes[previewVoiceLevel][1]
            });
            window.RSMoney.show();
        }
    }

    function setHudSuppressed(suppressed) {
        hudSuppressed = suppressed === true;
        document.documentElement.classList.toggle('rs-hud-suppressed', hudSuppressed);
        if (!document.body) return;
        document.body.classList.toggle('rs-hud-suppressed', hudSuppressed);

        if (window.RSWeapon) window.RSWeapon.setSuppressed(hudSuppressed);
        if (hudSuppressed) {
            if (window.RSBoot) window.RSBoot.hide();
            if (window.RSSpeedo) window.RSSpeedo.hide();
            if (window.RSStatus) window.RSStatus.hide();
            if (window.RSMoney) window.RSMoney.hide();
            if (window.RSMenu && window.RSMenu.isOpen && window.RSMenu.isOpen()) window.RSMenu.close();
        }
    }

    // ============================================================
    //  NUI MESSAGE ROUTER
    // ============================================================
    window.addEventListener('message', function(e) {
        const msg = e.data || {};
        const action = msg.action;

        switch (action) {

            case 'playBoot':
                // Hide speedo FIRST before boot renders — prevents overlap
                if (window.RSSpeedo) window.RSSpeedo.hide();
                if (window.RSBoot) {
                    window.RSBoot.render(msg.vehicle, msg.timing, {
                        showName: msg.showName,
                        showClass: msg.showClass,
                        showStats: msg.showStats,
                        particles: msg.particles,
                        scrim: msg.scrim
                    });
                }
                break;

            case 'showSpeedo':
                if (window.RSSpeedo) window.RSSpeedo.show();
                break;

            case 'hideSpeedo':
                if (window.RSBoot) window.RSBoot.hide();
                if (window.RSSpeedo) window.RSSpeedo.hide();
                break;

            case 'cancelBoot':
                if (window.RSBoot) window.RSBoot.hide();
                break;

            case 'updateSpeedo':
                if (window.RSSpeedo) window.RSSpeedo.update(msg.data || {});
                break;

            case 'updateStatus':
                if (window.RSStatus) window.RSStatus.handlePayload(msg);
                if (window.RSSpeedo) {
                    if (msg.config) {
                        window.RSSpeedo.applyConfig({
                            nosLowThreshold: msg.config.nosLowThreshold,
                            nosStyle: msg.config.nosStyle
                        });
                    }
                    window.RSSpeedo.updateStatus(msg.data || {});
                }
                break;

            case 'updateWeapon':
                if (window.RSWeapon) window.RSWeapon.update(msg.data || {});
                break;

            case 'hideWeapon':
                if (window.RSWeapon) window.RSWeapon.hide();
                break;

            case 'updateMoney':
                if (window.RSMoney) window.RSMoney.handlePayload(msg);
                break;

            case 'updateVoice':
                if (window.RSMoney) window.RSMoney.updateVoice(msg.data || {});
                break;

            case 'configDefaults':
                // Lua pushes config.lua defaults on login so new players inherit
                // the server owner's layout/style. Applied only when the player
                // has no saved settings of their own.
                if (window.RSMenu && msg.data) {
                    window.RSMenu.applyConfigDefaults(msg.data);
                }
                break;

            case 'loadSettings':
                // Lua pushes saved KVP settings on player login
                // Restore the player's saved layout immediately
                if (window.RSMenu && msg.json) {
                    window.RSMenu.loadFromServer(msg.json);
                }
                break;

            case 'openMenu':
                if (window.RSMenu) window.RSMenu.open(msg.config || {});
                break;

            case 'closeMenu':
                if (window.RSMenu && window.RSMenu.isOpen && window.RSMenu.isOpen()) window.RSMenu.close();
                break;

            case 'playSound':
                playSound(msg.sound, msg.volume);
                break;

            case 'setHudSuppressed':
                setHudSuppressed(msg.suppressed === true);
                break;

            case 'hideAll':
                if (window.RSWeapon) window.RSWeapon.hide();
                if (window.RSBoot) window.RSBoot.hide();
                if (window.RSSpeedo) window.RSSpeedo.hide();
                if (window.RSStatus) window.RSStatus.hide();
                if (window.RSMoney) window.RSMoney.hide();
                if (window.RSMenu && window.RSMenu.isOpen && window.RSMenu.isOpen()) window.RSMenu.close();
                break;

            default:
                break;
        }
    });

    // ============================================================
    //  BOOT
    // ============================================================
    document.addEventListener('DOMContentLoaded', function() {
        applyBranding();
        initAudioPool();
        if (window.RSSpeedo) window.RSSpeedo.build();
        if (window.RSStatus) window.RSStatus.build();
        if (window.RSMoney) window.RSMoney.build();
        if (window.RSMenu) {
            window.RSMenu.load();
            window.RSMenu.init();
            // Apply saved settings immediately
            const s = window.RSMenu.getSettings();
            if (window.RSSpeedo) {
                window.RSSpeedo.setPosition(s.speedoX, s.speedoY);
                window.RSSpeedo.setScale(s.scale / 100);
            }
        }
        startPreview();
    });

    // Fallback if DOMContentLoaded already fired
    if (document.readyState !== 'loading') {
        applyBranding();
        initAudioPool();
        if (window.RSSpeedo) window.RSSpeedo.build();
        if (window.RSStatus) window.RSStatus.build();
        if (window.RSMoney) window.RSMoney.build();
        if (window.RSMenu) {
            window.RSMenu.load();
            window.RSMenu.init();
        }
        startPreview();
    }
})();
