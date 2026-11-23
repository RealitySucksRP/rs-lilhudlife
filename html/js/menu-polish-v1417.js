// ============================================================================
// RS HUDLife v1.4.18 — Menu Logo Polish (2D-safe)
// ============================================================================
(function () {
    'use strict';

    function wireLogo() {
        const stage = document.getElementById('rs17-logo-stage');
        const logo3d = document.getElementById('rs17-logo-3d');
        if (!stage || !logo3d || stage.dataset.rs17Wired) return;
        stage.dataset.rs17Wired = '1';

        stage.addEventListener('click', function () {
            stage.classList.remove('spinning');
            void stage.offsetWidth;
            logo3d.style.transform = '';
            logo3d.style.animation = '';
            stage.classList.add('spinning');
            setTimeout(function () {
                stage.classList.remove('spinning');
            }, 880);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireLogo);
    } else {
        wireLogo();
    }
})();
