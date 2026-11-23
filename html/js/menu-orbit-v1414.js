/* RS HUDLife 1.4.14 - local menu-only enhancements; no game/NUI endpoints. */
(() => {
    'use strict';
    const overlay = document.getElementById('menu-overlay');
    const shell = overlay && overlay.querySelector('.z11-shell');
    const orbit = document.getElementById('menu-orbit');
    const orbitToggle = document.getElementById('menu-orbit-toggle');
    const orbitItems = document.getElementById('rs-orbit-items');
    const preview = document.querySelector('#menu-overlay .z11-live-card');
    const previewRail = document.querySelector('#menu-overlay .z11-right');
    const floatButton = document.getElementById('rs-preview-float');
    const collapseButton = document.getElementById('rs-preview-collapse');
    const dragHandle = document.getElementById('rs-preview-drag');
    if (!overlay || !shell || !orbit || !orbitToggle || !orbitItems || !preview || !previewRail) return;
    const tabButtons = [...overlay.querySelectorAll('.z11-sidebar .menu-nav-btn[data-tab]')];
    if (!tabButtons.length) return;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const isOpen = () => !overlay.classList.contains('hidden') &&
        !document.documentElement.classList.contains('rs-hud-suppressed');
    const orbitIsOpen = () => !orbit.hidden;
    let orbitIndex = 0;
    let ignoreEscapeKeyup = false;

    // Each radial item delegates to its existing sidebar button: no duplicate
    // settings engine, callbacks, and no script-specific menu navigation path.
    const radialButtons = tabButtons.map((source, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / tabButtons.length;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rs-orbit-item';
        button.dataset.tab = source.dataset.tab;
        button.style.setProperty('--orbit-x', `${(190 + 148 * Math.cos(angle)).toFixed(1)}px`);
        button.style.setProperty('--orbit-y', `${(190 + 148 * Math.sin(angle)).toFixed(1)}px`);
        const icon = document.createElement('span');
        icon.className = 'rs-orbit-item-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = source.querySelector('.menu-nav-icon')?.textContent || '◎';
        const label = document.createElement('span');
        label.className = 'rs-orbit-item-label';
        label.textContent = source.querySelector('.znav-text b')?.textContent || source.dataset.tab;
        button.setAttribute('aria-label', `Open ${label.textContent}`);
        button.append(icon, label);
        button.addEventListener('focus', () => { orbitIndex = index; updateRadialSelection(); });
        button.addEventListener('click', () => {
            source.click();
            closeOrbit(false);
            source.focus({ preventScroll: true });
        });
        orbitItems.append(button);
        return button;
    });

    function updateRadialSelection() {
        radialButtons.forEach((button, i) => button.setAttribute('aria-current', String(i === orbitIndex)));
    }
    function closeOrbit(restoreFocus = true) {
        if (!orbitIsOpen()) return;
        orbit.hidden = true;
        orbit.setAttribute('aria-hidden', 'true');
        orbitToggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus && isOpen()) orbitToggle.focus({ preventScroll: true });
    }
    function openOrbit() {
        if (!isOpen()) return;
        orbitIndex = Math.max(0, tabButtons.findIndex(btn => btn.classList.contains('active')));
        orbit.hidden = false;
        orbit.setAttribute('aria-hidden', 'false');
        orbitToggle.setAttribute('aria-expanded', 'true');
        updateRadialSelection();
        radialButtons[orbitIndex].focus({ preventScroll: true });
    }
    orbitToggle.addEventListener('click', () => orbitIsOpen() ? closeOrbit() : openOrbit());
    orbit.querySelector('.rs-orbit-scrim')?.addEventListener('click', () => closeOrbit());
    orbit.querySelector('.rs-orbit-dismiss')?.addEventListener('click', () => closeOrbit());

    // Capture Escape before menu.js's keyup-close handler only while this modal
    // is open. Otherwise Escape retains HUDLife's established close behavior.
    document.addEventListener('keydown', (event) => {
        if (!isOpen()) return;
        if (orbitIsOpen()) {
            const key = event.key;
            if (key === 'Escape') {
                ignoreEscapeKeyup = true;
                event.preventDefault(); event.stopImmediatePropagation(); closeOrbit(); return;
            }
            if (['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].includes(key)) {
                orbitIndex = (orbitIndex + (key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1) + radialButtons.length) % radialButtons.length;
                updateRadialSelection(); radialButtons[orbitIndex].focus({ preventScroll: true });
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
            if (key === 'Enter' || key === ' ') {
                const focused = document.activeElement;
                if (focused === orbitToggle || focused === orbit.querySelector('.rs-orbit-dismiss')) return;
                radialButtons[orbitIndex].click(); event.preventDefault(); event.stopImmediatePropagation(); return;
            }
            if (key === 'Tab') {
                orbitIndex = (orbitIndex + (event.shiftKey ? -1 : 1) + radialButtons.length) % radialButtons.length;
                updateRadialSelection(); radialButtons[orbitIndex].focus({ preventScroll: true });
                event.preventDefault(); event.stopImmediatePropagation(); return;
            }
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault(); event.stopImmediatePropagation(); openOrbit(); return;
        }
        // Keyboard repositioning is allowed only for a deliberately detached
        // preview and only while its accessible title bar is focused.
        if (preview.classList.contains('rs-preview-floating') &&
            event.altKey && ['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key) &&
            (document.activeElement === dragHandle || dragHandle.contains(document.activeElement))) {
            const dx = (event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0);
            const dy = (event.key === 'ArrowDown' ? 16 : event.key === 'ArrowUp' ? -16 : 0);
            movePreview(previewX + dx, previewY + dy);
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);
    document.addEventListener('keyup', (event) => {
        if (event.key !== 'Escape') return;
        if (ignoreEscapeKeyup || orbitIsOpen()) {
            ignoreEscapeKeyup = false;
            if (orbitIsOpen()) closeOrbit();
            event.preventDefault(); event.stopImmediatePropagation();
        }
    }, true);

    // Detach the existing preview card itself: its DOM IDs and all live data
    // update targets stay the same. A native placeholder returns it to the rail.
    let placeholder = null;
    let previewX = 0;
    let previewY = 0;
    let dragging = null;
    function scale() { const r = shell.getBoundingClientRect(); return r.width / Math.max(shell.offsetWidth, 1) || 1; }
    function movePreview(x, y) {
        const width = preview.offsetWidth || 318;
        const height = preview.offsetHeight || 220;
        previewX = clamp(x, 8, shell.clientWidth - width - 8);
        previewY = clamp(y, 64, shell.clientHeight - height - 54);
        preview.style.setProperty('--rs-preview-x', `${Math.round(previewX)}px`);
        preview.style.setProperty('--rs-preview-y', `${Math.round(previewY)}px`);
    }
    function dockPreview() {
        if (dragging) dragging = null;
        if (placeholder) {
            placeholder.replaceWith(preview);
            placeholder = null;
        }
        preview.classList.remove('rs-preview-floating', 'rs-is-dragging');
        floatButton.setAttribute('aria-pressed', 'false');
        floatButton.setAttribute('aria-label', 'Float preview');
        floatButton.title = 'Float preview';
        floatButton.textContent = '⤢';
        previewRail.classList.toggle('rs-preview-docked-minimized', preview.classList.contains('rs-preview-collapsed'));
    }
    function floatPreview() {
        if (!isOpen() || placeholder) return;
        const bounds = preview.getBoundingClientRect();
        const shellBounds = shell.getBoundingClientRect();
        const factor = scale();
        placeholder = document.createElement('button');
        placeholder.type = 'button';
        placeholder.className = 'rs-window-placeholder';
        placeholder.textContent = '↙ DOCK LIVE WORKSPACE';
        placeholder.addEventListener('click', dockPreview);
        preview.replaceWith(placeholder);
        shell.append(preview);
        previewRail.classList.remove('rs-preview-docked-minimized');
        preview.classList.add('rs-preview-floating');
        floatButton.setAttribute('aria-pressed', 'true');
        floatButton.setAttribute('aria-label', 'Dock preview');
        floatButton.title = 'Dock preview';
        floatButton.textContent = '↙';
        movePreview((bounds.left - shellBounds.left) / factor, (bounds.top - shellBounds.top) / factor);
    }
    floatButton.addEventListener('click', () => placeholder ? dockPreview() : floatPreview());

    function setCollapsed(collapsed) {
        preview.classList.toggle('rs-preview-collapsed', collapsed);
        previewRail.classList.toggle('rs-preview-docked-minimized', collapsed && !placeholder);
        collapseButton.setAttribute('aria-expanded', String(!collapsed));
        collapseButton.setAttribute('aria-label', collapsed ? 'Restore preview' : 'Minimize preview');
        collapseButton.title = collapsed ? 'Restore preview' : 'Minimize preview';
        collapseButton.textContent = collapsed ? '+' : '−';
        if (placeholder) movePreview(previewX, previewY);
    }
    collapseButton.addEventListener('click', () => setCollapsed(!preview.classList.contains('rs-preview-collapsed')));
    dragHandle.setAttribute('tabindex', '0');
    dragHandle.setAttribute('role', 'group');
    dragHandle.setAttribute('aria-label', 'Live workspace title bar; float to drag; Alt plus arrow keys to reposition');
    dragHandle.addEventListener('pointerdown', (event) => {
        if (!placeholder || event.button !== 0 || event.target.closest('button')) return;
        dragging = { id:event.pointerId, x:event.clientX, y:event.clientY, left:previewX, top:previewY };
        preview.classList.add('rs-is-dragging');
        try { dragHandle.setPointerCapture(event.pointerId); } catch (_) { /* best effort */ }
        event.preventDefault();
    });
    dragHandle.addEventListener('pointermove', (event) => {
        if (!dragging || dragging.id !== event.pointerId) return;
        const factor = scale();
        movePreview(dragging.left + (event.clientX - dragging.x) / factor,
                    dragging.top + (event.clientY - dragging.y) / factor);
    });
    const endPreviewDrag = () => { dragging = null; preview.classList.remove('rs-is-dragging'); };
    dragHandle.addEventListener('pointerup', endPreviewDrag);
    dragHandle.addEventListener('pointercancel', endPreviewDrag);
    window.addEventListener('blur', endPreviewDrag);
    window.addEventListener('resize', () => { if (placeholder) movePreview(previewX, previewY); });

    // Optional collapsible settings cards. Original content remains in place,
    // so ids, listeners, input values and native change events are preserved.
    overlay.querySelectorAll('.z11-tab > .menu-section').forEach(card => {
        const title = [...card.children].find(child => child.classList.contains('menu-section-title'));
        if (!title || card.children.length < 3) return;
        const label = title.textContent.trim();
        const fold = document.createElement('button');
        fold.className = 'rs-card-fold'; fold.type = 'button';
        fold.textContent = '−';
        fold.setAttribute('aria-label', `Collapse ${label}`);
        fold.setAttribute('aria-expanded', 'true');
        fold.addEventListener('click', () => {
            const collapsed = card.classList.toggle('rs-folded');
            fold.textContent = collapsed ? '+' : '−';
            fold.setAttribute('aria-expanded', String(!collapsed));
            fold.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${label}`);
        });
        card.classList.add('rs-can-fold');
        card.append(fold);
    });

    // Paint the native sliders from their own current min/max/value. We never
    // mutate a slider value or call gameplay endpoints here.
    const sliders = [...overlay.querySelectorAll('input.menu-slider[type="range"]')];
    function refreshSliders() {
        sliders.forEach(el => {
            const low = Number(el.min) || 0;
            const high = Number(el.max) || 100;
            const pct = clamp((Number(el.value) - low) / Math.max(high - low, 1) * 100, 0, 100);
            el.style.setProperty('--rs-slider-pct', `${pct.toFixed(1)}%`);
        });
    }
    overlay.addEventListener('input', refreshSliders, { passive:true });
    overlay.addEventListener('change', refreshSliders, { passive:true });
    overlay.addEventListener('click', () => setTimeout(refreshSliders, 0), { passive:true });
    refreshSliders();

    // Menu teardown: floating windows never survive into gameplay or hijack
    // focus on the next open; existing menu.js handles NUI focus itself.
    new MutationObserver(() => {
        if (!isOpen()) {
            closeOrbit(false);
            dockPreview();
            setCollapsed(false);
        } else {
            refreshSliders();
        }
    }).observe(overlay, { attributes:true, attributeFilter:['class'] });
})();
