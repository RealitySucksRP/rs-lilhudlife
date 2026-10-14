// ============================================================
// RS-HUDLIFE - BOOT SEQUENCE (v1.1.3)
// Dark spotlight reveal. Transparent over the live game.
// The real vehicle image is the hero, lit by a sweeping spotlight,
// floor pool, reflection, sheen, and a config-driven particle layer.
// ============================================================

const RSBoot = (function() {
    'use strict';

    let bootTimeout = null;
    let closeTimeout = null;
    let speedoFadeTimeout = null;

    // ============================================================
    //  PARTICLE PRESETS
    //  Config.Boot.Particles.Type selects one. Color/Glow override
    //  the palette when set. These render INSIDE the HUD overlay.
    //  (The real exp_grd_grenade_smoke world PTFX is fired in Lua.)
    // ============================================================
    const PRESETS = {
        smoke:  { count: 22, size: [12, 26], color: 'rgba(120,124,132,0.42)', glow: 'rgba(90,94,102,0.25)',  motion: 'smoke', dur: [5, 10],  ty: [-170, -90],  tx: [-34, 34], blur: 5 },
        embers: { count: 22, size: [2, 4],   color: 'rgba(255,170,80,0.95)',  glow: 'rgba(255,120,40,0.8)',  motion: 'rise',  dur: [4, 8],   ty: [-220, -120], tx: [-18, 22], blur: 0 },
        sparks: { count: 26, size: [1, 2.5], color: 'rgba(220,245,255,1)',    glow: 'rgba(143,227,255,0.9)', motion: 'rise',  dur: [1.6, 3.2],ty: [-260, -150], tx: [-30, 30], blur: 0 },
        snow:   { count: 30, size: [2, 5],   color: 'rgba(245,250,255,0.95)', glow: 'rgba(200,225,255,0.5)', motion: 'fall',  dur: [6, 11],  ty: [180, 300],   tx: [-26, 26], blur: 0 },
        dust:   { count: 16, size: [2, 3.5], color: 'rgba(230,240,255,0.7)',  glow: 'rgba(200,220,255,0.4)', motion: 'rise',  dur: [6, 11],  ty: [-180, -90],  tx: [-12, 16], blur: 0 },
        none:   { count: 0 }
    };

    const rnd = (a, b) => a + Math.random() * (b - a);

    // ============================================================
    //  VEHICLE SILHOUETTE FALLBACK
    //  When a vehicle has no bespoke PNG in assets/vehicles/, draw a
    //  clean per-class silhouette so the reveal/HUD always shows art
    //  instead of an empty box. Exposed globally so speedo.js reuses it.
    // ============================================================
    const SILHOUETTES = {
        car: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><path fill="#7fe6ff" d="M8 44 L8 39 Q10 31 20 30 L44 28 Q52 19 66 19 L94 19 Q108 19 116 29 L138 34 Q150 37 150 43 L150 44 Z"/><circle cx="42" cy="45" r="9" fill="#0a1418"/><circle cx="42" cy="45" r="4.4" fill="#7fe6ff"/><circle cx="118" cy="45" r="9" fill="#0a1418"/><circle cx="118" cy="45" r="4.4" fill="#7fe6ff"/></svg>',
        truck: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><path fill="#7fe6ff" d="M8 45 L8 18 L84 18 L84 45 Z"/><path fill="#7fe6ff" d="M84 45 L84 26 L110 26 L128 36 L150 39 L150 45 Z"/><circle cx="44" cy="47" r="9" fill="#0a1418"/><circle cx="44" cy="47" r="4.2" fill="#7fe6ff"/><circle cx="116" cy="47" r="9" fill="#0a1418"/><circle cx="116" cy="47" r="4.2" fill="#7fe6ff"/><circle cx="138" cy="47" r="9" fill="#0a1418"/><circle cx="138" cy="47" r="4.2" fill="#7fe6ff"/></svg>',
        motorcycle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><g fill="none" stroke="#7fe6ff" stroke-width="4" stroke-linecap="round"><circle cx="36" cy="40" r="15"/><circle cx="124" cy="40" r="15"/><path d="M36 40 L72 40 L92 24 L108 24"/><path d="M72 40 L104 40 L124 40"/></g><path fill="#7fe6ff" d="M84 22 L102 22 L100 28 L86 28 Z"/></svg>',
        bicycle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><g fill="none" stroke="#7fe6ff" stroke-width="2.4" stroke-linecap="round"><circle cx="38" cy="42" r="15"/><circle cx="122" cy="42" r="15"/><path d="M38 42 L74 42 L96 22 M74 42 L98 42 L122 42 M96 22 L84 42"/><path d="M88 20 L104 20"/></g></svg>',
        boat: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><path fill="#7fe6ff" d="M16 34 L144 34 L128 50 L34 50 Z"/><path fill="#7fe6ff" d="M80 32 L80 10 L116 30 L80 30 Z"/></svg>',
        helicopter: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><path fill="#7fe6ff" d="M40 44 Q40 30 64 30 L104 30 L130 40 L130 44 Q130 46 128 46 L44 46 Q40 46 40 44 Z"/><rect x="104" y="34" width="46" height="4" fill="#7fe6ff"/><path fill="#7fe6ff" d="M142 24 L150 24 L150 42 L146 42 L146 30 L142 30 Z"/><rect x="28" y="19" width="94" height="3.5" rx="1.5" fill="#7fe6ff"/><rect x="72" y="19" width="4" height="12" fill="#7fe6ff"/><path d="M46 46 L120 46" stroke="#7fe6ff" stroke-width="3" stroke-linecap="round"/></svg>',
        plane: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60"><path fill="#7fe6ff" d="M14 33 Q14 29 24 29 L120 27 Q142 26 152 33 Q142 40 120 39 L24 37 Q14 37 14 33 Z"/><path fill="#7fe6ff" d="M56 31 L88 11 L98 11 L80 31 Z"/><path fill="#7fe6ff" d="M56 35 L88 55 L98 55 L80 35 Z"/><path fill="#7fe6ff" d="M20 31 L30 18 L36 18 L32 31 Z"/></svg>'
    };

    function vehicleSilhouette(classKey) {
        const svg = SILHOUETTES[String(classKey || 'car').toLowerCase()] || SILHOUETTES.car;
        return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
    window.RSVehicleSilhouette = vehicleSilhouette;

    // ============================================================
    //  VEHICLE ART NAME CANDIDATES
    //  Ordered list of file basenames to try in assets/vehicles/.
    //
    //  Only the spawn name used to be tried. That is correct when it resolves,
    //  but GetEntityArchetypeName can answer empty on GTA V Enhanced, and the
    //  GXT display label the code then falls back to is NOT the spawn code for
    //  DLC vehicles. A vehicle whose art is shipped under its real spawn code
    //  therefore rendered as a silhouette -- the reported driftkeitora case.
    //
    //  Each step below only ever widens the search; an exact hit still wins
    //  because it is tried first.
    // ============================================================
    function vehicleArtNames(spawnName, displayName) {
        const out = [];
        const push = (value) => {
            if (!value) return;
            const name = String(value).toLowerCase().replace(/[^a-z0-9_-]/g, '');
            if (name && !out.includes(name)) out.push(name);
        };

        push(spawnName);
        push(displayName);

        // Variant prefixes GTA uses for retrims of an existing model. Falling
        // back to the base car is far better than a generic silhouette.
        for (const base of [spawnName, displayName]) {
            if (!base) continue;
            const lower = String(base).toLowerCase();
            for (const prefix of ['drift', 'pol', 'police', 'sher']) {
                if (lower.startsWith(prefix) && lower.length > prefix.length) {
                    push(lower.slice(prefix.length));
                }
            }
            // Trailing model numbers: 'coquette4' -> 'coquette'.
            push(lower.replace(/\d+$/, ''));
        }

        return out;
    }
    window.RSVehicleArtNames = vehicleArtNames;

    function buildParticles(cfg) {
        const layer = document.getElementById('boot-fx');
        if (!layer) return;
        layer.innerHTML = '';

        cfg = cfg || {};
        if (cfg.Enabled === false) return;

        const type = (cfg.Type || 'smoke').toLowerCase();
        const p = PRESETS[type] || PRESETS.smoke;
        if (!p.count) return;

        const count = cfg.Count || p.count;
        const color = (cfg.Color && cfg.Color !== '') ? cfg.Color : p.color;
        const glow  = (cfg.Glow && cfg.Glow !== '')   ? cfg.Glow  : p.glow;
        const speedMul = (typeof cfg.Speed === 'number' && cfg.Speed > 0) ? cfg.Speed : 1.0;

        for (let i = 0; i < count; i++) {
            const el = document.createElement('div');
            el.className = 'fx fx-' + p.motion;
            const sz = rnd(p.size[0], p.size[1]);
            el.style.width = sz + 'px';
            el.style.height = sz + 'px';
            el.style.background = color;
            if (p.glow) el.style.boxShadow = `0 0 ${sz * 1.6}px ${glow}`;
            if (p.blur) el.style.filter = `blur(${p.blur}px)`;

            // spawn near the floor (rise/smoke) or top (fall), in the light column
            el.style.left = rnd(30, 70) + '%';
            if (p.motion === 'fall') {
                el.style.top = rnd(-10, 30) + 'px';
            } else {
                el.style.bottom = rnd(78, 120) + 'px';
            }

            el.style.setProperty('--o', rnd(0.5, 1).toFixed(2));
            el.style.setProperty('--ty', rnd(p.ty[0], p.ty[1]) + 'px');
            el.style.setProperty('--tx', rnd(p.tx[0], p.tx[1]) + 'px');

            const dur = rnd(p.dur[0], p.dur[1]) * speedMul;
            const delay = rnd(0, dur);
            el.style.animation = `boot-p-${p.motion} ${dur}s linear ${delay}s infinite`;
            layer.appendChild(el);
        }
    }

    // ============================================================
    //  LOAD VEHICLE IMAGE (hero + reflection share the same source)
    //  Tries webp then png by spawn name, then class key, then unknown.
    // ============================================================
    function loadVehicleImage(vehicleData) {
        const imgEl = document.getElementById('boot-vehicle-img');
        const refEl = document.getElementById('boot-vehicle-reflection');
        if (!imgEl) return;

        imgEl.classList.add('hidden-img');
        imgEl.src = '';
        if (refEl) { refEl.classList.add('hidden-img'); refEl.src = ''; }

        imgEl.classList.remove('boot-silhouette');

        const m = (vehicleData.spawnName && typeof vehicleData.spawnName === 'string')
            ? vehicleData.spawnName.toLowerCase() : null;
        const k = (vehicleData.classKey && typeof vehicleData.classKey === 'string')
            ? vehicleData.classKey.toLowerCase() : 'car';

        const tries = [];
        // PNG first: the shipped library is 100% .png, so leading with webp
        // made every vehicle log a failed NUI fetch before falling through.
        // webp is still tried, so dropping webp art in later still works.
        //
        // Names are tried in order of confidence. Only the spawn name was tried
        // before, so any vehicle whose name did not resolve exactly -- notably
        // the LS Car Meet drift models, where GetEntityArchetypeName can answer
        // empty on GTA V Enhanced and the GXT label is used instead -- fell
        // straight through to a silhouette even when its art was shipped.
        const d = (vehicleData.displayName && typeof vehicleData.displayName === 'string')
            ? vehicleData.displayName.toLowerCase() : null;
        for (const name of window.RSVehicleArtNames(m, d)) {
            tries.push(`assets/vehicles/${name}.png`);
            tries.push(`assets/vehicles/${name}.webp`);
        }

        function useSilhouette() {
            imgEl.src = vehicleSilhouette(k);
            imgEl.classList.remove('hidden-img');
            imgEl.classList.add('boot-silhouette');
            if (refEl) { refEl.src = imgEl.src; refEl.classList.remove('hidden-img'); }
        }

        let ti = 0;
        function tryNext() {
            if (ti >= tries.length) { useSilhouette(); return; }
            const t = new Image();
            t.onload = () => {
                imgEl.src = tries[ti];
                imgEl.classList.remove('hidden-img');
                if (refEl) { refEl.src = tries[ti]; refEl.classList.remove('hidden-img'); }
            };
            t.onerror = () => { ti++; tryNext(); };
            t.src = tries[ti];
        }

        if (tries.length) tryNext(); else useSilhouette();
    }

    // ============================================================
    //  RENDER BOOT SEQUENCE
    // ============================================================
    function render(vehicleData, timing, options) {
        const overlay = document.getElementById('boot-overlay');
        if (!overlay) return;
        options = options || {};
        vehicleData = vehicleData || {};

        if (bootTimeout)  { clearTimeout(bootTimeout);  bootTimeout = null; }
        if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
        if (speedoFadeTimeout) { clearTimeout(speedoFadeTimeout); speedoFadeTimeout = null; }
        overlay.classList.remove('closing', 'collapsing', 'play');

        // Scrim strength (0..1) - how much the game dims behind the car
        let scrim = (typeof options.scrim === 'number') ? options.scrim : 0.72;
        scrim = Math.max(0, Math.min(1, scrim));
        overlay.style.setProperty('--boot-scrim', scrim.toFixed(2));

        // Hero image + reflection
        loadVehicleImage(vehicleData);

        // Text
        if (options.showName !== false) {
            const nameEl = document.getElementById('boot-vehicle-name');
            if (nameEl) nameEl.textContent = (vehicleData.name || 'UNKNOWN').toUpperCase();
        }
        const classEl = document.getElementById('boot-class-name');
        if (classEl && options.showClass !== false) {
            classEl.textContent = vehicleData.className || vehicleData.classKey || 'CAR';
        }

        if (options.showStats !== false && vehicleData.stats) {
            const sp = document.getElementById('boot-stat-speed');
            const ac = document.getElementById('boot-stat-accel');
            if (sp) sp.textContent = vehicleData.stats.topSpeed || '---';
            if (ac) ac.textContent = vehicleData.stats.acceleration || '---';
        }

        // Config-driven HUD particles
        buildParticles(options.particles);

        // Play
        overlay.classList.remove('hidden');
        void overlay.offsetWidth; // restart animations
        overlay.classList.add('play');

        // --- Lifecycle (unchanged timing so Lua sound cues stay synced) ---
        const t = timing || {};
        const phase1 = (t.PlatformFadeIn || 400) + (t.RingsPulse || 600);
        const phase2 = phase1 + (t.HologramRise || 800);
        const phase3 = phase2 + (t.HologramHold || 1600);
        const phase4 = phase3 + (t.HologramCollapse || 700);

        bootTimeout = setTimeout(() => {
            overlay.classList.add('collapsing');
        }, phase3);

        closeTimeout = setTimeout(() => {
            overlay.classList.add('closing');
            speedoFadeTimeout = setTimeout(() => {
                speedoFadeTimeout = null;
                overlay.classList.add('hidden');
                overlay.classList.remove('collapsing', 'closing', 'play');
                if (window.RSSpeedo) window.RSSpeedo.show();
            }, Math.max(0, Number(t.SpeedoFadeIn) || 400));
        }, phase4);
    }

    function hide() {
        if (bootTimeout)  { clearTimeout(bootTimeout);  bootTimeout = null; }
        if (closeTimeout) { clearTimeout(closeTimeout); closeTimeout = null; }
        if (speedoFadeTimeout) { clearTimeout(speedoFadeTimeout); speedoFadeTimeout = null; }
        const overlay = document.getElementById('boot-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.classList.remove('collapsing', 'closing', 'play');
        }
    }

    return {
        render: render,
        hide: hide
    };
})();

window.RSBoot = RSBoot;
