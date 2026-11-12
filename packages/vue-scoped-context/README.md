# vue-scoped-context

Type-safe, subtree-scoped context utilities for Vue 3. Define a context once,
create an instance for each provider, and consume the nearest instance from
descendant components. Nested providers override the context only in their own
subtree.

## Requirements

- Vue 3.3 or later
- Node.js 20 or later for development
- pnpm for development

## Install

```sh
pnpm add vue-scoped-context
```

## Quick start

Define the context shape and its per-instance defaults in one place:

```ts
// contexts/counter.ts
import { ref } from 'vue';
import { defineContext } from 'vue-scoped-context';

export const Counter = defineContext({
  name: 'Counter',
  factory: () => ({
    count: ref(0),
    increment() {
      this.count.value++;
    },
  }),
});
```

Provide an instance during the provider component's `setup()`:

```vue
<script setup lang="ts">
import { Counter } from './contexts/counter';

Counter.provideNew();
</script>

<template>
  <slot />
</template>
```

Consume it in any descendant's setup:

```vue
<script setup lang="ts">
import { Counter } from './contexts/counter';

const counter = Counter.use();
</script>

<template>
  <button @click="counter.increment()">Count: {{ counter.count }}</button>
</template>
```

`use()` throws a descriptive error if there is no matching ancestor provider.
Use `tryUse()` when absence is expected; it returns `undefined` instead.

## API

### `defineContext<TContext>(options)`

Defines a context with a unique injection key. Definitions with the same name
are still distinct contexts. `options.factory` is required and runs once per
instance. It receives a lifecycle object for registering cleanup callbacks.

```ts
const User = defineContext({
  name: 'User',
  factory: ({ onDispose }) => {
    const subscription = subscribeToUser();
    onDispose(() => subscription.unsubscribe());
    return { user: ref(null) };
  },
});
```

The factory must return a plain object (an object literal or null-prototype
object). Class instances and objects with custom prototypes are rejected,
because context creation copies own enumerable properties into a new reactive
object.

### `create(options?)`

Creates an instance without providing it. Use `options.factory` to return
per-instance values that override the definition defaults. The defaults are
merged automatically, so return only the fields you want to override:

```ts
const context = User.create({
  factory: () => ({
    user: ref(loadUser()),
  }),
});
```

An instance created this way is not tied to a component. Call `User.dispose()`
if you do not provide it.

### `provide(instance)` and `provideNew(options?)`

Both must be called during component `setup()`. `provide(instance)` provides an
existing instance; `provideNew()` creates and provides one. The provider
component owns the instance lifetime, so unmounting that component disposes it.
An instance can only be provided once.

### `use()` and `tryUse()`

Resolve the nearest provider in the current component ancestry. `use()` throws
when none exists; `tryUse()` returns `undefined`.

### `dispose(instance)`

Stops effects created in the context factory's scope, unregisters the instance
from the optional registry, and runs `onDispose` callbacks in reverse
registration order. Disposal is idempotent. Cleanup failures are reported as
`ContextLifecycleError` after all cleanup work has been attempted.

## Reactivity and lifetime

The returned context is `shallowReactive`: replacing a top-level property is
reactive, while nested values are not made reactive automatically. Use Vue's
`ref`, `shallowRef`, `reactive`, and `computed` as appropriate for nested or
derived state. Effects created inside the definition or instance factory are
owned by that context instance and stop when it is disposed.

Register external resource cleanup with `onDispose`, for example to unsubscribe,
abort a request, or close a connection. Cleanup callbacks run last-in-first-out.

## Registry and DevTools

Install `createContextPlugin()` to inspect instances and subscribe to registry
events:

```ts
import { createApp } from 'vue';
import { createContextPlugin } from 'vue-scoped-context';

const app = createApp(App);
const contexts = createContextPlugin();
app.use(contexts);
app.mount('#app');
```

The plugin exposes `getInstances()`, `subscribe()`, and `disposeAll()`. Use a
separate plugin instance for each Vue app and each SSR request. The optional
[`vue-scoped-context-devtools`](../vue-scoped-context-devtools/README.md)
package installs this registry and adds the Scoped Contexts inspector.

`disposeAll()` is intended for app or request teardown. If called while provider
components are still mounted, their injections still reference the now-disposed
instances until those components unmount.

## Logging

The core and DevTools packages share a log level, which defaults to `info`.
Set it before installing plugins:

```ts
import { setContextLogLevel } from 'vue-scoped-context';

setContextLogLevel('warn'); // 'silent' | 'error' | 'warn' | 'info' | 'debug'
```

## Development

From the workspace root:

```sh
pnpm install
pnpm test
pnpm test:types
pnpm typecheck
pnpm build
```

## License

MIT
