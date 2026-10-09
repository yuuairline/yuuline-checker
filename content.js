(() => {
    "use strict";

    const CHANNEL = "PROXY_ROTATION_BRIDGE_V1";

    const REQUEST_EVENT = "proxy-rotation-userscript";
    const RESPONSE_EVENT = "proxy-rotation-extension";

    // Сообщаем userscript, что bridge установлен
    document.documentElement.setAttribute(
        "data-proxy-rotation-bridge",
        "ready"
    );

    function sendToUserscript(data) {
        try {
            document.dispatchEvent(
                new CustomEvent(RESPONSE_EVENT, {
                    detail: JSON.stringify(data)
                })
            );
        } catch (error) {
            console.error(
                "[Proxy Rotation Bridge] Response error:",
                error
            );
        }
    }

    function parseMessage(detail) {
        if (!detail) {
            return null;
        }

        if (typeof detail === "string") {
            try {
                return JSON.parse(detail);
            } catch (error) {
                console.error(
                    "[Proxy Rotation Bridge] JSON parse error:",
                    error
                );

                return null;
            }
        }

        return detail;
    }

    async function handleUserscriptRequest(message) {
        if (!message) {
            return;
        }

        if (message.channel !== CHANNEL) {
            return;
        }

        if (message.direction !== "userscript-to-extension") {
            return;
        }

        try {
            console.log(
                "[Proxy Rotation Bridge] Request:",
                message.type
            );

            const result = await chrome.runtime.sendMessage({
                channel: CHANNEL,
                type: message.type,
                requestId: message.requestId || null,
                payload: message.payload || null
            });

            sendToUserscript({
                channel: CHANNEL,
                direction: "extension-to-userscript",
                type: "response",
                requestId: message.requestId || null,
                ok: result?.ok !== false,
                result: result || null,
                error: result?.ok === false
                    ? result.error
                    : null
            });

        } catch (error) {
            console.error(
                "[Proxy Rotation Bridge] Runtime error:",
                error
            );

            sendToUserscript({
                channel: CHANNEL,
                direction: "extension-to-userscript",
                type: "response",
                requestId: message.requestId || null,
                ok: false,
                error: error?.message || String(error)
            });
        }
    }

    // Userscript → Content Script
    document.addEventListener(
        REQUEST_EVENT,
        event => {
            const message = parseMessage(event.detail);

            if (!message) {
                return;
            }

            handleUserscriptRequest(message);
        }
    );

    // Background → Content Script → Userscript
    chrome.runtime.onMessage.addListener(
        message => {
            if (!message) {
                return;
            }

            if (message.channel !== CHANNEL) {
                return;
            }

            console.log(
                "[Proxy Rotation Bridge] Background message:",
                message.type
            );

            if (message.type === "event") {
                sendToUserscript({
                    channel: CHANNEL,
                    direction: "extension-to-userscript",
                    type: "event",
                    event: message.event,
                    payload: message.payload || null
                });
            }
        }
    );

    // Проверяем, что background.js доступен
    chrome.runtime.sendMessage({
        channel: CHANNEL,
        type: "hello",
        requestId: null
    }).then(result => {

        console.log(
            "[Proxy Rotation Bridge] Extension connected:",
            result
        );

    }).catch(error => {

        console.error(
            "[Proxy Rotation Bridge] Extension hello error:",
            error
        );

    });

    console.log(
        "[Proxy Rotation Bridge] Ready"
    );
})();