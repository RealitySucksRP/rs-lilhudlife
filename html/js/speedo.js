// ============================================================
// RS-HUDLIFE - MULTI-LAYOUT SPEEDOMETER
// Ten selectable layouts, live vehicle art, integrated survival stats, and real damage telemetry.
// ============================================================

const RSSpeedo = (function() {
    'use strict';

    let initialized = false;
    let container = null;
    let currentStyle = 'halo';
    let visible = false;
    let enabled = true;
    let minimized = false;
    let userScale = 1.0;
    let nosLowThreshold = 20;
    let nosStyle = 'bottle';
    let hideStandaloneStatusInCluster = true;
    let editorMode = false;
    let lastMaxSpeed = 200;
    let warnThreshold = 0.75;   // fraction of max speed (Config.Speedo.WarningThreshold)
    let critThreshold = 0.90;   // fraction of max speed (Config.Speedo.CriticalThreshold)
    let lastVehicleKey = '';
    let lastData = {
        speed: 0, maxSpeed: 200, unit: 'MPH', fuel: 100,
        engine: 100, body: 100, rpm: 0, gear: 0,
        vehicleName: '', spawnName: '', classKey: 'car',
        burstTires: 0, brokenWindows: 0, damagedDoors: 0,
        seatbelt: false, harness: false, lightsOn: false, highBeams: false, engineRunning: false,
        tires: 100, transmission: 100, brakes: 100, cooling: 100, fuelSystem: 100, mechanicLinked: false
    };
    let elements = {};
    let lastStatus = { health: 100, armor: 0, hunger: 100, thirst: 100, stamina: 100, nos: 0 };

    const INTEGRATED_STATUS_STYLES = new Set(['cluster']);
    // Embedded exact NOS-bottle fallback. This prevents CEF/NUI asset-cache failures
    // from leaving a broken-image box in the all-in-one cluster.
    const NOS_ICON_FALLBACK = 'data:image/png;base64,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';
    const CLUSTER_STATS = [
        { key: 'stamina', label: 'STAM', icon: 'stamina.png', color: '#ff4b55' },
        { key: 'health',  label: 'HLTH', icon: 'health.png',  color: '#ff4057' },
        { key: 'armor',   label: 'ARMR', icon: 'armor.png',   color: '#8aa4bd' },
        { key: 'hunger',  label: 'FOOD', icon: 'hunger.png',  color: '#ffb22e' },
        { key: 'thirst',  label: 'H2O',  icon: 'thirst.png',  color: '#38d8ff' },
        { key: 'nos',     label: 'NOS',  icon: 'nos-bottle-v128.png', color: '#ff473d' }
    ];

    const STYLE_MAP = {
        cyber: 'halo', velocity: 'halo',
        katana: 'apex', street: 'apex',
        ghost: 'classic', luxe: 'classic',
        reactor: 'neon', overdrive: 'neon',
        oni: 'vehicle', inferno: 'vehicle'
    };

    const STYLES = {
        halo: {
            label: 'HALO', themeClass: 'rs-speedo--halo', badge: 'RS',
            sub: 'SERVER EDITION', warning: 'VELOCITY ALERT',
            primary: '#54ecff', secondary: '#a96dff', danger: '#ff477e',
            primaryRgb: '84,236,255', secondaryRgb: '169,109,255', dangerRgb: '255,71,126'
        },
        vehicle: {
            label: 'VEHICLE', themeClass: 'rs-speedo--vehicle', badge: 'VITAL',
            sub: 'SYSTEM STATUS', warning: 'VEHICLE CRITICAL',
            primary: '#55f7bf', secondary: '#52a7ff', danger: '#ff4e66',
            primaryRgb: '85,247,191', secondaryRgb: '82,167,255', dangerRgb: '255,78,102'
        },
        apex: {
            label: 'APEX', themeClass: 'rs-speedo--apex', badge: 'RACE',
            sub: 'COMPETITION DASH', warning: 'REDLINE',
            primary: '#b7ff3c', secondary: '#ffb629', danger: '#ff3f3f',
            primaryRgb: '183,255,60', secondaryRgb: '255,182,41', dangerRgb: '255,63,63'
        },
        classic: {
            label: 'CLASSIC', themeClass: 'rs-speedo--classic', badge: 'GT',
            sub: 'GRAND TOURING', warning: 'HIGH SPEED',
            primary: '#f4ead1', secondary: '#d5a94d', danger: '#df4f45',
            primaryRgb: '244,234,209', secondaryRgb: '213,169,77', dangerRgb: '223,79,69'
        },
        neon: {
            label: 'NEON', themeClass: 'rs-speedo--neon', badge: 'N7',
            sub: 'DIGITAL STREET', warning: 'LIMIT BREAK',
            primary: '#00f0ff', secondary: '#ff46d7', danger: '#ff315f',
            primaryRgb: '0,240,255', secondaryRgb: '255,70,215', dangerRgb: '255,49,95'
        },
        minimal: {
            label: 'MINIMAL', themeClass: 'rs-speedo--minimal', badge: '',
            sub: 'FOCUS MODE', warning: 'FAST',
            primary: '#f8fbff', secondary: '#70e1ff', danger: '#ff5b66',
            primaryRgb: '248,251,255', secondaryRgb: '112,225,255', dangerRgb: '255,91,102'
        },
        // Blue racing cluster: outer 1-10 RPM ring, big red speed digits,
        // blue gear box, and warning lamps across the top.
        turbo: {
            label: 'TURBO', themeClass: 'rs-speedo--turbo', badge: 'RPM',
            sub: 'RACE CLUSTER', warning: 'REDLINE',
            primary: '#38b6ff', secondary: '#8ad7ff', danger: '#ff2e4d',
            primaryRgb: '56,182,255', secondaryRgb: '138,215,255', dangerRgb: '255,46,77'
        },
        // EV-style cluster: left power arc, side rails, drive mode + battery.
        volt: {
            label: 'VOLT', themeClass: 'rs-speedo--volt', badge: 'EV',
            sub: 'ELECTRIC DRIVE', warning: 'POWER LIMIT',
            primary: '#2fd0ff', secondary: '#7ee8ff', danger: '#ff5470',
            primaryRgb: '47,208,255', secondaryRgb: '126,232,255', dangerRgb: '255,84,112'
        },
        survival: {
            label: 'SURVIVAL', themeClass: 'rs-speedo--survival', badge: 'LIFE',
            sub: 'FIELD VEHICLE MONITOR', warning: 'DANGER SPEED',
            primary: '#24cfff', secondary: '#7ee8ff', danger: '#ff3c43',
            primaryRgb: '36,207,255', secondaryRgb: '126,232,255', dangerRgb: '255,60,67'
        },
        cluster: {
            label: 'CLUSTER', themeClass: 'rs-speedo--cluster', badge: 'SURV',
            sub: 'SURVIVAL DRIVE SYSTEM', warning: 'REDLINE',
            primary: '#32bfff', secondary: '#79dcff', danger: '#ff3547',
            primaryRgb: '50,191,255', secondaryRgb: '121,220,255', dangerRgb: '255,53,71'
        }
    };

    function normalizeStyle(style) {
        const value = String(style || '').toLowerCase();
        return STYLES[value] ? value : (STYLE_MAP[value] || 'halo');
    }

    function usesIntegratedStatus() {
        return !editorMode && hideStandaloneStatusInCluster && INTEGRATED_STATUS_STYLES.has(currentStyle);
    }

    function syncStandaloneStatusVisibility() {
        if (window.RSStatus && typeof window.RSStatus.setIntegratedHidden === 'function') {
            window.RSStatus.setIntegratedHidden(visible && usesIntegratedStatus());
        }
    }

    function buildClusterStatusBar() {
        return CLUSTER_STATS.map(function(stat) {
            const isNos = stat.key === 'nos';
            const icon = isNos && nosStyle === 'bottle' ? 'nos-bottle-v128.png' : stat.icon;
            const styleClass = isNos ? (' rs-cluster-nos-' + nosStyle) : '';
            return '<div class="rs-cluster-stat' + styleClass + '" data-cluster-stat="' + stat.key + '" style="--rs-stat-color:' + stat.color + '">' +
                '<div class="rs-cluster-stat-icon"><img src="assets/icons/' + icon + '" alt=""></div>' +
                '<div class="rs-cluster-stat-copy"><strong data-cluster-value="' + stat.key + '">100%</strong><small>' + stat.label + '</small></div>' +
                '<div class="rs-cluster-stat-track"><i data-cluster-fill="' + stat.key + '"></i></div>' +
            '</div>';
        }).join('');
    }

    function polarToCartesian(cx, cy, radius, angleDeg) {
        const radians = (angleDeg - 90) * Math.PI / 180;
        return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) };
    }

    function describeArc(cx, cy, radius, startAngle, endAngle) {
        const start = polarToCartesian(cx, cy, radius, endAngle);
        const end = polarToCartesian(cx, cy, radius, startAngle);
        const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
        return 'M ' + start.x.toFixed(2) + ' ' + start.y.toFixed(2) +
            ' A ' + radius + ' ' + radius + ' 0 ' + largeArc + ' 0 ' +
            end.x.toFixed(2) + ' ' + end.y.toFixed(2);
    }

    function buildTicks(maxSpeed) {
        const ticks = [];
        const numbers = [];
        const start = 225;
        const sweep = 270;
        const total = 54;

        for (let i = 0; i <= total; i++) {
            const pct = i / total;
            const angle = start + pct * sweep;
            const major = i % 9 === 0;
            const mid = i % 3 === 0 && !major;
            const p1 = polarToCartesian(150, 150, major ? 119 : (mid ? 123 : 127), angle);
            const p2 = polarToCartesian(150, 150, major ? 137 : (mid ? 134 : 132), angle);
            const width = major ? 3.2 : (mid ? 1.7 : 0.85);
            const opacity = major ? 0.82 : (mid ? 0.42 : 0.22);
            ticks.push(
                '<line class="rs-speedo-tick ' + (major ? 'major' : (mid ? 'mid' : 'minor')) +
                '" data-tick="' + pct.toFixed(3) + '" x1="' + p1.x.toFixed(2) +
                '" y1="' + p1.y.toFixed(2) + '" x2="' + p2.x.toFixed(2) +
                '" y2="' + p2.y.toFixed(2) + '" stroke-width="' + width +
                '" opacity="' + opacity + '"/>'
            );
        }

        for (let i = 0; i <= 6; i++) {
            const pct = i / 6;
            const point = polarToCartesian(150, 150, 100, start + pct * sweep);
            const value = Math.round((maxSpeed * pct) / 10) * 10;
            numbers.push(
                '<div class="rs-speedo-num" data-num="' + pct.toFixed(3) +
                '" style="left:' + (point.x - 18).toFixed(1) + 'px;top:' +
                (point.y - 9).toFixed(1) + 'px">' + value + '</div>'
            );
        }
        return { ticks: ticks.join(''), numbers: numbers.join('') };
    }

    // Outer 1-10 RPM ring for the TURBO cluster (x1000 rpm, like the reference).
    function buildRpmRing() {
        const out = [];
        const start = 214;
        const sweep = 292;
        for (let i = 0; i <= 10; i++) {
            const pct = i / 10;
            const p = polarToCartesian(150, 150, 112, start + pct * sweep);
            out.push(
                '<div class="rs-rpm-num' + (i >= 8 ? ' redline' : '') + '" data-rpm-num="' +
                pct.toFixed(2) + '" style="left:' + (p.x - 13).toFixed(1) +
                'px;top:' + (p.y - 9).toFixed(1) + 'px">' + i + '</div>'
            );
        }
        return out.join('');
    }

    function build() {
        container = document.getElementById('speedo-container');
        if (!container) return;
        buildStyle(currentStyle);
        initialized = true;
    }

    function buildDrivingIndicators() {
        return '' +
            '<div class="rs-drive-indicators" aria-label="Vehicle status indicators">' +
                '<span class="rs-drive-indicator rs-ind-seatbelt" data-drive-ind="seatbelt" title="Seatbelt">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 2.5a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6Zm-1 5.7h2c.7 0 1.3.4 1.6 1l2.1 4.3 1.8-.9-1.5-3 1.8-.9 2 4.1 3.3 6.8-2.1 1-2.5-5.1-2 .9 1.8 3.7-2.1 1-5.3-10.7v10H4.8V9.6c0-.8.6-1.4 1.4-1.4Z"/></svg>' +
                '</span>' +
                '<span class="rs-drive-indicator rs-ind-harness" data-drive-ind="harness" title="Harness">H</span>' +
                '<span class="rs-drive-indicator rs-ind-engine" data-drive-ind="engine" title="Engine condition">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3V3h4v2h3l2 3h2v9h-3l-2 3H7l-2-3H2V9h3l2-4Zm1.2 3L7 10v6l1.2 1h6.7l1.1-2h2V10h-1.7l-1.4-2H8.2Z"/></svg>' +
                '</span>' +
                '<span class="rs-drive-indicator rs-ind-tires" data-drive-ind="tires" title="Tire condition">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h10l2 4v12l-2 4H7l-2-4V6l2-4Zm1.5 3L8 7v10l.5 2h7l.5-2V7l-.5-2h-7ZM10 7h4v2h-4V7Zm0 4h4v2h-4v-2Zm0 4h4v2h-4v-2Z"/></svg>' +
                '</span>' +
                '<span class="rs-drive-indicator rs-ind-lights" data-drive-ind="lights" title="Headlights">' +
                    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7a5 5 0 0 1 0 10H4V7Zm11 1 5-2v2l-5 1V8Zm0 4h6v2h-6v-2Zm0 5 5 1v2l-5-2v-1Z"/></svg>' +
                '</span>' +
            '</div>';
    }

    function buildVehicleDiagnostics() {
        const parts = [
            ['engine', 'ENGINE'], ['transmission', 'TRANS'], ['tires', 'TIRES'], ['brakes', 'BRAKE']
        ];
        return '<div class="rs-vehicle-diag-grid">' + parts.map(function(part) {
            return '<div class="rs-vehicle-diag" data-diag="' + part[0] + '">' +
                '<span>' + part[1] + '</span><strong data-diag-value="' + part[0] + '">100</strong>' +
                '<div><i data-diag-fill="' + part[0] + '"></i></div>' +
            '</div>';
        }).join('') + '</div>';
    }

    function buildStyle(style) {
        container = document.getElementById('speedo-container');
        if (!container) return;

        currentStyle = normalizeStyle(style);
        const cfg = STYLES[currentStyle];
        const pieces = buildTicks(lastMaxSpeed);
        const track = describeArc(150, 150, 106, 225, 495);
        elements = {};

        container.innerHTML =
            '<div class="rs-speedo ' + cfg.themeClass + '" data-style="' + currentStyle + '"' +
                ' style="--rs-primary:' + cfg.primary + ';--rs-secondary:' + cfg.secondary +
                ';--rs-danger:' + cfg.danger + ';--rs-primary-rgb:' + cfg.primaryRgb +
                ';--rs-secondary-rgb:' + cfg.secondaryRgb + ';--rs-danger-rgb:' + cfg.dangerRgb + '">' +
                '<div class="rs-speedo-ambient"></div>' +
                '<div class="rs-speedo-shell"></div>' +
                '<div class="rs-speedo-watermark"><img src="assets/logo.png" alt=""></div>' +
                '<svg class="rs-speedo-svg" viewBox="0 0 300 300" aria-hidden="true">' +
                    '<defs>' +
                        '<linearGradient id="rs-speedo-grad-' + currentStyle + '" x1="0%" y1="0%" x2="100%" y2="100%">' +
                            '<stop offset="0%" stop-color="' + cfg.primary + '"/>' +
                            '<stop offset="65%" stop-color="' + cfg.secondary + '"/>' +
                            '<stop offset="100%" stop-color="' + cfg.danger + '"/>' +
                        '</linearGradient>' +
                        '<filter id="rs-speedo-glow-' + currentStyle + '" x="-40%" y="-40%" width="180%" height="180%">' +
                            '<feGaussianBlur stdDeviation="4" result="blur"/>' +
                            '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
                        '</filter>' +
                    '</defs>' +
                    '<circle class="rs-speedo-outer-ring" cx="150" cy="150" r="142"/>' +
                    '<circle class="rs-speedo-inner-ring" cx="150" cy="150" r="118"/>' +
                    '<path class="rs-speedo-track" d="' + track + '"/>' +
                    '<path class="rs-speedo-arc-glow" d="' + track + '" stroke="url(#rs-speedo-grad-' + currentStyle + ')" filter="url(#rs-speedo-glow-' + currentStyle + ')"/>' +
                    '<path class="rs-speedo-arc" d="' + track + '" stroke="url(#rs-speedo-grad-' + currentStyle + ')"/>' +
                    '<g class="rs-speedo-ticks">' + pieces.ticks + '</g>' +
                '</svg>' +
                '<div class="rs-speedo-numbers">' + pieces.numbers + '</div>' +
                '<div class="rs-speedo-topline">' +
                    '<span class="rs-speedo-mode">' + cfg.label + '</span>' +
                    '<span class="rs-speedo-sub">' + cfg.sub + '</span>' +
                '</div>' +
                '<div class="rs-speedo-gear"><span>GEAR</span><strong id="rs-speedo-gear">N</strong></div>' +
                '<div class="rs-speedo-rpm"><span>RPM</span><strong id="rs-speedo-rpm">0</strong></div>' +
                '<div class="rs-speedo-needle" id="rs-speedo-needle">' +
                    '<div class="rs-speedo-needle-glow"></div><div class="rs-speedo-needle-line"></div>' +
                '</div>' +
                '<div class="rs-speedo-hub"><div class="rs-speedo-hub-ring"></div><div class="rs-speedo-hub-dot"></div></div>' +
                '<div class="rs-speedo-readout" id="rs-speedo-readout">' +
                    '<div class="rs-speedo-speed" id="rs-speedo-speed">000</div>' +
                    '<div class="rs-speedo-unit" id="rs-speedo-unit">MPH</div>' +
                '</div>' +
                '<div class="rs-speedo-warning" id="rs-speedo-warning">' + cfg.warning + '</div>' +
                '<div class="rs-speedo-vehicle-panel">' +
                    '<div class="rs-speedo-vehicle-title">' +
                        '<span id="rs-speedo-vehicle-name">VEHICLE</span><strong id="rs-speedo-body-state">NOMINAL</strong>' +
                    '</div>' +
                    '<div class="rs-speedo-vehicle-visual">' +
                        '<div class="rs-speedo-damage-aura"></div>' +
                        '<div class="rs-vehicle-health-rail" title="Overall vehicle health"><i id="rs-vehicle-health-fill"></i><b id="rs-vehicle-health-text">100</b></div>' +
                        '<img id="rs-speedo-vehicle-img" alt="">' +
                        '<div class="rs-speedo-scanline"></div>' +
                    '</div>' +
                    buildVehicleDiagnostics() +
                    '<div class="rs-speedo-damage-pills">' +
                        '<span class="rs-dmg-pill" data-dmg="tires"><b id="rs-speedo-tires">0</b> TIRE</span>' +
                        '<span class="rs-dmg-pill" data-dmg="windows"><b id="rs-speedo-windows">0</b> GLASS</span>' +
                        '<span class="rs-dmg-pill" data-dmg="doors"><b id="rs-speedo-doors">0</b> DOOR</span>' +
                    '</div>' +
                '</div>' +
                '<div class="rs-speedo-telemetry">' +
                    '<div class="rs-speedo-stat rs-stat-fuel"><span>FUEL</span><div><i id="rs-speedo-fuel-fill"></i></div><strong id="rs-speedo-fuel-text">100</strong></div>' +
                    '<div class="rs-speedo-stat rs-stat-cooling"><span>COOL</span><div><i id="rs-speedo-cooling-fill"></i></div><strong id="rs-speedo-cooling-text">100</strong></div>' +
                    '<div class="rs-speedo-stat rs-stat-body"><span>BODY</span><div><i id="rs-speedo-body-fill"></i></div><strong id="rs-speedo-body-text">100</strong></div>' +
                '</div>' +
                buildDrivingIndicators() +
                // --- TURBO cluster extras (hidden unless style is turbo) ---
                '<div class="rs-speedo-rpmring">' + buildRpmRing() + '</div>' +
                '<div class="rs-speedo-lamps">' +
                    '<span class="rs-lamp" data-lamp="fuel" title="Low fuel">' +
                        '<svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M19 9l-4-4v3h-4V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16h10V10h2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V9zM11 11H5V4h6z"/></svg>' +
                    '</span>' +
                    '<span class="rs-lamp" data-lamp="engine" title="Engine damage">' +
                        '<svg viewBox="0 0 24 24" width="9" height="9" fill="currentColor"><path d="M12 2 1 21h22zm0 5 7.5 12h-15zM11 10h2v5h-2zm0 6h2v2h-2z"/></svg>' +
                    '</span>' +
                '</div>' +
                '<div class="rs-speedo-gearbadge" id="rs-speedo-gearbadge">N</div>' +
                // --- VOLT cluster extras (hidden unless style is volt) ---
                '<div class="rs-volt-rail rs-volt-rail-l">' +
                    '<span>HIGH</span><span class="rs-volt-rail-mid">LEVEL</span><span>LOW</span>' +
                '</div>' +
                '<div class="rs-volt-rail rs-volt-rail-r">' +
                    '<span>ECO</span><span class="rs-volt-mode" id="rs-volt-mode">NORMAL</span><span>SPORT</span>' +
                '</div>' +
                '<div class="rs-volt-power"><i id="rs-volt-power-fill"></i></div>' +
                '<div class="rs-volt-batt">' +
                    '<div class="rs-volt-batt-shell"><i id="rs-volt-batt-fill"></i></div>' +
                    '<strong id="rs-volt-batt-text">100</strong>' +
                '</div>' +
                '<div class="rs-cluster-iconbar" aria-label="Live player status">' +
                    buildClusterStatusBar() +
                '</div>' +
            '</div>';

        elements.root = container.querySelector('.rs-speedo');
        elements.arc = container.querySelector('.rs-speedo-arc');
        elements.arcGlow = container.querySelector('.rs-speedo-arc-glow');
        elements.needle = document.getElementById('rs-speedo-needle');
        elements.speed = document.getElementById('rs-speedo-speed');
        elements.unit = document.getElementById('rs-speedo-unit');
        elements.readout = document.getElementById('rs-speedo-readout');
        elements.warning = document.getElementById('rs-speedo-warning');
        elements.gear = document.getElementById('rs-speedo-gear');
        elements.rpm = document.getElementById('rs-speedo-rpm');
        elements.vehicleName = document.getElementById('rs-speedo-vehicle-name');
        elements.vehicleImage = document.getElementById('rs-speedo-vehicle-img');
        elements.bodyState = document.getElementById('rs-speedo-body-state');
        elements.tires = document.getElementById('rs-speedo-tires');
        elements.windows = document.getElementById('rs-speedo-windows');
        elements.doors = document.getElementById('rs-speedo-doors');
        elements.fuelFill = document.getElementById('rs-speedo-fuel-fill');
        elements.coolingFill = document.getElementById('rs-speedo-cooling-fill');
        elements.bodyFill = document.getElementById('rs-speedo-body-fill');
        elements.fuelText = document.getElementById('rs-speedo-fuel-text');
        elements.coolingText = document.getElementById('rs-speedo-cooling-text');
        elements.bodyText = document.getElementById('rs-speedo-body-text');
        elements.healthRailFill = document.getElementById('rs-vehicle-health-fill');
        elements.healthRailText = document.getElementById('rs-vehicle-health-text');
        elements.driveIndicators = {};
        ['seatbelt', 'harness', 'engine', 'tires', 'lights'].forEach(function(key) {
            elements.driveIndicators[key] = container.querySelector('[data-drive-ind="' + key + '"]');
        });
        elements.diagnostics = {};
        ['engine', 'transmission', 'tires', 'brakes'].forEach(function(key) {
            elements.diagnostics[key] = {
                wrap: container.querySelector('[data-diag="' + key + '"]'),
                value: container.querySelector('[data-diag-value="' + key + '"]'),
                fill: container.querySelector('[data-diag-fill="' + key + '"]')
            };
        });
        elements.gearBadge = document.getElementById('rs-speedo-gearbadge');
        elements.lampFuel = container.querySelector('.rs-lamp[data-lamp="fuel"]');
        elements.lampEngine = container.querySelector('.rs-lamp[data-lamp="engine"]');
        elements.rpmNums = container.querySelectorAll('.rs-rpm-num');
        elements.voltMode = document.getElementById('rs-volt-mode');
        elements.voltPower = document.getElementById('rs-volt-power-fill');
        elements.voltBattFill = document.getElementById('rs-volt-batt-fill');
        elements.voltBattText = document.getElementById('rs-volt-batt-text');
        elements.clusterStats = {};
        CLUSTER_STATS.forEach(function(stat) {
            const wrap = container.querySelector('[data-cluster-stat="' + stat.key + '"]');
            elements.clusterStats[stat.key] = {
                wrap: wrap,
                value: container.querySelector('[data-cluster-value="' + stat.key + '"]'),
                fill: container.querySelector('[data-cluster-fill="' + stat.key + '"]'),
                icon: wrap ? wrap.querySelector('img') : null
            };

            // FiveM CEF can retain a stale/broken NUI image cache after an icon is
            // replaced under the same filename. Use a new filename and an embedded
            // copy of the exact supplied bottle as a guaranteed fallback.
            const icon = elements.clusterStats[stat.key].icon;
            if (stat.key === 'nos' && icon) {
                icon.addEventListener('error', function handleNosIconError() {
                    icon.removeEventListener('error', handleNosIconError);
                    icon.src = NOS_ICON_FALLBACK;
                    icon.classList.add('rs-nos-icon-fallback');
                });
            }
        });

        const length = elements.arc && elements.arc.getTotalLength ? elements.arc.getTotalLength() : 1;
        [elements.arc, elements.arcGlow].forEach(function(el) {
            if (!el) return;
            el.style.strokeDasharray = String(length);
            el.style.strokeDashoffset = String(length);
        });

        lastVehicleKey = '';
        initialized = true;
        update(lastData);
        updateStatus(lastStatus);
        syncStandaloneStatusVisibility();
    }

    function loadVehicleImage(data) {
        if (!elements.vehicleImage) return;
        const spawn = String(data.spawnName || '').toLowerCase();
        const classKey = String(data.classKey || 'car').toLowerCase();
        const key = spawn + ':' + classKey;
        if (!spawn || key === lastVehicleKey) return;
        lastVehicleKey = key;

        // PNG first -- see boot.js. The library is all .png; leading with webp
        // logged a failed fetch per vehicle.
        //
        // The candidate list widens past the spawn name for the same reason the
        // boot reveal does: a DLC vehicle whose archetype name does not resolve
        // falls back to its GXT label, which is not the art filename.
        const attempts = [];
        const display = String(data.displayName || '').toLowerCase();
        const names = window.RSVehicleArtNames
            ? window.RSVehicleArtNames(spawn, display)
            : [spawn];
        for (const name of names) {
            attempts.push('assets/vehicles/' + name + '.png');
            attempts.push('assets/vehicles/' + name + '.webp');
        }
        let index = 0;
        elements.vehicleImage.classList.add('loading');
        elements.vehicleImage.classList.remove('rs-silhouette');

        function useSilhouette() {
            // No bespoke art for this vehicle: draw the per-class silhouette
            // so the panel always shows something recognizable.
            elements.vehicleImage.src = window.RSVehicleSilhouette
                ? window.RSVehicleSilhouette(classKey) : '';
            elements.vehicleImage.classList.remove('loading');
            elements.vehicleImage.classList.add('rs-silhouette');
            elements.root.classList.remove('rs-no-vehicle-art');
        }

        function tryNext() {
            if (index >= attempts.length) { useSilhouette(); return; }
            const src = attempts[index++];
            const probe = new Image();
            probe.onload = function() {
                elements.vehicleImage.src = src;
                elements.vehicleImage.classList.remove('loading');
                elements.vehicleImage.classList.remove('rs-silhouette');
                elements.root.classList.remove('rs-no-vehicle-art');
            };
            probe.onerror = tryNext;
            probe.src = src;
        }
        tryNext();
    }

    function updateTickLighting(pct) {
        if (!elements.root) return;
        elements.root.querySelectorAll('.rs-speedo-tick').forEach(function(tick) {
            const point = parseFloat(tick.dataset.tick || '0');
            const active = pct >= point;
            const near = !active && pct > point - 0.03;
            tick.classList.toggle('lit', active || near);
            tick.style.setProperty('--tick-bright', active ? '1' : (near ? '0.55' : '0'));
        });
        elements.root.querySelectorAll('.rs-speedo-num').forEach(function(number) {
            number.classList.toggle('lit', pct >= parseFloat(number.dataset.num || '0') - 0.02);
        });
    }

    function healthState(body, engine) {
        const worst = Math.min(body, engine);
        if (worst <= 20) return { name: 'CRITICAL', css: 'rs-damage-critical' };
        if (worst <= 45) return { name: 'DAMAGED', css: 'rs-damage-heavy' };
        if (worst <= 75) return { name: 'WORN', css: 'rs-damage-worn' };
        return { name: 'NOMINAL', css: 'rs-damage-clean' };
    }

    function update(data) {
        if (!initialized || !container) return;
        lastData = Object.assign({}, lastData, data || {});

        const speed = Math.max(0, Number(lastData.speed || 0));
        const maxSpeed = Math.max(40, Number(lastData.maxSpeed || 200));
        const unit = String(lastData.unit || 'MPH').toUpperCase() === 'KMH' ? 'KMH' : 'MPH';
        const fuel = Math.max(0, Math.min(100, Number(lastData.fuel ?? 0)));
        const engine = Math.max(0, Math.min(100, Number(lastData.engine ?? 0)));
        const body = Math.max(0, Math.min(100, Number(lastData.body ?? engine)));
        const tires = Math.max(0, Math.min(100, Number(lastData.tires ?? 100)));
        const transmission = Math.max(0, Math.min(100, Number(lastData.transmission ?? 100)));
        const brakes = Math.max(0, Math.min(100, Number(lastData.brakes ?? 100)));
        const cooling = Math.max(0, Math.min(100, Number(lastData.cooling ?? 100)));
        const rpm = Math.max(0, Math.min(100, Number(lastData.rpm ?? 0)));
        const pct = Math.max(0, Math.min(speed / maxSpeed, 1));
        // Weighted score. When mechanic telemetry is absent, transmission and
        // brakes are pinned at 100 and would inflate this -- the summary would
        // read healthier than the car is. Redistribute their weight onto the
        // three values that are always real.
        const mechAvailable = lastData.mechanicLinked === true;
        const systemHealth = mechAvailable
            ? Math.max(0, Math.min(100, Math.round((engine * 0.34) + (body * 0.20) + (transmission * 0.18) + (tires * 0.16) + (brakes * 0.12))))
            : Math.max(0, Math.min(100, Math.round((engine * 0.45) + (body * 0.30) + (tires * 0.25))));
        // Same reasoning: a pinned 100 must not be allowed to win a Math.min and
        // report the car as fine.
        const state = lastData.mechanicLinked === true
            ? healthState(Math.min(body, tires, transmission, brakes), Math.min(engine, cooling))
            : healthState(Math.min(body, tires), engine);

        if (typeof lastData.warnThreshold === 'number') warnThreshold = lastData.warnThreshold;
        if (typeof lastData.critThreshold === 'number') critThreshold = lastData.critThreshold;

        if (maxSpeed !== lastMaxSpeed) {
            lastMaxSpeed = maxSpeed;
            buildStyle(currentStyle);
            return;
        }

        if (elements.speed) elements.speed.textContent = String(Math.round(speed)).padStart(3, '0');
        if (elements.unit) elements.unit.textContent = unit;
        const currentGearLabel = lastData.reverse === true ? 'R' : (Number(lastData.gear || 0) > 0 ? String(lastData.gear) : 'N');
        if (elements.gear) elements.gear.textContent = currentGearLabel;
        if (elements.rpm) elements.rpm.textContent = String(Math.round(rpm));
        if (elements.vehicleName) elements.vehicleName.textContent = String(lastData.vehicleName || lastData.spawnName || 'VEHICLE').toUpperCase();
        if (elements.bodyState) elements.bodyState.textContent = state.name;
        const setPill = function(bEl, n) {
            if (!bEl) return;
            bEl.textContent = String(n);
            if (bEl.parentElement) bEl.parentElement.classList.toggle('rs-dmg-hit', n > 0);
        };
        setPill(elements.tires, Number(lastData.burstTires || 0));
        setPill(elements.windows, Number(lastData.brokenWindows || 0));
        setPill(elements.doors, Number(lastData.damagedDoors || 0));

        const setIndicator = function(key, active, warning) {
            const el = elements.driveIndicators && elements.driveIndicators[key];
            if (!el) return;
            el.classList.toggle('active', active === true);
            el.classList.toggle('warning', warning === true);
        };
        const restrained = lastData.seatbelt === true || lastData.harness === true;
        setIndicator('seatbelt', lastData.seatbelt === true, !restrained && speed >= 12);
        setIndicator('harness', lastData.harness === true, false);
        setIndicator('engine', engine <= 55, engine <= 30);
        setIndicator('tires', tires <= 75, tires <= 50);
        setIndicator('lights', lastData.lightsOn === true || lastData.highBeams === true, false);
        if (elements.driveIndicators && elements.driveIndicators.harness) {
            elements.driveIndicators.harness.classList.toggle('available', lastData.harness === true);
        }

        // TRANS and BRAKE come from qbx_mechanicjob. Without it the Lua side
        // pins them to 100 -- see Config comment in client/main.lua. A full bar
        // then means 'no data', which is indistinguishable from 'perfect', so
        // they are marked unavailable rather than drawn as healthy.
        const mechLinked = lastData.mechanicLinked === true;
        const diagValues = { engine: engine, transmission: transmission, tires: tires, brakes: brakes };
        const diagFabricated = { engine: false, tires: false, transmission: !mechLinked, brakes: !mechLinked };
        Object.keys(diagValues).forEach(function(key) {
            const item = elements.diagnostics && elements.diagnostics[key];
            const value = diagValues[key];
            if (!item) return;
            const unavailable = diagFabricated[key] === true;
            if (item.value) item.value.textContent = unavailable ? '--' : String(Math.round(value));
            if (item.fill) item.fill.style.width = (unavailable ? 0 : value) + '%';
            if (item.wrap) {
                item.wrap.classList.toggle('rs-diag-unavailable', unavailable);
                // Never warn on a value we invented.
                item.wrap.classList.toggle('warn', !unavailable && value <= 65 && value > 35);
                item.wrap.classList.toggle('critical', !unavailable && value <= 35);
            }
        });
        if (elements.healthRailFill) elements.healthRailFill.style.height = systemHealth + '%';
        if (elements.healthRailText) elements.healthRailText.textContent = String(systemHealth);

        if (elements.needle) elements.needle.style.transform = 'rotate(' + (-135 + pct * 270) + 'deg)';
        if (elements.readout) elements.readout.classList.toggle('warn', pct >= warnThreshold);
        if (elements.warning) elements.warning.classList.toggle('show', pct >= critThreshold || state.name === 'CRITICAL');

        [elements.arc, elements.arcGlow].forEach(function(el) {
            if (!el) return;
            const length = el.getTotalLength ? el.getTotalLength() : 1;
            el.style.strokeDashoffset = String(length - length * pct);
        });

        const values = [
            [elements.fuelFill, elements.fuelText, fuel],
            [elements.coolingFill, elements.coolingText, cooling],
            [elements.bodyFill, elements.bodyText, body]
        ];
        values.forEach(function(item) {
            if (item[0]) item[0].style.width = item[2] + '%';
            if (item[1]) item[1].textContent = String(Math.round(item[2]));
        });

        // --- TURBO cluster: RPM ring lighting, warning lamps, gear badge ---
        if (elements.gearBadge) {
            elements.gearBadge.textContent = lastData.reverse === true ? 'R' : (Number(lastData.gear || 0) > 0 ? String(lastData.gear) : 'N');
        }
        const rpmPct = rpm / 100;
        if (elements.rpmNums) {
            elements.rpmNums.forEach(function(n) {
                n.classList.toggle('lit', rpmPct >= parseFloat(n.dataset.rpmNum || '0'));
            });
        }
        if (elements.root) elements.root.classList.toggle('rs-redline', rpmPct >= 0.8);
        if (elements.lampFuel) elements.lampFuel.classList.toggle('lit', fuel <= 20);
        if (elements.lampEngine) elements.lampEngine.classList.toggle('lit', engine <= 50);

        // --- VOLT cluster: power arc, drive mode, battery (fuel as charge) ---
        if (elements.voltPower) elements.voltPower.style.height = Math.round(rpm) + '%';
        if (elements.voltBattFill) elements.voltBattFill.style.width = Math.round(fuel) + '%';
        if (elements.voltBattText) elements.voltBattText.textContent = String(Math.round(fuel));
        if (elements.voltMode) {
            const mode = pct >= 0.66 ? 'SPORT' : (pct <= 0.18 ? 'ECO' : 'NORMAL');
            if (elements.voltMode.textContent !== mode) elements.voltMode.textContent = mode;
        }

        elements.root.classList.remove('rs-damage-clean', 'rs-damage-worn', 'rs-damage-heavy', 'rs-damage-critical');
        elements.root.classList.add(state.css);
        elements.root.style.setProperty('--rs-rpm', rpm + '%');
        // Continuous body/engine damage (0 = pristine, 1 = destroyed) so the car
        // visibly reddens/scorches as it takes damage, not just in 4 steps.
        elements.root.style.setProperty('--rs-body-dmg', (Math.max(0, Math.min(1, (100 - body) / 100))).toFixed(3));
        elements.root.style.setProperty('--rs-engine-dmg', (Math.max(0, Math.min(1, (100 - engine) / 100))).toFixed(3));
        elements.root.style.setProperty('--rs-system-health', (systemHealth / 100).toFixed(3));
        elements.root.classList.toggle('rs-seatbelt-alert', !restrained && speed >= 12);
        elements.root.classList.toggle('rs-harness-active', lastData.harness === true);
        elements.root.classList.toggle('rs-mechanic-linked', lastData.mechanicLinked === true);
        loadVehicleImage(lastData);
        updateTickLighting(pct);
    }

    function updateStatus(data) {
        lastStatus = Object.assign({}, lastStatus, data || {});
        if (!initialized || !elements.clusterStats) {
            syncStandaloneStatusVisibility();
            return;
        }

        // Accept the common names used by nitrous resources and normalize them to NOS.
        if (data) {
            if (data.nos === undefined && data.nitro !== undefined) lastStatus.nos = data.nitro;
            if (data.nos === undefined && data.nitrous !== undefined) lastStatus.nos = data.nitrous;
            if (data.nos === undefined && data.boost !== undefined) lastStatus.nos = data.boost;
        }

        CLUSTER_STATS.forEach(function(stat) {
            const el = elements.clusterStats[stat.key];
            if (!el) return;
            const raw = Number(lastStatus[stat.key]);
            const value = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
            const rounded = Math.round(value);
            if (el.value) el.value.textContent = rounded + '%';
            if (el.fill) el.fill.style.width = value + '%';
            if (el.wrap) {
                const lowAt = stat.key === 'nos' ? nosLowThreshold : 25;
                el.wrap.classList.toggle('rs-cluster-stat-low', value > 0 && value <= lowAt);
                el.wrap.classList.toggle('rs-cluster-stat-empty', value <= 0);
                el.wrap.classList.toggle('rs-cluster-stat-full', value >= 100);
            }
        });

        syncStandaloneStatusVisibility();
    }

    function show() {
        if (!initialized) build();
        if (!container) return;
        if (!enabled) { hide(); return; }
        visible = true;
        container.classList.remove('hidden');
        container.classList.add('visible');
        syncStandaloneStatusVisibility();
    }

    function hide() {
        visible = false;
        if (!container) {
            syncStandaloneStatusVisibility();
            return;
        }
        container.classList.remove('visible');
        container.classList.add('hidden');
        syncStandaloneStatusVisibility();
    }

    function setPosition(x, y) {
        if (!container) container = document.getElementById('speedo-container');
        if (!container) return;
        container.style.setProperty('--rs-x', Number(x) + '%');
        container.style.setProperty('--rs-y', Number(y) + '%');
    }

    function applyScale() {
        if (!container) container = document.getElementById('speedo-container');
        const root = container ? container.querySelector('.rs-speedo') : null;
        if (!root) return;
        const value = userScale * (minimized ? 0.68 : 1.0);
        root.style.setProperty('--rs-user-scale', String(userScale));
        root.style.transform = 'scale(' + value + ')';
        container.classList.toggle('rs-speedo-minimized', minimized);
    }

    function setScale(scale) {
        userScale = typeof scale === 'number' && !Number.isNaN(scale) ? scale : 1;
        applyScale();
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
        }).catch(function() {});
    }

    function setStyle(style, skipSave) {
        const next = normalizeStyle(style);
        if (next === currentStyle && initialized) {
            syncStandaloneStatusVisibility();
            return;
        }
        currentStyle = next;
        buildStyle(next);
        syncStandaloneStatusVisibility();
        if (!skipSave) saveStyle(next);
    }

    function setMinimized(value) {
        minimized = value === true;
        applyScale();
        return minimized;
    }

    function setEditorMode(enabled) {
        editorMode = enabled === true;
        syncStandaloneStatusVisibility();
    }

    function applyConfig(cfg) {
        cfg = cfg || {};
        if (cfg.enabled !== undefined) {
            enabled = cfg.enabled !== false;
            if (!enabled) hide();
        }
        if (cfg.hideStandaloneStatusInCluster !== undefined) {
            hideStandaloneStatusInCluster = cfg.hideStandaloneStatusInCluster !== false;
        }
        if (cfg.nosLowThreshold !== undefined) {
            const parsedNosThreshold = Number(cfg.nosLowThreshold);
            nosLowThreshold = Math.max(0, Math.min(100, Number.isFinite(parsedNosThreshold) ? parsedNosThreshold : 20));
        }
        if (cfg.nosStyle && ['bottle', 'neon', 'mono'].includes(String(cfg.nosStyle).toLowerCase())) {
            const nextNosStyle = String(cfg.nosStyle).toLowerCase();
            if (nextNosStyle !== nosStyle) {
                nosStyle = nextNosStyle;
                if (initialized) buildStyle(currentStyle);
            }
        }
        if (cfg.speedoStyle) setStyle(cfg.speedoStyle, true);
        if (cfg.speedoMinimized !== undefined) setMinimized(cfg.speedoMinimized === true);
        syncStandaloneStatusVisibility();
    }

    return {
        build: build,
        show: show,
        hide: hide,
        update: update,
        updateStatus: updateStatus,
        usesIntegratedStatus: usesIntegratedStatus,
        syncStatusVisibility: syncStandaloneStatusVisibility,
        setPosition: setPosition,
        setScale: setScale,
        setStyle: setStyle,
        setMinimized: setMinimized,
        setEditorMode: setEditorMode,
        applyConfig: applyConfig
    };
})();

window.RSSpeedo = RSSpeedo;
