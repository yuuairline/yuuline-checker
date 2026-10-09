// ==UserScript==
// @name         Tanki Online — Checker prod. by yuuairline
// @namespace    http://tampermonkey.net/
// @version      1.0.6
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
    const EXPECTED_VERSION = "1.0.6";

    function stripUserScriptHeader(code) {
        return String(code || "").replace(
            /\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/m,
            ""
        );
    }

    function runCode(code, from) {
        const body = stripUserScriptHeader(code).trim();
        if (!body) {
            console.error("[Tanki Checker] Empty source from", from);
            return;
        }
        try {
            eval(body);
            console.log("[Tanki Checker] Loaded from", from);
        } catch (err) {
            console.error("[Tanki Checker] Execute error:", err);
        }
    }

    function loadFromCache() {
        try {
            const ver = GM_getValue(CACHE_VER_KEY, "");
            const code = GM_getValue(CACHE_KEY, "");
            if (code && ver) {
                runCode(code, "cache@" + ver);
                return true;
            }
        } catch (_) {}
        return false;
    }

    function saveCache(code) {
        try {
            GM_setValue(CACHE_KEY, code);
            GM_setValue(CACHE_VER_KEY, EXPECTED_VERSION);
        } catch (_) {}
    }

    function fetchRemote(thenRun) {
        GM_xmlhttpRequest({
            method: "GET",
            url: SOURCE_URL + "?t=" + Date.now(),
            headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache"
            },
            onload(res) {
                if (res.status >= 200 && res.status < 300 && res.responseText) {
                    saveCache(res.responseText);
                    if (thenRun) runCode(res.responseText, "github");
                } else {
                    console.error(
                        "[Tanki Checker] GitHub HTTP",
                        res.status,
                        SOURCE_URL
                    );
                    if (thenRun && !loadFromCache()) {
                        console.error("[Tanki Checker] No cache fallback");
                    }
                }
            },
            onerror() {
                console.error("[Tanki Checker] Network error", SOURCE_URL);
                if (thenRun && !loadFromCache()) {
                    console.error("[Tanki Checker] No cache fallback");
                }
            }
        });
    }

    const hadCache = loadFromCache();
    fetchRemote(!hadCache);
})();
