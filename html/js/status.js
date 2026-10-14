// ============================================================
// RS-HUDLIFE - STATUS RINGS
// Health, Armor, Hunger, Thirst, Stamina
// Free positioning, 4 shapes, 4 icon styles, per-ring toggles
// Sync-hud style effects: glow, pulse, fade-when-full, dynamic color, opacity
// ============================================================

const RSStatus = (function() {
    'use strict';

    let initialized = false;
    let container;
    let integratedHidden = false;
    let elements = {};
    let config = {
        enabled: true,
        position: 'bottom-center',
        shape: 'circle',
        iconStyle: 'crystal',
        layout: 'horizontal',
        scale: 1.0,
        glow: true,
        lowPulse: true,
        fadeWhenFull: false,
        dynamicColor: false,
        opacity: 1.0,
        lowThreshold: 25,
        nosLowThreshold: 20,
        nosStyle: 'bottle',
        show: { health: true, armor: true, hunger: true, thirst: true, stamina: true, oxygen: true, nos: false },
        colors: {
            health: '#ff3050', armor: '#60a5fa', hunger: '#ff9040',
            thirst: '#00e0ff', stamina: '#fbbf24', oxygen: '#40c8ff', nos: '#ff4d4d'
        },
        offset: { x: 20, y: 20 }
    };
    let data = { health: 100, armor: 0, hunger: 100, thirst: 100, stamina: 100 };

    // 'oxygen' and 'nos' are conditional rings: they only appear when relevant
    // (underwater / driving a vehicle that has NOS fitted).
    const RING_ORDER = ['health', 'armor', 'hunger', 'thirst', 'stamina', 'oxygen', 'nos'];

    const SVG_ICONS = {
        health: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
        armor: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        hunger: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11h16a1 1 0 0 1 1 1v.5a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 12.5V12a1 1 0 0 1 1-1z"/><path d="M5 11c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M7 19h10"/></svg>',
        thirst: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
        stamina: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5v6c0 1-.8 1.7-1.8 1.4C5.7 11.4 3 14.2 3 18v2h5c2.2 0 4-1.8 4-4V5z"/><path d="M13 5v6c0 1 .8 1.7 1.8 1.4 3.5-1 6.2 1.8 6.2 5.6v2h-5c-2.2 0-4-1.8-4-4V5z"/></svg>',
        oxygen: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/></svg>',
        nos: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 2h5v2.5h-5z"/><path d="M8.6 4.5h6.8c.9 0 1.6.8 1.6 1.8v13.4c0 1.3-1 2.3-2.3 2.3H9.3c-1.3 0-2.3-1-2.3-2.3V6.3c0-1 .7-1.8 1.6-1.8z"/><path d="M7 10.5h10"/><path d="M7 14.5h10"/></svg>'
    };

    // ============================================================
    //  VIVID 3D ICON SET
    //  Full-color icons (hand+heart, vest, burger, bottle, wind
    //  swirl, lungs). Used when iconStyle === 'vivid'.
    //  Drop matching PNGs in html/assets/icons/<key>.png to override
    //  any of these with your own art - see loadIconOverrides().
    // ============================================================
    const VIVID_ICONS = {
        health: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-h1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a7a"/><stop offset="1" stop-color="#d81f2a"/></linearGradient><linearGradient id="rsv-h2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcb7a"/><stop offset="1" stop-color="#f2921f"/></linearGradient></defs><path fill="url(#rsv-h1)" d="M24 9.6c3.1-3.9 10.2-2.3 10.2 3.6 0 4.6-5.8 8.6-10.2 11.6-4.4-3-10.2-7-10.2-11.6 0-5.9 7.1-7.5 10.2-3.6z"/><path fill="url(#rsv-h2)" d="M4.6 30.4c2.2-2.1 5.2-2.4 7.6-1.3l4.6 2.1h8.4a2.7 2.7 0 0 1 0 5.4h-6.5v1.7h9.2c2.9 0 5.2-.9 7.3-2.7l4-3.4a3.1 3.1 0 0 1 4.2 4.5l-6.2 5.9c-3 2.9-6.3 4-10.5 4H15.4c-2.9 0-5.2-1-7.2-3l-4.3-4.2a3 3 0 0 1 0-4.3z"/></svg>',
        armor: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-a1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9aa4b2"/><stop offset="1" stop-color="#5b636f"/></linearGradient></defs><path fill="url(#rsv-a1)" d="M14 7h20a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V11a4 4 0 0 1 4-4z"/><path fill="#39404a" d="M21.4 7h5.2v34h-5.2z"/><rect x="10" y="17" width="28" height="3.4" rx="1.7" fill="#39404a"/><rect x="10" y="27" width="28" height="3.4" rx="1.7" fill="#39404a"/></svg>',
        hunger: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-f1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8c877"/><stop offset="1" stop-color="#e09b3e"/></linearGradient></defs><path fill="url(#rsv-f1)" d="M8 20c0-7.2 7.2-12 16-12s16 4.8 16 12z"/><rect x="7" y="20.4" width="34" height="4.4" rx="2.2" fill="#7ec850"/><rect x="7" y="24.2" width="34" height="4.6" rx="2.3" fill="#ffd23f"/><rect x="7" y="28.4" width="34" height="5" rx="2.5" fill="#8a5330"/><path fill="url(#rsv-f1)" d="M9 33.4h30a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5z"/><circle cx="18" cy="14.5" r="1.5" fill="#fff3d6"/><circle cx="27" cy="12.6" r="1.5" fill="#fff3d6"/></svg>',
        thirst: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-t1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe6f5"/><stop offset="1" stop-color="#2aa5c4"/></linearGradient></defs><rect x="20" y="4" width="8" height="5" rx="1.6" fill="#4f6ef0"/><rect x="19.2" y="8.4" width="9.6" height="3.4" rx="1.2" fill="#3f57c9"/><path fill="url(#rsv-t1)" d="M18.4 12h11.2c1.6 2.2 2.4 4.6 2.4 7.2v19.2a5.6 5.6 0 0 1-5.6 5.6h-4.8a5.6 5.6 0 0 1-5.6-5.6V19.2c0-2.6.8-5 2.4-7.2z"/><rect x="16" y="23" width="16" height="4" rx="1.4" fill="#ffffff" opacity=".32"/></svg>',
        stamina: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-o1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7d84"/><stop offset="1" stop-color="#d32232"/></linearGradient></defs><rect x="22.4" y="6" width="3.2" height="13" rx="1.6" fill="#e86070"/><path fill="url(#rsv-o1)" d="M22.4 17.6v6.8c0 1.6-1.2 2.6-2.6 2.2-2-.6-4-.4-5.6.6C10.6 29.4 9 34 9 38.6A3.4 3.4 0 0 0 12.4 42h4.2c3 0 5.8-2.6 5.8-6.2V17.6z"/><path fill="url(#rsv-o1)" d="M25.6 17.6v6.8c0 1.6 1.2 2.6 2.6 2.2 2-.6 4-.4 5.6.6C37.4 29.4 39 34 39 38.6A3.4 3.4 0 0 1 35.6 42h-4.2c-3 0-5.8-2.6-5.8-6.2V17.6z"/></svg>',
        oxygen: '<svg viewBox="0 0 48 48" width="22" height="22" fill="none" stroke-linecap="round"><defs><linearGradient id="rsv-s1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#4318d6"/></linearGradient></defs><g stroke="url(#rsv-s1)" stroke-width="4.6"><path d="M7 17h18.5a5.6 5.6 0 1 0-5.6-5.6"/><path d="M7 25h25a5.6 5.6 0 1 1-5.6 5.6"/><path d="M7 33h11.4a5.6 5.6 0 1 1-5.6 5.6"/></g></svg>',
        nos: '<svg viewBox="0 0 48 48" width="22" height="22"><defs><linearGradient id="rsv-n1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff6b6b"/><stop offset=".5" stop-color="#e5262f"/><stop offset="1" stop-color="#a3121c"/></linearGradient></defs><rect x="18.5" y="2.5" width="11" height="3.4" rx="1.7" fill="#e5262f"/><rect x="22.6" y="5" width="2.8" height="4" fill="#c9a227"/><circle cx="31" cy="9" r="4.6" fill="#2b2b2b"/><circle cx="31" cy="9" r="3.2" fill="#f2f2f2"/><path d="M31 6.6V9l1.7 1.4" stroke="#d0021b" stroke-width="1.1" fill="none" stroke-linecap="round"/><path fill="#f5c518" d="M15.5 8.5h17c1.1 0 2 .9 2 2v2.2h-21V10.5c0-1.1.9-2 2-2z"/><path fill="url(#rsv-n1)" d="M13.5 12.7h21v25.6c0 3.6-2.9 6.5-6.5 6.5h-8c-3.6 0-6.5-2.9-6.5-6.5z"/><rect x="16" y="19" width="16" height="14" rx="1.6" fill="#f5c518"/><text x="24" y="29.6" font-family="Arial Black,Arial,sans-serif" font-size="9" font-weight="900" fill="#fff" text-anchor="middle">NOS</text></svg>'
    };

    const RING_LABELS = {
        health: 'HLTH', armor: 'ARMR', hunger: 'FOOD', thirst: 'H2O', stamina: 'STAM', oxygen: 'AIR', nos: 'NOS'
    };

    const ICON_STYLES = ['crystal', 'neon', 'mono', 'vivid'];

    // Custom art support: if html/assets/icons/<key>.png exists it replaces the
    // built-in icon for that ring. Lets a server owner drop in their own set
    // without touching any code.
    const iconOverrides = {};
    function loadIconOverrides(onFound) {
        RING_ORDER.forEach(key => {
            const src = 'assets/icons/' + key + '.png';
            const probe = new Image();
            probe.onload = function() {
                iconOverrides[key] = src;
                if (onFound) onFound(key, src);
            };
            probe.onerror = function() {};
            probe.src = src;
        });
    }

    function iconMarkup(key) {
        if (key === 'nos') {
            if (config.nosStyle === 'bottle') return '<img class="rs-ring-icon-img" src="assets/icons/nos-bottle-v128.png" alt="">';
            if (config.nosStyle === 'neon') return VIVID_ICONS.nos;
            if (config.nosStyle === 'mono') return SVG_ICONS.nos;
        }
        if (iconOverrides[key]) {
            return '<img class="rs-ring-icon-img" src="' + iconOverrides[key] + '" alt="">';
        }
        if (config.iconStyle === 'vivid') return VIVID_ICONS[key] || SVG_ICONS[key];
        return SVG_ICONS[key];
    }

    function paintIcons() {
        RING_ORDER.forEach(key => {
            const el = elements[key] && elements[key].icon;
            if (!el) return;
            const markup = iconMarkup(key);
            el.innerHTML =
                '<span class="rs-ring-icon-depth">' + markup + '</span>' +
                '<span class="rs-ring-icon-face">' + markup + '</span>';
        });
    }

    function getShapeClipPath(shape) {
        switch (shape) {
            case 'diamond':  return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
            case 'hexagon':  return 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)';
            case 'square':   return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
            default:         return '';
        }
    }

    function getDynamicColor(val) {
        if (val > 60) return '#4ade80';
        if (val > 30) return '#fbbf24';
        if (val > 0)  return '#ff3050';
        return '#6b7280';
    }

    function build() {
        container = document.getElementById('status-container');
        if (!container) return;

        let html = '';
        RING_ORDER.forEach(key => {
            const color = config.colors[key];
            html += `
            <div class="rs-ring" data-ring="${key}" style="color:${color}">
                <div class="rs-ring-shape" data-ring-shape="${key}">
                    <svg class="rs-ring-svg" viewBox="0 0 60 60">
                        <circle class="rs-ring-track" cx="30" cy="30" r="25"/>
                        <circle class="rs-ring-fill" data-ring-fill="${key}" cx="30" cy="30" r="25"
                                stroke="${color}"
                                stroke-dasharray="0 157"
                                transform="rotate(-90 30 30)"/>
                    </svg>
                    <div class="rs-ring-icon" data-ring-icon="${key}">
                        <span class="rs-ring-icon-depth">${SVG_ICONS[key]}</span>
                        <span class="rs-ring-icon-face">${SVG_ICONS[key]}</span>
                    </div>
                </div>
                <div class="rs-ring-value" data-ring-value="${key}" style="color:${color}">100</div>
                <div class="rs-ring-label">${RING_LABELS[key]}</div>
            </div>
            `;
        });
        container.innerHTML = html;

        RING_ORDER.forEach(key => {
            elements[key] = {
                wrap: container.querySelector(`[data-ring="${key}"]`),
                fill: container.querySelector(`[data-ring-fill="${key}"]`),
                value: container.querySelector(`[data-ring-value="${key}"]`),
                shape: container.querySelector(`[data-ring-shape="${key}"]`),
                icon: container.querySelector(`[data-ring-icon="${key}"]`),
            };
        });

        initialized = true;
        paintIcons();
        // Repaint if the owner has custom PNG art in assets/icons/
        loadIconOverrides(function() { paintIcons(); });
    }

    function applyConfig(cfg) {
        if (!cfg) return;
        // Merge nested maps rather than replacing them: a partial payload
        // (e.g. Lua colors with no 'oxygen' key) must not wipe the defaults,
        // otherwise that ring renders with an undefined stroke.
        const mergedColors = Object.assign({}, config.colors, cfg.colors || {});
        const mergedShow = Object.assign({}, config.show, cfg.show || {});
        const previousNosStyle = config.nosStyle;
        Object.assign(config, cfg);
        config.colors = mergedColors;
        config.show = mergedShow;
        if (!['bottle', 'neon', 'mono'].includes(String(config.nosStyle || '').toLowerCase())) config.nosStyle = 'bottle';
        if (!container) return;
        container.setAttribute('data-nos-style', config.nosStyle);
        if (previousNosStyle !== config.nosStyle) paintIcons();

        // NOTE: visibility is controlled ONLY by handlePayload() and show()/hide()
        // applyConfig only updates position/appearance without showing the container

        // Free X/Y positioning
        if (cfg.x !== undefined) container.style.setProperty('--rs-x', cfg.x + '%');
        if (cfg.y !== undefined) container.style.setProperty('--rs-y', cfg.y + '%');
        container.style.setProperty('--rs-opacity', (config.opacity || 1).toString());

        const clipPath = getShapeClipPath(config.shape);
        RING_ORDER.forEach(key => {
            if (elements[key] && elements[key].shape) {
                if (config.shape === 'circle') {
                    elements[key].shape.style.clipPath = '';
                    elements[key].shape.style.borderRadius = '50%';
                } else {
                    elements[key].shape.style.clipPath = clipPath;
                    elements[key].shape.style.borderRadius = '0';
                }
            }
        });

        if (config.iconStyle === 'emoji' || config.iconStyle === 'svg') config.iconStyle = 'crystal';
        if (!ICON_STYLES.includes(config.iconStyle)) config.iconStyle = 'crystal';
        if (container.getAttribute('data-icon-style') !== config.iconStyle) {
            container.setAttribute('data-icon-style', config.iconStyle);
            paintIcons();   // vivid <-> line icons need different markup
        }

        const allowedLayouts = ['horizontal', 'stacked', 'compact'];
        config.layout = allowedLayouts.includes(String(config.layout || '').toLowerCase()) ? String(config.layout).toLowerCase() : 'horizontal';
        container.setAttribute('data-layout', config.layout);

        RING_ORDER.forEach(key => {
            if (elements[key] && elements[key].wrap) {
                elements[key].wrap.style.transform = `scale(${config.scale || 1})`;
            }
        });

        container.classList.toggle('rs-glow', !!config.glow);
        container.classList.toggle('rs-pulse', !!config.lowPulse);
        container.classList.toggle('rs-fade-full', !!config.fadeWhenFull);
        container.classList.toggle('rs-dynamic', !!config.dynamicColor);

        RING_ORDER.forEach(key => {
            if (elements[key] && elements[key].wrap) {
                if (key === 'oxygen' || key === 'nos') {
                    elements[key].wrap.style.display = conditionalRingVisible(key) ? '' : 'none';
                    return;
                }
                if (config.show && config.show[key] === false) {
                    elements[key].wrap.style.display = 'none';
                } else {
                    elements[key].wrap.style.display = '';
                }
            }
        });

        update(data);
    }

    // Conditional rings. Oxygen appears while swimming; NOS appears when the
    // vehicle actually has nitrous fitted. Either can be pinned on permanently
    // via config.show. NOS presence is inferred from the bridge reporting a
    // level, or an explicit showNos flag when the client sends one.
    function conditionalRingVisible(key) {
        if (config.show && config.show[key] === true) return true;
        if (key === 'oxygen') return data.showOxygen === true;
        if (key === 'nos') {
            if (data.showNos === true) return true;
            if (data.hasNos === true) return true;
            return Number(data.nos || 0) > 0;
        }
        return false;
    }

    function update(newData) {
        if (!initialized) return;
        Object.assign(data, newData || {});

        RING_ORDER.forEach(key => {
            const el = elements[key];
            if (!el) return;

            // Conditional rings manage their own visibility; the rest just
            // respect the config.show toggle.
            if (key === 'oxygen' || key === 'nos') {
                const shouldShow = conditionalRingVisible(key);
                el.wrap.style.display = shouldShow ? '' : 'none';
                if (!shouldShow) return;
            } else {
                if (config.show && config.show[key] === false) return;
            }

            const val = Math.max(0, Math.min(100, data[key] || 0));
            const dashLen = (157 * val) / 100;
            el.fill.setAttribute('stroke-dasharray', `${dashLen} 157`);
            el.value.textContent = Math.round(val);

            if (config.dynamicColor) {
                const dyn = getDynamicColor(val);
                el.fill.setAttribute('stroke', dyn);
                el.wrap.style.color = dyn;
                el.value.style.color = dyn;
            } else {
                const baseColor = config.colors[key];
                el.fill.setAttribute('stroke', baseColor);
                el.wrap.style.color = baseColor;
                el.value.style.color = baseColor;
            }

            const nosThresholdRaw = Number(config.nosLowThreshold);
            const regularThresholdRaw = Number(config.lowThreshold);
            const threshold = key === 'nos'
                ? (Number.isFinite(nosThresholdRaw) ? nosThresholdRaw : 20)
                : (Number.isFinite(regularThresholdRaw) ? regularThresholdRaw : 25);
            const isLow = val <= threshold && val > 0;
            const isFull = val >= 100;
            const isDead = val <= 0;

            el.wrap.classList.toggle('rs-ring-low', isLow);
            el.wrap.classList.toggle('rs-ring-full', isFull);
            el.wrap.classList.toggle('rs-ring-dead', isDead);
        });
    }

    function syncVisibility() {
        if (!container) return;
        container.classList.toggle('hidden', !config.enabled || integratedHidden);
    }

    function setIntegratedHidden(hidden) {
        integratedHidden = hidden === true;
        syncVisibility();
    }

    function handlePayload(payload) {
        if (payload.config) applyConfig(payload.config);
        if (payload.data) update(payload.data);
        if (initialized) syncVisibility();
    }

    function show() { syncVisibility(); }
    function hide() { if (container) container.classList.add('hidden'); }

    return {
        build: build,
        update: update,
        applyConfig: applyConfig,
        handlePayload: handlePayload,
        setIntegratedHidden: setIntegratedHidden,
        show: show,
        hide: hide
    };
})();

window.RSStatus = RSStatus;
