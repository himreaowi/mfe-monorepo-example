// jsdom test environment + the Fetch API classes of Node (Headers, Request, Response).
//
// jsdom implements no Fetch API: `fetch`, `Headers`, `Request` and `Response` are undefined in
// a plain jest-environment-jsdom, so code that builds headers or responses (e.g.
// @org/http-client) cannot run in component tests. This environment copies Node's classes in.
// `fetch` itself stays undefined on purpose: unit tests never hit the network; inject a fake
// (`createFakeFetch` from `@org/jest-config/fetch`) or mock the feature's `api/` module.
const { TestEnvironment } = require('jest-environment-jsdom');

const FETCH_CLASSES = ['Headers', 'Request', 'Response'];

class JsdomEnvironmentWithFetchClasses extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of FETCH_CLASSES) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
}

module.exports = JsdomEnvironmentWithFetchClasses;
module.exports.TestEnvironment = JsdomEnvironmentWithFetchClasses;
