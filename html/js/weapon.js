// RS HUDLife weapon hologram v1.4.7 — no global overlay, no game focus, no new deps.
const RSWeapon = (function () {
    'use strict';

    const root = document.getElementById('weapon-container');
    if (!root) return { build() {}, update() {}, applyConfig() {}, setEditorMode() {}, hide() {}, setSuppressed() {} };

    // These are local original silhouettes. ox_inventory art is optional and never required.
    const icons = {
        pistol: '<path d="M11 34 H65 L72 28 H92 L101 36 L85 42 H58 L53 66 L36 68 L32 45 H18 L12 52 H4 V43 Z M22 28 H64 V33 H22Z"/>',
        revolver: '<path d="M8 33 H52 V27 H65 V31 H96 L103 36 L75 42 H57 L49 68 L35 70 L31 46 H12Z M31 23 H48 V31 H31Z"/>',
        smg: '<path d="M7 27 H58 L64 22 H82 L88 31 H104 V40 H82 L73 48 H57 L55 67 H41 L38 45 H30 L28 51 H13 L9 40 H2Z M49 45 H60 V76 H49Z"/>',
        rifle: '<path d="M2 30 L20 25 L32 28 L40 22 H100 L108 29 L116 30 L118 38 L101 41 H81 L70 46 L59 47 L56 65 L46 66 L43 47 H37 L34 42 H29 L26 55 L13 59 L10 45 L2 43Z M59 19 H85 V23 H59Z M32 31 L29 45 L14 50 L13 40Z"/>',
        shotgun: '<path d="M2 32 L25 29 L34 26 H112 L120 31 L114 37 H42 L32 44 L13 47 L8 53 L2 51 L6 40Z M53 21 H99 V25 H53Z M48 38 L46 56 L56 57 L62 40Z"/>',
        sniper: '<path d="M3 32 L25 29 L32 27 H104 L118 30 V35 H70 L62 42 L46 44 L43 58 L32 59 L31 46 L19 48 L10 55 L4 51 L8 41Z M50 19 H82 V23 H50Z M61 15 H69 V19 H61Z M78 41 L84 60 L79 61 L73 43Z"/>',
        mg: '<path d="M2 28 H25 L33 21 H94 L106 28 H119 V36 H89 L75 41 H56 L53 63 H42 L39 43 H26 L23 48 H5Z M60 41 H80 V72 H60Z M88 21 H95 V26 H88Z"/>',
        launcher: '<path d="M4 24 H102 L116 31 L102 38 H4 L0 34 V28Z M21 18 H64 V24 H21Z M41 38 H62 L56 62 H44Z M89 38 H97 L104 56 H95Z"/>',
        heavy: '<path d="M2 25 H113 L120 32 L114 40 H78 L69 47 H53 L47 68 H35 L34 43 H12 L6 52 H2Z M40 19 H86 V25 H40Z"/>',
        melee: '<path d="M10 57 L19 63 L35 45 L44 47 L51 40 L43 32 L36 37 L32 39Z M41 32 L87 2 L112 3 L119 10 L55 42 L49 43Z M13 59 L6 69 L14 76 L24 67Z"/>',
        machete: '<path d="M10 58 L21 66 L32 49 L47 45 L48 38 L38 32 L31 43Z M39 33 L90 5 L116 4 L121 14 L112 23 L53 42Z M13 62 L6 72 L13 78 L23 67Z"/>',
        knife: '<path d="M6 52 L18 62 L29 45 L39 46 L48 36 L38 26 L29 37Z M42 29 L111 5 L119 12 L49 42Z M8 56 L3 64 L15 73 L21 64Z"/>',
        bat: '<path d="M13 65 L22 72 L35 51 L42 46 L93 7 Q113 -2 118 10 Q117 22 101 29 L49 52 L35 60 L24 77Z"/>',
        axe: '<path d="M15 73 L22 78 L88 5 L81 1Z M60 24 L87 5 L113 11 L121 31 L99 43 L76 31Z"/>',
        throwable: '<path d="M45 8 H76 L81 19 H91 V28 H81 C93 38 102 51 99 63 Q94 80 63 80 Q32 80 27 63 C24 50 34 35 44 28 H38 V19 H49Z M51 4 H72 V13 H51Z"/>',
        utility: '<path d="M52 5 H84 V16 H95 V32 H105 V74 H35 V32 H45 V16 H52Z M48 38 H92 V65 H48Z M57 22 H80 V32 H57Z"/>',
        generic: '<path d="M4 30 H92 L109 25 L118 31 L110 38 H66 L56 45 L51 65 H37 L33 45 H20 L11 51 L4 44Z"/>'
    };

    const art = root.querySelector('#weapon-art');
    const fallback = root.querySelector('#weapon-art-fallback');
    const count = root.querySelector('#weapon-clip');
    const reserve = root.querySelector('#weapon-reserve');
    const name = root.querySelector('#weapon-name');
    const ammoType = root.querySelector('#weapon-ammo-type');
    const bullets = root.querySelector('#weapon-bullets');
    const arc = root.querySelector('#weapon-arc-fill');
    const magLabel = root.querySelector('#weapon-mag-label');
    const stateLabel = root.querySelector('#weapon-status');
    const hint = root.querySelector('#weapon-hint');
    const particles = root.querySelector('#weapon-particles');

    const previewSample = { weapon: 'WEAPON_CARBINERIFLE', name: 'CARBINE RIFLE', category: 'rifle',
        mode: 'firearm', ammoType: '5.56MM', clip: 8, reserve: 72, maxClip: 30, state: 'low',
        ammoSource: 'ox_inventory', imageEnabled: false, effects: true, preview: true };
    const stateTitles = { ready: 'READY', low: 'LOW MAG', reload: 'RELOAD', reloading: 'RELOADING',
        reloaded: 'RELOADED', empty: 'NO AMMO', lastmag: 'LAST MAG', melee: 'MELEE',
        throwable: 'READY', utility: 'EQUIPPED' };
    const stateHints = { ready: 'READY TO FIRE', low: 'MAGAZINE LOW', reload: 'PRESS RELOAD',
        reloading: 'LOADING ROUNDS', reloaded: 'MAGAZINE LOADED', empty: 'OUT OF AMMO',
        lastmag: 'NO SPARE ROUNDS', melee: 'CLOSE RANGE', throwable: 'THROWABLE EQUIPPED',
        utility: 'EQUIPMENT READY' };

    let data = null;
    let editorMode = false;
    let suppressed = false;
    let cfg = { enabled: true, x: 3, y: 9, scale: 100, opacity: 95,
        style: 'arc', showAmmoType: true, showReserve: true, useInventoryArt: true };
    let imageName = '';
    let prev = null;
    let lastIcon = '';
    let burstTick = 0;
    let fxTimer = null;
    const reduceMotion = Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function iconFor(d) {
        const w = String(d.weapon || '').toUpperCase();
        if (d.mode === 'melee') {
            if (w.includes('MACHETE')) return 'machete';
            if (/KNIFE|DAGGER|SWITCHBLADE/.test(w)) return 'knife';
            if (/BAT|POOLCUE|GOLFCLUB/.test(w)) return 'bat';
            if (/HATCHET|AXE/.test(w)) return 'axe';
            return 'melee';
        }
        return Object.prototype.hasOwnProperty.call(icons, d.category) ? d.category :
            (d.mode === 'throwable' ? 'throwable' : d.mode === 'utility' ? 'utility' : 'generic');
    }

    function updateImage(d) {
        const key = /^[A-Z0-9_]+$/.test(d.weapon || '') ? d.weapon : '';
        const newName = cfg.useInventoryArt && d.imageEnabled && key ? key : '';
        if (imageName === newName) return;
        imageName = newName;
        art.classList.add('hidden');
        fallback.classList.remove('hidden');
        art.removeAttribute('src');
        if (!newName) return;
        art.onload = () => {
            if (imageName === newName && art.naturalWidth > 0) {
                art.classList.remove('hidden');
                fallback.classList.add('hidden');
            }
        };
        art.onerror = () => {
            if (imageName === newName) {
                art.classList.add('hidden');
                fallback.classList.remove('hidden');
            }
        };
        art.src = `https://cfx-nui-ox_inventory/web/images/${newName}.png`;
    }

    // Particles are capped and clipped within this HUD panel; no full-screen canvas.
    function burst(kind, amount = 5) {
        if (reduceMotion || !data || data.effects === false) return;
        const now = performance.now();
        if (now - burstTick < 95) return;
        burstTick = now;
        const max = Math.min(amount, 10);
        for (let i = 0; i < max; i++) {
            const p = document.createElement('i');
            p.className = 'rsw-particle rsw-particle-' + kind;
            p.style.setProperty('--x', `${20 + Math.random() * 48}%`);
            p.style.setProperty('--y', `${25 + Math.random() * 52}%`);
            p.style.setProperty('--dx', `${Math.round((Math.random() - .5) * 100)}px`);
            p.style.setProperty('--dy', `${Math.round(-18 - Math.random() * 49)}px`);
            p.style.setProperty('--dz', `${Math.round(12 + Math.random() * 40)}px`);
            p.style.setProperty('--delay', `${Math.round(Math.random() * 100)}ms`);
            particles.appendChild(p);
            p.addEventListener('animationend', () => p.remove(), { once: true });
        }
        while (particles.children.length > 26) particles.firstElementChild.remove();
    }

    function showFlash(kind) {
        if (!data || data.effects === false || reduceMotion) return;
        root.classList.remove('rsw-hit', 'rsw-swap', 'rsw-load');
        void root.offsetWidth;
        root.classList.add('rsw-' + kind);
        clearTimeout(fxTimer);
        fxTimer = setTimeout(() => root.classList.remove('rsw-' + kind), 510);
    }

    function onTransition(next) {
        if (!prev) { prev = { ...next }; return; }
        const weaponChanged = prev.weapon !== next.weapon;
        if (weaponChanged) { burst('swap', 8); showFlash('swap'); }
        else if (next.state === 'reloaded' && prev.state !== 'reloaded') {
            burst('reload', 9); showFlash('load');
        } else if (next.state === 'reloading' && prev.state !== 'reloading') {
            burst('reload', 5); showFlash('load');
        } else if (next.mode === 'firearm' && Number(next.clip) < Number(prev.clip)) {
            burst('shot', 3); showFlash('hit');
        } else if (next.mode === 'firearm' && Number(next.clip) > Number(prev.clip)) {
            burst('reload', 7); showFlash('load');
        }
        prev = { ...next };
    }

    function render() {
        const d = data || (editorMode ? previewSample : null);
        root.classList.toggle('hidden', suppressed || !cfg.enabled || !d);
        if (!d || suppressed || !cfg.enabled) return;
        const clip = Math.max(0, Math.floor(Number(d.clip) || 0));
        const spare = Math.max(0, Math.floor(Number(d.reserve) || 0));
        const max = Math.max(1, Math.floor(Number(d.maxClip) || clip || 1));
        const mode = ['melee', 'utility', 'throwable'].includes(d.mode) ? d.mode : 'firearm';
        const state = stateTitles[d.state] ? d.state : 'ready';
        const noMagazine = mode === 'melee' || mode === 'utility';
        root.dataset.mode = mode;
        root.dataset.state = state;
        root.dataset.preview = d.preview ? '1' : '0';
        root.dataset.ammoSource = d.ammoSource === 'ox_inventory' ? 'inventory' : 'native';
        root.dataset.effects = d.effects !== false && !reduceMotion ? '1' : '0';
        count.textContent = noMagazine ? '—' : String(clip);
        reserve.textContent = noMagazine || mode === 'throwable' ? '—' : String(spare);
        name.textContent = String(d.name || d.weapon || 'WEAPON').slice(0, 45);
        ammoType.textContent = String(d.ammoType || 'AMMO').slice(0, 26);
        magLabel.textContent = mode === 'melee' ? 'EQUIPPED' : mode === 'utility' ? 'EQUIPMENT' : mode === 'throwable' ? 'COUNT' : 'IN MAG';
        stateLabel.textContent = stateTitles[state];
        hint.textContent = stateHints[state];
        const icon = iconFor(d);
        if (icon !== lastIcon) {
            lastIcon = icon;
            fallback.innerHTML = `<svg viewBox="0 0 122 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${icon} silhouette"><g fill="currentColor">${icons[icon]}</g></svg>`;
        }
        updateImage(d);
        const pct = noMagazine ? 1 : Math.min(1, clip / max);
        arc.style.strokeDasharray = `${(pct * 100).toFixed(1)} 100`;
        bullets.replaceChildren();
        if (!noMagazine) {
            const marks = Math.min(30, max);
            const lit = Math.round(marks * pct);
            const fragment = document.createDocumentFragment();
            for (let i = 0; i < marks; i++) {
                const b = document.createElement('i');
                if (i >= lit) b.className = 'spent';
                fragment.appendChild(b);
            }
            bullets.appendChild(fragment);
        }
    }

    function applyConfig(update) {
        cfg = Object.assign({}, cfg, update || {});
        cfg.x = Math.min(95, Math.max(0, Number(cfg.x) || 0));
        cfg.y = Math.min(95, Math.max(0, Number(cfg.y) || 0));
        cfg.scale = Math.min(140, Math.max(65, Number(cfg.scale) || 100));
        cfg.opacity = Math.min(100, Math.max(20, Number(cfg.opacity) || 95));
        root.style.right = `${cfg.x}%`;
        root.style.bottom = `${cfg.y}%`;
        root.style.transform = `scale(${cfg.scale / 100})`;
        root.style.opacity = String(cfg.opacity / 100);
        root.dataset.style = ['arc', 'minimal'].includes(cfg.style) ? cfg.style : 'arc';
        root.dataset.showAmmoType = cfg.showAmmoType === false ? '0' : '1';
        root.dataset.showReserve = cfg.showReserve === false ? '0' : '1';
        render();
    }

    function hide() {
        data = null;
        prev = null;
        imageName = '';
        lastIcon = '';
        root.classList.remove('rsw-hit', 'rsw-swap', 'rsw-load');
        clearTimeout(fxTimer);
        particles.replaceChildren();
        art.classList.add('hidden');
        fallback.classList.remove('hidden');
        art.removeAttribute('src');
        render();
    }
    function setSuppressed(yes) { suppressed = !!yes; render(); }
    function setEditorMode(yes) { editorMode = !!yes; render(); }
    function update(next) {
        if (!next || next.visible === false) { hide(); return; }
        data = { ...next };
        onTransition(data);
        render();
    }
    return { build: render, update, hide, applyConfig, setEditorMode, setSuppressed };
})();
window.RSWeapon = RSWeapon;
