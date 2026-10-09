const CHANNEL = "PROXY_ROTATION_BRIDGE_V1";
const STORAGE_KEY = "proxyRotationExtensionState";

let activeProxy = null;
let proxyError = null;

const authAttempts = new Map();

const DEFAULT_STATE = {
    activeProxy: null,
    updatedAt: 0
};

function log(...args) {
    console.log("[Proxy Rotation Extension]", ...args);
}

async function loadState() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const state = data?.[STORAGE_KEY] || DEFAULT_STATE;

        activeProxy = state.activeProxy || null;

        log("State loaded:", publicProxy(activeProxy));
    } catch (error) {
        log("State load error:", error);
        activeProxy = null;
    }
}

async function saveState() {
    await chrome.storage.local.set({
        [STORAGE_KEY]: {
            activeProxy,
            updatedAt: Date.now()
        }
    });
}

function sanitizeProxy(proxy) {
    if (!proxy || typeof proxy !== "object") {
        throw new Error("Прокси не передан");
    }

    const host = String(proxy.host || "").trim();
    const port = Number(proxy.port);
    const scheme = String(proxy.scheme || "http").toLowerCase();

    const username =
        proxy.username == null
            ? ""
            : String(proxy.username);

    const password =
        proxy.password == null
            ? ""
            : String(proxy.password);

    if (!host) {
        throw new Error("Пустой host прокси");
    }

    if (
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65535
    ) {
        throw new Error(
            `Некорректный порт прокси: ${proxy.port}`
        );
    }

    if (
        ![
            "http",
            "https",
            "socks4",
            "socks5"
        ].includes(scheme)
    ) {
        throw new Error(
            `Неподдерживаемая схема прокси: ${scheme}`
        );
    }

    return {
        host,
        port,
        scheme,
        username,
        password
    };
}

function publicProxy(proxy) {
    if (!proxy) {
        return null;
    }

    return {
        host: proxy.host,
        port: proxy.port,
        scheme: proxy.scheme,
        hasCredentials: Boolean(proxy.username)
    };
}

function proxyConfig(proxy) {
    return {
        mode: "fixed_servers",

        rules: {
            singleProxy: {
                scheme: proxy.scheme,
                host: proxy.host,
                port: proxy.port
            },

            bypassList: [
                "<local>"
            ]
        }
    };
}

async function getProxySetting() {
    return chrome.proxy.settings.get({
        incognito: false
    });
}

async function verifyProxySetting(proxy) {
    const setting = await getProxySetting();

    const value = setting?.value;

    if (!value) {
        throw new Error(
            "Chrome не вернул текущую конфигурацию proxy"
        );
    }

    if (value.mode !== "fixed_servers") {
        throw new Error(
            `Chrome proxy mode: ${value.mode || "unknown"}`
        );
    }

    const current =
        value.rules?.singleProxy;

    if (!current) {
        throw new Error(
            "Chrome не вернул singleProxy"
        );
    }

    const sameHost =
        String(current.host || "").toLowerCase() ===
        String(proxy.host || "").toLowerCase();

    const samePort =
        Number(current.port) ===
        Number(proxy.port);

    const sameScheme =
        String(current.scheme || "").toLowerCase() ===
        String(proxy.scheme || "").toLowerCase();

    if (!sameHost || !samePort || !sameScheme) {
        throw new Error(
            `Chrome применил другой proxy: ` +
            `${current.scheme || "?"}://` +
            `${current.host || "?"}:` +
            `${current.port || "?"}`
        );
    }

    return setting;
}

async function setProxy(proxy) {
    const normalized = sanitizeProxy(proxy);

    log(
        "Applying proxy:",
        publicProxy(normalized)
    );

    proxyError = null;

    /*
     * Сбрасываем старые данные авторизации.
     * Это важно при переключении между разными прокси.
     */
    authAttempts.clear();

    /*
     * Проверяем, может ли расширение управлять proxy.
     */
    const before = await getProxySetting();

    log(
        "Current proxy control:",
        before?.levelOfControl
    );

    if (
        before?.levelOfControl ===
            "controlled_by_other_extensions" ||
        before?.levelOfControl ===
            "not_controllable"
    ) {
        throw new Error(
            `Chrome proxy setting is not controllable: ` +
            `${before.levelOfControl}`
        );
    }

    /*
     * Применяем новый proxy.
     */
    await chrome.proxy.settings.set({
        value: proxyConfig(normalized),
        scope: "regular"
    });

    /*
     * Даём Chrome небольшой момент применить настройку.
     */
    await new Promise(resolve =>
        setTimeout(resolve, 250)
    );

    /*
     * Проверяем, что настройка действительно записалась.
     */
    const effective =
        await verifyProxySetting(normalized);

    /*
     * Только после успешной проверки считаем
     * proxy активным.
     */
    activeProxy = normalized;

    proxyError = null;

    await saveState();

    log(
        "Proxy activated:",
        publicProxy(normalized)
    );

    log(
        "Effective Chrome proxy:",
        effective?.value
    );

    broadcast("PROXY_CHANGED", {
        proxy: publicProxy(activeProxy),
        effective: effective?.value || null
    });

    return {
        ok: true,

        proxy: publicProxy(activeProxy),

        effectiveMode:
            effective?.value?.mode || null,

        effectiveProxy:
            effective?.value?.rules?.singleProxy || null,

        levelOfControl:
            effective?.levelOfControl || null
    };
}

async function clearProxy() {
    authAttempts.clear();

    await chrome.proxy.settings.clear({
        scope: "regular"
    });

    activeProxy = null;
    proxyError = null;

    await saveState();

    log("Proxy settings cleared");

    broadcast("PROXY_CLEARED");

    return {
        ok: true
    };
}

async function getCurrentProxy() {
    const setting = await getProxySetting();
    const effective = setting?.value || null;
    const effectiveProxy = effective?.rules?.singleProxy || null;

    return {
        ok: true,
        proxy: publicProxy(activeProxy),
        effective,
        effectiveProxy,
        levelOfControl: setting?.levelOfControl || null,
        proxyError
    };
}

async function testProxy(timeoutMs = 10000) {
    if (!activeProxy) {
        return {
            ok: false,
            status: "UNAVAILABLE",
            error: "Активный прокси не установлен"
        };
    }

    const controller =
        new AbortController();

    const timer =
        setTimeout(
            () => controller.abort(),
            timeoutMs
        );

    try {
        log(
            "Testing external IP through:",
            publicProxy(activeProxy)
        );

        const response =
            await fetch(
                "https://api.ipify.org?format=json",
                {
                    cache: "no-store",
                    signal: controller.signal
                }
            );

        if (!response.ok) {
            return {
                ok: false,
                status: "ERROR",
                error:
                    `HTTP ${response.status}`
            };
        }

        const data =
            await response.json();

        const ip =
            data?.ip || null;

        log(
            "External IP:",
            ip
        );

        return {
            ok: true,
            status: "ACTIVE",
            ip,
            proxy:
                publicProxy(activeProxy)
        };

    } catch (error) {
        const message =
            error?.name === "AbortError"
                ? "TIMEOUT"
                : (
                    error?.message ||
                    String(error)
                );

        return {
            ok: false,

            status:
                error?.name === "AbortError"
                    ? "TIMEOUT"
                    : "ERROR",

            error: message
        };

    } finally {
        clearTimeout(timer);
    }
}

function handleProxyAuth(
    details,
    callback
) {
    try {
        if (!details?.isProxy) {
            callback({});
            return;
        }

        if (!activeProxy?.username) {
            callback({});
            return;
        }

        const challengeHost =
            String(
                details.challenger?.host || ""
            ).toLowerCase();

        const challengePort =
            Number(
                details.challenger?.port
            );

        const proxyHost =
            String(
                activeProxy.host || ""
            ).toLowerCase();

        const proxyPort =
            Number(
                activeProxy.port
            );

        if (
            challengeHost !== proxyHost ||
            challengePort !== proxyPort
        ) {
            callback({});
            return;
        }

        const requestId =
            details.requestId;

        const attempts =
            authAttempts.get(requestId) || 0;

        if (attempts >= 2) {
            authAttempts.delete(requestId);

            log(
                "Proxy auth failed:",
                requestId
            );

            callback({
                cancel: true
            });

            return;
        }

        authAttempts.set(
            requestId,
            attempts + 1
        );

        log(
            "Providing proxy credentials:",
            proxyHost,
            proxyPort,
            `attempt=${attempts + 1}`
        );

        callback({
            authCredentials: {
                username:
                    activeProxy.username,

                password:
                    activeProxy.password
            }
        });

    } catch (error) {
        log(
            "Auth handler error:",
            error
        );

        callback({
            cancel: true
        });
    }
}

function handleProxyError(details) {
    proxyError = {
        error:
            details?.error ||
            "Unknown proxy error",

        details:
            details?.details ||
            "",

        fatal:
            Boolean(details?.fatal),

        time:
            Date.now()
    };

    log(
        "PROXY ERROR:",
        proxyError
    );

    broadcast(
        "PROXY_ERROR",
        {
            ...proxyError,

            proxy:
                publicProxy(activeProxy)
        }
    );
}

function broadcast(
    event,
    payload = null
) {
    chrome.tabs
        .query({})
        .then(tabs => {
            for (const tab of tabs) {
                if (!tab.id) {
                    continue;
                }

                chrome.tabs
                    .sendMessage(
                        tab.id,
                        {
                            channel: CHANNEL,
                            type: "event",
                            event,
                            payload
                        }
                    )
                    .catch(() => {});
            }
        })
        .catch(() => {});
}

/*
 * Proxy authentication.
 */
chrome.webRequest.onAuthRequired.addListener(
    handleProxyAuth,
    {
        urls: ["<all_urls>"]
    },
    ["asyncBlocking"]
);

/*
 * Chrome proxy errors.
 */
chrome.proxy.onProxyError.addListener(
    handleProxyError
);

/*
 * Cleanup authentication attempts.
 */
chrome.webRequest.onCompleted.addListener(
    details => {
        authAttempts.delete(
            details.requestId
        );
    },
    {
        urls: ["<all_urls>"]
    }
);

chrome.webRequest.onErrorOccurred.addListener(
    details => {
        authAttempts.delete(
            details.requestId
        );
    },
    {
        urls: ["<all_urls>"]
    }
);

/*
 * Messages from content.js.
 */
chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {
        if (
            !message ||
            message.channel !== CHANNEL
        ) {
            return;
        }

        (async () => {
            try {
                switch (message.type) {

                    case "hello":
                        log(
                            "HELLO received"
                        );

                        return {
                            ok: true,
                            type: "hello",
                            extensionVersion:
                                chrome.runtime
                                    .getManifest()
                                    .version,
                            bridge: CHANNEL
                        };

                    case "setProxy":
                        return await setProxy(
                            message.payload?.proxy
                        );

                    case "getCurrentProxy":
                        return await getCurrentProxy();

                    case "testProxy":
                        return await testProxy(
                            Number(
                                message.payload
                                    ?.timeoutMs
                            ) || 10000
                        );

                    case "clearProxy":
                        return await clearProxy();

                    default:
                        throw new Error(
                            `Unknown command: ${message.type}`
                        );
                }

            } catch (error) {
                log(
                    "Command error:",
                    error
                );

                return {
                    ok: false,
                    error:
                        error?.message ||
                        String(error)
                };
            }

        })().then(sendResponse);

        return true;
    }
);

chrome.runtime.onInstalled.addListener(
    async () => {
        await loadState().catch(
            () => {}
        );

        log(
            "Installed/updated"
        );
    }
);

loadState()
    .then(() => {
        log(
            "Service worker initialized"
        );

        log(
            "Active proxy:",
            publicProxy(activeProxy)
        );
    })
    .catch(error => {
        log(
            "State load error:",
            error
        );
    });