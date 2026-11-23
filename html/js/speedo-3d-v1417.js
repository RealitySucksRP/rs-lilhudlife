// ============================================================================
// RS HUDLife v1.4.16 — 18 Forward-Facing Speedometers (10 Analog Needle Styles)
// + Interactive Drift Telemetry Engine
// Protects HALO LOGO ('halo') and VEHICLE HEALTH ('vehicle') 100% untouched.
// ============================================================================
(function () {
    'use strict';

    if (!window.RSSpeedo) return;
    const orig = window.RSSpeedo;

    const CUSTOM_STYLES = new Set([
        'apex', 'classic', 'neon', 'minimal', 'turbo', 'volt', 'survival', 'cluster',
        'gtneedle', 'chronograph', 'muscle', 'hyperneedle', 'driftking',
        'cyberneedle', 'rally', 'aviation', 'retro80s', 'touge',
        'driftpro', 'driftbar', 'neonpunk', 'cyberbounce', 'hyperpulse'
    ]);

    const LEGACY_MAP = {
        cyber: 'halo', velocity: 'halo',
        katana: 'apex', street: 'apex',
        ghost: 'classic', luxe: 'classic',
        reactor: 'neon', overdrive: 'neon',
        oni: 'vehicle', inferno: 'vehicle'
    };

    const STYLE_META = {
        apex:        { badge: 'APEX' },
        classic:     { badge: 'GT BAY' },
        neon:        { badge: 'PRISM' },
        minimal:     { badge: 'VISOR' },
        turbo:       { badge: 'TURBO' },
        volt:        { badge: 'ORBIT' },
        survival:    { badge: 'JDM' },
        cluster:     { badge: 'DECK' },
        gtneedle:    { badge: 'GT TWIN' },
        chronograph: { badge: 'CHRONO' },
        muscle:      { badge: 'V8 TACH' },
        hyperneedle: { badge: 'LASER' },
        driftking:   { badge: 'DRIFT' },
        cyberneedle: { badge: 'CYBER' },
        rally:       { badge: 'RALLY' },
        aviation:    { badge: 'HUD' },
        retro80s:    { badge: 'SYNTH' },
        touge:       { badge: 'TOUGE' },
        driftpro:    { badge: 'DRIFT PRO' },
        driftbar:    { badge: 'BALANCE' },
        neonpunk:    { badge: 'PUNK 3D' },
        cyberbounce: { badge: 'BOUNCE' },
        hyperpulse:  { badge: 'PULSE 3D' }
    };

    const CLUSTER_DECK = [
        { key: 'stamina', label: 'STM', color: '#ff5263' },
        { key: 'health',  label: 'HP',  color: '#ff385c' },
        { key: 'armor',   label: 'ARM', color: '#6ba8ff' },
        { key: 'hunger',  label: 'FOD', color: '#ffb536' },
        { key: 'thirst',  label: 'H2O', color: '#38dcff' },
        { key: 'nos',     label: 'NOS', color: '#ff47d1' }
    ];

    let activeStyle = 'halo';
    let container = null;
    let visible = false;
    let enabled = true;
    let minimized = false;
    let editorMode = false;
    let hideStandaloneStatusInCluster = true;
    let nosLowThreshold = 20;
    let userScale = 1.0;
    let lastMaxSpeedBuilt = 200;

    let lastData = {
        speed: 0, maxSpeed: 200, unit: 'MPH', fuel: 100,
        engine: 100, body: 100, rpm: 0, gear: 0, reverse: false,
        vehicleName: '', spawnName: '', tires: 100,
        seatbelt: false, harness: false, lightsOn: false, highBeams: false,
        engineRunning: false, warnThreshold: 0.75, critThreshold: 0.90,
        drifting: false, driftAngle: 0, driftDir: 0
    };
    let lastStatus = {
        health: 100, armor: 0, hunger: 100, thirst: 100, stamina: 100, nos: 0
    };

    // Interactive Drift State
    let driftScore = 0;
    let lastDriftTs = 0;
    let prevFrameTs = 0;
    let prevNos = 0;
    let prevGear = 0;
    let prevRpm = 0;
    let peakAngle = 0;
    let driftCombo = 1;
    let driftDuration = 0;
    let tireHeat = 22;
    let bounceImpulse = 0;
    let dom = null;

    function normalizeStyle(style) {
        const s = String(style || '').toLowerCase();
        if (s === 'halo' || s === 'vehicle' || CUSTOM_STYLES.has(s)) return s;
        return LEGACY_MAP[s] || 'halo';
    }

    function isCustom(style) {
        return CUSTOM_STYLES.has(style || activeStyle);
    }

    function getContainer() {
        if (!container) container = document.getElementById('speedo-container');
        return container;
    }

    function driftBannerHTML() {
        return (
            '<div class="rs3d-drift-banner" data-el="driftBanner">' +
                '<div class="rs3d-drift-left">' +
                    '<span class="rs3d-drift-arrows" data-el="driftArrows">&gt;&gt;&gt;</span>' +
                    '<span data-el="driftLabel">DRIFTING</span>' +
                '</div>' +
                '<div class="rs3d-drift-metrics">' +
                    '<span class="rs3d-drift-angle" data-el="driftAngle">0°</span>' +
                    '<span class="rs3d-drift-score" data-el="driftScore">+0</span>' +
                '</div>' +
            '</div>'
        );
    }

    function iconsHTML() {
        return (
            '<div class="rs3d-icons">' +
                '<span class="rs3d-ico" data-ico="seatbelt" title="Seatbelt">' +
                    '<svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="2.2"/><path d="M7 11l10 8M9 20h6M8 11c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5v3.5"/></svg>' +
                '</span>' +
                '<span class="rs3d-ico" data-ico="harness" title="Racing Harness">' +
                    '<svg viewBox="0 0 24 24"><path d="M7 4l4 8-4 8M17 4l-4 8 4 8M9 12h6"/></svg>' +
                '</span>' +
                '<span class="rs3d-ico" data-ico="lights" title="Headlights">' +
                    '<svg viewBox="0 0 24 24"><path d="M10 7a5 5 0 0 0 0 10h2V7h-2zM15 8h4M15 12h5M15 16h4"/></svg>' +
                '</span>' +
                '<span class="rs3d-ico" data-ico="highbeam" title="High Beams">' +
                    '<svg viewBox="0 0 24 24"><path d="M9 7a5 5 0 0 0 0 10h2V7H9zM14 7l5-1M14 10.5l6-.5M14 13.5l6 .5M14 17l5 1"/></svg>' +
                '</span>' +
                '<span class="rs3d-ico" data-ico="engine" title="Engine Health">' +
                    '<svg viewBox="0 0 24 24"><path d="M6 10h2l2-2h5l2 2h2v6h-2l-2 2H9l-2-2H6zM10 6h4"/></svg>' +
                '</span>' +
                '<span class="rs3d-ico" data-ico="tires" title="Tire Condition">' +
                    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/></svg>' +
                '</span>' +
            '</div>'
        );
    }

    function barsHTML() {
        return (
            '<div class="rs3d-bars">' +
                '<div class="rs3d-bar-item" data-bar="fuel">' +
                    '<div class="rs3d-bar-head"><span>FUEL</span><b data-val="fuel">100%</b></div>' +
                    '<div class="rs3d-bar-track"><div class="rs3d-bar-fill" data-fill="fuel"></div></div>' +
                '</div>' +
                '<div class="rs3d-bar-item" data-bar="engine">' +
                    '<div class="rs3d-bar-head"><span>ENG</span><b data-val="engine">100%</b></div>' +
                    '<div class="rs3d-bar-track"><div class="rs3d-bar-fill" data-fill="engine"></div></div>' +
                '</div>' +
                '<div class="rs3d-bar-item" data-bar="nos">' +
                    '<div class="rs3d-bar-head"><span>NOS</span><b data-val="nos">0%</b></div>' +
                    '<div class="rs3d-bar-track"><div class="rs3d-bar-fill" data-fill="nos"></div></div>' +
                '</div>' +
            '</div>'
        );
    }

    function topMetaHTML(style) {
        const meta = STYLE_META[style] || { badge: 'HUD' };
        return (
            '<div class="rs3d-top-meta">' +
                '<span class="rs3d-veh-name" data-el="vehName">VEHICLE</span>' +
                '<span class="rs3d-badge" data-el="badge">' + meta.badge + '</span>' +
            '</div>'
        );
    }

    function slipMeterHTML() {
        return (
            '<div class="rs3d-slip-meter">' +
                '<div class="rs3d-slip-head"><span>SLIP ANGLE</span><b class="rs3d-mono" data-el="slipVal">0°</b></div>' +
                '<div class="rs3d-slip-track">' +
                    '<div class="rs3d-slip-fill" data-el="slipFill"></div>' +
                    '<div class="rs3d-slip-center"></div>' +
                '</div>' +
            '</div>'
        );
    }


    function driftBalanceHTML() {
        return (
            '<div class="rs3d-balance-wrap">' +
                '<div class="rs3d-balance-head"><span>BALANCE</span><b data-el="balState">NEUTRAL</b><span>HEAT <i class="rs3d-mono" data-el="tireHeat">22%</i></span></div>' +
                '<div class="rs3d-balance-track">' +
                    '<div class="rs3d-balance-sweet"></div>' +
                    '<div class="rs3d-balance-puck" data-el="balPuck"></div>' +
                '</div>' +
            '</div>' +
            '<div class="rs3d-drift-grid">' +
                '<div class="rs3d-dstat"><small>COMBO</small><strong data-el="driftCombo">x1</strong></div>' +
                '<div class="rs3d-dstat"><small>PEAK</small><strong data-el="peakAngle">0°</strong></div>' +
                '<div class="rs3d-dstat"><small>ANGLE</small><strong data-el="slipVal">0°</strong></div>' +
            '</div>'
        );
    }

    function polar(cx, cy, r, deg) {
        const rad = (deg - 90) * Math.PI / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    function arcPath(cx, cy, r, startDeg, endDeg) {
        const s = polar(cx, cy, r, startDeg);
        const e = polar(cx, cy, r, endDeg);
        const large = (endDeg - startDeg) > 180 ? 1 : 0;
        return 'M ' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + e.x.toFixed(1) + ' ' + e.y.toFixed(1);
    }

    // Precision SVG Analog Dial + Needle generator (viewBox 0 0 200 200, pivot 100,100)
    function buildDialSVG(opts) {
        const startDeg = -135;
        const endDeg = 135;
        const totalDeg = endDeg - startDeg; // 270 deg sweep
        const majorCount = opts.majorCount || 8;
        const subDiv = opts.subDiv || 4;
        const totalTicks = majorCount * subDiv;
        const redStart = opts.redStart !== undefined ? opts.redStart : 0.80;
        const needleColor = opts.needleColor || '#ff3556';
        const arcColor = opts.arcColor || '#38e8ff';
        const labelFn = opts.labelFn || function (i) { return String(i); };
        const needleRole = opts.needleRole || 'primaryNeedle';
        const trailRole = opts.trailRole || 'primaryTrail';
        const caption = opts.caption || '';

        let ticks = '';
        let nums = '';
        for (let i = 0; i <= totalTicks; i++) {
            const frac = i / totalTicks;
            const deg = startDeg + frac * totalDeg;
            const isMajor = (i % subDiv === 0);
            const isRed = frac >= redStart;
            const rOuter = 86;
            const rInner = isMajor ? 72 : 79;
            const p1 = polar(100, 100, rOuter, deg);
            const p2 = polar(100, 100, rInner, deg);
            const cls = 'rs3d-dial-tick' + (isMajor ? ' major' : '') + (isRed ? ' redzone' : '');
            ticks += '<line class="' + cls + '" x1="' + p1.x.toFixed(1) + '" y1="' + p1.y.toFixed(1) + '" x2="' + p2.x.toFixed(1) + '" y2="' + p2.y.toFixed(1) + '"/>';

            if (isMajor) {
                const idx = i / subDiv;
                const pt = polar(100, 100, 58, deg);
                nums += '<text class="rs3d-dial-num' + (isRed ? ' redzone' : '') + '" x="' + pt.x.toFixed(1) + '" y="' + pt.y.toFixed(1) + '">' + labelFn(idx) + '</text>';
            }
        }

        const trackD = arcPath(100, 100, 88, startDeg, endDeg);

        return (
            '<svg class="rs3d-dial-svg" viewBox="0 0 200 200" aria-hidden="true">' +
                '<circle cx="100" cy="100" r="94" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1.5"/>' +
                '<path d="' + trackD + '" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4.5" stroke-linecap="round"/>' +
                '<path data-el="' + trailRole + '" d="' + trackD + '" fill="none" stroke="' + arcColor + '" stroke-width="4.5" stroke-linecap="round"/>' +
                ticks +
                nums +
                (caption ? '<text x="100" y="72" text-anchor="middle" fill="rgba(210,228,248,0.55)" font-size="9" font-weight="700" letter-spacing="1.4">' + caption + '</text>' : '') +
                '<g class="rs3d-needle-group" data-el="' + needleRole + '" style="transform:rotate(-135deg)">' +
                    '<polygon points="97,108 103,108 100.8,24 99.2,24" fill="' + needleColor + '"/>' +
                    '<circle cx="100" cy="100" r="9.5" fill="#141822" stroke="' + needleColor + '" stroke-width="2.5"/>' +
                    '<circle cx="100" cy="100" r="3.5" fill="#ffffff"/>' +
                '</g>' +
            '</svg>'
        );
    }

    function buildSingleNeedleCard(style, dialOpts, extraPodTopHTML) {
        return (
            '<div class="rs3d-stage rs3d-needle-card">' +
                '<div class="rs3d-dial-wrap">' +
                    (style === 'aviation' ? '<div class="rs3d-horizon-line"></div>' : '') +
                    buildDialSVG(dialOpts) +
                    '<div class="rs3d-dial-digital">' +
                        '<span class="rs3d-speed-val rs3d-num" data-el="speed">000</span>' +
                        '<span class="rs3d-unit" data-el="unit">MPH</span>' +
                    '</div>' +
                '</div>' +
                '<div class="rs3d-pod-col">' +
                    topMetaHTML(style) +
                    (extraPodTopHTML || '') +
                    '<div class="rs3d-pod-readout">' +
                        '<div class="rs3d-pod-speed">' +
                            '<span class="rs3d-speed-val rs3d-num" data-el="speedMirror">000</span>' +
                            '<span class="rs3d-unit" data-el="unitMirror">MPH</span>' +
                        '</div>' +
                        '<div class="rs3d-gear-box" style="width:46px;height:42px">' +
                            '<small>GEAR</small><strong class="rs3d-gear-val" data-el="gear" style="font-size:21px">N</strong>' +
                        '</div>' +
                    '</div>' +
                    barsHTML() +
                    iconsHTML() +
                '</div>' +
            '</div>'
        );
    }

    function buildTemplate(style) {
        const maxSpd = Math.max(80, Number(lastData.maxSpeed || 200));

        // --- 1..8: Forward-facing digital / hybrid styles ---
        if (style === 'apex') {
            let segs = '';
            for (let i = 0; i < 20; i++) {
                const cls = i >= 16 ? ' red' : (i >= 12 ? ' mid' : '');
                segs += '<span class="rs3d-apex-seg' + cls + '" data-seg="' + i + '"></span>';
            }
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-apex-rpm">' + segs + '</div>' +
                    '<div class="rs3d-apex-main">' +
                        '<div class="rs3d-apex-speed-wrap"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span></div>' +
                        '<div class="rs3d-gear-box"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                    '</div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'classic') {
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-bay-gauge">' +
                        '<svg class="rs3d-bay-svg" viewBox="0 0 320 116" aria-hidden="true">' +
                            '<defs><linearGradient id="rs3d-bay-grad" x1="0%" y1="0%" x2="100%" y2="0%">' +
                                '<stop offset="0%" stop-color="#f5c85b"/><stop offset="70%" stop-color="#ff6e38"/><stop offset="100%" stop-color="#ff3b47"/>' +
                            '</linearGradient></defs>' +
                            '<path class="rs3d-bay-track" d="M 32 102 A 128 112 0 0 1 288 102"/>' +
                            '<path class="rs3d-bay-arc" data-el="rpmArc" d="M 32 102 A 128 112 0 0 1 288 102"/>' +
                        '</svg>' +
                        '<div class="rs3d-bay-center">' +
                            '<div class="rs3d-bay-row"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-bay-gear-pill rs3d-gear-val" data-el="gear">N</span></div>' +
                            '<div class="rs3d-bay-sub"><span data-el="unit">MPH</span><span>RPM <b class="rs3d-mono" data-el="rpmTxt">0%</b></span></div>' +
                        '</div>' +
                    '</div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'neon') {
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-prism-hero">' +
                        '<div class="rs3d-apex-speed-wrap"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span></div>' +
                        '<div class="rs3d-prism-side"><span class="rs3d-prism-gear rs3d-gear-val" data-el="gear">N</span><span class="rs3d-mono" style="font-size:10px;color:var(--rs3d-muted)" data-el="rpmTxt">0% RPM</span></div>' +
                    '</div>' +
                    '<div class="rs3d-rpm-bar"><div class="rs3d-rpm-fill" data-el="rpmFill"></div></div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'minimal') {
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-visor-mid">' +
                        '<div class="rs3d-visor-wing"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                        '<div class="rs3d-visor-center"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span><div class="rs3d-visor-horizon"><i data-el="rpmFill"></i></div></div>' +
                        '<div class="rs3d-visor-wing"><small>RPM</small><strong class="rs3d-mono" data-el="rpmShort">0</strong></div>' +
                    '</div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'turbo') {
            return (
                '<div class="rs3d-stage">' +
                    '<div class="rs3d-gyro-core">' +
                        '<div class="rs3d-gyro-ring" data-el="gyroOuter"></div>' +
                        '<div class="rs3d-gyro-ring-inner" data-el="gyroInner"></div>' +
                        '<svg class="rs3d-gyro-svg" viewBox="0 0 120 120" aria-hidden="true">' +
                            '<circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="6"/>' +
                            '<circle cx="60" cy="60" r="52" fill="none" stroke="#3bbdff" stroke-width="6" stroke-linecap="round" data-el="rpmArc"/>' +
                        '</svg>' +
                        '<div class="rs3d-gyro-readout"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" style="font-size:9px" data-el="unit">MPH</span><span class="rs3d-gyro-gear rs3d-gear-val" data-el="gear">N</span></div>' +
                    '</div>' +
                    '<div class="rs3d-gyro-pod">' + topMetaHTML(style) + barsHTML() + iconsHTML() + '</div>' +
                '</div>'
            );
        }

        if (style === 'volt') {
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-orbital-deck">' +
                        '<span class="rs3d-speed-val rs3d-num" data-el="speed">000</span>' +
                        '<div class="rs3d-orbital-meta">' +
                            '<span class="rs3d-drive-mode" data-el="driveMode">NORMAL</span>' +
                            '<span class="rs3d-unit" data-el="unit">MPH</span>' +
                            '<span class="rs3d-mono" style="font-size:12px;color:#fff">GEAR <b class="rs3d-gear-val" data-el="gear">N</b></span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="rs3d-rpm-bar"><div class="rs3d-rpm-fill" data-el="rpmFill"></div></div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'survival') {
            let leds = '';
            for (let i = 0; i < 10; i++) {
                const c = i < 5 ? 'g' : (i < 8 ? 'y' : 'r');
                leds += '<span class="rs3d-jdm-led ' + c + '" data-led="' + i + '"></span>';
            }
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-jdm-shiftbar">' + leds + '</div>' +
                    '<div class="rs3d-jdm-main">' +
                        '<div class="rs3d-apex-speed-wrap"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" style="color:var(--rs3d-secondary)" data-el="unit">MPH</span></div>' +
                        '<div class="rs3d-jdm-gearbox"><small>SHIFT</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                    '</div>' +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'cluster') {
            const cstats = CLUSTER_DECK.map(function (st) {
                return (
                    '<div class="rs3d-cstat" data-cstat="' + st.key + '">' +
                        '<div class="rs3d-cstat-head"><span>' + st.label + '</span><b data-cval="' + st.key + '">100</b></div>' +
                        '<div class="rs3d-cstat-track"><div class="rs3d-cstat-fill" data-cfill="' + st.key + '" style="background:' + st.color + '"></div></div>' +
                    '</div>'
                );
            }).join('');
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-blade-hero">' +
                        '<div>' +
                            '<div class="rs3d-blade-speed-block"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span></div>' +
                            '<div class="rs3d-rpm-bar" style="margin-top:4px"><div class="rs3d-rpm-fill" data-el="rpmFill"></div></div>' +
                        '</div>' +
                        '<div class="rs3d-gear-box"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                    '</div>' +
                    barsHTML() + iconsHTML() +
                    '<div class="rs3d-cluster-deck">' + cstats + '</div>' +
                '</div>'
            );
        }

        // --- 9..18: 10 BRAND-NEW FORWARD-FACING ANALOG NEEDLE VARIETIES ---
        if (style === 'gtneedle') {
            const rpmDial = buildDialSVG({
                majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#ff4757', arcColor: '#ff4757',
                labelFn: function (i) { return String(i); }, needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'RPM x1000'
            });
            const spdDial = buildDialSVG({
                majorCount: 8, subDiv: 4, redStart: 0.85, needleColor: '#ffba3b', arcColor: '#ffba3b',
                labelFn: function (i) { return String(Math.round((maxSpd / 8) * i)); }, needleRole: 'spdNeedle', trailRole: 'spdTrail', caption: 'SPEED'
            });
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-gt-twins">' +
                        '<div class="rs3d-gt-dial">' + rpmDial + '</div>' +
                        '<div class="rs3d-gt-center">' +
                            '<small style="font-size:8px;letter-spacing:1.2px;color:var(--rs3d-muted)">GEAR</small>' +
                            '<strong class="rs3d-gear-val" data-el="gear">N</strong>' +
                            '<span class="rs3d-speed-val rs3d-num" data-el="speed">000</span>' +
                            '<span class="rs3d-unit" style="font-size:9px" data-el="unit">MPH</span>' +
                        '</div>' +
                        '<div class="rs3d-gt-dial">' + spdDial + '</div>' +
                    '</div>' +
                    '<div class="rs3d-gt-foot">' + barsHTML() + iconsHTML() + '</div>' +
                '</div>'
            );
        }

        if (style === 'chronograph') {
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 5, redStart: 0.85, needleColor: '#e8d08e', arcColor: '#d8c38a',
                labelFn: function (i) { return String(Math.round((maxSpd / 8) * i)); },
                needleRole: 'spdNeedle', trailRole: 'spdTrail', caption: 'CHRONO'
            });
        }

        if (style === 'muscle') {
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 4, redStart: 0.75, needleColor: '#ff5e1a', arcColor: '#ff7a1f',
                labelFn: function (i) { return String(i); },
                needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'V8 x1000'
            });
        }

        if (style === 'hyperneedle') {
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 4, redStart: 0.82, needleColor: '#00f0ff', arcColor: '#00e5ff',
                labelFn: function (i) { return String(Math.round((maxSpd / 8) * i)); },
                needleRole: 'spdNeedle', trailRole: 'spdTrail', caption: 'HYPER'
            });
        }

        if (style === 'driftking') {
            return buildSingleNeedleCard(style, {
                majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#ff2ed1', arcColor: '#ff6a1a',
                labelFn: function (i) { return String(i); },
                needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'DRIFT RPM'
            }, slipMeterHTML());
        }

        if (style === 'cyberneedle') {
            return buildSingleNeedleCard(style, {
                majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#ffe600', arcColor: '#00f0ff',
                labelFn: function (i) { return String(i); },
                needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'CYBER RPM'
            });
        }

        if (style === 'rally') {
            let leds = '';
            for (let i = 0; i < 10; i++) {
                const c = i < 5 ? 'g' : (i < 8 ? 'y' : 'r');
                leds += '<span class="rs3d-jdm-led ' + c + '" data-led="' + i + '"></span>';
            }
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 4, redStart: 0.78, needleColor: '#ff2e3d', arcColor: '#ffd426',
                labelFn: function (i) { return String(i); },
                needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'RALLY x1K'
            }, '<div class="rs3d-jdm-shiftbar">' + leds + '</div>');
        }

        if (style === 'aviation') {
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 4, redStart: 0.85, needleColor: '#45ff9e', arcColor: '#45ff9e',
                labelFn: function (i) { return String(Math.round((maxSpd / 8) * i)); },
                needleRole: 'spdNeedle', trailRole: 'spdTrail', caption: 'AIRSPEED'
            });
        }

        if (style === 'retro80s') {
            return buildSingleNeedleCard(style, {
                majorCount: 8, subDiv: 4, redStart: 0.82, needleColor: '#30e8ff', arcColor: '#ff3cc7',
                labelFn: function (i) { return String(Math.round((maxSpd / 8) * i)); },
                needleRole: 'spdNeedle', trailRole: 'spdTrail', caption: 'OUTRUN'
            });
        }


        if (style === 'driftpro') {
            return buildSingleNeedleCard(style, {
                majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#ff369b', arcColor: '#ff9f2e',
                labelFn: function (i) { return String(i); },
                needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'DRIFT PRO'
            }, driftBalanceHTML());
        }

        if (style === 'driftbar') {
            return (
                '<div class="rs3d-stage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-slide-hero">' +
                        '<div class="rs3d-wing-meter"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                        '<div class="rs3d-slide-center">' +
                            '<span class="rs3d-speed-val rs3d-num" data-el="speed">000</span>' +
                            '<span class="rs3d-unit" data-el="unit">MPH</span>' +
                        '</div>' +
                        '<div class="rs3d-wing-meter"><small>COMBO</small><strong data-el="driftCombo">x1</strong></div>' +
                    '</div>' +
                    '<div class="rs3d-rpm-bar"><div class="rs3d-rpm-fill" data-el="rpmFill"></div></div>' +
                    driftBalanceHTML() +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'neonpunk') {
            let segs = '';
            for (let i = 0; i < 20; i++) {
                const cls = i >= 16 ? ' red' : (i >= 12 ? ' mid' : '');
                segs += '<span class="rs3d-apex-seg' + cls + '" data-seg="' + i + '"></span>';
            }
            return (
                '<div class="rs3d-stage rs3d-bounce-stage" data-el="bounceStage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-punk-hero">' +
                        '<div class="rs3d-apex-speed-wrap"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span></div>' +
                        '<div class="rs3d-gear-box"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                    '</div>' +
                    '<div class="rs3d-apex-rpm">' + segs + '</div>' +
                    driftBalanceHTML() +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'cyberbounce') {
            return (
                '<div class="rs3d-stage rs3d-bounce-stage" data-el="bounceStage">' +
                    topMetaHTML(style) +
                    '<div class="rs3d-cb-core">' +
                        '<div class="rs3d-cb-rail"><i data-el="railL"></i></div>' +
                        '<div class="rs3d-cb-center">' +
                            '<div class="rs3d-apex-speed-wrap"><span class="rs3d-speed-val rs3d-num" data-el="speed">000</span><span class="rs3d-unit" data-el="unit">MPH</span></div>' +
                            '<div class="rs3d-gear-box"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear">N</strong></div>' +
                        '</div>' +
                        '<div class="rs3d-cb-rail"><i data-el="railR"></i></div>' +
                    '</div>' +
                    driftBalanceHTML() +
                    barsHTML() + iconsHTML() +
                '</div>'
            );
        }

        if (style === 'hyperpulse') {
            return (
                '<div class="rs3d-stage rs3d-needle-card rs3d-bounce-stage" data-el="bounceStage">' +
                    '<div class="rs3d-dial-wrap">' +
                        buildDialSVG({
                            majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#00f0ff', arcColor: '#a855ff',
                            labelFn: function (i) { return String(i); },
                            needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'PULSE 3D'
                        }) +
                        '<div class="rs3d-dial-digital">' +
                            '<span class="rs3d-speed-val rs3d-num" data-el="speed">000</span>' +
                            '<span class="rs3d-unit" data-el="unit">MPH</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="rs3d-pod-col">' +
                        topMetaHTML(style) +
                        driftBalanceHTML() +
                        '<div class="rs3d-pod-readout">' +
                            '<div class="rs3d-pod-speed"><span class="rs3d-speed-val rs3d-num" data-el="speedMirror">000</span><span class="rs3d-unit" data-el="unitMirror">MPH</span></div>' +
                            '<div class="rs3d-gear-box" style="width:46px;height:42px"><small>GEAR</small><strong class="rs3d-gear-val" data-el="gear" style="font-size:21px">N</strong></div>' +
                        '</div>' +
                        barsHTML() + iconsHTML() +
                    '</div>' +
                '</div>'
            );
        }

        // touge
        return buildSingleNeedleCard(style, {
            majorCount: 9, subDiv: 4, redStart: 0.78, needleColor: '#ff2e3d', arcColor: '#ffffff',
            labelFn: function (i) { return String(i); },
            needleRole: 'rpmNeedle', trailRole: 'rpmTrail', caption: 'TOUGE x1K'
        }, slipMeterHTML());
    }

    function applyCustomScale() {
        const el = getContainer();
        if (!el || !dom || !dom.root) return;
        const sc = userScale * (minimized ? 0.68 : 1.0);
        dom.root.style.setProperty('--rs3d-scale', String(sc));
        el.classList.toggle('rs-speedo-minimized', minimized);
    }

    function prepArc(el) {
        if (!el || typeof el.getTotalLength !== 'function') return 0;
        const len = el.getTotalLength();
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len);
        return len;
    }

    function buildCustom(style) {
        const el = getContainer();
        if (!el) return;
        activeStyle = style;
        lastMaxSpeedBuilt = Math.max(80, Number(lastData.maxSpeed || 200));

        el.innerHTML =
            '<div class="rs3d-root" data-style="' + style + '">' +
                driftBannerHTML() +
                buildTemplate(style) +
            '</div>';

        const root = el.querySelector('.rs3d-root');
        dom = {
            root: root,
            speed: root.querySelector('[data-el="speed"]'),
            speedMirror: root.querySelector('[data-el="speedMirror"]'),
            unit: root.querySelector('[data-el="unit"]'),
            unitMirror: root.querySelector('[data-el="unitMirror"]'),
            gear: root.querySelector('[data-el="gear"]'),
            vehName: root.querySelector('[data-el="vehName"]'),
            badge: root.querySelector('[data-el="badge"]'),
            rpmArc: root.querySelector('[data-el="rpmArc"]'),
            rpmFill: root.querySelector('[data-el="rpmFill"]'),
            rpmTxt: root.querySelector('[data-el="rpmTxt"]'),
            rpmShort: root.querySelector('[data-el="rpmShort"]'),
            driveMode: root.querySelector('[data-el="driveMode"]'),
            gyroOuter: root.querySelector('[data-el="gyroOuter"]'),
            gyroInner: root.querySelector('[data-el="gyroInner"]'),
            rpmNeedle: root.querySelector('[data-el="rpmNeedle"]'),
            spdNeedle: root.querySelector('[data-el="spdNeedle"]'),
            rpmTrail: root.querySelector('[data-el="rpmTrail"]'),
            spdTrail: root.querySelector('[data-el="spdTrail"]'),
            driftArrows: root.querySelector('[data-el="driftArrows"]'),
            driftLabel: root.querySelector('[data-el="driftLabel"]'),
            driftAngle: root.querySelector('[data-el="driftAngle"]'),
            driftScore: root.querySelector('[data-el="driftScore"]'),
            slipVal: root.querySelector('[data-el="slipVal"]'),
            slipFill: root.querySelector('[data-el="slipFill"]'),
            balPuck: root.querySelector('[data-el="balPuck"]'),
            balState: root.querySelector('[data-el="balState"]'),
            tireHeat: root.querySelector('[data-el="tireHeat"]'),
            driftCombo: root.querySelectorAll('[data-el="driftCombo"]'),
            peakAngle: root.querySelector('[data-el="peakAngle"]'),
            bounceStage: root.querySelector('[data-el="bounceStage"]'),
            railL: root.querySelector('[data-el="railL"]'),
            railR: root.querySelector('[data-el="railR"]'),
            segs: root.querySelectorAll('[data-seg]'),
            leds: root.querySelectorAll('[data-led]'),
            bars: {
                fuel:   { wrap: root.querySelector('[data-bar="fuel"]'),   fill: root.querySelector('[data-fill="fuel"]'),   val: root.querySelector('[data-val="fuel"]') },
                engine: { wrap: root.querySelector('[data-bar="engine"]'), fill: root.querySelector('[data-fill="engine"]'), val: root.querySelector('[data-val="engine"]') },
                nos:    { wrap: root.querySelector('[data-bar="nos"]'),    fill: root.querySelector('[data-fill="nos"]'),    val: root.querySelector('[data-val="nos"]') }
            },
            icons: {
                seatbelt: root.querySelector('[data-ico="seatbelt"]'),
                harness:  root.querySelector('[data-ico="harness"]'),
                lights:   root.querySelector('[data-ico="lights"]'),
                highbeam: root.querySelector('[data-ico="highbeam"]'),
                engine:   root.querySelector('[data-ico="engine"]'),
                tires:    root.querySelector('[data-ico="tires"]')
            },
            cstats: {}
        };

        dom.rpmArcLen = prepArc(dom.rpmArc);
        dom.rpmTrailLen = prepArc(dom.rpmTrail);
        dom.spdTrailLen = prepArc(dom.spdTrail);

        CLUSTER_DECK.forEach(function (st) {
            const w = root.querySelector('[data-cstat="' + st.key + '"]');
            if (w) {
                dom.cstats[st.key] = {
                    wrap: w,
                    val: root.querySelector('[data-cval="' + st.key + '"]'),
                    fill: root.querySelector('[data-cfill="' + st.key + '"]')
                };
            }
        });

        applyCustomScale();
        renderCustomData();
        renderCustomStatus();
    }

    function setBar(barObj, pct, lowAt) {
        if (!barObj) return;
        const v = Math.max(0, Math.min(100, Number(pct || 0)));
        if (barObj.fill) barObj.fill.style.width = v + '%';
        if (barObj.val) barObj.val.textContent = Math.round(v) + '%';
        if (barObj.wrap) barObj.wrap.classList.toggle('low', v <= lowAt);
    }

    function setIcon(el, active, warn, crit) {
        if (!el) return;
        el.classList.toggle('active', !!active);
        el.classList.toggle('warn', !!warn);
        el.classList.toggle('crit', !!crit);
    }

    function renderCustomData() {
        if (!dom || !dom.root) return;
        const d = lastData;
        const speed = Math.max(0, Number(d.speed || 0));
        const maxSpeed = Math.max(80, Number(d.maxSpeed || 200));

        if (maxSpeed !== lastMaxSpeedBuilt) {
            buildCustom(activeStyle);
            return;
        }

        const unit = String(d.unit || 'MPH').toUpperCase() === 'KMH' ? 'KMH' : 'MPH';
        const rpm = Math.max(0, Math.min(100, Number(d.rpm || 0)));
        const fuel = Math.max(0, Math.min(100, Number(d.fuel ?? 100)));
        const engine = Math.max(0, Math.min(100, Number(d.engine ?? 100)));
        const tires = Math.max(0, Math.min(100, Number(d.tires ?? 100)));
        const spdFrac = Math.max(0, Math.min(1, speed / maxSpeed));
        const rpmFrac = rpm / 100;
        const warnT = typeof d.warnThreshold === 'number' ? d.warnThreshold : 0.75;
        const critT = typeof d.critThreshold === 'number' ? d.critThreshold : 0.90;

        // Speed & Gear readouts
        const speedStr = String(Math.round(speed)).padStart(3, '0');
        if (dom.speed) dom.speed.textContent = speedStr;
        if (dom.speedMirror) dom.speedMirror.textContent = speedStr;
        if (dom.unit) dom.unit.textContent = unit;
        if (dom.unitMirror) dom.unitMirror.textContent = unit;

        const gearLabel = d.reverse === true ? 'R' : (Number(d.gear || 0) > 0 ? String(d.gear) : 'N');
        if (dom.gear) dom.gear.textContent = gearLabel;
        if (dom.vehName) dom.vehName.textContent = String(d.vehicleName || d.spawnName || 'VEHICLE').toUpperCase();
        if (dom.rpmTxt) dom.rpmTxt.textContent = Math.round(rpm) + '%';
        if (dom.rpmShort) dom.rpmShort.textContent = String(Math.round(rpm));

        // Sweeping Analog Needles (-135deg to +135deg)
        if (dom.rpmNeedle) {
            dom.rpmNeedle.style.transform = 'rotate(' + (-135 + rpmFrac * 270).toFixed(1) + 'deg)';
        }
        if (dom.spdNeedle) {
            dom.spdNeedle.style.transform = 'rotate(' + (-135 + spdFrac * 270).toFixed(1) + 'deg)';
        }
        if (dom.rpmTrail && dom.rpmTrailLen) {
            dom.rpmTrail.style.strokeDashoffset = String(dom.rpmTrailLen * (1 - rpmFrac));
        }
        if (dom.spdTrail && dom.spdTrailLen) {
            dom.spdTrail.style.strokeDashoffset = String(dom.spdTrailLen * (1 - spdFrac));
        }

        // Digital Arcs / Bars / LEDs
        if (dom.rpmFill) dom.rpmFill.style.width = rpm.toFixed(1) + '%';
        if (dom.rpmArc && dom.rpmArcLen) {
            dom.rpmArc.style.strokeDashoffset = String(dom.rpmArcLen * (1 - rpmFrac));
        }
        if (dom.segs && dom.segs.length) {
            const lit = Math.round(rpmFrac * dom.segs.length);
            dom.segs.forEach(function (seg, i) { seg.classList.toggle('lit', i < lit); });
        }
        if (dom.leds && dom.leds.length) {
            const lit = Math.round(rpmFrac * dom.leds.length);
            dom.leds.forEach(function (led, i) { led.classList.toggle('lit', i < lit); });
        }

        if (dom.driveMode) {
            const mode = spdFrac >= 0.72 ? 'OVERDRIVE' : (spdFrac >= 0.45 ? 'SPORT' : (spdFrac <= 0.16 ? 'ECO' : 'NORMAL'));
            if (dom.driveMode.textContent !== mode) dom.driveMode.textContent = mode;
        }
        if (dom.gyroOuter && dom.gyroInner) {
            dom.gyroOuter.style.animationDuration = Math.max(1.2, 8 - rpmFrac * 6.5).toFixed(2) + 's';
            dom.gyroInner.style.animationDuration = Math.max(0.7, 4.5 - rpmFrac * 3.6).toFixed(2) + 's';
        }

        // Interactive Drift Telemetry Engine
        const now = performance.now();
        const dt = prevFrameTs ? Math.max(0.016, Math.min(0.25, (now - prevFrameTs) / 1000)) : 0.05;
        prevFrameTs = now;

        const isDriftingNow = d.drifting === true && Number(d.driftAngle || 0) >= 10;
        const angle = isDriftingNow ? Math.min(80, Math.max(0, Number(d.driftAngle || 0))) : 0;
        const dir = Number(d.driftDir || 0);

        if (isDriftingNow) {
            lastDriftTs = now;
            driftScore += Math.round((speed * 0.65 + angle * 1.4) * dt * 10);
        } else if (now - lastDriftTs > 1800) {
            driftScore = 0;
        }

        const showDrift = isDriftingNow || (driftScore > 0 && (now - lastDriftTs <= 1500));
        const highAngle = isDriftingNow && angle >= 34;

        dom.root.classList.toggle('rs3d-drifting', showDrift);
        dom.root.classList.toggle('rs3d-drifting-high', highAngle);
        dom.root.style.setProperty('--drift-angle', (dir * Math.min(32, angle * 0.65)).toFixed(1) + 'deg');

        if (dom.driftArrows) {
            dom.driftArrows.textContent = dir < 0 ? '<<<' : (dir > 0 ? '>>>' : '///');
        }
        if (dom.driftLabel) {
            dom.driftLabel.textContent = isDriftingNow ? (highAngle ? 'MAX ANGLE' : 'DRIFTING') : 'CLEAN SLIDE';
        }
        if (dom.driftAngle) {
            dom.driftAngle.textContent = Math.round(angle) + '°';
        }
        if (dom.driftScore) {
            dom.driftScore.textContent = '+' + driftScore.toLocaleString();
        }

        // Dedicated Slip-Angle Protractor (Drift King & Touge)
        if (dom.slipVal) {
            dom.slipVal.textContent = (dir < 0 ? '-' : (dir > 0 ? '+' : '')) + Math.round(angle) + '°';
        }
        if (dom.slipFill) {
            const halfPct = Math.min(50, (angle / 60) * 50);
            if (dir < 0) {
                dom.slipFill.style.left = (50 - halfPct).toFixed(1) + '%';
                dom.slipFill.style.width = halfPct.toFixed(1) + '%';
            } else {
                dom.slipFill.style.left = '50%';
                dom.slipFill.style.width = halfPct.toFixed(1) + '%';
            }
        }


        // Enhanced Drift Balance, Combo Multiplier, Tire Heat & 3D Bounce Physics
        const rawBal = (typeof d.driftBalance === 'number') ? d.driftBalance : (isDriftingNow ? dir * Math.min(100, angle * 1.8) : 0);
        if (isDriftingNow) {
            driftDuration += dt;
            if (angle > peakAngle) peakAngle = angle;
            driftCombo = Math.min(5, 1 + Math.floor(driftDuration / 1.4));
            tireHeat = Math.min(100, tireHeat + dt * (12 + angle * 0.28));
        } else {
            if (now - lastDriftTs > 1800) {
                driftDuration = 0;
                driftCombo = 1;
                peakAngle = 0;
            }
            tireHeat = Math.max(22, tireHeat - dt * 9);
        }

        if (dom.balPuck) {
            const puckPct = Math.max(6, Math.min(94, 50 + (rawBal * 0.44)));
            dom.balPuck.style.left = puckPct.toFixed(1) + '%';
            dom.balPuck.style.background = isDriftingNow ? (Math.abs(rawBal) > 72 ? '#ff3556' : '#3df2a0') : '#ffffff';
        }
        if (dom.balState) {
            let bTxt = 'GRIP';
            if (isDriftingNow) {
                const absB = Math.abs(rawBal);
                bTxt = absB < 26 ? 'SHALLOW' : (absB <= 74 ? 'SWEET SPOT' : 'OVERSTEER');
            }
            dom.balState.textContent = bTxt;
            dom.balState.style.color = bTxt === 'SWEET SPOT' ? '#3df2a0' : (bTxt === 'OVERSTEER' ? '#ff3556' : '#ffd038');
        }
        if (dom.tireHeat) dom.tireHeat.textContent = Math.round(tireHeat) + '%';
        if (dom.peakAngle) dom.peakAngle.textContent = Math.round(peakAngle) + '°';
        if (dom.driftCombo && dom.driftCombo.length) {
            dom.driftCombo.forEach(function (el) { el.textContent = 'x' + driftCombo; });
        }
        if (dom.railL) dom.railL.style.height = rpm.toFixed(1) + '%';
        if (dom.railR) dom.railR.style.height = (spdFrac * 100).toFixed(1) + '%';

        // 3D Bouncing Physics for Neon-Punk High-Tech Styles
        const curGearNum = Number(d.gear || 0);
        const gearChanged = curGearNum !== prevGear && speed > 5;
        const rpmSurge = (rpm - prevRpm) > 9;
        prevGear = curGearNum;
        prevRpm = rpm;

        if (gearChanged) bounceImpulse = 1.0;
        else if (rpmSurge || (isDriftingNow && angle >= 30)) bounceImpulse = Math.max(bounceImpulse, 0.58);
        else bounceImpulse = Math.max(0, bounceImpulse - dt * 4.2);

        if (dom.bounceStage) {
            const idleBeat = Math.sin(now * 0.008) * (1.2 + rpmFrac * 2.2);
            const kickY = (-bounceImpulse * 8.5 + idleBeat).toFixed(2);
            const kickZ = (bounceImpulse * 20).toFixed(1);
            const kickRx = (bounceImpulse * 7.5 + (isDriftingNow ? 3.5 : 0)).toFixed(2);
            const kickSc = (1 + bounceImpulse * 0.032).toFixed(3);
            dom.bounceStage.style.setProperty('--bounce-y', kickY + 'px');
            dom.bounceStage.style.setProperty('--bounce-z', kickZ + 'px');
            dom.bounceStage.style.setProperty('--bounce-rx', kickRx + 'deg');
            dom.bounceStage.style.setProperty('--bounce-scale', kickSc);
        }

        // Telemetry Bars & 6 Status Icons
        setBar(dom.bars.fuel, fuel, 20);
        setBar(dom.bars.engine, engine, 35);
        setBar(dom.bars.nos, lastStatus.nos, nosLowThreshold);

        const restrained = d.seatbelt === true || d.harness === true;
        setIcon(dom.icons.seatbelt, d.seatbelt === true, false, !restrained && speed >= 12);
        setIcon(dom.icons.harness, d.harness === true, false, false);
        setIcon(dom.icons.lights, d.lightsOn === true, false, false);
        setIcon(dom.icons.highbeam, d.highBeams === true, false, false);
        setIcon(dom.icons.engine, false, engine <= 55 && engine > 30, engine <= 30);
        setIcon(dom.icons.tires, false, tires <= 75 && tires > 50, tires <= 50);

        dom.root.classList.toggle('rs3d-warn', spdFrac >= warnT && spdFrac < critT);
        dom.root.classList.toggle('rs3d-crit', spdFrac >= critT);
        dom.root.classList.toggle('rs3d-redline', rpmFrac >= 0.84);
        if (dom.badge) {
            const baseBadge = (STYLE_META[activeStyle] && STYLE_META[activeStyle].badge) || 'HUD';
            dom.badge.textContent = isDriftingNow ? 'DRIFT' : (spdFrac >= critT ? 'LIMIT' : (rpmFrac >= 0.84 ? 'SHIFT' : baseBadge));
        }
    }

    function renderCustomStatus() {
        if (!dom || !dom.root) return;
        const nosVal = Math.max(0, Math.min(100, Number(lastStatus.nos || 0)));
        setBar(dom.bars.nos, nosVal, nosLowThreshold);

        const nosDraining = prevNos - nosVal > 0.3;
        prevNos = nosVal;
        dom.root.classList.toggle('rs3d-nos-hot', nosDraining);

        CLUSTER_DECK.forEach(function (st) {
            const c = dom.cstats[st.key];
            if (!c) return;
            const val = Math.max(0, Math.min(100, Number(lastStatus[st.key] || 0)));
            if (c.val) c.val.textContent = String(Math.round(val));
            if (c.fill) c.fill.style.width = val + '%';
            if (c.wrap) {
                const lowAt = st.key === 'nos' ? nosLowThreshold : 25;
                c.wrap.classList.toggle('low', val > 0 && val <= lowAt);
            }
        });
    }

    function usesIntegratedStatus() {
        return !editorMode && hideStandaloneStatusInCluster && activeStyle === 'cluster';
    }

    function syncStatusVisibility() {
        if (window.RSStatus && typeof window.RSStatus.setIntegratedHidden === 'function') {
            window.RSStatus.setIntegratedHidden(visible && usesIntegratedStatus());
        }
    }

    function saveStyle(style) {
        try {
            const saved = localStorage.getItem('rs-hudlife-settings-v2');
            const parsed = saved ? JSON.parse(saved) : {};
            parsed.speedoStyle = style;
            localStorage.setItem('rs-hudlife-settings-v2', JSON.stringify(parsed));
        } catch (e) {}

        if (typeof GetParentResourceName === 'undefined') return;
        const settings = window.RSMenu ? window.RSMenu.getSettings() : {};
        settings.speedoStyle = style;
        fetch('https://' + GetParentResourceName() + '/saveKVP', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: JSON.stringify(settings) })
        }).catch(function () {});
    }

    // Wrap window.RSSpeedo seamlessly (halo & vehicle pass straight through!)
    window.RSSpeedo = {
        build: function () {
            if (isCustom()) {
                buildCustom(activeStyle);
                syncStatusVisibility();
            } else {
                orig.build();
            }
        },
        show: function () {
            visible = true;
            if (!enabled) { this.hide(); return; }
            if (isCustom()) {
                const el = getContainer();
                if (!dom) buildCustom(activeStyle);
                if (el) {
                    el.classList.remove('hidden');
                    el.classList.add('visible');
                }
                applyCustomScale();
                syncStatusVisibility();
            } else {
                orig.show();
            }
        },
        hide: function () {
            visible = false;
            if (isCustom()) {
                const el = getContainer();
                if (el) {
                    el.classList.remove('visible');
                    el.classList.add('hidden');
                }
                syncStatusVisibility();
            } else {
                orig.hide();
            }
        },
        update: function (data) {
            lastData = Object.assign({}, lastData, data || {});
            if (isCustom()) {
                if (!dom) buildCustom(activeStyle);
                renderCustomData();
            } else {
                orig.update(data);
            }
        },
        updateStatus: function (data) {
            if (data) {
                lastStatus = Object.assign({}, lastStatus, data);
                if (data.nos === undefined && data.nitro !== undefined) lastStatus.nos = data.nitro;
                if (data.nos === undefined && data.nitrous !== undefined) lastStatus.nos = data.nitrous;
                if (data.nos === undefined && data.boost !== undefined) lastStatus.nos = data.boost;
            }
            if (isCustom()) {
                renderCustomStatus();
                syncStatusVisibility();
            } else {
                orig.updateStatus(data);
            }
        },
        usesIntegratedStatus: function () {
            return isCustom() ? usesIntegratedStatus() : orig.usesIntegratedStatus();
        },
        syncStatusVisibility: function () {
            if (isCustom()) syncStatusVisibility();
            else orig.syncStatusVisibility();
        },
        setPosition: function (x, y) {
            orig.setPosition(x, y);
        },
        setScale: function (scale) {
            userScale = typeof scale === 'number' && !Number.isNaN(scale) ? scale : 1;
            if (isCustom()) applyCustomScale();
            else orig.setScale(scale);
        },
        setStyle: function (style, skipSave) {
            const next = normalizeStyle(style);
            const prevWasCustom = isCustom(activeStyle);
            activeStyle = next;

            if (isCustom(next)) {
                buildCustom(next);
                syncStatusVisibility();
                if (!skipSave) saveStyle(next);
            } else {
                dom = null;
                orig.setStyle(next, skipSave);
                if (prevWasCustom) {
                    orig.build();
                    orig.setScale(userScale);
                    orig.setMinimized(minimized);
                    orig.update(lastData);
                    orig.updateStatus(lastStatus);
                    if (visible && enabled) orig.show();
                }
            }
        },
        setMinimized: function (value) {
            minimized = value === true;
            if (isCustom()) {
                applyCustomScale();
                return minimized;
            }
            return orig.setMinimized(value);
        },
        setEditorMode: function (flag) {
            editorMode = flag === true;
            orig.setEditorMode(flag);
            if (isCustom()) syncStatusVisibility();
        },
        applyConfig: function (cfg) {
            cfg = cfg || {};
            if (cfg.enabled !== undefined) {
                enabled = cfg.enabled !== false;
                if (!enabled) this.hide();
            }
            if (cfg.hideStandaloneStatusInCluster !== undefined) {
                hideStandaloneStatusInCluster = cfg.hideStandaloneStatusInCluster !== false;
            }
            if (cfg.nosLowThreshold !== undefined) {
                const t = Number(cfg.nosLowThreshold);
                nosLowThreshold = Math.max(0, Math.min(100, Number.isFinite(t) ? t : 20));
            }
            if (cfg.speedoMinimized !== undefined) {
                minimized = cfg.speedoMinimized === true;
            }
            if (cfg.speedoStyle) {
                this.setStyle(cfg.speedoStyle, true);
            }
            const origCfg = Object.assign({}, cfg);
            if (origCfg.speedoStyle && isCustom(normalizeStyle(origCfg.speedoStyle))) {
                delete origCfg.speedoStyle;
            }
            orig.applyConfig(origCfg);
            if (isCustom()) {
                applyCustomScale();
                syncStatusVisibility();
            }
        }
    };
})();
