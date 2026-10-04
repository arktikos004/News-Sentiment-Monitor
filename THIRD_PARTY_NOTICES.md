# 第三方套件與授權

盤點日：2026-10-04。Python 以 `pip-licenses`、前端以 `license-checker` 對實際安裝的版本產生；
資料、資料集與模型的來源與授權另見 [DATA_SOURCES.md](DATA_SOURCES.md)，生成式 AI 的使用見 [AI_USE.md](AI_USE.md)。

## 需要特別說明的項目

**本專案沒有使用 GPL 或 AGPL 授權的套件。** 下表列出弱 copyleft、有署名要求，或會隨網站散布的項目。

| 項目 | 授權 | 用在哪裡 | 是否隨成果散布 | 說明 |
| --- | --- | --- | --- | --- |
| certifi | MPL-2.0 | Python 的 HTTPS 憑證清單 | 否 | 只在伺服端與排程使用，未修改原始碼 |
| tqdm | MPL-2.0 AND MIT | 訓練時的進度列 | 否 | 只在本機訓練使用，未修改原始碼 |
| `@img/sharp-*`、`@img/sharp-libvips-*` | Apache-2.0 AND LGPL-3.0-or-later | Next.js 的選用影像處理相依（依作業系統安裝其一） | 否 | 只存在於建置環境；網站是靜態輸出，不含這些二進位檔 |
| lightningcss | MPL-2.0 | CSS 建置工具 | 否 | 只在建置時執行 |
| axe-core | MPL-2.0 | ESLint 外掛的相依 | 否 | 開發工具 |
| caniuse-lite | CC-BY-4.0 | 瀏覽器相容性資料 | 否 | 只在建置時讀取 |
| argparse（npm） | Python-2.0 | 開發工具的相依 | 否 | 開發工具 |
| 字型 IBM Plex Sans、IBM Plex Mono | SIL Open Font License 1.1 | 網站字型 | 是 | 由 `next/font` 在建置時下載並隨網站提供，未修改 |

## Python 套件（後端 API、每日排程與模型訓練；不隨網站散布）

| 套件 | 版本 | 授權 |
| --- | --- | --- |
| accelerate | 1.14.0 | Apache-2.0 |
| annotated-doc | 0.0.5 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.15.1 | MIT |
| beautifulsoup4 | 4.15.0 | MIT |
| certifi | 2026.7.22 | MPL-2.0 |
| cffi | 2.1.1 | MIT-0 |
| charset-normalizer | 3.5.2 | MIT |
| click | 8.5.0 | BSD-3-Clause |
| colorama | 0.4.6 | BSD |
| cryptography | 50.0.2 | Apache-2.0 OR BSD-3-Clause |
| curl_cffi | 0.16.3 | MIT |
| Deprecated | 3.0.0 | MIT |
| fastapi | 0.139.0 | MIT |
| filelock | 3.32.3 | MIT |
| fsspec | 2026.7.0 | BSD-3-Clause |
| h11 | 0.16.0 | MIT |
| hf-xet | 1.6.0 | Apache-2.0 |
| httpcore | 1.0.9 | BSD-3-Clause |
| httptools | 0.8.0 | MIT |
| httpx | 0.28.1 | BSD |
| huggingface_hub | 1.23.0 | Apache-2.0 |
| idna | 3.20 | BSD-3-Clause |
| iniconfig | 2.3.0 | MIT |
| Jinja2 | 3.1.6 | BSD |
| joblib | 1.5.3 | BSD-3-Clause |
| limits | 5.8.0 | MIT |
| lxml | 6.1.3 | BSD-3-Clause |
| markdown-it-py | 4.2.0 | MIT |
| MarkupSafe | 3.0.3 | BSD-3-Clause |
| mdurl | 0.1.2 | MIT |
| mpmath | 1.3.0 | BSD |
| multitasking | 0.0.13 | Apache-2.0 |
| narwhals | 2.26.0 | MIT |
| networkx | 3.6.1 | BSD-3-Clause |
| numpy | 2.5.1 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| packaging | 26.3 | Apache-2.0 OR BSD-2-Clause |
| pandas | 3.0.3 | BSD |
| peewee | 4.5.2 | MIT（metadata 未填，依套件隨附 LICENSE 檔） |
| platformdirs | 4.12.3 | MIT |
| pluggy | 1.6.0 | MIT |
| protobuf | 7.36.2 | BSD-3-Clause |
| psutil | 7.2.2 | BSD-3-Clause |
| pycparser | 3.0 | BSD-3-Clause |
| pydantic | 2.13.4 | MIT |
| pydantic_core | 2.46.4 | MIT |
| Pygments | 2.21.0 | BSD-2-Clause |
| pytest | 9.1.1 | MIT |
| python-dateutil | 2.9.0.post0 | Apache-2.0 OR BSD |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| pytz | 2026.5 | MIT |
| PyYAML | 6.0.3 | MIT |
| regex | 2026.7.10 | Apache-2.0 AND CNRI-Python |
| requests | 2.34.2 | Apache-2.0 |
| rich | 15.0.0 | MIT |
| safetensors | 0.8.0 | Apache-2.0 |
| scikit-learn | 1.9.0 | BSD-3-Clause |
| scipy | 1.18.0 | BSD |
| shellingham | 1.5.4 | ISC |
| six | 1.17.0 | MIT |
| slowapi | 0.1.10 | MIT |
| soupsieve | 2.10 | MIT |
| starlette | 1.3.1 | BSD-3-Clause |
| sympy | 1.14.0 | BSD |
| threadpoolctl | 3.7.0 | BSD-3-Clause |
| tokenizers | 0.22.2 | Apache-2.0 |
| torch | 2.11.0+cpu | BSD-3-Clause |
| tqdm | 4.70.1 | MPL-2.0 AND MIT |
| transformers | 5.13.0 | Apache-2.0 |
| typer | 0.27.2 | MIT |
| typing-inspection | 0.4.4 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.3 | Apache-2.0 |
| urllib3 | 2.8.0 | MIT |
| uvicorn | 0.51.0 | BSD-3-Clause |
| watchfiles | 1.3.0 | MIT |
| websockets | 17.2 | BSD-3-Clause |
| wrapt | 2.5.0 | BSD-2-Clause |
| yfinance | 1.7.0 | Apache-2.0 |

深度學習框架 torch 在雲端排程安裝 CPU 版；本機訓練使用 CUDA 版時，另含 NVIDIA 的 CUDA 執行階段函式庫（依 NVIDIA 授權條款，僅在本機使用、不散布）。

## 前端正式相依（`dependencies` 及其相依）

其中只有在瀏覽器執行的程式（React、Next.js 的用戶端執行階段、圖表與 UI 元件）會打包進靜態網站；`@img/sharp-*`、`caniuse-lite` 等是 Next.js 在建置或伺服端才用到的相依，不在網站輸出裡。

| 套件 | 版本 | 授權 |
| --- | --- | --- |
| @floating-ui/core | 1.8.0 | MIT |
| @floating-ui/dom | 1.8.0 | MIT |
| @floating-ui/react-dom | 2.1.9 | MIT |
| @floating-ui/utils | 0.2.12 | MIT |
| @img/colour | 1.1.0 | MIT |
| @img/sharp-win32-x64 | 0.34.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @next/env | 16.2.10 | MIT |
| @next/swc-win32-x64-msvc | 16.2.10 | MIT |
| @radix-ui/number | 1.1.3 | MIT |
| @radix-ui/primitive | 1.1.7 | MIT |
| @radix-ui/react-accessible-icon | 1.1.15 | MIT |
| @radix-ui/react-accordion | 1.2.20 | MIT |
| @radix-ui/react-alert-dialog | 1.1.23 | MIT |
| @radix-ui/react-arrow | 1.1.15 | MIT |
| @radix-ui/react-aspect-ratio | 1.1.15 | MIT |
| @radix-ui/react-avatar | 1.2.6 | MIT |
| @radix-ui/react-checkbox | 1.3.11 | MIT |
| @radix-ui/react-collapsible | 1.1.20 | MIT |
| @radix-ui/react-collection | 1.1.15 | MIT |
| @radix-ui/react-compose-refs | 1.1.5 | MIT |
| @radix-ui/react-context | 1.2.2 | MIT |
| @radix-ui/react-context-menu | 2.3.7 | MIT |
| @radix-ui/react-dialog | 1.1.23 | MIT |
| @radix-ui/react-direction | 1.1.4 | MIT |
| @radix-ui/react-dismissable-layer | 1.1.19 | MIT |
| @radix-ui/react-dropdown-menu | 2.1.24 | MIT |
| @radix-ui/react-focus-guards | 1.1.6 | MIT |
| @radix-ui/react-focus-scope | 1.1.16 | MIT |
| @radix-ui/react-form | 0.1.16 | MIT |
| @radix-ui/react-hover-card | 1.1.23 | MIT |
| @radix-ui/react-id | 1.1.4 | MIT |
| @radix-ui/react-label | 2.1.15 | MIT |
| @radix-ui/react-menu | 2.1.24 | MIT |
| @radix-ui/react-menubar | 1.1.24 | MIT |
| @radix-ui/react-navigation-menu | 1.2.22 | MIT |
| @radix-ui/react-one-time-password-field | 0.1.16 | MIT |
| @radix-ui/react-password-toggle-field | 0.1.11 | MIT |
| @radix-ui/react-popover | 1.1.23 | MIT |
| @radix-ui/react-popper | 1.3.7 | MIT |
| @radix-ui/react-portal | 1.1.17 | MIT |
| @radix-ui/react-presence | 1.1.10 | MIT |
| @radix-ui/react-primitive | 2.1.10 | MIT |
| @radix-ui/react-progress | 1.1.16 | MIT |
| @radix-ui/react-radio-group | 1.4.7 | MIT |
| @radix-ui/react-roving-focus | 1.1.19 | MIT |
| @radix-ui/react-scroll-area | 1.2.18 | MIT |
| @radix-ui/react-select | 2.3.7 | MIT |
| @radix-ui/react-separator | 1.1.15 | MIT |
| @radix-ui/react-slider | 1.4.7 | MIT |
| @radix-ui/react-slot | 1.3.3 | MIT |
| @radix-ui/react-switch | 1.3.7 | MIT |
| @radix-ui/react-tabs | 1.1.21 | MIT |
| @radix-ui/react-toast | 1.2.23 | MIT |
| @radix-ui/react-toggle | 1.1.18 | MIT |
| @radix-ui/react-toggle-group | 1.1.19 | MIT |
| @radix-ui/react-toolbar | 1.1.19 | MIT |
| @radix-ui/react-tooltip | 1.2.16 | MIT |
| @radix-ui/react-use-callback-ref | 1.1.4 | MIT |
| @radix-ui/react-use-controllable-state | 1.2.6 | MIT |
| @radix-ui/react-use-effect-event | 0.0.5 | MIT |
| @radix-ui/react-use-escape-keydown | 1.1.5 | MIT |
| @radix-ui/react-use-is-hydrated | 0.1.3 | MIT |
| @radix-ui/react-use-layout-effect | 1.1.4 | MIT |
| @radix-ui/react-use-previous | 1.1.4 | MIT |
| @radix-ui/react-use-rect | 1.1.4 | MIT |
| @radix-ui/react-use-size | 1.1.4 | MIT |
| @radix-ui/react-visually-hidden | 1.2.11 | MIT |
| @radix-ui/rect | 1.1.3 | MIT |
| @reduxjs/toolkit | 2.12.0 | MIT |
| @standard-schema/spec | 1.1.0 | MIT |
| @standard-schema/utils | 0.3.0 | MIT |
| @swc/helpers | 0.5.15 | Apache-2.0 |
| @types/d3-array | 3.2.2 | MIT |
| @types/d3-color | 3.1.3 | MIT |
| @types/d3-ease | 3.0.2 | MIT |
| @types/d3-interpolate | 3.0.4 | MIT |
| @types/d3-path | 3.1.1 | MIT |
| @types/d3-scale | 4.0.9 | MIT |
| @types/d3-shape | 3.2.0 | MIT |
| @types/d3-time | 3.0.4 | MIT |
| @types/d3-timer | 3.0.2 | MIT |
| @types/react | 19.2.17 | MIT |
| @types/react-dom | 19.2.3 | MIT |
| @types/use-sync-external-store | 0.0.6 | MIT |
| aria-hidden | 1.2.6 | MIT |
| baseline-browser-mapping | 2.10.42 | Apache-2.0 |
| caniuse-lite | 1.0.30001803 | CC-BY-4.0 |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| client-only | 0.0.1 | MIT |
| clsx | 2.1.1 | MIT |
| cn | 0.4.0 | MIT |
| csstype | 3.2.3 | MIT |
| d3-array | 3.2.4 | ISC |
| d3-color | 3.1.0 | ISC |
| d3-ease | 3.0.1 | BSD-3-Clause |
| d3-format | 3.1.2 | ISC |
| d3-interpolate | 3.0.1 | ISC |
| d3-path | 3.1.0 | ISC |
| d3-scale | 4.0.2 | ISC |
| d3-shape | 3.2.0 | ISC |
| d3-time | 3.1.0 | ISC |
| d3-time-format | 4.1.0 | ISC |
| d3-timer | 3.0.1 | ISC |
| decimal.js-light | 2.5.1 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| detect-node-es | 1.1.0 | MIT |
| es-toolkit | 1.52.0 | MIT |
| eventemitter3 | 5.0.4 | MIT |
| framer-motion | 13.4.4 | MIT |
| get-nonce | 1.0.1 | MIT |
| immer | 11.1.18 | MIT |
| internmap | 2.0.3 | ISC |
| lucide-react | 1.48.0 | ISC |
| motion | 13.4.4 | MIT |
| motion-dom | 13.4.4 | MIT |
| motion-utils | 13.3.0 | MIT |
| nanoid | 3.3.15 | MIT |
| next | 16.2.10 | MIT |
| picocolors | 1.1.1 | ISC |
| postcss | 8.4.31 | MIT |
| radix-ui | 1.6.7 | MIT |
| react | 19.2.4 | MIT |
| react-dom | 19.2.4 | MIT |
| react-is | 16.13.1 | MIT |
| react-redux | 9.3.0 | MIT |
| react-remove-scroll | 2.7.2 | MIT |
| react-remove-scroll-bar | 2.3.8 | MIT |
| react-style-singleton | 2.2.3 | MIT |
| recharts | 3.10.1 | MIT |
| redux | 5.0.1 | MIT |
| redux-thunk | 3.1.0 | MIT |
| reselect | 5.2.0 | MIT |
| scheduler | 0.27.0 | MIT |
| semver | 7.8.5 | ISC |
| sharp | 0.34.5 | Apache-2.0 |
| sonner | 2.0.8 | MIT |
| source-map-js | 1.2.1 | BSD-3-Clause |
| styled-jsx | 5.1.6 | MIT |
| tiny-invariant | 1.3.3 | MIT |
| tslib | 2.8.1 | 0BSD |
| use-callback-ref | 1.3.3 | MIT |
| use-sidecar | 1.1.3 | MIT |
| use-sync-external-store | 1.7.0 | MIT |
| vaul | 1.1.2 | MIT |
| victory-vendor | 37.3.6 | MIT AND ISC |

## 前端建置與開發工具（共 333 個套件；不隨網站散布）

| 授權 | 套件數 |
| --- | --- |
| MIT | 289 |
| Apache-2.0 | 17 |
| ISC | 13 |
| BSD-2-Clause | 7 |
| MPL-2.0 | 3 |
| Python-2.0 | 1 |
| BSD-3-Clause | 1 |
| CC0-1.0 | 1 |
| BlueOak-1.0.0 | 1 |
