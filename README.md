# Tanki Online — Checker

Userscript for [Tampermonkey](https://www.tampermonkey.net/): account checking, Daily Rubies collection, FastValid database, and optional automatic 2FA setup.

**Author:** yuuairline  
**Install (raw):**  
https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker.user.js

---

## Install

1. Install **Tampermonkey** (Chrome / Firefox / Edge).
2. Open the install link above — TM will offer to add the script.
3. Confirm installation.
4. Open the game: `https://*.tankionline.com/play/`
5. Press **F8** to open the panel (menu key can be changed in Settings).

### Updates

The script header includes `@updateURL` / `@downloadURL`.  
Tampermonkey can check for new versions automatically (enable updates in the script settings).  
After each release, `@version` in the file is bumped.

---

## Features

| Module | Description |
|--------|-------------|
| **Checker** | Login validation, rank / experience / currencies, nickname change & binding info, optional Discord notify |
| **Daily Rubies** | Queue of accounts, collect daily ruby missions, archive finished subscriptions |
| **FastValid** | Separate lightweight account DB for fast validation |
| **2FA** | Optional auto-enable 2FA in checker mode, TOTP storage, live codes in UI, import for Daily Rubies login |
| **Proxy rotation** | Optional proxy list & rotation helpers in Settings |
| **Import / Export** | TXT import/export for accounts, results, Daily Rubies, 2FA secrets |

---

## Modes

Open the panel (**F8**) → **Checker** / **Daily Rubies** and pick a mode:

- **Checker** — full account check flow  
- **FastValid** — check against the FastValid DB only  
- **Daily Rubies** — walk the rubies queue, collect missions, skip finished / no-daily accounts  
- **Nickname** (if enabled in your build) — nickname-related flow  

Use **Start / Pause / Stop** in the panel. State is kept in `GM` storage across reloads.

---

## 2FA

### Auto-enable (Checker)

In **Settings** enable:

**«Автоматически включать 2FA при проверке»** (`AUTO_ENABLE_2FA`)

When checking an account, the script can:

1. Open Settings → Security  
2. Start 2FA setup, read the Base32 secret  
3. Generate TOTP and activate  
4. Save secret to local GM storage (`tanki_2fa_accounts_v1`)

Secrets are **local by default**. Discord messages can include the secret in spoiler form (`||secret||`) only as part of the valid-account embed if you use webhooks — do not share webhooks publicly.

### UI tab «2FA»

- Live 6-digit codes + countdown  
- Copy code / delete entry  
- Export TXT  
- Import blocks that contain `2FA secret - …`

### Daily Rubies + 2FA

If you import accounts with a `2FA secret` line into Daily Rubies, secrets are linked automatically.  
On login, the script can fill the security code from the stored secret.

---

## Import formats

### Simple

```text
login:password
login;password
```

### Block (Checker / Daily Rubies / 2FA)

```text
--------------------------
Логин - example
Пароль - secretpass
Ник - example
Почта - mail@example.com
2FA secret - ABCD2EFG3HIJKLMNOPQRSTUVWXYZ234567
Ранг - Мастер-сержант
Опыт - 20000
Рубины - 150
Кристаллы - 1000
Танкоины - 10
Привязан - да
--------------------------
```

### Daily Rubies export (example)

```text
---------------------------------------------
Логин - example
Пароль - secretpass
Почта - mail@example.com
Ранг - Сержант-майор
Статус рубинов - Собрано
Прогресс рубинов - 1/10
Количество рубинов - 150
2FA secret - ...
---------------------------------------------
```

---

## Settings (panel)

Typical options:

- Discord webhook URL  
- Discord notifications for rubies / valid accounts  
- Theme: dark / light  
- Check interval  
- Auto Daily Rubies schedule  
- Skip finished rubies subscriptions  
- **Auto-enable 2FA** on check  
- Proxy list / rotation (if used)

All settings are stored via `GM_setValue` in the browser profile.

---

## Discord

Optional. Set webhook in **Settings**.

Valid account embeds can include login, rank, currencies, binding, and 2FA secret (spoiler).  
Avoid posting webhook URLs or exported secrets in public chats.

---

## Storage keys (GM)

Examples (versioned suffixes may change between builds):

| Key | Purpose |
|-----|---------|
| `tanki_accounts_v71` | Main account library |
| `tanki_rubies_accounts_v72` | Daily Rubies active list |
| `tanki_rubies_accounts_archive_v81` | Finished / no-daily archive |
| `tanki_valid_results_v90` | Valid check results |
| `tanki_2fa_accounts_v1` | 2FA secrets |
| `tanki_settings_v71` | Panel settings |

Clearing data: use panel actions or Tampermonkey storage for this script.

---

## Requirements

- Tampermonkey (or compatible userscript manager)  
- Access to Tanki Online play client in the browser  
- For Discord: a webhook you control  
- For 2FA auto-login: secrets must exist in the 2FA tab / import  

---

## Safety

- Do **not** commit real account lists, passwords, or 2FA secrets to GitHub.  
- Keep the repo **code-only**; store credentials only in TM local storage.  
- Public raw URL is enough for install/update; private account data stays in the browser.  

---

## File

| File | Description |
|------|-------------|
| `tanki-checker.user.js` | Main userscript |

---

## License / disclaimer

Provided as-is for personal automation use.  
You are responsible for compliance with the game’s terms of service and for securing your accounts and webhooks.
