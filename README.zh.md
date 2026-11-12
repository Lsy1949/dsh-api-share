# dsh-api-share

中文 | [English](README.md)

把 [DeepSeek Harness](https://github.com/deepseek-ai) 某个 profile 的模型 provider 配置分享出去。

在 **设置 → 模型** 页面底部加一个「导出配置」入口：勾选要导出的 API（provider）和它们下面的模型，右侧实时
生成可直接粘贴到目标 `cordis.patch.yml` 的 YAML 片段与一份 JSON 文档；与目标环境重名时 id 会自动加后缀，
每一次改名都列在预览里。

- **宿主半边**：两条同源 `POST` 路由，读本 profile 的配置、合成两个产物。不写盘、不改 profile。
- **客户端半边**：一个 footer 插槽条目、一个对话框。零第三方依赖、无打包器、无 JSX。

## 兼容性

| | |
| --- | --- |
| 已验证版本 | DeepSeek Harness **0.2.2-rc.1**（桌面端，profile `desktop`） |
| 声明范围 | `engines.dsh: ">=0.2.1-rc.2 <0.3.0"` |
| Node | `>=24`（harness 自带运行时） |
| 运行时依赖 | 无 |
| 平台 | 全部 —— 纯 JavaScript，不碰任何操作系统 API |

兼容性在这里是设计约束，不是口号：

- **不 import `@deepseek-ai/*`。** 这些包在 `app.asar` 里，profile 安装的插件走普通 Node 解析，会直接
  `ERR_MODULE_NOT_FOUND`。需要的一切都通过**服务**读（`settings`、`configEditor`、`loader`、`llm`、
  `credentials`、`webServer`）。
- **只用公开服务，且每个都可缺席。** `test/manifest.mjs` 会在任何发布文件出现 `@deepseek-ai/*` 导入、YAML
  解析库导入或非相对/非 `node:` 导入时让构建失败。
- **降级而不是抛错。** `apply()` 不抛异常；缺服务时导出不可用，而不是把插件树拖成 PENDING。
- **清单就是 release 读取的那份。** `dsh.manifestVersion: 1`、bundle patch、`dsh.client.platform: "web"` 与可
  解析的 `./client` 导出，全部由测试断言。
- **YAML 是验证过的，不是猜的。** 片段会用 harness 自带的那份 `js-yaml` 反向解析，解析结果与 JSON 文档里的
  `patch` 深度相等。

## 导出什么

只导出**你在 profile patch 里写过的东西**（`settings.describe()` 的 `user` 层）。schemastery 物化出来的默认值
（`defaultContextWindow`、`streamIdleTimeoutMs`、`maxRequestImages` …）一律不写：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      my-gateway:
        apiKeyEnv: MY_GATEWAY_API_KEY
        api: openai-completions
        baseURL: http://127.0.0.1:7863/v1
        models:
          - id: "cn:hy3"
            name: Hy3
            contextWindow: 192000
            maxTokens: 64000
```

| 情况 | 导出结果 |
| --- | --- |
| 模型是你在配置里写的 | 连同 `name` / `contextWindow` / `maxTokens` / `input` / `reasoningEfforts` / `compat` 一起导出 |
| 模型来自内置目录（你没写 `models`） | 只写 `id`，容量交给目标环境的内置目录 |
| provider 只在别的层（bundle / home patch）声明 | 不导出，列在「未导出」里并说明原因 |
| 值是一个 `!!js` 表达式 | 不导出，列在「未导出」里（表达式没法安全序列化） |

`apiKeyEnv` 是凭据**引用名**，不是密钥。

## 重名处理

| 档位 | 行为 | 什么时候用 |
| --- | --- | --- |
| 仅真实冲突时自动改名（默认） | 目标已有同名 provider 且 `api` / `baseURL` / `apiKeyEnv` 不同 → `foo-2`、`foo-3`…；同名且同连接视为「就是它本身」，不改名；同名 provider 下内容不同的同名模型同样加后缀 | 导给可能已有同名配置的机器 |
| 总是加后缀 | 每个 provider 都加数字后缀（`relay` → `relay-2`） | 把同一套配置并进你已经有的那份 |
| 保持原名 | 一个 id 都不动 | 目标环境是空的 |

「目标」是**本机当前生效的配置**——插件看不到另一台机器，所以冲突判断基于本地事实。每次改名都会出现在 YAML
注释和预览面板里。改名的 provider 是一条新路由，所以它下面的模型 id 保持原样。

## 明文密钥

默认关闭。勾选「包含明文 API Key」后：

- 密钥只以注释形式出现在 YAML 头部（`#   MY_GATEWAY_API_KEY=sk-…`），**不会**成为配置字段——`llm-pi-ai` 的
  schema 里没有密钥字段，密钥由凭据 seam 管理；
- 这条路由只在请求来自 **DSH 页面本身**（同源 `Origin`）时返回密钥；本地进程直接 `POST` 会得到
  `403 secrets-require-browser-origin`；
- 导出文件请自行保管。

## 安装

```powershell
# 桌面端：设置 → 插件；或
dsh plugin --profile desktop add dsh-api-share
# 本地开发指向工作区里的包
dsh plugin --profile desktop add link:D:\path\to\dsh-api-share
```

卸载：`dsh plugin --profile desktop remove dsh-api-share`。

## 路由

都是同源 `POST`、只答 JSON、不写盘。

| 路由 | 请求体 | 返回 |
| --- | --- | --- |
| `POST /dsh-api-share/catalog` | `{}` | `{ ok, sources, secretsAvailable, providers[], skipped[], dormant[], warnings[] }` |
| `POST /dsh-api-share/export` | `{ selection: [{ id, models[] }], mode: "auto"\|"always"\|"off", includeSecrets }` | `{ ok, mode, yaml, json, renames[], identical[], warnings[], providerIds[], secretsIncluded }` |

`sources.tier` 说明数据来自哪一层：`settings`（最全）→ `configEditor` → `loader` → `none`。
错误码：`400 bad-body`、`403 cross-origin`、`403 secrets-require-browser-origin`、`405 method-not-allowed`、
`500 internal`（带 `detail`）。

## 已知边界

- **只覆盖 `llm-pi-ai` 路由。** DeepSeek 官方账号 / `llm-deepseek` 是组合事实，不在导出范围；别的插件运行时注入
  的 provider 也不在其中。
- **目标环境不可见。** 冲突判断只能用本机事实，导出是一份「提案」，不是一次同步。
- **内置目录提供的模型容量不导出。** 想把目录容量钉死，请在配置里显式写 `models`。
- **删掉 provider 行不会清理它的凭据**——本插件从不写 profile。

## 开发

```powershell
npm run check   # 对每个发布文件跑 node --check
npm test        # 5 个套件，53 条断言
```

| 套件 | 覆盖 |
| --- | --- |
| `test/unit.mjs` | YAML 生成（引号、缩进、序列形态）与改名策略 |
| `test/export.mjs` | 选择 → YAML/JSON 合成、改名、密钥、拒绝路径 |
| `test/catalog.mjs` | 三级读取、`!!js` 跳过、目标事实、请求校验、凭据门禁 |
| `test/client.mjs` | 浏览器包在假 module loader 里激活、注册、渲染 |
| `test/manifest.mjs` | 发布与兼容性守卫（清单、导出、engines、导入、插槽、路由） |

## 发布清单

1. `npm run verify` —— 静态检查 + 全量测试（含兼容性守卫）。
2. `npm pack --dry-run` —— 确认 tarball 只含 `index.js`、`client.js`、`cordis.patch.yml`、`lib/**` 与文档。
3. 升 `version` 并写 `CHANGELOG.md`。
4. `npm publish`、给提交打 tag；仓库地址写在 `package.json` 里。

## 许可

MIT © Lsy1949
