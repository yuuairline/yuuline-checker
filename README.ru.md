# Tanki Online — Checker

Userscript для [Tampermonkey](https://www.tampermonkey.net/): проверка аккаунтов, Daily Rubies, FastValid, опциональное авто-включение 2FA и ротация прокси через Companion-расширение Chrome.

**Автор:** [yuuairline](https://github.com/yuuairline)

---

## Установка (Tampermonkey)

Ставится **только загрузчик**, не полный код:

**→ [Установить loader](https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js)**

1. Установи [Tampermonkey](https://www.tampermonkey.net/)
2. Открой ссылку выше → **Установить**
3. Зайди в игру: `https://*.tankionline.com/play/`
4. Нажми **F8** — откроется панель

Loader скачивает полный скрипт с GitHub, кэширует его и запускает.  
Вставлять весь код в Tampermonkey **не нужно**.

| Файл | Назначение |
|------|------------|
| `tanki-checker-loader.user.js` | **Его ставить** в Tampermonkey |
| `tanki-checker.user.js` | Полный исходник на GitHub (подгружается loader’ом) |

---

## Структура репозитория

```text
yuuline-checker/
├── tanki-checker-loader.user.js    # загрузчик для Tampermonkey
├── tanki-checker.user.js           # полный userscript (удалённый исходник)
├── README.md                       # English
├── README.ru.md                    # Русский
└── proxy-rotation/                 # расширение Chrome (MV3)
    ├── manifest.json
    ├── background.js
    └── content.js
```

---

## Ротация прокси (расширение Chrome)

Userscript **сам** не может переключить системный прокси Chrome.  
Для этого нужна папка **`proxy-rotation/`** — расширение MV3.

### Установка расширения

1. Chrome → `chrome://extensions`
2. Включи **Режим разработчика**
3. **Загрузить распакованное** → укажи папку `proxy-rotation`
4. Оставь расширение **включённым**, пока пользуешься чекером

### Использование

1. Панель (**F8**) → **Settings** → блок Proxy rotation  
2. Вставь прокси (по одному на строку):

```text
http://1.2.3.4:8080:user:pass
socks5://1.2.3.4:1080:user:pass
1.2.3.4:8080:user:pass
```

Поддерживаются: `http`, `https`, `socks4`, `socks5`.

Канал связи: `PROXY_ROTATION_BRIDGE_V1` (скрипт ↔ расширение).

Без расширения чекер работает, но прокси-команды покажут, что bridge недоступен.

---

## Возможности

| Модуль | Описание |
|--------|----------|
| **Checker** | Проверка логина, ранг, опыт, валюты, смена ника, привязка |
| **Daily Rubies** | Очередь аккаунтов, сбор ежедневных рубинов, архив завершённых |
| **FastValid** | Отдельная база для быстрой проверки |
| **2FA** | Опциональный авто-ввод 2FA, локальные секреты, живые TOTP-коды |
| **Proxy rotation** | Смена прокси через расширение Chrome |
| **Import / Export** | TXT для аккаунтов, результатов, рубинов, 2FA |

---

## Режимы

- **Checker** — полная проверка  
- **FastValid** — только база FastValid  
- **Daily Rubies** — сбор дейликов  

**Start / Pause / Stop** в панели. Состояние хранится в Tampermonkey (`GM_setValue`).

---

## 2FA

В **Settings** можно включить автоматическое включение 2FA при проверке.

- Секреты только **локально** (GM storage)  
- Вкладка **2FA**: коды, таймер, экспорт/импорт  
- Импорт в Daily Rubies со строкой `2FA secret - …` сам привязывает секрет  

Не коммить секреты в GitHub.

---

## Форматы импорта

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

## Обновления

1. Правишь и пушишь `tanki-checker.user.js` на GitHub  
2. Поднимаешь `@version` в loader и в полном скрипте  
3. При следующем входе в игру loader подтянет новый код  

После правок расширения нажми **Обновить** на `chrome://extensions`.

---

## Безопасность

- Публичный репозиторий = **только код**  
- Не заливай пароли, 2FA-секреты, прокси и Discord webhook  
- Данные аккаунтов остаются в хранилище Tampermonkey / расширения  

---

## Отказ от ответственности

Скрипт предоставляется «как есть» для личного использования.  
Соблюдение правил игры и безопасность аккаунтов — на твоей стороне.

---

## Ссылки

- Loader (установка): https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker-loader.user.js  
- Полный исходник: https://raw.githubusercontent.com/yuuairline/yuuline-checker/main/tanki-checker.user.js  
- English readme: [README.md](./README.md)  
