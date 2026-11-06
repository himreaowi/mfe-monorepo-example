// jsdom test environment + the Fetch API of Node (Headers, Request, Response, abort signals).
//
// jsdom implements no Fetch API: `fetch`, `Headers`, `Request` and `Response` are undefined in
// a plain jest-environment-jsdom, so code that builds requests (@org/http-client) cannot run in
// component tests. This environment copies Node's classes in, and Node's AbortController too:
// Node's `Request` rejects jsdom's signals.
// `fetch` itself never reaches the network: it rejects (axios needs one to exist when it loads).
// Inject a fake (`createFakeFetch` from `@org/jest-config/fetch`) or mock the `api/` module.
const { TestEnvironment } = require('jest-environment-jsdom');

const FETCH_CLASSES = ['Headers', 'Request', 'Response'];
const ABORT_CLASSES = ['AbortController', 'AbortSignal'];

class JsdomEnvironmentWithFetchClasses extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of FETCH_CLASSES) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
    for (const name of ABORT_CLASSES) this.global[name] = globalThis[name];
    this.global.fetch ??= () =>
      Promise.reject(
        new Error(
          'No network in unit tests: inject a fake fetch (createFakeFetch) or mock the api/ module.',
        ),
      );
  }
}

module.exports = JsdomEnvironmentWithFetchClasses;
module.exports.TestEnvironment = JsdomEnvironmentWithFetchClasses;
