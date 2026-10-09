// ==UserScript==
// @name         Tanki Online — Checker prod. by yuuairline
// @namespace    http://tampermonkey.net/
// @version      1.0.7
// @description  Checker + Daily Rubies + FastValid + auto 2FA (loader from GitHub)
// @author       yuuairline
// @match        https://*.tankionline.com/play/*
// @match        https://*.tankionline.com/play/
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      github.com
// @connect      *
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js
// @downloadURL  https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js
// ==/UserScript==

(function () {
    "use strict";

    const SOURCE_URL =
        "https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker.user.js";

    const CACHE_KEY = "tc_remote_src_v1";
    const CACHE_VER_KEY = "tc_remote_src_ver_v1";
    const LAST_NOTIFIED_VER_KEY = "tc_last_notified_ver_v1";

    let didRun = false;

    function parseVersion(code) {
        const m = String(code || "").match(/\/\/\s*@version\s+([0-9]+(?:\.[0-9]+)*)/);
        return m ? m[1] : "";
    }

    function cmpVersion(a, b) {
        const pa = String(a || "0").split(".").map(n => parseInt(n, 10) || 0);
        const pb = String(b || "0").split(".").map(n => parseInt(n, 10) || 0);
        const len = Math.max(pa.length, pb.length);
        for (let i = 0; i < len; i++) {
            const x = pa[i] || 0;
            const y = pb[i] || 0;
            if (x > y) return 1;
            if (x < y) return -1;
        }
        return 0;
    }

    function stripUserScriptHeader(code) {
        return String(code || "").replace(
            /\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/m,
            ""
        );
    }

    function showUpdateBanner(oldVer, newVer) {
        try {
            const last = GM_getValue(LAST_NOTIFIED_VER_KEY, "");
            if (last === newVer) return;
            GM_setValue(LAST_NOTIFIED_VER_KEY, newVer);
        } catch (_) {}

        const id = "tc-update-banner";
        if (document.getElementById(id)) return;

        const el = document.createElement("div");
        el.id = id;
        el.innerHTML =
            '<div style="font-weight:800;margin-bottom:4px">Tanki Checker — новое обновление</div>' +
            '<div style="opacity:.9;margin-bottom:10px">v' +
            (oldVer || "?") +
            " → <b>v" +
            newVer +
            "</b>. Код уже скачан. Перезагрузите страницу, чтобы применить.</div>" +
            '<div style="display:flex;gap:8px">' +
            '<button type="button" data-tc-reload style="cursor:pointer;padding:6px 12px;border:0;border-radius:8px;background:#c43b6e;color:#fff;font-weight:700">Перезагрузить</button>' +
            '<button type="button" data-tc-dismiss style="cursor:pointer;padding:6px 12px;border:0;border-radius:8px;background:rgba(255,255,255,.12);color:#fff;font-weight:600">Позже</button>' +
            "</div>";

        Object.assign(el.style, {
            position: "fixed",
            right: "16px",
            bottom: "16px",
            zIndex: "2147483646",
            maxWidth: "360px",
            padding: "14px 16px",
            borderRadius: "14px",
            background: "rgba(12,12,16,.94)",
            color: "#f2f2f5",
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: "0 16px 40px rgba(0,0,0,.45)",
            font:
                "13px/1.45 Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
        });

        el.querySelector("[data-tc-reload]")?.addEventListener("click", () => {
            location.reload();
        });
        el.querySelector("[data-tc-dismiss]")?.addEventListener("click", () => {
            el.remove();
        });

        const mount = () => {
            if (!document.body) return void setTimeout(mount, 100);
            document.body.appendChild(el);
        };
        mount();
    }

    function runCode(code, from) {
        if (didRun) return;
        const body = stripUserScriptHeader(code).trim();
        if (!body) {
            console.error("[Tanki Checker] Empty source from", from);
            return;
        }
        try {
            eval(body);
            didRun = true;
            console.log("[Tanki Checker] Loaded from", from);
        } catch (err) {
            console.error("[Tanki Checker] Execute error:", err);
        }
    }

    function loadFromCache() {
        try {
            const ver = GM_getValue(CACHE_VER_KEY, "");
            const code = GM_getValue(CACHE_KEY, "");
            if (code) {
                runCode(code, "cache@" + (ver || "?"));
                return { ok: true, ver, code };
            }
        } catch (_) {}
        return { ok: false, ver: "", code: "" };
    }

    function saveCache(code, ver) {
        try {
            GM_setValue(CACHE_KEY, code);
            if (ver) GM_setValue(CACHE_VER_KEY, ver);
        } catch (_) {}
    }

    function fetchRemote(cacheInfo) {
        GM_xmlhttpRequest({
            method: "GET",
            url: SOURCE_URL + "?t=" + Date.now(),
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache"
            },
            onload(res) {
                if (!(res.status >= 200 && res.status < 300 && res.responseText)) {
                    console.error("[Tanki Checker] GitHub HTTP", res.status);
                    if (!didRun) loadFromCache();
                    return;
                }

                const remoteCode = res.responseText;
                const remoteVer = parseVersion(remoteCode) || "0";
                const localVer = cacheInfo.ver || parseVersion(cacheInfo.code) || "";

                saveCache(remoteCode, remoteVer);

                if (!didRun) {
                    runCode(remoteCode, "github@" + remoteVer);
                    return;
                }

                if (localVer && cmpVersion(remoteVer, localVer) > 0) {
                    console.log(
                        "[Tanki Checker] Update available:",
                        localVer,
                        "→",
                        remoteVer
                    );
                    showUpdateBanner(localVer, remoteVer);
                } else {
                    console.log("[Tanki Checker] Source up to date:", remoteVer);
                }
            },
            onerror() {
                console.error("[Tanki Checker] Network error", SOURCE_URL);
                if (!didRun) loadFromCache();
            }
        });
    }

    const cacheInfo = loadFromCache();
    fetchRemote(cacheInfo);
})();
