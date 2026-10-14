/*
 * RS UI scale — GTA V Enhanced
 * ---------------------------------------------------------------------------
 * Legacy rendered NUI into a virtual 1920x1080 surface and upscaled it, so a
 * fixed-pixel layout looked identical at any resolution. Enhanced renders NUI
 * at the client's native resolution, so the same layout shrinks: ~75% at
 * 1440p, ~50% at 4K.
 *
 * IMPORTANT — why this file is not applied to every UI:
 *
 *   CSS `zoom` scales viewport units too. Measured in Chromium: at zoom 2 a
 *   50vw element goes 960px -> 1920px, exactly like a px value. Viewport units
 *   are NOT renormalised. So on a layout that is driven by vw/vh — which is
 *   already correct at any resolution — zoom doubles it and breaks it.
 *
 *   This shim is therefore only wired into UIs whose sizing is overwhelmingly
 *   fixed-px (see RS_ENHANCED_NOTES.md). Viewport-driven UIs are left alone
 *   because they already scale correctly on Enhanced.
 *
 * `zoom` is used rather than `transform: scale()` because zoom participates in
 * layout, so element boxes, hit testing and scrolling stay correct.
 *
 * Tuning: set window.RS_UISCALE_MAX before this script loads to change the
 * ceiling, or window.RS_UISCALE_FORCE to pin an exact factor.
 */
(function () {
    'use strict';

    var DESIGN_W = 1920;
    var DESIGN_H = 1080;

    // Never shrink below the authored size.
    var MIN_SCALE = 1.0;

    // Ceiling. A 1920-authored UI at 4K would mathematically want 2.0, but in
    // practice that reads as oversized because these layouts were drawn with
    // generous padding to begin with. 1.5 recovers most of the loss without
    // overshooting; raise it if the UI still feels small on your display.
    var MAX_SCALE = 1.5;

    function computeScale() {
        if (typeof window.RS_UISCALE_FORCE === 'number') return window.RS_UISCALE_FORCE;

        var max = typeof window.RS_UISCALE_MAX === 'number' ? window.RS_UISCALE_MAX : MAX_SCALE;
        var w = window.innerWidth || DESIGN_W;
        var h = window.innerHeight || DESIGN_H;

        // Smaller axis, so a tall or ultrawide viewport never pushes UI offscreen.
        var scale = Math.min(w / DESIGN_W, h / DESIGN_H);

        if (!isFinite(scale) || scale <= 0) return MIN_SCALE;
        if (scale < MIN_SCALE) return MIN_SCALE;
        if (scale > max) scale = max;

        // Quantise to 1/8 steps.
        //
        // An arbitrary fractional zoom (1.3333...) puts element edges on
        // sub-pixel boundaries. Adjacent panels then round apart and leave
        // hairline seams straight through the layout, and glyph advances round
        // inconsistently so letters collide. Snapping to eighths keeps edges on
        // whole or half pixels for the common 1x/1.5x/2x device ratios.
        scale = Math.round(scale * 8) / 8;

        return scale < MIN_SCALE ? MIN_SCALE : scale;
    }

    function apply() {
        var scale = computeScale();

        // Nothing to do at 1:1 — avoid touching the document at 1080p, which
        // is also the Legacy case.
        if (scale === 1) {
            document.documentElement.style.zoom = '';
            document.documentElement.removeAttribute('data-rs-uiscale');
            return;
        }

        document.documentElement.style.zoom = scale;
        document.documentElement.setAttribute('data-rs-uiscale', scale.toFixed(3));

        // Promote the document to its own compositing layer and pin text
        // geometry. Without this, zoomed text is re-hinted per element and
        // adjacent glyphs can overlap where advances round differently.
        var root = document.documentElement.style;
        root.setProperty('-webkit-font-smoothing', 'antialiased');
        root.setProperty('text-rendering', 'geometricPrecision');
        root.setProperty('backface-visibility', 'hidden');
        root.setProperty('transform', 'translateZ(0)');
    }

    window.RSUIScale = { apply: apply, get: computeScale };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }

    window.addEventListener('resize', apply);
})();
