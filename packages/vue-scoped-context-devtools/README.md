# vue-scoped-context-devtools

Vue Devtools inspector for [`vue-scoped-context`](../vue-scoped-context).

The Devtools package installs the context registry for you. Add its plugin once:

```ts
import { createApp } from 'vue';
import { createContextDevtoolsPlugin } from 'vue-scoped-context-devtools';
import App from './App.vue';

const app = createApp(App);
app.use(createContextDevtoolsPlugin());
app.mount('#app');
```

Open the Vue Devtools **Inspectors** panel and select **Scoped Contexts**. The
tree lists context instances created during component setup, including
instances that have not been provided yet. Selecting an instance shows its
provider and current properties. Properties appear as child nodes with type
tags; editable values can be changed in the state pane. A lightbulb action
highlights the provider component in the inspected app. Property labels use runtime values, so
TypeScript-only types are not available; refs and computed refs show their
wrapper and the inner value type.

Install `vue-scoped-context-devtools` alongside `vue-scoped-context` and Vue.
The Devtools inspector is available when a compatible Vue Devtools plugin API
is present.

On initialization, the package prints a styled message when it starts
registering the inspector. Its log level is shared with the core package; see
the [logging configuration](../vue-scoped-context/README.md#logging).
