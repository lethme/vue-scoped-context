# Vue Scoped Context

A pnpm workspace containing two independently publishable Vue 3 packages:

- [`vue-scoped-context`](packages/vue-scoped-context): type-safe, subtree-scoped context utilities.
- [`vue-scoped-context-devtools`](packages/vue-scoped-context-devtools): a Vue Devtools inspector for context instances.

## Requirements

- Node.js 20 or later
- pnpm 10 or later

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

See each package README for usage and API details. The packages are versioned and published separately; the DevTools package depends on the core package.

## Publishing

Build and validate from the workspace root, then publish the packages from their respective directories with `pnpm publish`. Publish `vue-scoped-context` before publishing a DevTools version that depends on a newer core version. Use npm trusted publishing or a narrowly scoped automation token for CI publishing.

## License

MIT. Each package includes its license file.
