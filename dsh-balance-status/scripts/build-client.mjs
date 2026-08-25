// Build the browser half into the client-plugin module format the harness
// serves and loads (window.__ModuleLoader__.load with a lazy CJS factory).
// Externals stay on the platform seed words: react, react/jsx-runtime and
// @deepseek-ai/dsh-client-ui-primitives are provided by the shell.

import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const entryPath = fileURLToPath(new URL("../src/client.tsx", import.meta.url));
const tmpOutPath = fileURLToPath(new URL("../lib/_client.bundle.cjs", import.meta.url));
const finalOutPath = fileURLToPath(new URL("../lib/client.js", import.meta.url));

await build({
	entryPoints: [entryPath],
	bundle: true,
	format: "cjs",
	platform: "browser",
	target: "es2020",
	jsx: "automatic",
	external: [
		"react",
		"react/jsx-runtime",
		"react-dom",
		"react-dom/client",
		"@deepseek-ai/dsh-client-ui-primitives"
	],
	outfile: tmpOutPath,
	sourcemap: false,
	logLevel: "info"
});

const body = await readFile(tmpOutPath, "utf8");
const wrapped = `window.__ModuleLoader__.load({
	id: "dsh-balance-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
${body}
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
`;
await writeFile(finalOutPath, wrapped);
console.log(`built ${finalOutPath}`);
