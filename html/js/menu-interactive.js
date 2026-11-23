/* RS HUDLife 1.4.9 — effects only within an open control deck.
   No NUI callbacks, gameplay input, HUD overlays or action interceptions. */
(() => {
    'use strict';
    const overlay = document.getElementById('menu-overlay');
    const shell = overlay && overlay.querySelector('.menu-container.zmenu-shell');
    if (!overlay || !shell) return;

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    const active = () => !overlay.classList.contains('hidden') &&
        !document.documentElement.classList.contains('rs-hud-suppressed') &&
        !document.hidden && !(reduceMotion && reduceMotion.matches);
    const quality = () => overlay.dataset.fx || 'standard';
    const depth = () => overlay.dataset.depth || 'medium';

    // Keep menu-only sparks in sync with selected primary/secondary palette.
    let particlePrimary = '#5feaff';
    let particleSecondary = '#ff6cce';
    const refreshParticleColors = () => {
        const css = getComputedStyle(overlay);
        particlePrimary = css.getPropertyValue('--rs-menu-primary').trim() || '#5feaff';
        particleSecondary = css.getPropertyValue('--rs-menu-secondary').trim() || '#ff6cce';
    };
    new MutationObserver(refreshParticleColors).observe(overlay, {
        attributes: true, attributeFilter: ['style']
    });
    refreshParticleColors();

    const canvas = document.createElement('canvas');
    canvas.className = 'rs-hud-fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'none';
    shell.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) { canvas.remove(); return; }
    const particles = [];
    const cap = 64;
    let w = 1, h = 1, dpr = 1, raf = 0, previous = 0, lastAmbient = 0, lastHover = 0;
    let hoverCard = null;

    const resize = () => {
        if (!active()) return;
        w = Math.max(1, canvas.clientWidth);
        h = Math.max(1, canvas.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        const iw = Math.round(w * dpr), ih = Math.round(h * dpr);
        if (canvas.width !== iw || canvas.height !== ih) {
            canvas.width = iw; canvas.height = ih;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const point = e => {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (w / Math.max(1, rect.width)),
            y: (e.clientY - rect.top) * (h / Math.max(1, rect.height))
        };
    };
    const add = (x, y, amount, ambient = false) => {
        for (let i = 0; i < amount && particles.length < cap; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = ambient ? .23 + Math.random() * .28 : .55 + Math.random() * 1.35;
            const ttl = ambient ? 1200 + Math.random() * 1400 : 380 + Math.random() * 380;
            particles.push({
                x, y, vx: Math.cos(angle) * speed * (ambient ? .28 : 1),
                vy: ambient ? -.28 - Math.random() * .35 : Math.sin(angle) * speed - .25,
                life: ttl, maxLife: ttl, r: ambient ? .4 + Math.random() * .8 : .9 + Math.random() * 1.1,
                pink: Math.random() > .68, ambient
            });
        }
        start();
    };
    function stop() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        particles.length = 0;
        previous = 0; lastAmbient = 0;
        ctx.clearRect(0, 0, w, h);
        canvas.style.display = 'none';
        if (hoverCard) resetCard(hoverCard);
        hoverCard = null;
    }
    const start = () => {
        if (!active() || quality() === 'off') return;
        if (!raf) { canvas.style.display = ''; resize(); raf = requestAnimationFrame(tick); }
    };
    function tick(now) {
        raf = 0;
        if (!active() || quality() === 'off') { stop(); return; }
        if (canvas.clientWidth !== w || canvas.clientHeight !== h) resize();
        const dt = Math.min(34, previous ? now - previous : 16);
        previous = now;
        if (quality() === 'high' && now - lastAmbient > 110 && particles.length < 32) {
            lastAmbient = now;
            add(Math.random() * w, h * (.15 + Math.random() * .80), 1, true);
        }
        ctx.clearRect(0, 0, w, h);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.x += p.vx * dt / 16;
            p.y += p.vy * dt / 16;
            ctx.globalAlpha = Math.max(0, Math.min(.76, p.life / p.maxLife * (p.ambient ? .28 : .83)));
            ctx.fillStyle = p.pink ? particleSecondary : particlePrimary;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (particles.length || quality() === 'high') raf = requestAnimationFrame(tick);
    }
    function resetCard(card) {
        if (!card) return;
        card.style.removeProperty('--rshud-tilt-x');
        card.style.removeProperty('--rshud-tilt-y');
        card.style.removeProperty('--rshud-glow-x');
        card.style.removeProperty('--rshud-glow-y');
    }
    const cardSelector = '.menu-section:not(.z11-map-card)';
    shell.addEventListener('pointerover', e => {
        if (!active() || e.pointerType === 'touch') return;
        const card = e.target.closest(cardSelector);
        if (!card || hoverCard === card || card.contains(e.relatedTarget)) return;
        if (hoverCard) resetCard(hoverCard);
        hoverCard = card;
        if (quality() === 'standard' || quality() === 'high') {
            const now = performance.now();
            if (now - lastHover > 145) {
                lastHover = now;
                const p = point(e);
                add(p.x, p.y, quality() === 'high' ? 6 : 4);
            }
        }
    }, { passive: true });
    shell.addEventListener('pointerout', e => {
        if (hoverCard && !hoverCard.contains(e.relatedTarget)) {
            resetCard(hoverCard);
            hoverCard = null;
        }
    }, { passive: true });
    shell.addEventListener('pointermove', e => {
        if (!active() || e.pointerType === 'touch') return;
        const card = e.target.closest(cardSelector);
        if (!card || depth() === 'off') return;
        // Do not shift a slider or HUD-position editor while the player drags it.
        if (e.buttons || e.target.closest('input[type="range"], .zmap, .zmap-chip')) {
            resetCard(card);
            return;
        }
        const rect = card.getBoundingClientRect();
        const dx = Math.max(-1, Math.min(1, (e.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1));
        const dy = Math.max(-1, Math.min(1, (e.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1));
        const amount = depth() === 'high' ? 2.7 : 1.35;
        card.style.setProperty('--rshud-tilt-x', `${(-dy * amount).toFixed(2)}deg`);
        card.style.setProperty('--rshud-tilt-y', `${(dx * amount).toFixed(2)}deg`);
        card.style.setProperty('--rshud-glow-x', `${((dx + 1) * 50).toFixed(1)}%`);
        card.style.setProperty('--rshud-glow-y', `${((dy + 1) * 50).toFixed(1)}%`);
    }, { passive: true });
    shell.addEventListener('pointerdown', e => {
        if (!active() || e.button !== 0 || quality() === 'off') return;
        const btn = e.target.closest('button');
        if (!btn || btn.disabled || !shell.contains(btn) || btn.closest('.zmap')) return;
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'rs-hud-click-ring';
        ripple.setAttribute('aria-hidden', 'true');
        // account for the menu's author-configured zoom value
        const sx = (btn.clientWidth || rect.width) / Math.max(rect.width, 1);
        const sy = (btn.clientHeight || rect.height) / Math.max(rect.height, 1);
        ripple.style.setProperty('--rshud-click-x', `${(e.clientX - rect.left) * sx}px`);
        ripple.style.setProperty('--rshud-click-y', `${(e.clientY - rect.top) * sy}px`);
        btn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
        setTimeout(() => ripple.remove(), 550);
        const n = quality() === 'low' ? 2 : quality() === 'high' ? 11 : 7;
        const p = point(e);
        add(p.x, p.y, n);
    }, { passive: true });
    const sync = () => {
        if (!active() || quality() === 'off') { stop(); return; }
        resize();
        if (quality() === 'high') start();
        else if (!raf && !particles.length) canvas.style.display = 'none';
    };
    new MutationObserver(sync).observe(overlay, {
        attributes: true, attributeFilter: ['class', 'data-fx', 'data-depth']
    });
    new MutationObserver(sync).observe(document.documentElement, {
        attributes: true, attributeFilter: ['class']
    });
    window.addEventListener('resize', sync, { passive: true });
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', sync);
    if (reduceMotion) {
        if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', sync);
        else if (reduceMotion.addListener) reduceMotion.addListener(sync);
    }
    sync();
})();
