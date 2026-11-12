/**
 * dsh-api-share — client half (browser bundle).
 *
 * Shape: a Module-Loader CJS factory (`window.__ModuleLoader__.load`), the same
 * lane every shipped client plugin uses. The loader calls `factory(require)`
 * once, lazily, the first time the plugin is needed; `require` resolves the
 * frozen platform table (`react`) plus the baseline externals.
 *
 * Rules this file follows, because breaking them breaks the GUI:
 *
 *   1. `inject` names only services that are certainly provided (`slots`). A
 *      declared service nobody provides keeps this entry PENDING and the web
 *      boot audit reports "did not activate".
 *   2. Every registration is wrapped: a missing slot means a missing button,
 *      never a broken settings page.
 *   3. UI is React inside slots — no DOM hunting, no class-name anchors.
 *
 * Surfaces:
 *   settings.models.footer   "导出配置" button + export dialog
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
        button: '导出配置',
        buttonHint: '把已配置的 API 与模型导出为 cordis.patch.yml 片段或 JSON 文件。',
        title: '导出模型配置',
        subtitle: '选择要导出的 API 和模型，导出结果可直接粘贴到目标 profile 的 cordis.patch.yml。',
        close: '关闭',
        loadFailed: '读取配置失败：',
        retry: '重试',
        loading: '正在读取已配置的 API…',
        empty: '这个 profile 里还没有可导出的 provider。请先在模型设置里添加 API。',
        providers: 'API / 模型',
        selectAll: '全选',
        clear: '清空',
        selectedCount: '已选 {providers} 个 API、{models} 个模型',
        options: '选项',
        namingLabel: '重名处理',
        namingAuto: '仅真实冲突时自动改名',
        namingAlways: '总是加后缀（合并进同一套配置时用）',
        namingOff: '保持原名',
        namingHint: '目标环境已有同名但连接信息不同的 provider 时自动加后缀（foo → foo-2），预览会标出每一次改名。',
        inheritNote: '这些模型的容量来自内置目录，导出时只写 id。',
        catalogTag: '目录',
        secretsLabel: '包含明文 API Key',
        secretsHint: '默认只导出 apiKeyEnv 引用；勾选后会把密钥写进注释，请自行保管导出文件。',
        secretsUnavailable: '本环境读不到任何密钥值，只能导出引用。',
        preview: '预览',
        yamlTab: 'YAML 片段',
        jsonTab: 'JSON',
        previewEmpty: '勾选至少一个模型后显示预览。',
        previewBusy: '正在生成…',
        previewFailed: '生成失败：',
        copy: '复制 YAML',
        copied: '已复制',
        copyFailed: '复制失败，请手动选择文本。',
        download: '下载 JSON',
        downloaded: '已下载',
        renames: '已自动改名',
        identical: '与现有配置一致',
        warnings: '提示',
        secretsIncluded: '已包含明文密钥',
        skipped: '未导出',
        noModel: '没有模型',
        modelsCount: '{count} 个模型',
        a11y: '导出模型配置对话框',
      },
      en: {
        button: 'Export configuration',
        buttonHint: 'Export the configured APIs and models as a cordis.patch.yml snippet or a JSON file.',
        title: 'Export model configuration',
        subtitle: 'Pick the APIs and models to export. The result pastes straight into the target profile’s cordis.patch.yml.',
        close: 'Close',
        loadFailed: 'Could not read the configuration: ',
        retry: 'Retry',
        loading: 'Reading the configured APIs…',
        empty: 'No exportable provider in this profile yet. Add an API in Models settings first.',
        providers: 'APIs / models',
        selectAll: 'All',
        clear: 'None',
        selectedCount: '{providers} APIs, {models} models selected',
        options: 'Options',
        namingLabel: 'Name collisions',
        namingAuto: 'Rename only on a real collision',
        namingAlways: 'Always add a suffix (merging into the same setup)',
        namingOff: 'Keep every name',
        namingHint: 'A provider the target already owns under this id with a different connection gets a numeric suffix (foo → foo-2); the preview lists every rename.',
        inheritNote: 'These model capacities come from the installed catalog, so only their ids are exported.',
        catalogTag: 'catalog',
        secretsLabel: 'Include plaintext API keys',
        secretsHint: 'Only the apiKeyEnv reference is exported by default. Ticking this writes the key into a comment — keep the file private.',
        secretsUnavailable: 'No credential value is readable here, so only references can be exported.',
        preview: 'Preview',
        yamlTab: 'YAML snippet',
        jsonTab: 'JSON',
        previewEmpty: 'Select at least one model to see the preview.',
        previewBusy: 'Generating…',
        previewFailed: 'Generation failed: ',
        copy: 'Copy YAML',
        copied: 'Copied',
        copyFailed: 'Copy failed — select the text manually.',
        download: 'Download JSON',
        downloaded: 'Downloaded',
        renames: 'Renamed automatically',
        identical: 'Identical to the current configuration',
        warnings: 'Notes',
        secretsIncluded: 'Plaintext keys included',
        skipped: 'Not exported',
        noModel: 'no models',
        modelsCount: '{count} models',
        a11y: 'Export model configuration dialog',
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
        var id = typeof current === 'string' ? current : current !== null && current !== undefined && typeof current.id === 'string' ? current.id : '';
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
          '.das-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 0 2px;margin-top:8px;border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28))}',
          '.das-row-text{display:flex;flex-direction:column;gap:2px;min-width:220px;flex:1}',
          '.das-row-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}',
          '.das-row-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-btn{appearance:none;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.32));background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.1));color:var(--dsw-alias-label-primary,inherit);border-radius:var(--dsw-radius-sm,8px);padding:7px 14px;font-size:13px;line-height:1.2;cursor:pointer;font-family:inherit}',
          '.das-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.2))}',
          '.das-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,#4c8dff);outline-offset:2px}',
          '.das-btn:disabled{opacity:.5;cursor:not-allowed}',
          '.das-btn-primary{background:var(--dsw-alias-button-primary-fill,#3b6fe0);border-color:var(--dsw-alias-button-primary-fill,#3b6fe0);color:var(--dsw-alias-label-primary-foreground,#fff)}',
          '.das-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,#3561c9)}',
          '.das-backdrop{position:fixed;inset:0;background:var(--dsw-alias-bg-mask-1,rgba(0,0,0,.48));display:flex;align-items:center;justify-content:center;padding:24px;z-index:1000}',
          '.das-dialog{width:min(960px,100%);max-height:min(86vh,900px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-2,#1c1c20);color:var(--dsw-alias-label-primary,#eee);border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.32));border-radius:var(--dsw-radius-lg,16px);box-shadow:var(--dsw-elevation-prominent,0 24px 64px rgba(0,0,0,.45));overflow:hidden}',
          '.das-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 20px 12px;border-bottom:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28))}',
          '.das-head h2{margin:0;font-size:16px;font-weight:650;line-height:1.3}',
          '.das-sub{margin:6px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));max-width:70ch}',
          '.das-body{display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.1fr);min-height:0;flex:1}',
          '.das-col{min-height:0;overflow:auto;padding:16px 20px}',
          '.das-col+.das-col{border-left:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28));display:flex;flex-direction:column;gap:10px}',
          '.das-section-title{font-size:12px;font-weight:600;letter-spacing:.02em;text-transform:uppercase;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));margin:0 0 10px}',
          '.das-provider{border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28));border-radius:var(--dsw-radius-md,12px);margin-bottom:10px;overflow:hidden}',
          '.das-provider-head{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.08))}',
          '.das-provider-meta{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}',
          '.das-provider-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-provider-sub{font-size:11px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-models{padding:6px 12px 10px;display:flex;flex-direction:column;gap:2px}',
          '.das-model{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:12px;color:var(--dsw-alias-label-primary,inherit);cursor:pointer}',
          '.das-model-id{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
          '.das-model-name{color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));font-size:11px}',
          '.das-model-actions{display:flex;gap:8px;padding:0 12px 6px}',
          '.das-link{appearance:none;background:none;border:0;padding:0;color:var(--dsw-alias-state-business-primary,#5b8cff);font-size:12px;cursor:pointer;font-family:inherit}',
          '.das-link:hover{text-decoration:underline}',
          '.das-option{display:flex;gap:8px;align-items:flex-start;margin:0 0 12px;font-size:12px;line-height:1.55}',
          '.das-option input{margin-top:2px}',
          '.das-option-text{display:flex;flex-direction:column;gap:2px}',
          '.das-option-hint{color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));font-size:11px}',
          '.das-select{font-family:inherit;font-size:12px;padding:5px 8px;border-radius:var(--dsw-radius-xs,4px);border:1px solid var(--dsw-alias-border-l4,rgba(128,128,128,.4));background:var(--dsw-alias-bg-layer-1,#18181b);color:var(--dsw-alias-label-primary,inherit)}',
          '.das-tabs{display:flex;gap:6px}',
          '.das-tab{appearance:none;border:1px solid transparent;background:none;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95));font-size:12px;padding:4px 8px;border-radius:var(--dsw-radius-xs,4px);cursor:pointer;font-family:inherit}',
          '.das-tab[aria-selected="true"]{background:var(--dsw-alias-settings-card-fill,rgba(127,127,127,.16));color:var(--dsw-alias-label-primary,inherit);border-color:var(--dsw-alias-border-l3,rgba(128,128,128,.28))}',
          '.das-pre{margin:0;flex:1;min-height:180px;max-height:46vh;overflow:auto;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.08));border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28));border-radius:var(--dsw-radius-md,12px);padding:12px;font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:12px;line-height:1.55;white-space:pre;tab-size:2}',
          '.das-note{font-size:12px;line-height:1.55;border-radius:var(--dsw-radius-sm,8px);padding:8px 10px;border:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28))}',
          '.das-note-ok{color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-note-warn{color:var(--dsw-alias-state-warn-label,#e0b055);border-color:rgba(224,176,85,.4);background:rgba(224,176,85,.08)}',
          '.das-note-error{color:var(--dsw-alias-state-error-primary,#e07a7a);border-color:rgba(224,122,122,.4);background:rgba(224,122,122,.08)}',
          '.das-list{margin:4px 0 0;padding-left:16px;font-size:11px;color:var(--dsw-alias-label-secondary,rgba(140,140,150,.95))}',
          '.das-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 20px;border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28));flex-wrap:wrap}',
          '.das-foot-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}',
          '@media (max-width:760px){.das-body{grid-template-columns:1fr}.das-col+.das-col{border-left:0;border-top:1px solid var(--dsw-alias-border-l3,rgba(128,128,128,.28))}}',
        ].join('\n');
        document.head.appendChild(style);
      } catch (error) {
        /* styling is a courtesy: an unstyled dialog still works */
      }
    }

    /* ------------------------------------------------------------------ */
    /* transport                                                          */
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
              : 'HTTP ' + response.status;
            throw new Error(detail);
          }
          return payload;
        });
      });
    }

    /**
     * Copy text, falling back to a hidden textarea on browsers that refuse the
     * async clipboard (the GUI is http://127.0.0.1, which counts as secure, but
     * a hosting shell may not be).
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
    /* dialog                                                             */
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

    /**
     * One provider row: checkbox for the provider, checkboxes for its models.
     * @param {{ provider: any, selected: Record<string, boolean>, onToggleProvider: Function, onToggleModel: Function, onAllModels: Function, copy: any }} props
     */
    function ProviderRow(props) {
      var provider = props.provider;
      var models = Array.isArray(provider.models) ? provider.models : [];
      var chosen = models.filter(function (model) {
        return props.selected[model.id] === true;
      }).length;
      var all = models.length > 0 && chosen === models.length;

      return h(
        'div',
        { className: 'das-provider' },
        h(
          'div',
          { className: 'das-provider-head' },
          h('input', {
            type: 'checkbox',
            checked: all,
            'aria-label': provider.id,
            onChange: function () {
              props.onAllModels(provider, !all);
            },
          }),
          h(
            'div',
            { className: 'das-provider-meta' },
            h('span', { className: 'das-provider-name' }, provider.displayName || provider.id),
            h(
              'span',
              { className: 'das-provider-sub' },
              [provider.id, provider.api, provider.apiKeyEnv].filter(Boolean).join(' · '),
            ),
          ),
          h('span', { className: 'das-provider-sub' }, format(props.copy.modelsCount, { count: chosen })),
        ),
        h(
          'div',
          { className: 'das-model-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'das-link',
              onClick: function () {
                props.onAllModels(provider, true);
              },
            },
            props.copy.selectAll,
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'das-link',
              onClick: function () {
                props.onAllModels(provider, false);
              },
            },
            props.copy.clear,
          ),
        ),
        h(
          'div',
          { className: 'das-models' },
          models.length === 0
            ? h('span', { className: 'das-provider-sub' }, props.copy.noModel)
            : models.map(function (model) {
                return h(
                  'label',
                  { className: 'das-model', key: model.id },
                  h('input', {
                    type: 'checkbox',
                    checked: props.selected[model.id] === true,
                    onChange: function () {
                      props.onToggleModel(provider, model.id);
                    },
                  }),
                  h('span', { className: 'das-model-id' }, model.id),
                  model.name !== '' && model.name !== model.id
                    ? h('span', { className: 'das-model-name' }, model.name)
                    : null,
                  model.origin === 'catalog'
                    ? h('span', { className: 'das-model-name' }, '· ' + props.copy.catalogTag)
                    : null,
                );
              }),
          provider.inheritsModels === true
            ? h('span', { className: 'das-provider-sub', style: { paddingTop: '4px' } }, props.copy.inheritNote)
            : null,
        ),
      );
    }

    /**
     * The export dialog. Owns the catalogue read, the selection, the preview and
     * the two artefacts; every failure becomes a visible line, never a crash.
     * @param {{ open: boolean, onClose: Function, copy: any }} props
     */
    function ExportDialog(props) {
      var copy = props.copy;
      var catalogState = React.useState({ status: 'loading', providers: [], skipped: [], sources: {}, secretsAvailable: false, error: '' });
      var catalog = catalogState[0];
      var setCatalog = catalogState[1];

      var selectionState = React.useState({});
      var selected = selectionState[0];
      var setSelected = selectionState[1];

      var modeState = React.useState('auto');
      var mode = modeState[0];
      var setMode = modeState[1];

      var secretsState = React.useState(false);
      var includeSecrets = secretsState[0];
      var setIncludeSecrets = secretsState[1];

      var previewState = React.useState({ status: 'idle', yaml: '', json: '', renames: [], identical: [], warnings: [], error: '' });
      var preview = previewState[0];
      var setPreview = previewState[1];

      var tabState = React.useState('yaml');
      var tab = tabState[0];
      var setTab = tabState[1];

      var statusState = React.useState('');
      var status = statusState[0];
      var setStatus = statusState[1];

      var dialogRef = React.useRef(null);

      useEscapeKey(props.open, props.onClose);

      /** Load the catalogue once per open. */
      var load = React.useCallback(function () {
        setCatalog(function (previous) {
          return Object.assign({}, previous, { status: 'loading', error: '' });
        });
        postJson('/catalog', {}).then(
          function (payload) {
            var providers = Array.isArray(payload.providers) ? payload.providers : [];
            setCatalog({
              status: 'ready',
              providers: providers,
              skipped: Array.isArray(payload.skipped) ? payload.skipped : [],
              sources: payload.sources || {},
              secretsAvailable: payload.secretsAvailable === true,
              error: '',
            });
            /* Default: everything provider ticked, every model ticked. */
            var next = {};
            providers.forEach(function (provider) {
              var models = {};
              (provider.models || []).forEach(function (model) {
                models[model.id] = true;
              });
              next[provider.id] = models;
            });
            setSelected(next);
          },
          function (error) {
            setCatalog({
              status: 'error',
              providers: [],
              skipped: [],
              sources: {},
              secretsAvailable: false,
              error: String(error && error.message ? error.message : error),
            });
          },
        );
      }, []);

      React.useEffect(function () {
        if (props.open) {
          setStatus('');
          setPreview({ status: 'idle', yaml: '', json: '', renames: [], identical: [], warnings: [], error: '' });
          load();
        }
        return undefined;
      }, [props.open, load]);

      React.useEffect(function () {
        if (!props.open) return undefined;
        var timer = setTimeout(function () {
          if (dialogRef.current !== null && typeof dialogRef.current.focus === 'function') dialogRef.current.focus();
        }, 0);
        return function () {
          clearTimeout(timer);
        };
      }, [props.open]);

      var chosenProviders = React.useMemo(function () {
        var list = [];
        catalog.providers.forEach(function (provider) {
          var models = selected[provider.id] || {};
          var ids = Object.keys(models).filter(function (id) {
            return models[id] === true;
          });
          if (ids.length > 0) list.push({ id: provider.id, models: ids });
        });
        return list;
      }, [catalog.providers, selected]);

      var selectionKey = React.useMemo(function () {
        return JSON.stringify(chosenProviders) + '|' + mode + (includeSecrets ? '|s' : '|');
      }, [chosenProviders, mode, includeSecrets]);

      /** Regenerate the preview whenever the request would change. */
      React.useEffect(function () {
        if (!props.open || catalog.status !== 'ready') return undefined;
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
              setPreview({
                status: 'error',
                yaml: '',
                json: '',
                renames: [],
                identical: [],
                warnings: [],
                error: String(error && error.message ? error.message : error),
              });
            },
          );
        }, 220);
        return function () {
          clearTimeout(timer);
        };
      }, [props.open, catalog.status, selectionKey]);

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

      var modelCount = chosenProviders.reduce(function (total, entry) {
        return total + entry.models.length;
      }, 0);

      var onCopy = React.useCallback(function () {
        if (preview.yaml === '') return;
        copyText(preview.yaml).then(function (ok) {
          setStatus(ok ? copy.copied : copy.copyFailed);
          setTimeout(function () {
            setStatus('');
          }, 2400);
        });
      }, [preview.yaml, copy]);

      var onDownload = React.useCallback(function () {
        if (preview.json === '') return;
        var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        var ok = downloadText('dsh-model-config-' + stamp + '.json', preview.json, 'application/json');
        setStatus(ok ? copy.downloaded : copy.previewFailed);
        setTimeout(function () {
          setStatus('');
        }, 2400);
      }, [preview.json, copy]);

      if (!props.open) return null;

      var body = null;
      if (catalog.status === 'loading') {
        body = h('div', { className: 'das-col' }, h('div', { className: 'das-note das-note-ok' }, copy.loading));
      } else if (catalog.status === 'error') {
        body = h(
          'div',
          { className: 'das-col' },
          h('div', { className: 'das-note das-note-error' }, copy.loadFailed + catalog.error),
          h(
            'button',
            { type: 'button', className: 'das-btn', onClick: load, style: { marginTop: '10px' } },
            copy.retry,
          ),
        );
      } else if (catalog.providers.length === 0) {
        body = h('div', { className: 'das-col' }, h('div', { className: 'das-note das-note-ok' }, copy.empty));
      } else {
        body = h(
          'div',
          { className: 'das-body' },
          h(
            'div',
            { className: 'das-col' },
            h('h3', { className: 'das-section-title' }, copy.providers),
            catalog.providers.map(function (provider) {
              return h(ProviderRow, {
                key: provider.id,
                provider: provider,
                selected: selected[provider.id] || {},
                onToggleModel: toggleModel,
                onAllModels: setAllModels,
                copy: copy,
              });
            }),
            h('h3', { className: 'das-section-title', style: { marginTop: '16px' } }, copy.options),
            h(
              'label',
              { className: 'das-option' },
              h(
                'span',
                { className: 'das-option-text', style: { flex: 1 } },
                h('span', null, copy.namingLabel),
                h(
                  'select',
                  {
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
                h('span', { className: 'das-option-hint' }, copy.namingHint),
              ),
            ),
            h(
              'label',
              { className: 'das-option' },
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
                { className: 'das-option-text' },
                h('span', null, copy.secretsLabel),
                h('span', { className: 'das-option-hint' }, catalog.secretsAvailable ? copy.secretsHint : copy.secretsUnavailable),
              ),
            ),
            catalog.skipped.length > 0
              ? h(
                  'div',
                  { className: 'das-note das-note-ok' },
                  h('strong', null, copy.skipped + '：'),
                  h(
                    'ul',
                    { className: 'das-list' },
                    catalog.skipped.map(function (entry) {
                      return h('li', { key: entry.id }, entry.id + ' — ' + entry.reason);
                    }),
                  ),
                )
              : null,
          ),
          h(
            'div',
            { className: 'das-col' },
            h(
              'div',
              { className: 'das-tabs', role: 'tablist' },
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  className: 'das-tab',
                  'aria-selected': tab === 'yaml' ? 'true' : 'false',
                  onClick: function () {
                    setTab('yaml');
                  },
                },
                copy.yamlTab,
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  className: 'das-tab',
                  'aria-selected': tab === 'json' ? 'true' : 'false',
                  onClick: function () {
                    setTab('json');
                  },
                },
                copy.jsonTab,
              ),
            ),
            preview.renames.length > 0
              ? h(
                  'div',
                  { className: 'das-note das-note-warn' },
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
                  { className: 'das-note das-note-warn' },
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
            preview.status === 'error'
              ? h('div', { className: 'das-note das-note-error' }, copy.previewFailed + preview.error)
              : null,
            chosenProviders.length === 0
              ? h('div', { className: 'das-note das-note-ok' }, copy.previewEmpty)
              : preview.status === 'busy' && preview.yaml === ''
                ? h('div', { className: 'das-note das-note-ok' }, copy.previewBusy)
                : h('pre', { className: 'das-pre', tabIndex: 0, 'aria-label': tab === 'yaml' ? copy.yamlTab : copy.jsonTab }, tab === 'yaml' ? preview.yaml : preview.json),
            includeSecrets && catalog.secretsAvailable
              ? h('div', { className: 'das-note das-note-warn' }, copy.secretsIncluded)
              : null,
          ),
        );
      }

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
          {
            className: 'das-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': copy.a11y,
            ref: dialogRef,
            tabIndex: -1,
          },
          h(
            'div',
            { className: 'das-head' },
            h(
              'div',
              null,
              h('h2', null, copy.title),
              h('p', { className: 'das-sub' }, copy.subtitle),
            ),
            h(
              'button',
              { type: 'button', className: 'das-btn', onClick: props.onClose },
              copy.close,
            ),
          ),
          body,
          h(
            'div',
            { className: 'das-foot' },
            h(
              'span',
              { className: 'das-row-hint', role: 'status', 'aria-live': 'polite' },
              status !== ''
                ? status
                : format(copy.selectedCount, { providers: chosenProviders.length, models: modelCount }),
            ),
            h(
              'div',
              { className: 'das-foot-actions' },
              h(
                'button',
                { type: 'button', className: 'das-btn', disabled: preview.yaml === '', onClick: onCopy },
                copy.copy,
              ),
              h(
                'button',
                { type: 'button', className: 'das-btn das-btn-primary', disabled: preview.json === '', onClick: onDownload },
                copy.download,
              ),
            ),
          ),
        ),
      );
    }

    /**
     * The footer entry itself: one line with a button, plus the dialog.
     * @param {any} props
     */
    function ExportFooter(props) {
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
            h('span', { className: 'das-row-title' }, copy.button),
            h('span', { className: 'das-row-hint' }, copy.buttonHint),
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
            copy.button,
          ),
        ),
        h(ExportDialog, { open: open, onClose: close, copy: copy }),
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
            return h(
              'div',
              { className: 'das-root' },
              h('div', { className: 'das-note das-note-error' }, 'dsh-api-share: ' + detail),
            );
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
        register(
          ctx,
          SLOT_MODELS_FOOTER,
          { id: PACKAGE_ID + '.footer', order: 100 },
          withBoundary('footer', ExportFooter),
        );
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
