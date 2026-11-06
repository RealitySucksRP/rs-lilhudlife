// RS HUDLife - compact weapon and magazine display.
// Runs entirely inside the existing transparent NUI page.
const RSWeapon = (function () {
    'use strict';

    const root = document.getElementById('weapon-container');
    if (!root) return { build() {}, update() {}, applyConfig() {}, setEditorMode() {}, hide() {} };

    const icons = {
        // Local original SVG silhouettes (no external asset required).
        pistol: '<path d="M11 34 H65 L72 28 H92 L101 36 L85 42 H58 L53 66 L36 68 L32 45 H18 L12 52 H4 V43 Z M22 28 H64 V33 H22Z"/>',
        revolver: '<path d="M8 33 H52 V27 H65 V31 H96 L103 36 L75 42 H57 L49 68 L35 70 L31 46 H12Z M31 23 H48 V31 H31Z"/>',
        smg: '<path d="M7 27 H58 L64 22 H82 L88 31 H104 V40 H82 L73 48 H57 L55 67 H41 L38 45 H30 L28 51 H13 L9 40 H2Z M49 45 H60 V76 H49Z"/>',
        rifle: '<path d="M2 30 L20 25 L32 28 L40 22 H100 L108 29 L116 30 L118 38 L101 41 H81 L70 46 L59 47 L56 65 L46 66 L43 47 H37 L34 42 H29 L26 55 L13 59 L10 45 L2 43Z M59 19 H85 V23 H59Z M32 31 L29 45 L14 50 L13 40Z"/>',
        shotgun: '<path d="M2 32 L25 29 L34 26 H112 L120 31 L114 37 H42 L32 44 L13 47 L8 53 L2 51 L6 40Z M53 21 H99 V25 H53Z M48 38 L46 56 L56 57 L62 40Z"/>',
        sniper: '<path d="M3 32 L25 29 L32 27 H104 L118 30 V35 H70 L62 42 L46 44 L43 58 L32 59 L31 46 L19 48 L10 55 L4 51 L8 41Z M50 19 H82 V23 H50Z M61 15 H69 V19 H61Z M78 41 L84 60 L79 61 L73 43Z"/>',
        mg: '<path d="M2 28 H25 L33 21 H94 L106 28 H119 V36 H89 L75 41 H56 L53 63 H42 L39 43 H26 L23 48 H5Z M60 41 H80 V72 H60Z M88 21 H95 V26 H88Z"/>',
        launcher: '<path d="M4 24 H102 L116 31 L102 38 H4 L0 34 V28Z M21 18 H64 V24 H21Z M41 38 H62 L56 62 H44Z M89 38 H97 L104 56 H95Z"/>',
        heavy: '<path d="M2 25 H113 L120 32 L114 40 H78 L69 47 H53 L47 68 H35 L34 43 H12 L6 52 H2Z M40 19 H86 V25 H40Z"/>',
        generic: '<path d="M4 30 H92 L109 25 L118 31 L110 38 H66 L56 45 L51 65 H37 L33 45 H20 L11 51 L4 44Z"/>'
    };

    let data = null;
    let editorMode = false;
    let suppressed = false;
    let cfg = { enabled: true, x: 3, y: 9, scale: 100, opacity: 95, style: 'arc', showAmmoType: true, showReserve: true, useInventoryArt: true };
    let imageName = '';
    const sample = { weapon: 'WEAPON_CARBINERIFLE', name: 'CARBINE RIFLE', category: 'rifle', ammoType: 'RIFLE AMMO', clip: 30, reserve: 19, maxClip: 30, imageEnabled: false, preview: true };
    const art = root.querySelector('#weapon-art');
    const fallback = root.querySelector('#weapon-art-fallback');
    const count = root.querySelector('#weapon-clip');
    const reserve = root.querySelector('#weapon-reserve');
    const name = root.querySelector('#weapon-name');
    const ammoType = root.querySelector('#weapon-ammo-type');
    const bullets = root.querySelector('#weapon-bullets');
    const arc = root.querySelector('#weapon-arc-fill');

    // Set the weapon art from the optional player's inventory, but never rely
    // on it: local SVG silhouettes are always available for missing pictures.
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

    function render() {
        const d = data || (editorMode ? sample : null);
        root.classList.toggle('hidden', suppressed || !cfg.enabled || !d);
        if (!d || suppressed || !cfg.enabled) return;
        const clip = Math.max(0, Math.floor(Number(d.clip) || 0));
        const spare = Math.max(0, Math.floor(Number(d.reserve) || 0));
        const max = Math.max(1, Math.floor(Number(d.maxClip) || clip || 1));
        const category = Object.prototype.hasOwnProperty.call(icons, d.category) ? d.category : 'generic';
        count.textContent = String(clip);
        reserve.textContent = String(spare);
        name.textContent = (d.name || d.weapon || 'WEAPON').slice(0, 34);
        ammoType.textContent = (d.ammoType || 'AMMO').slice(0, 24);
        root.dataset.empty = clip === 0 ? '1' : '0';
        root.dataset.preview = d.preview ? '1' : '0';
        fallback.innerHTML = `<svg viewBox="0 0 122 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${category} silhouette"><g fill="currentColor">${icons[category]}</g></svg>`;
        updateImage(d);
        const pct = Math.min(1, clip / max);
        arc.style.strokeDasharray = `${(pct * 100).toFixed(1)} 100`;
        bullets.innerHTML = '';
        const total = Math.min(30, max);
        const lit = Math.round(total * pct);
        for (let i = 0; i < total; i++) {
            const b = document.createElement('i');
            if (i >= lit) b.className = 'spent';
            bullets.appendChild(b);
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
        root.dataset.style = ['arc','minimal'].includes(cfg.style) ? cfg.style : 'arc';
        root.dataset.showAmmoType = cfg.showAmmoType === false ? '0' : '1';
        root.dataset.showReserve = cfg.showReserve === false ? '0' : '1';
        render();
    }

    function hide() { data = null; imageName = ''; art.classList.add('hidden'); fallback.classList.remove('hidden'); render(); }
    function setSuppressed(yes) { suppressed = !!yes; render(); }
    function setEditorMode(yes) { editorMode = !!yes; render(); }
    function update(next) {
        if (!next || next.visible === false) { hide(); return; }
        data = Object.assign({}, next);
        render();
    }
    return { build: render, update, hide, applyConfig, setEditorMode, setSuppressed };
})();
window.RSWeapon = RSWeapon;
