// ==UserScript==
// @name         Tanki Checker Loader
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @match        https://*.tankionline.com/play/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @run-at       document-end
// ==/UserScript==

(function () {
    const OWNER = "yuuairline", REPO = "yuuline-checker", BRANCH = "main", FILE = "tanki-checker.user.js";
    const API = `https://api.github.com/repos/${OWNER}/${REPO}/commits?path=${FILE}&sha=${BRANCH}&per_page=1`;
    const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${FILE}`;

    const get = (k, d = "") => { try { return GM_getValue(k, d); } catch { return d; } };
    const set = (k, v) => { try { GM_setValue(k, v); } catch {} };

    const run = (code) => {
        const body = String(code || "").replace(/\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/m, "").trim();
        if (!body) return;
        try { eval(body); } catch (e) { console.error("[Loader]", e); }
    };

    const cachedCode = get("tc_src"), cachedSha = get("tc_sha");
    if (cachedCode) run(cachedCode);

    GM_xmlhttpRequest({
        method: "GET", url: API + "?t=" + Date.now(),
        headers: { "Accept": "application/vnd.github+json" },
        onload: (r) => {
            let sha;
            try { sha = JSON.parse(r.responseText)[0].sha; } catch { return; }
            if (sha === cachedSha) return console.log("[Loader] up to date");

            GM_xmlhttpRequest({
                method: "GET", url: RAW + "?t=" + Date.now(),
                onload: (r2) => {
                    if (r2.status !== 200) return;
                    set("tc_src", r2.responseText);
                    set("tc_sha", sha);
                    if (!cachedCode) run(r2.responseText);      
                    else console.log("[Loader] update ready, reload page");
                }
            });
        }
    });
})();
