/**
 * dsh-api-share — entry point of the host half.
 *
 * The cordis loader imports the package (`main`) and reads the plugin object
 * from the default export. The implementation lives in `lib/host/` so the
 * catalogue, the export composition and the route table stay separate pieces
 * of code rather than one file that knows everything.
 */
export { apply, normalizeConfig, default, ROUTE_PREFIX, PACKAGE_ID } from './lib/host/plugin.js';
