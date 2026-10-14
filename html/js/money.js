// ============================================================
// RS-HUDLIFE - SERVER / MONEY / ID PANEL
// Sync-hud style: logo + server name + ID + cash + bank + job
// Free X/Y percentage positioning
// ============================================================

const RSMoney = (function() {
    'use strict';

    let initialized = false;
    let container;
    let config = {
        enabled: true,
        x: 1, y: 2,
        scale: 1.0,
        style: 'glass',
        show: { server: true, cash: true, bank: true, id: true, job: true, voice: true },
        serverName: 'REALITY SUCKS RP'
    };
    let data = { cash: 0, bank: 0, id: 0, playerName: '', job: '', jobGrade: '' };
    let voice = { connected: false, talking: false, radio: false, level: 'normal', mode: 'Normal', distance: 0 };

    // ============================================================
    //  FORMAT MONEY  1234567 -> "$1,234,567"
    // ============================================================
    function fmt(n) {
        return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // ============================================================
    //  BUILD  (the HTML is already in index.html)
    // ============================================================
    function build() {
        container = document.getElementById('money-container');
        if (!container) return;
        initialized = true;
    }

    // ============================================================
    //  APPLY CONFIG
    // ============================================================
    function applyConfig(cfg) {
        if (!cfg) return;
        Object.assign(config, cfg);
        if (!container) return;

        // NOTE: visibility controlled only by handlePayload/show/hide
        // applyConfig only updates position and appearance

        container.style.setProperty('--rs-x', (config.x !== undefined ? config.x : 1) + '%');
        container.style.setProperty('--rs-y', (config.y !== undefined ? config.y : 1) + '%');

        container.style.transform = `scale(${config.scale || 1})`;
        container.style.transformOrigin = 'top right';
        const allowedStyles = ['glass', 'clean', 'neon', 'executive', 'compact'];
        container.dataset.style = allowedStyles.includes(config.style) ? config.style : 'glass';

        const sn = document.getElementById('sp-server-name');
        if (sn && config.serverName) sn.textContent = config.serverName;

        const rowServer = document.getElementById('sp-row-server');
        if (rowServer) rowServer.style.display = (config.show && config.show.server === false) ? 'none' : '';

        const cashEl = document.getElementById('sp-cash');
        if (cashEl) cashEl.style.display = (config.show && config.show.cash === false) ? 'none' : '';

        const bankEl = document.getElementById('sp-bank');
        if (bankEl) bankEl.style.display = (config.show && config.show.bank === false) ? 'none' : '';

        const identityRow = document.getElementById('sp-row-identity');
        if (identityRow) identityRow.style.display = (config.show && config.show.id === false) ? 'none' : '';

        const jobRow = document.getElementById('sp-row-job');
        if (jobRow) jobRow.style.display = (config.show && config.show.job === false) ? 'none' : '';

        const voiceRow = document.getElementById('sp-row-voice');
        if (voiceRow) voiceRow.style.display = (config.show && config.show.voice === false) ? 'none' : '';
    }

    function updateVoice(newVoice) {
        if (!initialized) return;
        Object.assign(voice, newVoice || {});

        const row = document.getElementById('sp-row-voice');
        if (!row) return;

        const levels = ['soft', 'normal', 'loud'];
        const level = levels.includes(String(voice.level || '').toLowerCase())
            ? String(voice.level).toLowerCase() : 'normal';
        const connected = voice.connected === true;
        const talking = connected && voice.talking === true;
        const radio = talking && voice.radio === true;

        row.dataset.voiceLevel = level;
        row.dataset.voiceState = connected ? (radio ? 'radio' : (talking ? 'talking' : 'ready')) : 'offline';
        row.classList.toggle('is-connected', connected);
        row.classList.toggle('is-talking', talking);

        const stateEl = document.getElementById('sp-voice-state');
        if (stateEl) stateEl.textContent = !connected ? 'VOICE OFFLINE' : (radio ? 'RADIO TX' : (talking ? 'VOICE ACTIVE' : 'MIC READY'));

        const levelEl = document.getElementById('sp-voice-level');
        if (levelEl) levelEl.textContent = level.toUpperCase();

        const distanceEl = document.getElementById('sp-voice-distance');
        if (distanceEl) {
            const distance = Number(voice.distance);
            distanceEl.textContent = connected && Number.isFinite(distance) && distance > 0
                ? `${Math.round(distance * 10) / 10}M` : '';
        }

        row.setAttribute('aria-label', !connected
            ? 'Voice disconnected'
            : `${talking ? 'Microphone working, voice detected' : 'Microphone ready'}, ${level} range`);
    }

    // ============================================================
    //  UPDATE DATA
    // ============================================================
    function update(newData) {
        if (!initialized) return;
        Object.assign(data, newData || {});

        if (newData && newData.voice) updateVoice(newData.voice);

        const cashValEl = document.getElementById('sp-cash-val');
        if (cashValEl) cashValEl.textContent = fmt(data.cash);

        const bankValEl = document.getElementById('sp-bank-val');
        if (bankValEl) bankValEl.textContent = fmt(data.bank);

        const idEl = document.getElementById('sp-id-val');
        if (idEl) idEl.textContent = '#' + (data.id || 0);

        const playerNameEl = document.getElementById('sp-player-name');
        if (playerNameEl) playerNameEl.textContent = (data.playerName || 'PLAYER').toUpperCase();

        const jobEl = document.getElementById('sp-job-val');
        if (jobEl) jobEl.textContent = (data.job || 'UNEMPLOYED').toUpperCase();

        const gradeEl = document.getElementById('sp-grade');
        if (gradeEl) gradeEl.textContent = data.jobGrade ? data.jobGrade.toUpperCase() : '';
    }

    function handlePayload(payload) {
        if (payload.config) applyConfig(payload.config);
        if (payload.data) update(payload.data);
        if (payload.voice) updateVoice(payload.voice);
        if (initialized) {
            container.classList.toggle('hidden', !config.enabled);
        }
    }

    function show() { if (container && config.enabled) container.classList.remove('hidden'); }
    function hide() { if (container) container.classList.add('hidden'); }

    return {
        build: build,
        update: update,
        applyConfig: applyConfig,
        updateVoice: updateVoice,
        handlePayload: handlePayload,
        show: show,
        hide: hide
    };
})();

window.RSMoney = RSMoney;
