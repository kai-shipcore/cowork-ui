import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const reactModules = new Map(
  [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    'react-dom',
    'react-dom/server',
  ].map((specifier) => [
    specifier,
    pathToFileURL(require.resolve(specifier)).href,
  ]),
);

// Match Vite's React deduplication for the locally linked Storybook package.
registerHooks({
  resolve(specifier, context, nextResolve) {
    const url = reactModules.get(specifier);
    return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
  },
});
