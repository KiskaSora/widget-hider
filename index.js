/**
 * Widget Hider — SillyTavern Extension v2.1
 * Mobile-friendly, centered UI with FAB quick toggle
 */

(function () {
    'use strict';

    const EXT_NAME    = 'widget-hider';
    const STORAGE_KEY = 'widget_hider_targets';
    const STORAGE_HIDDEN = 'widget_hider_hidden';
    const STORAGE_FAB_VISIBLE = 'widget_hider_fab_visible';
    const STORAGE_FAB_SIZE = 'widget_hider_fab_size';
    const STORAGE_FAB_POS = 'widget_hider_fab_position';

    // ── Core ST elements we must NEVER touch ─────────────────────────────────
    const CORE_SELECTORS = [
        '#top-bar', '#chat', '#send_form', '#left-nav-panel', '#right-nav-panel',
        '#sheld', '#movingDivs', '#expression-holder', '#chat_stopGeneration',
        '#shadow_popup', '#dialogue_popup', '#debug_menu', '#toast-container',
        '.draggable', '#form_sheld', '#quickReplyBar', '#extensions_settings',
        '#settings_holder', '.range-block', '#options_popup',
        '#extensionsMenuButton', '#extensionsMenu', '.extensionsMenu',
        `#${EXT_NAME}-toggle`, `#${EXT_NAME}-menu`, `#${EXT_NAME}-pick-overlay`,
        `#${EXT_NAME}-pick-hint`, `#${EXT_NAME}-manage-panel`,
        `#${EXT_NAME}-autoscan-panel`, `#${EXT_NAME}-pick-panel`,
        `#${EXT_NAME}-backdrop`, `#${EXT_NAME}-fab`,
    ];

    // ── State ─────────────────────────────────────────────────────────────────
    let hiddenTargets  = loadJSON(STORAGE_KEY, []);
    let isHidden       = loadJSON(STORAGE_HIDDEN, false);
    let fabVisible     = loadJSON(STORAGE_FAB_VISIBLE, true);
    let fabSize        = loadJSON(STORAGE_FAB_SIZE, 28); // размер в пикселях (16-48)
    let fabPosition    = loadJSON(STORAGE_FAB_POS, null); // {x, y} или null для дефолта
    let pickModeActive = false;
    let menuOpen       = false;
    let isMobile       = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
    
    // FAB drag state
    let fabDragging = false;
    let fabDragStart = { x: 0, y: 0 };
    let fabStartPos = { x: 0, y: 0 };
    let fabMoved = false;

    // ── Detect mobile on resize ───────────────────────────────────────────────
    const UA_IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        isMobile = UA_IS_MOBILE || window.innerWidth < 768;
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            applyFabPosition();
        }, 150);
    });
    // На мобильных особенно важен поворот экрана
    window.addEventListener('orientationchange', () => {
        setTimeout(() => applyFabPosition(), 200);
    });


    // ── SVG Icons ─────────────────────────────────────────────────────────────
    function iconEye() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>`;
    }
    function iconCrosshair() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="2" x2="12" y2="6"/>
                  <line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="6" y2="12"/>
                  <line x1="18" y1="12" x2="22" y2="12"/>
                </svg>`;
    }
    function iconScan() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="4 7 4 4 7 4"/>
                  <polyline points="17 4 20 4 20 7"/>
                  <polyline points="20 17 20 20 17 20"/>
                  <polyline points="7 20 4 20 4 17"/>
                  <line x1="4" y1="12" x2="20" y2="12"/>
                </svg>`;
    }
    function iconList() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>`;
    }
    function iconTrash() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>`;
    }
    function iconEyeOff() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>`;
    }
    function iconToggle() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1" y="5" width="22" height="14" rx="7" ry="7"/>
                  <circle cx="16" cy="12" r="3"/>
                </svg>`;
    }
    function iconReset() {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>`;
    }

    // ── Build UI ──────────────────────────────────────────────────────────────
    function buildUI() {
        // Backdrop for modals
        const backdrop = el('div', { id: `${EXT_NAME}-backdrop` });
        backdrop.addEventListener('click', (e) => { e.stopPropagation(); closeAllPanels(); });
        backdrop.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); closeAllPanels(); }, { passive: false });

        // Main context menu (centered)
        const menu = el('div', { id: `${EXT_NAME}-menu` });
        menu.innerHTML = `
            <div class="wh-menu-label">
                <span>Widget Hider</span>
                <button class="wh-menu-close" id="wh-menu-close">✕</button>
            </div>
            <div class="wh-menu-item" id="wh-action-toggle">
                ${iconEye()}
                <span id="wh-toggle-label">Скрыть виджеты</span>
                <span class="wh-count-badge wh-hidden-badge" id="wh-hidden-count" style="display:none">0</span>
            </div>
            <div class="wh-menu-sep"></div>
            <div class="wh-menu-item" id="wh-action-pick">
                ${iconCrosshair()}
                <span>Выбрать виджет</span>
            </div>
            <div class="wh-menu-item" id="wh-action-auto">
                ${iconScan()}
                <span>Авто-сканирование</span>
            </div>
            <div class="wh-menu-item" id="wh-action-manage">
                ${iconList()}
                <span>Управление списком</span>
                <span class="wh-count-badge" id="wh-count">0</span>
            </div>
            <div class="wh-menu-sep"></div>
            <div class="wh-menu-item" id="wh-action-fab">
                ${iconToggle()}
                <span id="wh-fab-label">Быстрая кнопка: вкл</span>
            </div>
            <div class="wh-menu-slider" id="wh-fab-size-row">
                <span class="wh-slider-label">Размер: <span id="wh-fab-size-value">${fabSize}px</span></span>
                <input type="range" id="wh-fab-size-slider" min="16" max="48" value="${fabSize}" step="2">
            </div>
            <div class="wh-menu-item" id="wh-action-reset-pos">
                ${iconReset()}
                <span>Сброс позиции кнопки</span>
            </div>
            <div class="wh-menu-sep"></div>
            <div class="wh-menu-item" id="wh-action-clear">
                ${iconTrash()}
                <span>Сбросить всё</span>
            </div>`;

        // Manage panel
        const managePanel = el('div', { id: `${EXT_NAME}-manage-panel` });
        managePanel.innerHTML = `
            <div class="wh-panel-header">
                <span>Список виджетов</span>
                <button class="wh-panel-close" id="wh-manage-close">✕</button>
            </div>
            <div class="wh-panel-body" id="wh-manage-list"></div>
            <div class="wh-panel-footer">
                <span class="wh-panel-hint">Нажмите на строку для подсветки</span>
            </div>`;

        // Auto-scan panel
        const scanPanel = el('div', { id: `${EXT_NAME}-autoscan-panel` });
        scanPanel.innerHTML = `
            <div class="wh-panel-header">
                <span>Найденные виджеты</span>
                <button class="wh-panel-close" id="wh-scan-close">✕</button>
            </div>
            <div class="wh-panel-body" id="wh-scan-list">
                <div class="wh-panel-empty">Идёт сканирование…</div>
            </div>
            <div class="wh-panel-footer">
                <button class="wh-btn" id="wh-scan-confirm">Добавить выбранные</button>
                <button class="wh-btn wh-btn-ghost" id="wh-scan-cancel">Отмена</button>
            </div>`;

        // Mobile pick panel (альтернатива для мобильных устройств)
        const pickPanel = el('div', { id: `${EXT_NAME}-pick-panel` });
        pickPanel.innerHTML = `
            <div class="wh-panel-header">
                <span>Выберите виджеты</span>
                <button class="wh-panel-close" id="wh-pick-close">✕</button>
            </div>
            <div class="wh-panel-body" id="wh-pick-list">
                <div class="wh-panel-empty">Поиск виджетов…</div>
            </div>
            <div class="wh-panel-footer">
                <button class="wh-btn" id="wh-pick-confirm">Добавить выбранные</button>
                <button class="wh-btn wh-btn-ghost" id="wh-pick-cancel">Отмена</button>
            </div>`;

        // Pick overlay + hint
        const overlay = el('div', { id: `${EXT_NAME}-pick-overlay` });
        const hint = el('div', { id: `${EXT_NAME}-pick-hint` });
        hint.innerHTML = `
            🎯 Нажимайте на виджеты для выбора
            <br><small style="opacity:0.7">Escape — отмена</small>
            <br><button id="${EXT_NAME}-pick-cancel" class="wh-btn wh-btn-ghost" style="margin-top:12px;">Отмена</button>
        `;

        // FAB - Floating Action Button for quick toggle
        // Минималистичная кнопка - только иконка глаза, слегка видная
        const fab = el('div', { id: `${EXT_NAME}-fab` });
        fab.innerHTML = `<span class="wh-fab-icon">${iconEyeOff()}</span>`;
        fab.title = 'Переключить виджеты (перетащите чтобы переместить)';
        fab.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fabMoved) return;
            if (isMobile) return; // на мобильных — только через touchend
            toggleHide();
            updateFabState();
        });

        // Аппендим в body всё кроме FAB
        document.body.append(backdrop, menu, managePanel, scanPanel, pickPanel, overlay, hint);
        // FAB аппендим в documentElement (<html>) — так он не зависит от
        // transform/zoom/overflow на body которые ST может применять на мобильных
        document.documentElement.appendChild(fab);

        // Event listeners
        document.getElementById('wh-menu-close').addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); });
        document.getElementById('wh-action-toggle').addEventListener('click', (e) => { e.stopPropagation(); toggleHide(); closeMenu(); });
        document.getElementById('wh-action-pick').addEventListener('click', (e) => {
            e.stopPropagation();
            closeMenu();
            // На мобильных устройствах используем список с чекбоксами вместо overlay,
            // т.к. overlay-режим ненадёжно работает с touch-событиями и elementFromPoint
            setTimeout(() => {
                if (isMobile) {
                    openPickPanel();
                } else {
                    enterPickMode();
                }
            }, 100);
        });
        document.getElementById('wh-action-auto').addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); openScanPanel(); });
        document.getElementById('wh-action-manage').addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); openManagePanel(); });
        document.getElementById('wh-action-clear').addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); clearTargets(); });
        document.getElementById('wh-action-fab').addEventListener('click', (e) => { e.stopPropagation(); toggleFabVisibility(); });
        document.getElementById('wh-action-reset-pos').addEventListener('click', (e) => { e.stopPropagation(); resetFabPosition(); closeMenu(); });
        
        // FAB size slider
        const sizeSlider = document.getElementById('wh-fab-size-slider');
        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                fabSize = parseInt(e.target.value, 10);
                saveJSON(STORAGE_FAB_SIZE, fabSize);
                const sizeValue = document.getElementById('wh-fab-size-value');
                if (sizeValue) sizeValue.textContent = `${fabSize}px`;
                updateFabState();
            });
        }

        document.getElementById('wh-manage-close').addEventListener('click', closeManagePanel);
        document.getElementById('wh-scan-close').addEventListener('click', closeScanPanel);
        document.getElementById('wh-scan-cancel').addEventListener('click', closeScanPanel);
        document.getElementById('wh-scan-confirm').addEventListener('click', confirmScan);

        // Pick panel event listeners (для мобильных)
        document.getElementById('wh-pick-close').addEventListener('click', closePickPanel);
        document.getElementById('wh-pick-cancel').addEventListener('click', closePickPanel);
        document.getElementById('wh-pick-confirm').addEventListener('click', confirmPickPanel);

        overlay.addEventListener('click', handlePickClick);
        overlay.addEventListener('touchend', handlePickTouch, { passive: false });
        
        // Pick cancel button
        const pickCancelBtn = document.getElementById(`${EXT_NAME}-pick-cancel`);
        if (pickCancelBtn) {
            pickCancelBtn.addEventListener('click', (e) => { e.stopPropagation(); exitPickMode(); });
            pickCancelBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); exitPickMode(); }, { passive: false });
        }

        // Global keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (pickModeActive) { exitPickMode(); return; }
                closeAllPanels();
            }
        });

        injectIntoExtensionsMenu();
    }

    function closeAllPanels() {
        closeMenu();
        closeManagePanel();
        closeScanPanel();
        closePickPanel();
    }

    // ── Menu functions ────────────────────────────────────────────────────────
    function openMainMenu() {
        menuOpen = true;
        document.getElementById(`${EXT_NAME}-backdrop`).classList.add('active');
        document.getElementById(`${EXT_NAME}-menu`).classList.add('open');
        updateMenuState();
    }

    function closeMenu() {
        menuOpen = false;
        document.getElementById(`${EXT_NAME}-menu`).classList.remove('open');
        document.getElementById(`${EXT_NAME}-backdrop`).classList.remove('active');
    }

    function updateMenuState() {
        const label = document.getElementById('wh-toggle-label');
        const count = document.getElementById('wh-count');
        const hiddenCount = document.getElementById('wh-hidden-count');
        const entry = document.getElementById('wh-ext-entry');
        const entryBadge = document.getElementById('wh-ext-badge');

        if (label) label.textContent = isHidden ? 'Показать виджеты' : 'Скрыть виджеты';
        if (count) {
            count.textContent = hiddenTargets.length;
            count.style.display = hiddenTargets.length ? '' : 'none';
        }
        if (hiddenCount) {
            hiddenCount.textContent = hiddenTargets.length;
            hiddenCount.style.display = (isHidden && hiddenTargets.length) ? '' : 'none';
        }

        // Update badge in extensions menu
        if (entryBadge) {
            entryBadge.textContent = hiddenTargets.length;
            entryBadge.style.display = (isHidden && hiddenTargets.length) ? 'inline-flex' : 'none';
        }

        // Update icon
        if (entry) {
            const ico = entry.querySelector('i');
            if (ico) ico.className = isHidden ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
        }
    }

    // ── Inject into ST Extensions Menu ────────────────────────────────────────
    function injectIntoExtensionsMenu() {
        tryInject();
        setTimeout(tryInject, 1500);
        setTimeout(tryInject, 4000);

        document.addEventListener('click', (e) => {
            const btn = e.target.closest('#extensionsMenuButton, .fa-magic-wand-sparkles');
            if (btn) setTimeout(tryInject, 80);
        }, true);

        const obs = new MutationObserver(() => tryInject());
        obs.observe(document.body, { childList: true, subtree: true });

        function tryInject() {
            if (document.getElementById('wh-ext-entry')) return;

            const containers = [
                document.getElementById('extensionsMenu'),
                document.querySelector('.extensions_block'),
                document.querySelector('#extensionsMenuList'),
                document.querySelector('.extensionsMenuList'),
            ].filter(Boolean);

            if (containers.length === 0) return;

            const entry = el('div');
            entry.id = 'wh-ext-entry';
            entry.style.cssText = `
                display:flex; align-items:center; gap:8px;
                padding:8px 12px; cursor:pointer; color:inherit;
                font-family:inherit; font-size:inherit;
                border-radius:6px; transition:background .15s;`;
            entry.innerHTML = `
                <i class="fa-solid fa-eye-slash" style="width:18px;text-align:center;opacity:0.85;"></i>
                <span>Widget Hider</span>
                <span class="wh-hidden-badge" id="wh-ext-badge" style="display:none">0</span>`;
            entry.addEventListener('mouseover', () => { entry.style.background = 'var(--SmartThemeEmColor, rgba(255,255,255,0.1))'; });
            entry.addEventListener('mouseout', () => { entry.style.background = ''; });
            entry.addEventListener('click', (e) => {
                e.stopPropagation();
                const extMenu = containers[0];
                if (extMenu) extMenu.closest('.popup, [class*="popup"]')?.classList.remove('visible');
                openMainMenu();
            });

            // Insert at the beginning of the menu (first position)
            if (containers[0].firstChild) {
                containers[0].insertBefore(entry, containers[0].firstChild);
            } else {
                containers[0].appendChild(entry);
            }
            updateMenuState();
        }
    }

    // ── Manage Panel ──────────────────────────────────────────────────────────
    function openManagePanel() {
        renderManageList();
        document.getElementById(`${EXT_NAME}-backdrop`).classList.add('active');
        document.getElementById(`${EXT_NAME}-manage-panel`).classList.add('open');
    }

    function closeManagePanel() {
        document.getElementById(`${EXT_NAME}-manage-panel`).classList.remove('open');
        document.getElementById(`${EXT_NAME}-backdrop`).classList.remove('active');
        document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
    }

    function renderManageList() {
        const list = document.getElementById('wh-manage-list');
        list.innerHTML = '';

        if (hiddenTargets.length === 0) {
            list.innerHTML = '<div class="wh-panel-empty">Список пуст.<br>Добавьте виджеты через «Выбрать» или «Авто-сканирование».</div>';
            return;
        }

        hiddenTargets.forEach((sel, idx) => {
            const row = el('div');
            row.className = 'wh-manage-row';

            let label = sel;
            try {
                const found = document.querySelector(sel);
                if (found) {
                    const text = (found.title || found.getAttribute('aria-label') || found.textContent || '').trim().slice(0, 35);
                    if (text) label = `${sel}  —  "${text}"`;
                }
            } catch(_) {}

            row.innerHTML = `
                <div class="wh-manage-sel" title="${escapeHtml(sel)}">${escapeHtml(label)}</div>
                <button class="wh-manage-del" title="Убрать">✕</button>`;

            row.addEventListener('click', (e) => {
                if (e.target.classList.contains('wh-manage-del')) return;
                document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
                highlightElement(sel);
            });

            row.querySelector('.wh-manage-del').addEventListener('click', () => {
                unhighlightElement(sel);
                hiddenTargets.splice(idx, 1);
                saveJSON(STORAGE_KEY, hiddenTargets);
                if (isHidden) {
                    try { document.querySelectorAll(sel).forEach(n => n.classList.remove('wh-hidden-widget')); } catch(_) {}
                }
                updateMenuState();
                renderManageList();
            });

            list.appendChild(row);
        });
    }

    function highlightElement(sel) {
        try { document.querySelectorAll(sel).forEach(n => n.classList.add('wh-highlighted')); } catch(_) {}
    }

    function unhighlightElement(sel) {
        try { document.querySelectorAll(sel).forEach(n => n.classList.remove('wh-highlighted')); } catch(_) {}
    }

    // ── Auto-scan Panel ───────────────────────────────────────────────────────
    let scanCandidates = [];

    function openScanPanel() {
        scanCandidates = collectScanCandidates();
        renderScanPanel();
        document.getElementById(`${EXT_NAME}-backdrop`).classList.add('active');
        document.getElementById(`${EXT_NAME}-autoscan-panel`).classList.add('open');
    }

    function closeScanPanel() {
        document.getElementById(`${EXT_NAME}-autoscan-panel`).classList.remove('open');
        document.getElementById(`${EXT_NAME}-backdrop`).classList.remove('active');
        document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
        scanCandidates = [];
    }

    function collectScanCandidates() {
        const seen = new Set();
        const found = [];

        function add(node) {
            if (isCoreElement(node)) return;
            const sel = buildSelector(node);
            if (!sel || seen.has(sel)) return;
            seen.add(sel);
            found.push({ node, sel, checked: !hiddenTargets.includes(sel) });
        }

        document.querySelectorAll('body > *').forEach(node => {
            const s = window.getComputedStyle(node);
            if (s.position === 'fixed' || s.position === 'absolute') add(node);
        });

        document.querySelectorAll('[style*="position: fixed"],[style*="position:fixed"]').forEach(add);

        ['[id$="-widget"]','[id$="-panel"]','[id*="extension"]','.extension-','.ext-','.floating-'].forEach(pat => {
            try {
                document.querySelectorAll(pat).forEach(node => {
                    const s = window.getComputedStyle(node);
                    if (['fixed','absolute'].includes(s.position)) add(node);
                });
            } catch(_) {}
        });

        return found;
    }

    function renderScanPanel() {
        const list = document.getElementById('wh-scan-list');
        list.innerHTML = '';

        if (scanCandidates.length === 0) {
            list.innerHTML = '<div class="wh-panel-empty">Плавающих виджетов не обнаружено.</div>';
            return;
        }

        scanCandidates.forEach((c, idx) => {
            const alreadyAdded = hiddenTargets.includes(c.sel);
            const row = el('div');
            row.className = 'wh-scan-row' + (alreadyAdded ? ' wh-scan-already' : '');

            let label = c.sel;
            const text = (c.node.title || c.node.getAttribute('aria-label') || c.node.textContent || '').trim().slice(0, 40);
            if (text) label += `  — "${text}"`;

            row.innerHTML = `
                <div class="wh-scan-check">
                    <input type="checkbox" data-idx="${idx}" ${c.checked && !alreadyAdded ? 'checked' : ''} ${alreadyAdded ? 'disabled' : ''}>
                    <span class="wh-scan-sel" title="${escapeHtml(c.sel)}">${escapeHtml(label)}</span>
                    ${alreadyAdded ? '<em class="wh-scan-note">(уже добавлен)</em>' : ''}
                </div>`;

            const cb = row.querySelector('input');
            
            // Handle checkbox change
            cb.addEventListener('change', (e) => { 
                e.stopPropagation();
                scanCandidates[idx].checked = cb.checked; 
            });
            
            // Handle checkbox click - prevent row click from interfering
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Handle row click - toggle checkbox and highlight
            row.addEventListener('click', (e) => {
                // Don't toggle if clicked on checkbox itself or if already added
                if (e.target.tagName === 'INPUT' || alreadyAdded) return;
                
                // Toggle checkbox
                cb.checked = !cb.checked;
                scanCandidates[idx].checked = cb.checked;
                
                // Highlight element
                document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
                c.node.classList.add('wh-highlighted');
            });

            list.appendChild(row);
        });
    }

    function confirmScan() {
        let added = 0;
        scanCandidates.forEach(c => {
            if (c.checked && !hiddenTargets.includes(c.sel)) {
                hiddenTargets.push(c.sel);
                added++;
            }
        });
        saveJSON(STORAGE_KEY, hiddenTargets);
        updateMenuState();
        closeScanPanel();
        toastMsg(added > 0 ? `Добавлено: ${added}. Всего: ${hiddenTargets.length}` : 'Ничего не добавлено');
    }

    // ── Pick Mode ─────────────────────────────────────────────────────────────
    let lastHovered = null;
    let pickPanelCandidates = [];

    function enterPickMode() {
        pickModeActive = true;
        document.getElementById(`${EXT_NAME}-pick-overlay`).classList.add('active');
        document.getElementById(`${EXT_NAME}-pick-hint`).style.display = 'block';
        
        // На desktop добавляем hover эффект
        if (!isMobile) {
            document.addEventListener('mousemove', onPickHover, true);
        }
    }

    function exitPickMode() {
        pickModeActive = false;
        document.getElementById(`${EXT_NAME}-pick-overlay`).classList.remove('active');
        document.getElementById(`${EXT_NAME}-pick-hint`).style.display = 'none';
        document.removeEventListener('mousemove', onPickHover, true);
        document.querySelectorAll('.widget-hider-pickable').forEach(n => n.classList.remove('widget-hider-pickable'));
        lastHovered = null;
    }

    function onPickHover(e) {
        const overlay = document.getElementById(`${EXT_NAME}-pick-overlay`);
        overlay.style.pointerEvents = 'none';
        const target = document.elementFromPoint(e.clientX, e.clientY);
        overlay.style.pointerEvents = '';
        if (!target || isCoreElement(target)) return;
        const widget = findWidgetRoot(target);
        if (!widget || isCoreElement(widget)) return;
        if (lastHovered && lastHovered !== widget) lastHovered.classList.remove('widget-hider-pickable');
        widget.classList.add('widget-hider-pickable');
        lastHovered = widget;
    }

    function handlePickClick(e) {
        if (!pickModeActive) return;
        e.stopPropagation();
        e.preventDefault();
        processPickAt(e.clientX, e.clientY);
    }

    function handlePickTouch(e) {
        if (!pickModeActive) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (touch) processPickAt(touch.clientX, touch.clientY);
    }

    function processPickAt(x, y) {
        const overlay = document.getElementById(`${EXT_NAME}-pick-overlay`);
        overlay.style.pointerEvents = 'none';
        const target = document.elementFromPoint(x, y);
        overlay.style.pointerEvents = '';

        if (!target || isCoreElement(target)) {
            exitPickMode();
            return;
        }

        const widget = findWidgetRoot(target);
        if (!widget || isCoreElement(widget)) {
            exitPickMode();
            return;
        }

        const sel = buildSelector(widget);
        if (!sel) {
            exitPickMode();
            return;
        }

        // Single pick - add immediately
        if (!hiddenTargets.includes(sel)) {
            hiddenTargets.push(sel);
            saveJSON(STORAGE_KEY, hiddenTargets);
        }
        if (isHidden) widget.classList.add('wh-hidden-widget');
        exitPickMode();
        updateMenuState();
        toastMsg(`Виджет добавлен (${hiddenTargets.length} шт.)`);
    }

    // ── Mobile Pick Panel (альтернатива для мобильных устройств) ──────────────
    function openPickPanel() {
        pickPanelCandidates = collectPickCandidates();
        renderPickPanel();
        document.getElementById(`${EXT_NAME}-backdrop`).classList.add('active');
        document.getElementById(`${EXT_NAME}-pick-panel`).classList.add('open');
    }

    function closePickPanel() {
        document.getElementById(`${EXT_NAME}-pick-panel`).classList.remove('open');
        document.getElementById(`${EXT_NAME}-backdrop`).classList.remove('active');
        document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
        pickPanelCandidates = [];
    }

    function collectPickCandidates() {
        const seen = new Set();
        const found = [];

        function add(node) {
            if (isCoreElement(node)) return;
            const sel = buildSelector(node);
            if (!sel || seen.has(sel)) return;
            seen.add(sel);
            const alreadyAdded = hiddenTargets.includes(sel);
            found.push({ node, sel, checked: false, alreadyAdded });
        }

        // Сначала все плавающие элементы
        document.querySelectorAll('body > *').forEach(node => {
            const s = window.getComputedStyle(node);
            if (s.position === 'fixed' || s.position === 'absolute') add(node);
        });

        document.querySelectorAll('[style*="position: fixed"],[style*="position:fixed"]').forEach(add);

        // Паттерны для виджетов
        ['[id$="-widget"]','[id$="-panel"]','[id*="extension"]','.extension-','.ext-','.floating-'].forEach(pat => {
            try {
                document.querySelectorAll(pat).forEach(node => {
                    const s = window.getComputedStyle(node);
                    if (['fixed','absolute'].includes(s.position)) add(node);
                });
            } catch(_) {}
        });

        return found;
    }

    function renderPickPanel() {
        const list = document.getElementById('wh-pick-list');
        list.innerHTML = '';

        if (pickPanelCandidates.length === 0) {
            list.innerHTML = '<div class="wh-panel-empty">Плавающих виджетов не обнаружено.</div>';
            return;
        }

        pickPanelCandidates.forEach((c, idx) => {
            const row = el('div');
            row.className = 'wh-pick-row' + (c.alreadyAdded ? ' wh-pick-already' : '');

            let label = c.sel;
            const text = (c.node.title || c.node.getAttribute('aria-label') || c.node.textContent || '').trim().slice(0, 40);
            if (text) label += `  — "${text}"`;

            row.innerHTML = `
                <div class="wh-pick-check">
                    <input type="checkbox" data-idx="${idx}" ${c.checked ? 'checked' : ''} ${c.alreadyAdded ? 'disabled' : ''}>
                    <span class="wh-pick-sel" title="${escapeHtml(c.sel)}">${escapeHtml(label)}</span>
                    ${c.alreadyAdded ? '<em class="wh-pick-note">(уже добавлен)</em>' : ''}
                </div>`;

            const cb = row.querySelector('input');
            
            cb.addEventListener('change', (e) => { 
                e.stopPropagation();
                pickPanelCandidates[idx].checked = cb.checked; 
            });
            
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            row.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT' || c.alreadyAdded) return;
                
                cb.checked = !cb.checked;
                pickPanelCandidates[idx].checked = cb.checked;
                
                // Подсветить элемент
                document.querySelectorAll('.wh-highlighted').forEach(n => n.classList.remove('wh-highlighted'));
                c.node.classList.add('wh-highlighted');
            });

            list.appendChild(row);
        });
    }

    function confirmPickPanel() {
        let added = 0;
        pickPanelCandidates.forEach(c => {
            if (c.checked && !hiddenTargets.includes(c.sel)) {
                hiddenTargets.push(c.sel);
                if (isHidden) {
                    try { c.node.classList.add('wh-hidden-widget'); } catch(_) {}
                }
                added++;
            }
        });
        saveJSON(STORAGE_KEY, hiddenTargets);
        updateMenuState();
        closePickPanel();
        toastMsg(added > 0 ? `Добавлено: ${added}. Всего: ${hiddenTargets.length}` : 'Ничего не добавлено');
    }

    // ── Hide / Show ───────────────────────────────────────────────────────────
    function toggleHide() {
        isHidden = !isHidden;
        saveJSON(STORAGE_HIDDEN, isHidden);
        applyHiddenState();
        updateMenuState();
    }

    function applyHiddenState() {
        hiddenTargets.forEach(sel => {
            try {
                document.querySelectorAll(sel).forEach(node => {
                    node.classList.toggle('wh-hidden-widget', isHidden);
                });
            } catch (_) {}
        });
    }

    // ── Clear ─────────────────────────────────────────────────────────────────
    function clearTargets() {
        document.querySelectorAll('.wh-hidden-widget').forEach(n => n.classList.remove('wh-hidden-widget'));
        hiddenTargets = [];
        saveJSON(STORAGE_KEY, hiddenTargets);
        isHidden = false;
        saveJSON(STORAGE_HIDDEN, false);
        updateMenuState();
        updateFabState();
        toastMsg('Список виджетов очищен');
    }

    // ── FAB (Floating Action Button) ──────────────────────────────────────────
    function toggleFabVisibility() {
        fabVisible = !fabVisible;
        saveJSON(STORAGE_FAB_VISIBLE, fabVisible);
        updateFabState();
        const fabLabel = document.getElementById('wh-fab-label');
        if (fabLabel) fabLabel.textContent = `Быстрая кнопка: ${fabVisible ? 'вкл' : 'выкл'}`;
    }
    
    function resetFabPosition() {
        fabPosition = null;
        saveJSON(STORAGE_FAB_POS, null);
        applyFabPosition();
        toastMsg('Позиция кнопки сброшена');
    }
    
    function applyFabPosition() {
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (!fab) return;
        // Если кнопка выключена — не трогаем display
        if (!fabVisible) { fab.style.display = 'none'; return; }
        
        const vw = window.innerWidth || document.documentElement.clientWidth;
        const vh = window.innerHeight || document.documentElement.clientHeight;
        
        if (fabPosition && fabPosition.x !== undefined && fabPosition.y !== undefined) {
            // Восстанавливаем сохранённую позицию — и на мобильном, и на ПК
            const fabW = fab.offsetWidth || 44;
            const fabH = fab.offsetHeight || 44;
            const margin = 4;
            let x = Math.max(margin, Math.min(fabPosition.x, vw - fabW - margin));
            let y = Math.max(margin, Math.min(fabPosition.y, vh - fabH - margin));
            fab.style.right  = 'auto';
            fab.style.bottom = 'auto';
            fab.style.left   = x + 'px';
            fab.style.top    = y + 'px';
        } else {
            // Нет сохранённой позиции — дефолт
            fab.style.right  = 'auto';
            fab.style.bottom = 'auto';
            fab.style.left   = '12px';
            fab.style.top    = Math.round((window.innerHeight || 500) * 0.45) + 'px';
        }
        if (isMobile) {
            fab.style.width        = '52px';
            fab.style.height       = '52px';
            fab.style.position     = 'fixed';
            fab.style.zIndex       = '2147483647';
            fab.style.borderRadius = '50%';
        }
    }
    
    function initFabDrag() {
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (!fab) return;

        // ── Точная копия паттерна Asta setupDrag ─────────────────────────────
        let d = false, dm = false, sx = 0, sy = 0, sl = 0, st = 0, rafId = null;
        const THR = 8;

        const xy = (e) => {
            if (e.touches?.[0])        return { x: e.touches[0].clientX,        y: e.touches[0].clientY };
            if (e.changedTouches?.[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
            return { x: e.clientX, y: e.clientY };
        };

        const applyMove = (nx, ny) => {
            const cx = Math.max(0, Math.min(nx, window.innerWidth  - fab.offsetWidth));
            const cy = Math.max(0, Math.min(ny, window.innerHeight - fab.offsetHeight));
            fab.style.left   = cx + 'px';
            fab.style.top    = cy + 'px';
            fab.style.right  = 'auto';
            fab.style.bottom = 'auto';
        };

        // touchstart: passive:true — НЕ блокируем скролл заранее (как в Asta)
        fab.addEventListener('touchstart', (e) => {
            d = true; dm = false;
            const c = xy(e);
            sx = c.x; sy = c.y;
            const r = fab.getBoundingClientRect();
            sl = r.left; st = r.top;
            fab.style.left = sl + 'px'; fab.style.top = st + 'px';
            fab.style.right = 'auto'; fab.style.bottom = 'auto';
        }, { passive: true });

        // touchmove: passive:false — preventDefault только когда уже тащим
        fab.addEventListener('touchmove', (e) => {
            if (!d) return;
            const c = xy(e), dx = c.x - sx, dy = c.y - sy;
            if (Math.abs(dx) > THR || Math.abs(dy) > THR) dm = true;
            if (!dm) return;
            e.preventDefault(); // блокируем скролл только при drag
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => applyMove(sl + dx, st + dy));
        }, { passive: false });

        // touchend: тап если не было drag
        fab.addEventListener('touchend', (e) => {
            if (!d) return;
            d = false;
            if (!dm) {
                e.preventDefault();
                // Тап — переключаем
                toggleHide();
                updateFabState();
            } else {
                // Drag завершён — сохраняем позицию
                const r = fab.getBoundingClientRect();
                fabPosition = { x: Math.round(r.left), y: Math.round(r.top) };
                saveJSON(STORAGE_FAB_POS, fabPosition);
            }
            dm = false; rafId = null;
        }, { passive: false });

        // Mouse events (desktop)
        fab.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            d = true; dm = false;
            sx = e.clientX; sy = e.clientY;
            const r = fab.getBoundingClientRect();
            sl = r.left; st = r.top;
            fab.style.left = sl + 'px'; fab.style.top = st + 'px';
            fab.style.right = 'auto'; fab.style.bottom = 'auto';
        });

        document.addEventListener('mousemove', (e) => {
            if (!d) return;
            const dx = e.clientX - sx, dy = e.clientY - sy;
            if (Math.abs(dx) > THR || Math.abs(dy) > THR) dm = true;
            if (!dm) return;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => applyMove(sl + dx, st + dy));
        });

        document.addEventListener('mouseup', () => {
            if (!d) return;
            d = false;
            if (dm) {
                const r = fab.getBoundingClientRect();
                fabPosition = { x: Math.round(r.left), y: Math.round(r.top) };
                saveJSON(STORAGE_FAB_POS, fabPosition);
            } else {
                toggleHide();
                updateFabState();
            }
            dm = false; rafId = null;
        });
    }
    
    function onFabDragStart(e) {
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        startFabDrag(e.clientX, e.clientY);
    }
    
    function onFabTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        startFabDrag(touch.clientX, touch.clientY);
    }
    
    function startFabDrag(x, y) {
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (!fab) return;
        
        fabDragging = true;
        fabMoved = false;
        fabDragStart = { x, y };
        
        const rect = fab.getBoundingClientRect();
        fabStartPos = { x: rect.left, y: rect.top };
        
        fab.classList.add('wh-fab-dragging');
    }
    
    function onFabDragMove(e) {
        if (!fabDragging) return;
        e.preventDefault();
        moveFabTo(e.clientX, e.clientY);
    }
    
    function onFabTouchMove(e) {
        if (!fabDragging) return;
        if (e.touches.length !== 1) return;
        e.preventDefault(); // нужен для блокировки скролла во время drag
        const touch = e.touches[0];
        moveFabTo(touch.clientX, touch.clientY);
    }
    
    function moveFabTo(x, y) {
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (!fab) return;
        
        const dx = x - fabDragStart.x;
        const dy = y - fabDragStart.y;
        
        // Consider it moved if dragged more than 5px
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            fabMoved = true;
        }
        
        let newX = fabStartPos.x + dx;
        let newY = fabStartPos.y + dy;
        
        // Constrain to viewport
        const fabRect = fab.getBoundingClientRect();
        const maxX = window.innerWidth - fabRect.width;
        const maxY = window.innerHeight - fabRect.height;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
        
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
        fab.style.left = `${newX}px`;
        fab.style.top = `${newY}px`;
    }
    
    function onFabDragEnd(e) {
        endFabDrag();
    }
    
    function onFabTouchEnd(e) {
        endFabDrag();
    }
    
    function endFabDrag() {
        if (!fabDragging) return;
        
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (fab) {
            fab.classList.remove('wh-fab-dragging');
            
            // Save position if moved
            if (fabMoved) {
                const rect = fab.getBoundingClientRect();
                fabPosition = { x: rect.left, y: rect.top };
                saveJSON(STORAGE_FAB_POS, fabPosition);
            }
        }
        
        fabDragging = false;
        
        // If moved, prevent click from firing
        if (fabMoved) {
            setTimeout(() => { fabMoved = false; }, 100);
        }
    }

    function updateFabState() {
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (!fab) return;

        // Если выключен — скрываем полностью, не полупрозрачно
        if (!fabVisible) {
            fab.style.display = 'none';
            return;
        }
        fab.style.display = 'flex';
        fab.classList.remove('wh-fab-disabled');
        fab.classList.toggle('wh-fab-active', isHidden);

        // Icon
        const iconSpan = fab.querySelector('.wh-fab-icon');
        if (iconSpan) {
            iconSpan.style.width  = `${fabSize}px`;
            iconSpan.style.height = `${fabSize}px`;
            iconSpan.innerHTML = isHidden ? iconEye() : iconEyeOff();
        }

        const fabLabel = document.getElementById('wh-fab-label');
        if (fabLabel) fabLabel.textContent = `Быстрая кнопка: ${fabVisible ? 'вкл' : 'выкл'}`;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    function el(tag, attrs = {}) {
        const e = document.createElement(tag);
        Object.assign(e, attrs);
        return e;
    }

    function loadJSON(key, fallback) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
        catch(_) { return fallback; }
    }

    function saveJSON(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch(_) {}
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    function isCoreElement(node) {
        if (!node || node === document.body || node === document.documentElement) return true;
        return CORE_SELECTORS.some(sel => {
            try { return node.matches(sel) || node.closest(sel); } catch(_) { return false; }
        });
    }

    function findWidgetRoot(target) {
        let node = target;
        while (node && node.parentElement && node.parentElement !== document.body) {
            node = node.parentElement;
        }
        return node || target;
    }

    function buildSelector(node) {
        if (node.id) return `#${CSS.escape(node.id)}`;
        if (node.className && typeof node.className === 'string') {
            const cls = node.className.trim().split(/\s+/)
                .filter(c => c && !c.startsWith('wh-') && !c.startsWith('widget-hider'))
                .slice(0, 2);
            if (cls.length) return `${node.tagName.toLowerCase()}.${cls.map(c => CSS.escape(c)).join('.')}`;
        }
        const parent = node.parentElement;
        if (!parent) return null;
        const idx = Array.from(parent.children).indexOf(node) + 1;
        return `${node.tagName.toLowerCase()}:nth-child(${idx})`;
    }

    function toastMsg(msg) {
        if (window.toastr) { window.toastr.info(msg, 'Widget Hider', { timeOut: 3000 }); return; }
        const toast = el('div');
        toast.style.cssText = `
            position:fixed;bottom:100px;left:50%;transform:translateX(-50%);z-index:9999999;
            background:var(--SmartThemeBlurTintColor, rgba(0,0,0,0.9));
            border:1px solid var(--SmartThemeBorderColor, #555);
            color:var(--SmartThemeBodyColor, #ccc);
            padding:14px 24px;border-radius:10px;font-size:14px;
            font-family:var(--mainFontFamily, Georgia, serif);
            pointer-events:none;text-align:center;
            animation:wh-toast-in .2s ease;max-width:90vw;`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        console.log('[Widget Hider] init() started');
        console.log('[Widget Hider] viewport:', window.innerWidth, 'x', window.innerHeight);
        console.log('[Widget Hider] fabVisible from storage:', fabVisible);
        console.log('[Widget Hider] fabPosition from storage:', fabPosition);
        console.log('[Widget Hider] isMobile:', isMobile);
        
        buildUI();
        initFabDrag();
        updateMenuState();
        
        // Сначала включаем display:flex у FAB через updateFabState,
        // чтобы applyFabPosition мог корректно измерить размеры кнопки
        updateFabState();
        applyFabPosition();
        if (isHidden) applyHiddenState();
        
        // Проверяем состояние FAB после инициализации
        const fab = document.getElementById(`${EXT_NAME}-fab`);
        if (fab) {
            const styles = window.getComputedStyle(fab);
            console.log('[Widget Hider] FAB element found');
            console.log('[Widget Hider] FAB classes:', fab.className);
            console.log('[Widget Hider] FAB computed display:', styles.display);
            console.log('[Widget Hider] FAB computed position:', styles.position);
            console.log('[Widget Hider] FAB computed right:', styles.right);
            console.log('[Widget Hider] FAB computed bottom:', styles.bottom);
            console.log('[Widget Hider] FAB computed left:', styles.left);
            console.log('[Widget Hider] FAB computed top:', styles.top);
            console.log('[Widget Hider] FAB getBoundingClientRect:', fab.getBoundingClientRect());
        } else {
            console.error('[Widget Hider] FAB element NOT found!');
        }
        
        // Re-apply after page settles (важно для мобильных:
        // мобильные браузеры могут менять innerHeight после старта из-за address bar)
        setTimeout(() => {
            console.log('[Widget Hider] 500ms re-apply');
            if (isHidden) applyHiddenState();
            updateMenuState();
            updateFabState();
            applyFabPosition();
            
            const fab2 = document.getElementById(`${EXT_NAME}-fab`);
            if (fab2) {
                console.log('[Widget Hider] FAB rect after 500ms:', fab2.getBoundingClientRect());
            }
        }, 500);
        
        setTimeout(() => {
            console.log('[Widget Hider] 2000ms re-apply');
            updateFabState();
            applyFabPosition();
        }, 2000);
        
        console.log('Widget Hider v2.7 - Ready (with debug logging)');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
