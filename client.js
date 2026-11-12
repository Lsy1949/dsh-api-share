/**
 * dsh-api-share — client half (browser bundle).
 *
 * Shape: a Module-Loader CJS factory (`window.__ModuleLoader__.load`), the same
 * lane every shipped client plugin uses. The loader calls `factory(require)`
 * once, lazily, the first time the plugin is needed; `require` resolves the
 * frozen platform table (`react`).
 *
 * Rules this file follows, because breaking them breaks the GUI:
 *
 *   1. `inject` names only services that are certainly provided (`slots`). A
 *      declared service nobody provides keeps this entry PENDING and the web
 *      boot audit reports "did not activate".
 *   2. Every registration is wrapped: a missing slot means a missing button,
 *      never a broken settings page.
 *   3. UI is React inside slots — no DOM hunting, no class-name anchors.
 *   4. A crash renders a line of text, never an empty rectangle: every surface
 *      sits behind its own error boundary.
 *
 * Surfaces:
 *   settings.models.footer   "导入 / 导出配置" button + dialog
 *     ├─ 导出: pick APIs and models, preview YAML/JSON, copy or download
 *     └─ 导入: paste a snippet, preview the plan, apply it to the profile
 */
window.__ModuleLoader__.load({
  id: 'dsh-api-share',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require('react');
    var h = React.createElement;

    var PACKAGE_ID = 'dsh-api-share';
    var SLOT_MODELS_FOOTER = 'settings.models.footer';
    /* Document-relative on purpose: the GUI is served from the origin root today,
       and a relative route keeps working if that ever moves under a prefix. */
    var ROUTE_PREFIX = 'dsh-api-share';

    /* ------------------------------------------------------------------ */
    /* text                                                                */
    /* ------------------------------------------------------------------ */

    var TEXT = {
      zh: {
        entry: '导入 / 导出配置',
        entryHint: '把已配置的 API 与模型导出为 cordis.patch.yml 片段或 JSON，也可以把片段导入回本机。',
        title: '模型配置分享',
        tabExport: '导出',
        tabImport: '导入',
        close: '关闭',
        loading: '正在读取已配置的 API…',
        loadFailed: '读取配置失败：',
        retry: '重试',
        empty: '这个 profile 里还没有可导出的 provider。请先在模型设置里添加 API。',
        providersLabel: 'API / 模型',
        search: '搜索 provider 或模型…',
        expandAll: '展开全部',
        collapseAll: '收起全部',
        selectAll: '全选',
        selectNone: '清空',
        apiBadge: 'API',
        secretOk: '密钥已配置',
        secretMissing: '密钥缺失',
        inherited: '容量取自内置目录',
        noModel: '没有模型',
        exportOptions: '导出选项',
        namingLabel: '重名处理',
        namingAuto: '仅真实冲突时自动改名',
        namingAlways: '总是加后缀',
        namingOff: '保持原名',
        namingHint: '目标环境已有同名但连接信息不同的 provider 时自动加后缀（foo → foo-2），预览会标出每一次改名。',
        secretsLabel: '包含明文 API Key',
        secretsHint: '默认只导出 apiKeyEnv 引用；勾选后密钥写在注释里，请自行保管。',
        secretsUnavailable: '本环境读不到密钥值，只能导出引用。',
        preview: '预览',
        yamlTab: 'YAML',
        jsonTab: 'JSON',
        previewEmpty: '勾选至少一个模型后显示预览。',
        previewBusy: '正在生成…',
        previewFailed: '生成失败：',
        copyYaml: '复制 YAML',
        copyJson: '复制 JSON',
        copied: '已复制 {format} 到剪贴板',
        copyFailed: '复制失败，请手动选择文本。',
        downloadYaml: '下载 YAML',
        downloadJson: '下载 JSON',
        downloaded: '已开始下载 {format}',
        selected: '已选 {providers} 个 API · {models} 个模型',
        renames: '已自动改名',
        identical: '与现有配置一致',
        warnings: '提示',
        skipped: '未导出',
        secretsIncluded: '已包含明文密钥',
        moreDormant: '另有 {count} 个内置 provider 未配置',
        dormantTitle: '内置目录里还有 {count} 个 provider 没有配置',
        dormantHint: '这些是 pi-ai 内置目录自带的 provider（openai、anthropic、groq…），本 profile 没有它们的配置，所以没有 API Key、没有选定模型，导出时不可选。要用它们请到「模型设置 → 添加模型 provider」。',
        dormantShow: '展开列表',
        dormantHide: '收起列表',
        /* import */
        importTitle: '导入配置',
        importHint: '粘贴之前导出的 YAML 片段或 JSON 文件内容，先预览会改什么，再写进本 profile。',
        pasteLabel: '配置片段',
        pastePlaceholder: '在此粘贴 cordis.patch.yml 片段，或 JSON 导出文件的内容…',
        chooseFile: '选择文件…',
        dropHint: '也可以把 .yml / .yaml / .json 文件拖到这里',
        clearText: '清空',
        policyLabel: '冲突处理',
        policyMerge: '保留现有，冲突项改名',
        policySkip: '保留现有，冲突项跳过',
        policyOverwrite: '冲突项用导入内容覆盖',
        policyHint: '与现有 provider 同名时：改名会新建一个 foo-2，跳过则不动，覆盖会替换原有整段配置。',
        previewPlan: '导入预览',
        planEmpty: '粘贴片段后自动生成预览。',
        planBusy: '正在解析…',
        planFailed: '解析失败：',
        actionCreate: '新增',
        actionRename: '改名新增',
        actionUpdate: '覆盖',
        actionUnchanged: '已存在',
        actionSkip: '跳过',
        actionInvalid: '无效',
        modelsAdded: '模型 {count}',
        apply: '写入配置',
        applying: '正在写入…',
        applied: '已写入，重启或重载 DSH 后生效',
        applyFailed: '写入失败：',
        applyNoChange: '没有需要写入的改动',
        validationFailed: '写入前校验未通过：',
        cannotWrite: '当前环境不支持从插件写入配置，导入已禁用。',
        needConfirm: '写入会修改本 profile 的 cordis.patch.yml，请确认预览内容。',
        summary: '新增 {create} · 改名 {rename} · 覆盖 {update} · 已存在 {unchanged} · 跳过 {skip} · 无效 {invalid}',
        a11y: '模型配置分享对话框',
      },
      en: {
        entry: 'Import / export configuration',
        entryHint: 'Export the configured APIs and models as a cordis.patch.yml snippet or JSON — or import one back.',
        title: 'Share model configuration',
        tabExport: 'Export',
        tabImport: 'Import',
        close: 'Close',
        loading: 'Reading the configured APIs…',
        loadFailed: 'Could not read the configuration: ',
        retry: 'Retry',
        empty: 'No exportable provider in this profile yet. Add an API in Models settings first.',
        providersLabel: 'APIs / models',
        search: 'Search providers or models…',
        expandAll: 'Expand all',
        collapseAll: 'Collapse all',
        selectAll: 'All',
        selectNone: 'None',
        apiBadge: 'API',
        secretOk: 'key configured',
        secretMissing: 'key missing',
        inherited: 'capacities from the installed catalog',
        noModel: 'no models',
        exportOptions: 'Export options',
        namingLabel: 'Name collisions',
        namingAuto: 'Rename only on a real collision',
        namingAlways: 'Always add a suffix',
        namingOff: 'Keep every name',
        namingHint: 'A provider the target already owns under this id with a different connection gets a numeric suffix (foo → foo-2); the preview lists every rename.',
        secretsLabel: 'Include plaintext API keys',
        secretsHint: 'Only the apiKeyEnv reference is exported by default; ticking this writes the key into a comment.',
        secretsUnavailable: 'No credential value is readable here, so only references can be exported.',
        preview: 'Preview',
        yamlTab: 'YAML',
        jsonTab: 'JSON',
        previewEmpty: 'Select at least one model to see the preview.',
        previewBusy: 'Generating…',
        previewFailed: 'Generation failed: ',
        copyYaml: 'Copy YAML',
        copyJson: 'Copy JSON',
        copied: '{format} copied to the clipboard',
        copyFailed: 'Copy failed — select the text manually.',
        downloadYaml: 'Download YAML',
        downloadJson: 'Download JSON',
        downloaded: '{format} download started',
        selected: '{providers} APIs · {models} models selected',
        renames: 'Renamed automatically',
        identical: 'Identical to the current configuration',
        warnings: 'Notes',
        skipped: 'Not exported',
        secretsIncluded: 'Plaintext keys included',
        moreDormant: '{count} more catalog providers are not configured',
        dormantTitle: '{count} catalog providers are still unconfigured',
        dormantHint: 'These come with the installed pi-ai catalog (openai, anthropic, groq…). This profile has no configuration for them — no API key, no chosen models — so they cannot be exported. Add them in Models settings if you want them.',
        dormantShow: 'Show list',
        dormantHide: 'Hide list',
        importTitle: 'Import configuration',
        importHint: 'Paste a previously exported YAML snippet or JSON file, preview what would change, then write it into this profile.',
        pasteLabel: 'Snippet',
        pastePlaceholder: 'Paste a cordis.patch.yml snippet, or the contents of a JSON export…',
        chooseFile: 'Choose a file…',
        dropHint: 'You can also drop a .yml / .yaml / .json file here',
        clearText: 'Clear',
        policyLabel: 'Collisions',
        policyMerge: 'Keep existing, rename the import',
        policySkip: 'Keep existing, skip the import',
        policyOverwrite: 'Overwrite with the import',
        policyHint: 'When a provider id already exists: rename creates foo-2, skip leaves it alone, overwrite replaces the whole provider.',
        previewPlan: 'Import preview',
        planEmpty: 'The preview appears as soon as you paste a snippet.',
        planBusy: 'Parsing…',
        planFailed: 'Could not parse: ',
        actionCreate: 'New',
        actionRename: 'New (renamed)',
        actionUpdate: 'Replace',
        actionUnchanged: 'Already there',
        actionSkip: 'Skipped',
        actionInvalid: 'Invalid',
        modelsAdded: '{count} models',
        apply: 'Write configuration',
        applying: 'Writing…',
        applied: 'Written — restart or reload DSH to apply',
        applyFailed: 'Write failed: ',
        applyNoChange: 'Nothing to write',
        validationFailed: 'The adapter refused this plan: ',
        cannotWrite: 'This environment does not allow a plugin to write configuration, so import is disabled.',
        needConfirm: 'Writing modifies this profile’s cordis.patch.yml; check the preview first.',
        summary: 'new {create} · renamed {rename} · replaced {update} · existing {unchanged} · skipped {skip} · invalid {invalid}',
        a11y: 'Share model configuration dialog',
      },
    };

    /** The client context, kept so services can be read at render time. */
    var clientContext = null;
    var language = 'zh';

    /**
     * @param {any} locale
     * @returns {string}
     */
    function languageOf(locale) {
      try {
        if (locale === null || locale === undefined) return 'zh';
        var current = typeof locale.getLocale === 'function' ? locale.getLocale() : undefined;
        var id = '';
        if (typeof current === 'string') id = current;
        else if (current !== null && current !== undefined) {
          if (typeof current.id === 'string') id = current.id;
          else if (typeof current.active === 'string') id = current.active;
        }
        return String(id).toLowerCase().indexOf('en') === 0 ? 'en' : 'zh';
      } catch (error) {
        return 'zh';
      }
    }

    /** @returns {any} */
    function currentLocale() {
      try {
        var context = clientContext;
        if (context === null || context === undefined || typeof context.get !== 'function') return null;
        var service = context.get('locale');
        if (service === null || service === undefined) return null;
        return typeof service === 'object' ? service : null;
      } catch (error) {
        return null;
      }
    }

    /** @returns {any} */
    function useCopy() {
      var pair = React.useState(language);
      var current = pair[0];
      var setCurrent = pair[1];
      React.useEffect(function () {
        var next = languageOf(currentLocale());
        if (next !== current) setCurrent(next);
        return undefined;
      }, []);
      return TEXT[current] !== undefined ? TEXT[current] : TEXT.zh;
    }

    /**
     * @param {string} template
     * @param {Record<string, string | number>} values
     * @returns {string}
     */
    function format(template, values) {
      return String(template).replace(/\{(\w+)\}/g, function (match, key) {
        return values[key] === undefined ? match : String(values[key]);
      });
    }

    /* ------------------------------------------------------------------ */
    /* styles                                                             */
    /* ------------------------------------------------------------------ */

    var STYLE_ID = 'das-styles';

    function installStyles() {
      try {
        if (document.getElementById(STYLE_ID) !== null) return;
        var style = document.createElement('style');
        style.id = STYLE_ID;
        /* The loader claims and cleans styles injected during materialisation, so
           the tag is marked the way shipped plugins mark theirs. */
        style.setAttribute('data-plugin', PACKAGE_ID);
        style.setAttribute('data-plugin-css', PACKAGE_ID + '-styles');
        style.textContent = [
          /* entry row */
          '.das-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:16px;margin-top:10px;border:1px solid var(--dsw-alias-settings-card-stroke,rgba(128,128,128,.28));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.06))}',
          '.das-row-text{display:flex;flex-direction:column;gap:3px;min-width:240px;flex:1}',
          '.das-row-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
          '.das-row-hint{font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          /* controls */
          '.das-btn{appearance:none;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.32));background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.1));color:var(--dsw-alias-label-primary,inherit);border-radius:var(--dsw-radius-sm,8px);padding:7px 14px;font-size:13px;line-height:1.2;cursor:pointer;font-family:inherit;transition:background var(--ds-transition-duration,120ms) var(--ds-ease-in-out,ease)}',
          '.das-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.2))}',
          '.das-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#4c8dff);outline-offset:2px}',
          '.das-btn:disabled{opacity:.45;cursor:not-allowed}',
          '.das-btn-primary{background:var(--dsw-alias-button-primary-fill,#3b6fe0);border-color:var(--dsw-alias-button-primary-fill,#3b6fe0);color:var(--dsw-alias-label-primary-foreground,#fff)}',
          '.das-btn-primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,#3561c9)}',
          '.das-btn-sm{padding:4px 10px;font-size:12px;border-radius:var(--dsw-radius-xs,4px)}',
          '.das-input,.das-select,.das-textarea{font-family:inherit;font-size:12px;color:var(--dsw-alias-label-primary,inherit);background:var(--dsw-alias-bg-layer-1,#18181b);border:1px solid var(--dsw-alias-border-l4,rgba(128,128,128,.4));border-radius:var(--dsw-radius-xs,4px);padding:6px 8px}',
          '.das-input:focus-visible,.das-select:focus-visible,.das-textarea:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#4c8dff);outline-offset:1px}',
          '.das-textarea{width:100%;min-height:150px;resize:vertical;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);line-height:1.5}',
          '.das-field{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}',
          '.das-label{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
          '.das-hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-inline{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
          '.das-link{appearance:none;background:none;border:0;padding:0;color:var(--dsw-alias-state-business-primary,#5b8cff);font-size:12px;cursor:pointer;font-family:inherit}',
          '.das-link:hover{text-decoration:underline}',
          /* dialog shell */
          '.das-backdrop{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.48));display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000}',
          '.das-dialog{width:min(1040px,100%);height:min(88vh,920px);max-height:min(88vh,920px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#1c1c20);color:var(--dsw-alias-label-primary,#eee);border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.32));border-radius:var(--dsw-radius-lg,16px);box-shadow:var(--dsw-elevation-prominent,0 24px 64px rgba(0,0,0,.45));overflow:hidden}',
          '.das-head{flex:0 0 auto;display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.24))}',
          '.das-head-main{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}',
          '.das-head h2{margin:0;font-size:16px;font-weight:650;line-height:1.25}',
          '.das-sub{margin:0;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-tabs{display:inline-flex;padding:3px;gap:2px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.12))}',
          '.das-tab{appearance:none;border:0;background:none;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));font-size:12px;font-weight:600;padding:5px 14px;border-radius:var(--dsw-radius-xs,4px);cursor:pointer;font-family:inherit}',
          '.das-tab[aria-selected="true"]{background:var(--dsw-alias-bg-layer-1,#18181b);color:var(--dsw-alias-label-primary,inherit);box-shadow:0 0 0 1px var(--dsw-alias-border-l3,rgba(128,128,128,.3))}',
          '.das-tab:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#4c8dff);outline-offset:2px}',
          /* body */
          '.das-body{display:grid;grid-template-columns:minmax(320px,1.05fr) minmax(360px,1fr);grid-template-rows:minmax(0,1fr) auto;min-height:0;flex:1 1 auto;overflow:hidden}',
          '.das-col{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden}',
          '.das-col+.das-col{border-left:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.24))}',
          '.das-col-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.16));background:var(--dsw-alias-bg-layer-2,#1c1c20);position:sticky;top:0;z-index:2}',
          '.das-col-title{font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));margin:0;flex:1}',
          '.das-scroll{overflow-y:auto;overflow-x:hidden;padding:12px 16px;min-height:0;flex:1 1 0;max-height:calc(88vh - 240px);display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain;scrollbar-gutter:stable}',
          /* provider accordion */
          '.das-dormant{margin-top:4px;padding-top:8px;border-top:1px dashed var(--dsw-alias-border-l3,rgba(128,128,128,.24))}',
          '.das-group{border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.26));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.05));overflow:hidden}',
          '.das-group[data-selected="false"]{opacity:.72}',
          '.das-group-head{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;width:100%;text-align:left;background:none;border:0;color:inherit;font-family:inherit}',
          '.das-group-head:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.09))}',
          '.das-group-head:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#4c8dff);outline-offset:-2px}',
          '.das-chevron{flex:0 0 auto;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));transition:transform var(--ds-transition-duration,120ms) var(--ds-ease-in-out,ease)}',
          '.das-chevron[data-open="true"]{transform:rotate(90deg)}',
          '.das-group-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
          '.das-group-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-group-sub{font-size:11px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-group-body{border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.16));padding:8px 12px 10px}',
          '.das-group-actions{display:flex;gap:10px;padding:2px 0 8px}',
          '.das-model{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;cursor:pointer;min-width:0}',
          '.das-model-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace)}',
          '.das-model-name{color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-models-empty{font-size:11px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));padding:2px 0}',
          /* badges */
          '.das-badges{display:flex;gap:5px;flex-wrap:wrap;align-items:center}',
          '.das-badge{font-size:10px;line-height:1.6;padding:0 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.3));color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));white-space:nowrap}',
          '.das-badge[data-tone="ok"]{color:var(--dsw-alias-state-success-primary,#4caf82);border-color:rgba(76,175,130,.45)}',
          '.das-badge[data-tone="warn"]{color:var(--dsw-alias-state-warn-label,#e0b055);border-color:rgba(224,176,85,.45)}',
          '.das-badge[data-tone="error"]{color:var(--dsw-alias-state-error-primary,#e07a7a);border-color:rgba(224,122,122,.45)}',
          '.das-badge[data-tone="accent"]{color:var(--dsw-alias-state-business-primary,#5b8cff);border-color:rgba(91,140,255,.45)}',
          /* preview + notes */
          '.das-pre{margin:0;flex:1;min-height:200px;overflow:auto;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.26));border-radius:var(--dsw-radius-md,12px);padding:12px;font-family:var(--ds-font-family-code,ui-monospace,Menlo,Consolas,monospace);font-size:12px;line-height:1.55;white-space:pre;tab-size:2}',
          '.das-note{font-size:12px;line-height:1.55;border-radius:var(--dsw-radius-sm,8px);padding:8px 10px;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.24));color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-note[data-tone="warn"]{color:var(--dsw-alias-state-warn-label,#e0b055);border-color:rgba(224,176,85,.4);background:rgba(224,176,85,.07)}',
          '.das-note[data-tone="error"]{color:var(--dsw-alias-state-error-primary,#e07a7a);border-color:rgba(224,122,122,.4);background:rgba(224,122,122,.07)}',
          '.das-list{margin:5px 0 0;padding-left:16px;font-size:11px;line-height:1.6}',
          '.das-plan{display:flex;flex-direction:column;gap:6px}',
          '.das-plan-row{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.22));border-radius:var(--dsw-radius-sm,8px)}',
          '.das-plan-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
          '.das-plan-name{font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-plan-reason{font-size:11px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));line-height:1.5}',
          /* footer */
          '.das-foot{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.24));flex-wrap:wrap}',
          '.das-foot-status{font-size:12px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));min-width:0;flex:1}',
          '.das-foot-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}',
          '@media (max-width:820px){.das-body{grid-template-columns:1fr}.das-col+.das-col{border-left:0;border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.24))}}',
        ].join('\n');
        document.head.appendChild(style);
      } catch (error) {
        /* styling is a courtesy: an unstyled dialog still works */
      }
    }

    /* ------------------------------------------------------------------ */
    /* transport + clipboard + download                                    */
    /* ------------------------------------------------------------------ */

    /**
     * POST JSON to one of this plugin's own routes.
     * @param {string} path
     * @param {object} body
     * @returns {Promise<any>}
     */
    function postJson(path, body) {
      return fetch(ROUTE_PREFIX + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body === undefined ? {} : body),
      }).then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || payload === null || payload.ok !== true) {
            var detail = payload !== null && typeof payload === 'object' && typeof payload.detail === 'string'
              ? payload.detail
              : payload !== null && typeof payload === 'object' && typeof payload.error === 'string'
                ? payload.error
                : 'HTTP ' + response.status;
            var error = new Error(detail);
            error.payload = payload;
            throw error;
          }
          return payload;
        });
      });
    }

    /**
     * Copy text, falling back to a hidden textarea on browsers that refuse the
     * async clipboard.
     * @param {string} text
     * @returns {Promise<boolean>}
     */
    function copyText(text) {
      var clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
        return clipboard.writeText(text).then(function () {
          return true;
        }).catch(function () {
          return legacyCopy(text);
        });
      }
      return Promise.resolve(legacyCopy(text));
    }

    /**
     * @param {string} text
     * @returns {boolean}
     */
    function legacyCopy(text) {
      try {
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', 'readonly');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok === true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Download a string as a file, with no dependency and no server round-trip.
     * @param {string} filename
     * @param {string} text
     * @param {string} mime
     * @returns {boolean}
     */
    function downloadText(filename, text, mime) {
      try {
        var blob = new Blob([text], { type: mime + ';charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 4000);
        return true;
      } catch (error) {
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* small hooks + bits                                                 */
    /* ------------------------------------------------------------------ */

    function useEscapeKey(active, onEscape) {
      React.useEffect(function () {
        if (!active) return undefined;
        function onKeyDown(event) {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onEscape();
          }
        }
        document.addEventListener('keydown', onKeyDown, true);
        return function () {
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [active, onEscape]);
    }

    /** @param {string} text */
    function Badge(props) {
      return h(
        'span',
        { className: 'das-badge', 'data-tone': props.tone === undefined ? 'neutral' : props.tone, title: props.title },
        props.children,
      );
    }

    /** @param {{ count: number }} props */
    function CountBadge(props) {
      return h(Badge, { tone: props.count > 0 ? 'accent' : 'neutral' }, props.count);
    }

    /* ------------------------------------------------------------------ */
    /* export panel                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * One provider group: a header (checkbox, name, badges, model count) that
     * expands and collapses the model list underneath.
     *
     * @param {any} props
     */
    function ProviderGroup(props) {
      var provider = props.provider;
      var models = Array.isArray(provider.models) ? props.visibleModels : [];
      var modelState = props.selected[provider.id] || {};
      var chosen = Object.keys(modelState).filter(function (id) {
        return modelState[id] === true;
      }).length;
      var total = Array.isArray(provider.models) ? provider.models.length : 0;
      var open = props.expanded === true;

      var badges = [];
      if (provider.api) badges.push(h(Badge, { key: 'api', tone: 'neutral' }, provider.api));
      if (provider.apiKeyEnv) {
        badges.push(
          h(
            Badge,
            { key: 'key', tone: provider.hasCredential ? 'ok' : 'warn', title: provider.apiKeyEnv },
            provider.hasCredential ? props.copy.secretOk : props.copy.secretMissing,
          ),
        );
      }
      if (provider.handDeclared) badges.push(h(Badge, { key: 'hand', tone: 'neutral' }, 'hand-declared'));
      if (provider.inheritsModels) badges.push(h(Badge, { key: 'inh', tone: 'neutral', title: props.copy.inherited }, 'catalog'));
      if (provider.defaultBaseURL && !provider.baseURL) {
        badges.push(h(Badge, { key: 'def', tone: 'neutral', title: provider.defaultBaseURL }, 'default endpoint'));
      }

      return h(
        'div',
        { className: 'das-group', 'data-selected': chosen > 0 ? 'true' : 'false' },
        h(
          'div',
          { className: 'das-inline', style: { gap: '0' } },
          h(
            'button',
            {
              type: 'button',
              className: 'das-group-head',
              'aria-expanded': open ? 'true' : 'false',
              'aria-controls': 'das-models-' + provider.id,
              onClick: function () {
                props.onToggleOpen(provider.id);
              },
            },
            h('span', { className: 'das-chevron', 'data-open': open ? 'true' : 'false', 'aria-hidden': 'true' }, '▶'),
            h(
              'span',
              { className: 'das-group-main' },
              h('span', { className: 'das-group-name' }, provider.displayName || provider.id),
              h('span', { className: 'das-group-sub' }, [provider.id, provider.baseURL].filter(Boolean).join(' · ')),
            ),
            h(
              'span',
              { className: 'das-badges' },
              badges,
              h(CountBadge, { count: chosen + '/' + total }),
            ),
          ),
        ),
        open
          ? h(
              'div',
              { className: 'das-group-body', id: 'das-models-' + provider.id },
              h(
                'div',
                { className: 'das-group-actions' },
                h(
                  'label',
                  { className: 'das-model' },
                  h('input', {
                    type: 'checkbox',
                    checked: total > 0 && chosen === total,
                    onChange: function () {
                      props.onAllModels(provider, total === 0 ? false : chosen !== total);
                    },
                  }),
                  h('span', null, chosen === total && total > 0 ? props.copy.selectNone : props.copy.selectAll),
                ),
                total > 0 && chosen > 0
                  ? h(
                      'button',
                      {
                        type: 'button',
                        className: 'das-link',
                        onClick: function () {
                          props.onAllModels(provider, false);
                        },
                      },
                      props.copy.selectNone,
                    )
                  : null,
              ),
              models.length === 0
                ? h('div', { className: 'das-models-empty' }, props.copy.noModel)
                : models.map(function (model) {
                    return h(
                      'label',
                      { className: 'das-model', key: model.id },
                      h('input', {
                        type: 'checkbox',
                        checked: modelState[model.id] === true,
                        onChange: function () {
                          props.onToggleModel(provider, model.id);
                        },
                      }),
                      h('span', { className: 'das-model-id' }, model.id),
                      model.name !== '' && model.name !== model.id
                        ? h('span', { className: 'das-model-name' }, model.name)
                        : null,
                      model.origin === 'catalog' ? h(Badge, { tone: 'neutral', title: props.copy.inherited }, 'catalog') : null,
                    );
                  }),
              provider.inheritsModels === true
                ? h('div', { className: 'das-models-empty', style: { paddingTop: '6px' } }, props.copy.inherited)
                : null,
            )
          : null,
      );
    }

    /**
     * The export pane: catalogue on the left, options and preview on the right.
     * @param {{ copy: any, catalog: any, onReload: Function, active: boolean }} props
     */
    function ExportPanel(props) {
      var copy = props.copy;
      var catalog = props.catalog;

      var selectionState = React.useState({});
      var selected = selectionState[0];
      var setSelected = selectionState[1];

      var openState = React.useState({});
      var expanded = openState[0];
      var setExpanded = openState[1];

      var modeState = React.useState('auto');
      var mode = modeState[0];
      var setMode = modeState[1];

      var secretsState = React.useState(false);
      var includeSecrets = secretsState[0];
      var setIncludeSecrets = secretsState[1];

      var tabState = React.useState('yaml');
      var tab = tabState[0];
      var setTab = tabState[1];

      var searchState = React.useState('');
      var search = searchState[0];
      var setSearch = searchState[1];

      var dormantState = React.useState(false);
      var dormantOpen = dormantState[0];
      var setDormantOpen = dormantState[1];

      var previewState = React.useState({ status: 'idle', yaml: '', json: '', renames: [], identical: [], warnings: [], error: '' });
      var preview = previewState[0];
      var setPreview = previewState[1];

      /* Seed the selection once the catalogue arrives: everything ticked, every
         group collapsed so the list stays scannable until the user opens one. */
      var seeded = React.useRef(false);
      React.useEffect(function () {
        if (catalog.status !== 'ready' || seeded.current) return undefined;
        seeded.current = true;
        var next = {};
        var open = {};
        (catalog.providers || []).forEach(function (provider) {
          var models = {};
          (provider.models || []).forEach(function (model) {
            models[model.id] = true;
          });
          next[provider.id] = models;
          open[provider.id] = false;
        });
        setSelected(next);
        setExpanded(open);
        return undefined;
      }, [catalog.status]);

      React.useEffect(function () {
        if (catalog.status !== 'ready') seeded.current = false;
      }, [catalog.status]);

      var providers = catalog.providers || [];
      var query = search.trim().toLowerCase();

      /** Providers and models matching the search box. */
      var view = React.useMemo(function () {
        return providers
          .map(function (provider) {
            if (query === '') return { provider: provider, visibleModels: provider.models || [] };
            var nameHit = String(provider.id).toLowerCase().indexOf(query) >= 0
              || String(provider.displayName || '').toLowerCase().indexOf(query) >= 0
              || String(provider.baseURL || '').toLowerCase().indexOf(query) >= 0;
            var models = (provider.models || []).filter(function (model) {
              return String(model.id).toLowerCase().indexOf(query) >= 0
                || String(model.name || '').toLowerCase().indexOf(query) >= 0;
            });
            if (nameHit) return { provider: provider, visibleModels: provider.models || [] };
            if (models.length > 0) return { provider: provider, visibleModels: models };
            return null;
          })
          .filter(Boolean);
      }, [providers, query]);

      var chosenProviders = React.useMemo(function () {
        var list = [];
        providers.forEach(function (provider) {
          var models = selected[provider.id] || {};
          var ids = Object.keys(models).filter(function (id) {
            return models[id] === true;
          });
          if (ids.length > 0) list.push({ id: provider.id, models: ids });
        });
        return list;
      }, [providers, selected]);

      var modelCount = chosenProviders.reduce(function (total, entry) {
        return total + entry.models.length;
      }, 0);

      var requestKey = React.useMemo(function () {
        return JSON.stringify(chosenProviders) + '|' + mode + (includeSecrets ? '|s' : '|');
      }, [chosenProviders, mode, includeSecrets]);

      React.useEffect(function () {
        if (!props.active || catalog.status !== 'ready') return undefined;
        if (chosenProviders.length === 0) {
          setPreview({ status: 'idle', yaml: '', json: '', renames: [], identical: [], warnings: [], error: '' });
          return undefined;
        }
        setPreview(function (previous) {
          return Object.assign({}, previous, { status: 'busy', error: '' });
        });
        var timer = setTimeout(function () {
          postJson('/export', { selection: chosenProviders, mode: mode, includeSecrets: includeSecrets }).then(
            function (payload) {
              setPreview({
                status: 'ready',
                yaml: typeof payload.yaml === 'string' ? payload.yaml : '',
                json: typeof payload.json === 'string' ? payload.json : '',
                renames: Array.isArray(payload.renames) ? payload.renames : [],
                identical: Array.isArray(payload.identical) ? payload.identical : [],
                warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
                error: '',
              });
            },
            function (error) {
              setPreview({ status: 'error', yaml: '', json: '', renames: [], identical: [], warnings: [], error: String(error && error.message ? error.message : error) });
            },
          );
        }, 220);
        return function () {
          clearTimeout(timer);
        };
      }, [props.active, catalog.status, requestKey]);

      var toggleModel = React.useCallback(function (provider, modelId) {
        setSelected(function (previous) {
          var models = Object.assign({}, previous[provider.id] || {});
          models[modelId] = models[modelId] !== true;
          var next = Object.assign({}, previous);
          next[provider.id] = models;
          return next;
        });
      }, []);

      var setAllModels = React.useCallback(function (provider, on) {
        setSelected(function (previous) {
          var models = {};
          (provider.models || []).forEach(function (model) {
            models[model.id] = on;
          });
          var next = Object.assign({}, previous);
          next[provider.id] = models;
          return next;
        });
      }, []);

      var toggleOpen = React.useCallback(function (id) {
        setExpanded(function (previous) {
          var next = Object.assign({}, previous);
          next[id] = previous[id] !== true;
          return next;
        });
      }, []);

      var setAllOpen = React.useCallback(
        function (open) {
          setExpanded(function () {
            var next = {};
            providers.forEach(function (provider) {
              next[provider.id] = open;
            });
            return next;
          });
        },
        [providers],
      );

      var selectEverything = React.useCallback(
        function (on) {
          setSelected(function (previous) {
            var next = Object.assign({}, previous);
            view.forEach(function (entry) {
              var models = Object.assign({}, next[entry.provider.id] || {});
              entry.visibleModels.forEach(function (model) {
                models[model.id] = on;
              });
              next[entry.provider.id] = models;
            });
            return next;
          });
        },
        [view],
      );

      /* Both artefacts are always generated; the visible tab decides which one
         the buttons act on, so "复制" and "下载" never disagree with the preview. */
      var activeText = tab === 'yaml' ? preview.yaml : preview.json;
      var activeFormat = tab === 'yaml' ? 'yml' : 'json';
      var activeMime = tab === 'yaml' ? 'application/yaml' : 'application/json';
      var copyLabel = tab === 'yaml' ? copy.copyYaml : copy.copyJson;
      var downloadLabel = tab === 'yaml' ? copy.downloadYaml : copy.downloadJson;

      var onCopy = React.useCallback(function () {
        if (preview.yaml === '' || preview.json === '') return;
        copyText(activeText).then(function (ok) {
          props.onStatus(ok ? format(copy.copied, { format: activeFormat.toUpperCase() }) : copy.copyFailed);
        });
      }, [activeText, activeFormat, preview.yaml, preview.json, copy, props.onStatus]);

      var onDownload = React.useCallback(function () {
        if (preview.yaml === '' || preview.json === '') return;
        var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var ok = downloadText('dsh-model-config-' + stamp + '.' + activeFormat, activeText, activeMime);
        props.onStatus(ok ? format(copy.downloaded, { format: activeFormat.toUpperCase() }) : copy.previewFailed);
      }, [activeText, activeFormat, activeMime, preview.yaml, preview.json, copy, props.onStatus]);

      if (catalog.status === 'loading') {
        return h('div', { className: 'das-scroll' }, h('div', { className: 'das-note' }, copy.loading));
      }
      if (catalog.status === 'error') {
        return h(
          'div',
          { className: 'das-scroll' },
          h('div', { className: 'das-note', 'data-tone': 'error' }, copy.loadFailed + catalog.error),
          h('button', { type: 'button', className: 'das-btn', onClick: props.onReload, style: { marginTop: '10px', alignSelf: 'flex-start' } }, copy.retry),
        );
      }
      if (providers.length === 0) {
        return h('div', { className: 'das-scroll' }, h('div', { className: 'das-note' }, copy.empty));
      }

      return h(
        'div',
        { className: 'das-body' },
        /* left: providers */
        h(
          'div',
          { className: 'das-col' },
          h(
            'div',
            { className: 'das-col-head' },
            h('input', {
              className: 'das-input',
              type: 'search',
              value: search,
              placeholder: copy.search,
              'aria-label': copy.search,
              onChange: function (event) {
                setSearch(event.target.value);
              },
              style: { flex: '1 1 auto', minWidth: '0' },
            }),
            h(
              'button',
              { type: 'button', className: 'das-btn das-btn-sm', onClick: function () { setAllOpen(true); } },
              copy.expandAll,
            ),
            h(
              'button',
              { type: 'button', className: 'das-btn das-btn-sm', onClick: function () { setAllOpen(false); } },
              copy.collapseAll,
            ),
          ),
          h(
            'div',
            { className: 'das-col-head', style: { borderTop: '0', paddingTop: '8px', paddingBottom: '8px' } },
            h('h3', { className: 'das-col-title' }, copy.providersLabel),
            h(
              'button',
              { type: 'button', className: 'das-link', onClick: function () { selectEverything(true); } },
              copy.selectAll,
            ),
            h(
              'button',
              { type: 'button', className: 'das-link', onClick: function () { selectEverything(false); } },
              copy.selectNone,
            ),
          ),
          h(
            'div',
            { className: 'das-scroll' },
            view.length === 0
              ? h('div', { className: 'das-note' }, copy.empty)
              : view.map(function (entry) {
                  return h(ProviderGroup, {
                    key: entry.provider.id,
                    provider: entry.provider,
                    visibleModels: entry.visibleModels,
                    selected: selected,
                    expanded: expanded[entry.provider.id] === true,
                    copy: copy,
                    onToggleModel: toggleModel,
                    onAllModels: setAllModels,
                    onToggleOpen: toggleOpen,
                  });
                }),
            Array.isArray(catalog.dormant) && catalog.dormant.length > 0
              ? h(
                  'div',
                  { className: 'das-dormant' },
                  h(
                    'button',
                    {
                      type: 'button',
                      className: 'das-link',
                      'aria-expanded': dormantOpen ? 'true' : 'false',
                      onClick: function () {
                        setDormantOpen(function (value) {
                          return !value;
                        });
                      },
                    },
                    (dormantOpen ? '▾ ' : '▸ ')
                      + format(copy.dormantTitle, { count: catalog.dormant.length })
                      + ' · '
                      + (dormantOpen ? copy.dormantHide : copy.dormantShow),
                  ),
                  dormantOpen
                    ? h(
                        'div',
                        null,
                        h('p', { className: 'das-hint', style: { margin: '6px 0' } }, copy.dormantHint),
                        h(
                          'div',
                          { className: 'das-badges' },
                          catalog.dormant.map(function (entry) {
                            return h(Badge, { key: entry.id, tone: 'neutral', title: entry.displayName }, entry.id);
                          }),
                        ),
                      )
                    : null,
                )
              : null,
          ),
        ),
        /* right: options + preview */
        h(
          'div',
          { className: 'das-col' },
          h(
            'div',
            { className: 'das-col-head' },
            h('h3', { className: 'das-col-title' }, copy.exportOptions),
            h(
              'div',
              { className: 'das-tabs', role: 'tablist' },
              h(
                'button',
                { type: 'button', role: 'tab', className: 'das-tab', 'aria-selected': tab === 'yaml' ? 'true' : 'false', onClick: function () { setTab('yaml'); } },
                copy.yamlTab,
              ),
              h(
                'button',
                { type: 'button', role: 'tab', className: 'das-tab', 'aria-selected': tab === 'json' ? 'true' : 'false', onClick: function () { setTab('json'); } },
                copy.jsonTab,
              ),
            ),
          ),
          h(
            'div',
            { className: 'das-scroll' },
            h(
              'div',
              { className: 'das-field' },
              h('label', { className: 'das-label', htmlFor: 'das-naming' }, copy.namingLabel),
              h(
                'select',
                {
                  id: 'das-naming',
                  className: 'das-select',
                  value: mode,
                  onChange: function (event) {
                    setMode(event.target.value);
                  },
                },
                h('option', { value: 'auto' }, copy.namingAuto),
                h('option', { value: 'always' }, copy.namingAlways),
                h('option', { value: 'off' }, copy.namingOff),
              ),
              h('span', { className: 'das-hint' }, copy.namingHint),
            ),
            h(
              'label',
              { className: 'das-model', style: { marginBottom: '10px' } },
              h('input', {
                type: 'checkbox',
                checked: includeSecrets,
                disabled: !catalog.secretsAvailable,
                onChange: function () {
                  setIncludeSecrets(function (value) {
                    return !value;
                  });
                },
              }),
              h(
                'span',
                { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
                h('span', { className: 'das-label', style: { fontSize: '12px' } }, copy.secretsLabel),
                h('span', { className: 'das-hint' }, catalog.secretsAvailable ? copy.secretsHint : copy.secretsUnavailable),
              ),
            ),
            preview.renames.length > 0
              ? h(
                  'div',
                  { className: 'das-note', 'data-tone': 'warn' },
                  h('strong', null, copy.renames + '：'),
                  h(
                    'ul',
                    { className: 'das-list' },
                    preview.renames.map(function (rename, index) {
                      return h('li', { key: index }, rename.kind + ' ' + rename.provider + ' / ' + rename.from + ' → ' + rename.to);
                    }),
                  ),
                )
              : null,
            preview.warnings.length > 0
              ? h(
                  'div',
                  { className: 'das-note', 'data-tone': 'warn' },
                  h('strong', null, copy.warnings + '：'),
                  h(
                    'ul',
                    { className: 'das-list' },
                    preview.warnings.map(function (warning, index) {
                      return h('li', { key: index }, warning);
                    }),
                  ),
                )
              : null,
            preview.status === 'error' ? h('div', { className: 'das-note', 'data-tone': 'error' }, copy.previewFailed + preview.error) : null,
            chosenProviders.length === 0
              ? h('div', { className: 'das-note' }, copy.previewEmpty)
              : preview.status === 'busy' && preview.yaml === ''
                ? h('div', { className: 'das-note' }, copy.previewBusy)
                : h('pre', { className: 'das-pre', tabIndex: 0, 'aria-label': tab === 'yaml' ? copy.yamlTab : copy.jsonTab }, tab === 'yaml' ? preview.yaml : preview.json),
            includeSecrets && catalog.secretsAvailable ? h('div', { className: 'das-note', 'data-tone': 'warn' }, copy.secretsIncluded) : null,
          ),
        ),
        h(
          'div',
          { className: 'das-foot' },
            h('span', { className: 'das-foot-status' }, format(copy.selected, { providers: chosenProviders.length, models: modelCount })),
            h(
              'div',
              { className: 'das-foot-actions' },
              h(
                'button',
                { type: 'button', className: 'das-btn', disabled: preview.yaml === '' || preview.json === '', onClick: onCopy },
                copyLabel,
              ),
              h(
                'button',
                { type: 'button', className: 'das-btn das-btn-primary', disabled: preview.yaml === '' || preview.json === '', onClick: onDownload },
                downloadLabel,
              ),
            ),
          ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* import panel                                                       */
    /* ------------------------------------------------------------------ */

    var ACTION_TONE = {
      create: 'ok',
      rename: 'accent',
      update: 'warn',
      unchanged: 'neutral',
      skip: 'neutral',
      invalid: 'error',
    };

    /**
     * The import pane: paste or drop a snippet on the left, review the plan on
     * the right, then write it.
     * @param {{ copy: any, catalog: any, active: boolean, onApplied: Function, onStatus: Function }} props
     */
    function ImportPanel(props) {
      var copy = props.copy;
      var textState = React.useState('');
      var text = textState[0];
      var setText = textState[1];

      var policyState = React.useState('merge');
      var policy = policyState[0];
      var setPolicy = policyState[1];

      var planState = React.useState({ status: 'idle', entries: [], summary: null, warnings: [], error: '', format: '', validation: null });
      var plan = planState[0];
      var setPlan = planState[1];

      var applyState = React.useState({ status: 'idle', message: '' });
      var applying = applyState[0];
      var setApplying = applyState[1];

      var draggingState = React.useState(false);
      var dragging = draggingState[0];
      var setDragging = draggingState[1];

      var canWrite = props.catalog.canWrite === true;

      /* Preview when the text or the policy settles. */
      React.useEffect(function () {
        if (!props.active) return undefined;
        if (text.trim() === '') {
          setPlan({ status: 'idle', entries: [], summary: null, warnings: [], error: '', format: '', validation: null });
          return undefined;
        }
        setPlan(function (previous) {
          return Object.assign({}, previous, { status: 'busy', error: '' });
        });
        var timer = setTimeout(function () {
          postJson('/import/preview', { text: text, policy: policy }).then(
            function (payload) {
              setPlan({
                status: 'ready',
                entries: Array.isArray(payload.entries) ? payload.entries : [],
                summary: payload.summary || null,
                warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
                error: '',
                format: typeof payload.format === 'string' ? payload.format : '',
                validation: payload.validation || null,
              });
            },
            function (error) {
              setPlan({ status: 'error', entries: [], summary: null, warnings: [], error: String(error && error.message ? error.message : error), format: '', validation: null });
            },
          );
        }, 300);
        return function () {
          clearTimeout(timer);
        };
      }, [props.active, text, policy]);

      /**
       * @param {File} file
       */
      function readFile(file) {
        if (file === undefined || file === null) return;
        var reader = new FileReader();
        reader.onload = function () {
          setText(String(reader.result === null || reader.result === undefined ? '' : reader.result));
          props.onStatus(file.name);
        };
        reader.onerror = function () {
          props.onStatus(String(reader.error || 'read failed'));
        };
        reader.readAsText(file);
      }

      var onDrop = React.useCallback(function (event) {
        event.preventDefault();
        setDragging(false);
        var files = event.dataTransfer !== null && event.dataTransfer !== undefined ? event.dataTransfer.files : null;
        if (files !== null && files.length > 0) readFile(files[0]);
      }, []);

      var onPick = React.useCallback(function (event) {
        var files = event.target.files;
        if (files !== null && files.length > 0) readFile(files[0]);
        event.target.value = '';
      }, []);

      var summary = plan.summary === undefined || plan.summary === null ? null : plan.summary;
      var changes = summary === null ? 0 : summary.create + summary.rename + summary.update;
      var validationFailed = plan.validation !== null
        && plan.validation !== undefined
        && plan.validation.checked === true
        && plan.validation.error !== '';

      var onApply = React.useCallback(function () {
        if (changes === 0 || applying.status === 'busy' || validationFailed) return;
        setApplying({ status: 'busy', message: '' });
        postJson('/import/apply', { text: text, policy: policy, confirm: true }).then(
          function (payload) {
            setApplying({ status: 'done', message: copy.applied });
            props.onStatus(copy.applied);
            if (typeof props.onApplied === 'function') props.onApplied(payload);
          },
          function (error) {
            var message = String(error && error.message ? error.message : error);
            setApplying({ status: 'error', message: message });
            props.onStatus(copy.applyFailed + message);
          },
        );
      }, [changes, applying.status, validationFailed, text, policy, copy, props]);

      return h(
        'div',
        { className: 'das-body' },
        /* left: source */
        h(
          'div',
          { className: 'das-col' },
          h(
            'div',
            { className: 'das-col-head' },
            h('h3', { className: 'das-col-title' }, copy.importTitle),
            h(
              'label',
              { className: 'das-btn das-btn-sm', style: { cursor: 'pointer' } },
              copy.chooseFile,
              h('input', { type: 'file', accept: '.yml,.yaml,.json,text/plain,application/json', onChange: onPick, style: { display: 'none' } }),
            ),
            text === ''
              ? null
              : h(
                  'button',
                  { type: 'button', className: 'das-link', onClick: function () { setText(''); setApplying({ status: 'idle', message: '' }); } },
                  copy.clearText,
                ),
          ),
          h(
            'div',
            {
              className: 'das-scroll',
              onDragOver: function (event) {
                event.preventDefault();
                setDragging(true);
              },
              onDragLeave: function () {
                setDragging(false);
              },
              onDrop: onDrop,
              style: dragging ? { outline: '2px dashed var(--dsw-alias-state-business-primary,#5b8cff)', outlineOffset: '-6px' } : undefined,
            },
            h('p', { className: 'das-hint', style: { margin: '0' } }, copy.importHint),
            h(
              'div',
              { className: 'das-field' },
              h('label', { className: 'das-label', htmlFor: 'das-snippet' }, copy.pasteLabel),
              h('textarea', {
                id: 'das-snippet',
                className: 'das-textarea',
                value: text,
                placeholder: copy.pastePlaceholder,
                spellCheck: false,
                onChange: function (event) {
                  setText(event.target.value);
                  setApplying({ status: 'idle', message: '' });
                },
              }),
              h('span', { className: 'das-hint' }, copy.dropHint),
            ),
            h(
              'div',
              { className: 'das-field' },
              h('label', { className: 'das-label', htmlFor: 'das-policy' }, copy.policyLabel),
              h(
                'select',
                {
                  id: 'das-policy',
                  className: 'das-select',
                  value: policy,
                  onChange: function (event) {
                    setPolicy(event.target.value);
                  },
                },
                h('option', { value: 'merge' }, copy.policyMerge),
                h('option', { value: 'skip' }, copy.policySkip),
                h('option', { value: 'overwrite' }, copy.policyOverwrite),
              ),
              h('span', { className: 'das-hint' }, copy.policyHint),
            ),
            canWrite ? h('div', { className: 'das-note' }, copy.needConfirm) : h('div', { className: 'das-note', 'data-tone': 'warn' }, copy.cannotWrite),
          ),
        ),
        /* right: plan */
        h(
          'div',
          { className: 'das-col' },
          h(
            'div',
            { className: 'das-col-head' },
            h('h3', { className: 'das-col-title' }, copy.previewPlan),
            plan.format !== '' ? h(Badge, { tone: 'neutral' }, plan.format.toUpperCase()) : null,
          ),
          h(
            'div',
            { className: 'das-scroll' },
            plan.status === 'busy' ? h('div', { className: 'das-note' }, copy.planBusy) : null,
            plan.status === 'error' ? h('div', { className: 'das-note', 'data-tone': 'error' }, copy.planFailed + plan.error) : null,
            plan.status === 'idle' ? h('div', { className: 'das-note' }, copy.planEmpty) : null,
            summary !== null ? h('div', { className: 'das-hint' }, format(copy.summary, summary)) : null,
            plan.entries.length > 0
              ? h(
                  'div',
                  { className: 'das-plan' },
                  plan.entries.map(function (entry, index) {
                    return h(
                      'div',
                      { className: 'das-plan-row', key: entry.provider + ':' + index },
                      h(Badge, { tone: ACTION_TONE[entry.action] || 'neutral' }, copy['action' + entry.action.charAt(0).toUpperCase() + entry.action.slice(1)] || entry.action),
                      h(
                        'div',
                        { className: 'das-plan-main' },
                        h(
                          'span',
                          { className: 'das-plan-name' },
                          entry.action === 'rename' ? entry.from + ' → ' + entry.to : entry.to || entry.provider,
                        ),
                        h(
                          'span',
                          { className: 'das-plan-reason' },
                          entry.reason + (entry.models && entry.models.total > 0 ? ' · ' + format(copy.modelsAdded, { count: entry.models.total }) : ''),
                        ),
                      ),
                    );
                  }),
                )
              : null,
            plan.warnings.length > 0
              ? h(
                  'div',
                  { className: 'das-note', 'data-tone': 'warn' },
                  h('strong', null, copy.warnings + '：'),
                  h(
                    'ul',
                    { className: 'das-list' },
                    plan.warnings.map(function (warning, index) {
                      return h('li', { key: index }, warning);
                    }),
                  ),
                )
              : null,
            validationFailed ? h('div', { className: 'das-note', 'data-tone': 'error' }, copy.validationFailed + plan.validation.error) : null,
            applying.status === 'error' ? h('div', { className: 'das-note', 'data-tone': 'error' }, copy.applyFailed + applying.message) : null,
            applying.status === 'done' ? h('div', { className: 'das-note' }, applying.message) : null,
          ),
        ),
        h(
          'div',
          { className: 'das-foot' },
            h(
              'span',
              { className: 'das-foot-status' },
              changes === 0 ? copy.applyNoChange : format(copy.summary, summary || {}),
            ),
            h(
              'div',
              { className: 'das-foot-actions' },
              h(
                'button',
                {
                  type: 'button',
                  className: 'das-btn das-btn-primary',
                  disabled: !canWrite || changes === 0 || applying.status === 'busy' || validationFailed,
                  onClick: onApply,
                },
                applying.status === 'busy' ? copy.applying : copy.apply,
              ),
            ),
          ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* dialog                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * @param {{ open: boolean, onClose: Function, copy: any }} props
     */
    function ShareDialog(props) {
      var copy = props.copy;
      var tabState = React.useState('export');
      var tab = tabState[0];
      var setTab = tabState[1];

      var statusState = React.useState('');
      var status = statusState[0];
      var setStatus = statusState[1];

      var catalogState = React.useState({ status: 'loading', providers: [], skipped: [], dormant: [], sources: {}, secretsAvailable: false, canWrite: false, error: '' });
      var catalog = catalogState[0];
      var setCatalog = catalogState[1];

      var dialogRef = React.useRef(null);

      var onStatus = React.useCallback(function (message) {
        setStatus(String(message === undefined || message === null ? '' : message));
        setTimeout(function () {
          setStatus('');
        }, 2600);
      }, []);

      var load = React.useCallback(function () {
        setCatalog(function (previous) {
          return Object.assign({}, previous, { status: 'loading', error: '' });
        });
        postJson('/catalog', {}).then(
          function (payload) {
            setCatalog({
              status: 'ready',
              providers: Array.isArray(payload.providers) ? payload.providers : [],
              skipped: Array.isArray(payload.skipped) ? payload.skipped : [],
              dormant: Array.isArray(payload.dormant) ? payload.dormant : [],
              sources: payload.sources || {},
              secretsAvailable: payload.secretsAvailable === true,
              canWrite: payload.canWrite === true,
              error: '',
            });
          },
          function (error) {
            setCatalog({
              status: 'error',
              providers: [],
              skipped: [],
              dormant: [],
              sources: {},
              secretsAvailable: false,
              canWrite: false,
              error: String(error && error.message ? error.message : error),
            });
          },
        );
      }, []);

      React.useEffect(function () {
        if (!props.open) return undefined;
        setStatus('');
        if (catalog.status === 'error' || catalog.status === 'loading') load();
        var timer = setTimeout(function () {
          if (dialogRef.current !== null && typeof dialogRef.current.focus === 'function') dialogRef.current.focus();
        }, 0);
        return function () {
          clearTimeout(timer);
        };
      }, [props.open]);

      useEscapeKey(props.open, props.onClose);

      if (!props.open) return null;

      return h(
        'div',
        {
          className: 'das-backdrop',
          onMouseDown: function (event) {
            if (event.target === event.currentTarget) props.onClose();
          },
        },
        h(
          'div',
          { className: 'das-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': copy.a11y, ref: dialogRef, tabIndex: -1 },
          h(
            'div',
            { className: 'das-head' },
            h(
              'div',
              { className: 'das-head-main' },
              h('h2', null, copy.title),
              h('p', { className: 'das-sub' }, tab === 'export' ? copy.entryHint : copy.importHint),
            ),
            h(
              'div',
              { className: 'das-tabs', role: 'tablist' },
              h(
                'button',
                { type: 'button', role: 'tab', className: 'das-tab', 'aria-selected': tab === 'export' ? 'true' : 'false', onClick: function () { setTab('export'); } },
                copy.tabExport,
              ),
              h(
                'button',
                { type: 'button', role: 'tab', className: 'das-tab', 'aria-selected': tab === 'import' ? 'true' : 'false', onClick: function () { setTab('import'); } },
                copy.tabImport,
              ),
            ),
            h('button', { type: 'button', className: 'das-btn', onClick: props.onClose }, copy.close),
          ),
          tab === 'export'
            ? h(ExportPanel, { copy: copy, catalog: catalog, active: props.open && tab === 'export', onReload: load, onStatus: onStatus })
            : h(ImportPanel, {
                copy: copy,
                catalog: catalog,
                active: props.open && tab === 'import',
                onStatus: onStatus,
                onApplied: function () {
                  /* A write changes the catalogue, so re-read it for the export tab. */
                  load();
                },
              }),
          status === '' ? null : h('div', { className: 'das-sr', role: 'status', 'aria-live': 'polite' }, status),
        ),
      );
    }

    /**
     * The footer entry itself: one card with a button, plus the dialog.
     * @param {any} props
     */
    function ShareFooter(props) {
      var copy = useCopy();
      var openState = React.useState(false);
      var open = openState[0];
      var setOpen = openState[1];
      var close = React.useCallback(function () {
        setOpen(false);
      }, []);
      return h(
        'div',
        { className: 'das-root' },
        h(
          'div',
          { className: 'das-row' },
          h(
            'div',
            { className: 'das-row-text' },
            h('span', { className: 'das-row-title' }, copy.entry),
            h('span', { className: 'das-row-hint' }, copy.entryHint),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'das-btn',
              onClick: function () {
                setOpen(true);
              },
            },
            copy.entry,
          ),
        ),
        h(ShareDialog, { open: open, onClose: close, copy: copy }),
      );
    }

    /* ------------------------------------------------------------------ */
    /* registration                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * Register one slot entry, swallowing any failure.
     * A plugin must never take the surface it decorates down with it.
     * @param {any} ctx
     * @param {string} slot
     * @param {any} options
     * @param {Function} Component
     * @returns {boolean}
     */
    function register(ctx, slot, options, Component) {
      try {
        if (ctx === null || ctx === undefined || ctx.slots === null || ctx.slots === undefined) {
          throw new Error('the `slots` service is not available');
        }
        var registration = Object.assign({ name: slot }, options);
        ctx.slots.inject(slot, function () {
          return ctx.slots.register(registration, Component);
        });
        return true;
      } catch (error) {
        try {
          console.warn('[' + PACKAGE_ID + '] could not register ' + slot + ':', error);
        } catch (ignored) {
          /* nothing else to do */
        }
        return false;
      }
    }

    /**
     * Keep a surface from rendering an empty rectangle when it throws.
     * @param {string} name
     * @param {Function} Component
     * @returns {Function}
     */
    function withBoundary(name, Component) {
      var Base = typeof React.Component === 'function' ? React.Component : null;
      if (Base === null) return Component;
      var Boundary = class extends Base {
        constructor(props) {
          super(props);
          this.state = { error: null };
        }
        static getDerivedStateFromError(error) {
          return { error: error };
        }
        componentDidCatch(error) {
          try {
            console.warn('[' + PACKAGE_ID + '] render ' + name + ' failed:', error);
          } catch (ignored) {
            /* nothing else to do */
          }
        }
        render() {
          if (this.state !== null && this.state !== undefined && this.state.error !== null && this.state.error !== undefined) {
            var detail = String(this.state.error.message !== undefined ? this.state.error.message : this.state.error);
            return h('div', { className: 'das-root' }, h('div', { className: 'das-note', 'data-tone': 'error' }, PACKAGE_ID + ': ' + detail));
          }
          return h(Component, this.props);
        }
      };
      Boundary.displayName = 'DasBoundary(' + name + ')';
      return Boundary;
    }

    /**
     * @param {any} ctx client cordis context
     */
    function apply(ctx) {
      try {
        installStyles();
        clientContext = ctx === undefined ? null : ctx;
        language = languageOf(currentLocale());
        register(ctx, SLOT_MODELS_FOOTER, { id: PACKAGE_ID + '.footer', order: 100 }, withBoundary('footer', ShareFooter));
      } catch (error) {
        try {
          console.warn('[' + PACKAGE_ID + '] not activated:', error);
        } catch (ignored) {
          /* nothing else to do */
        }
      }
    }

    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
