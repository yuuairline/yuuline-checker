# Tanki Online — Checker

Tampermonkey userscript for Tanki Online: account checker, Daily Rubies, FastValid, optional auto 2FA, and proxy rotation via a companion Chrome extension.

**Author:** [yuuairline](https://github.com/yuuairline)

---

## Install (Tampermonkey)

Install **only the loader** — not the full source:

**→ [Install loader](https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js)**

1. Install [Tampermonkey](https://www.tampermonkey.net/)
2. Open the link above → **Install**
3. Go to `https://*.tankionline.com/play/`
4. Press **F8** to open the panel

The loader fetches the full script from GitHub, caches it, and runs it.  
You should not paste the full code into Tampermonkey.

| File | Purpose |
|------|---------|
| `tanki-checker-loader.user.js` | **Install this** in Tampermonkey |
| `tanki-checker.user.js` | Full source on GitHub (loaded by the loader) |

---

## Repository structure

```text
yuuline-checker/
├── tanki-checker-loader.user.js    # Tampermonkey loader
├── tanki-checker.user.js           # Full userscript (remote source)
├── README.md                       # English
├── README.ru.md                    # Русский
└── proxy-rotation/                 # Chrome extension (MV3)
    ├── manifest.json
    ├── background.js
    └── content.js
```

---

## Proxy rotation (Chrome extension)

Userscripts cannot change Chrome’s proxy settings alone.  
Use the companion extension in `proxy-rotation/`.

### Install extension

1. Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `proxy-rotation` folder
4. Leave the extension enabled while using the checker

### Usage

1. Open the panel (**F8**) → **Settings** → Proxy rotation  
2. Add proxies (one per line):

```text
http://1.2.3.4:8080:user:pass
socks5://1.2.3.4:1080:user:pass
1.2.3.4:8080:user:pass
```

Supported: `http`, `https`, `socks4`, `socks5`.

Bridge channel: `PROXY_ROTATION_BRIDGE_V1` (userscript ↔ extension).

Without the extension the checker still works; proxy controls will report that the bridge is offline.

---

## Features

| Module | Description |
|--------|-------------|
| **Checker** | Validate logins, rank, XP, currencies, nick change, binding |
| **Daily Rubies** | Queue accounts, claim daily ruby missions, archive finished |
| **FastValid** | Separate DB for quick validation |
| **2FA** | Optional auto-enable on check, local secrets, live TOTP codes |
| **Proxy rotation** | Rotate proxies through the Chrome extension |
| **Import / Export** | TXT import/export for accounts, results, rubies, 2FA |

---

## Modes

- **Checker** — full account check  
- **FastValid** — FastValid database only  
- **Daily Rubies** — collect daily missions  

Use **Start / Pause / Stop** in the panel. State is stored in Tampermonkey (`GM_setValue`).

---

## 2FA

In **Settings**, enable automatic 2FA on check if needed.

- Secrets are stored **locally** in GM storage  
- Tab **2FA**: live codes, countdown, export/import  
- Daily Rubies import with `2FA secret - …` attaches secrets automatically  

Do not commit secrets to GitHub.

---

## Import formats

```text
login:password
login;password
```

```text
--------------------------
Логин - example
Пароль - secretpass
Почта - mail@example.com
2FA secret - ABCD2EFG3HIJKLMNOPQRSTUVWXYZ234567
--------------------------
```

---

## Updates

1. Edit and push `tanki-checker.user.js` on GitHub  
2. Bump `@version` in the loader and the full script  
3. On next game load the loader pulls the new source  

After changing the extension, click **Reload** on `chrome://extensions`.

---

## Security

- Public repo = **code only**  
- Never commit passwords, 2FA secrets, proxies, or Discord webhooks  
- Credentials stay in Tampermonkey / extension storage on your machine  

---

## Disclaimer

Provided as-is for personal use.  
You are responsible for compliance with the game’s terms of service and for securing your accounts and tools.

---

## Links

- Loader (install): https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js  
- Full source: https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker.user.js  
- Russian readme: [README.ru.md](./README.ru.md)  
