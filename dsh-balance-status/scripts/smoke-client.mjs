// Smoke-test the built client bundle: materialize its factory with a stub
// module table (real react, stub primitives) and run apply against a fake
// client ctx. Catches syntax errors, missing requires, and registration bugs.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// React is resolved from a modules root that ships a matching version — the
// dev workspace in a checkout, or an explicit override via REACT_MODULES_ROOT.
const modulesRoots = [
  process.env.REACT_MODULES_ROOT,
  "D:/dsh/node_modules",
].filter((candidate) => candidate !== undefined);
const findReact = (spec) => {
  for (const root of modulesRoots) {
    try {
      return require.resolve(spec, { paths: [root] });
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`react not found in ${modulesRoots.join(", ")} — set REACT_MODULES_ROOT`);
};
const reactPath = findReact("react");
const jsxRuntimePath = findReact("react/jsx-runtime");
const react = await import(new URL(`file:///${reactPath.replace(/\\/g, "/")}`));
const jsxRuntime = await import(new URL(`file:///${jsxRuntimePath.replace(/\\/g, "/")}`));

const primitives = {
  Button: () => null,
  IconLoadingOutline16: () => null,
  Modal: () => null,
  Tooltip: () => null
};

const registration = { id: "test" };
const pending = [];
let factory;
globalThis.window = {
  __ModuleLoader__: {
    load(reg) {
      factory = reg.factory;
      registration.id = reg.id;
    }
  },
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};

const bundle = await readFile(new URL("../lib/client.js", import.meta.url), "utf8");
// execute
const fn = new Function("window", bundle + "\n;return window.__ModuleLoader__;");
const loader = fn(globalThis.window);
if (loader === undefined) throw new Error("loader not installed");
console.log("registered id:", registration.id);
if (typeof factory !== "function") throw new Error("no factory registered");

const moduleBox = { exports: {} };
const exportsObj = factory((spec) => {
  if (spec === "react") return react;
  if (spec === "react/jsx-runtime") return jsxRuntime;
  if (spec === "react-dom") return {};
  if (spec === "react-dom/client") return {};
  if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
  throw new Error(`unexpected require: ${spec}`);
});
console.log("exports:", Object.keys(exportsObj));

// fake client ctx
let registered = null;
const localeStore = {};
const ctx = {
  effect(fn) {
    const d = fn();
    return typeof d === "function" ? d : () => {};
  },
  locale: {
    register(ns, dicts) { localeStore[ns] = dicts; },
    bind() { return (k) => k; }
  },
  slots: {
    inject(key, fn) {
      const result = fn();
      registered = { key, register: result };
    },
    register(options, component) {
      registered = { key: "(register)", options, component };
      return () => {};
    }
  }
};
exportsObj.apply(ctx);
const disposed = registered;
console.log("slots.inject target:", disposed.key);
console.log("register disposer is function:", typeof disposed.register === "function");
console.log("locale namespaces:", Object.keys(localeStore));
console.log("OK");
