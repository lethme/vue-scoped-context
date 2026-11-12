import type { ObjectPlugin } from 'vue';

/**
 * A registry entry exposed to DevTools / {@link ContextPlugin.getInstances}.
 */
export interface RegisteredContext {
    id: number;
    name: string;
    instance: object;
    provider?: ContextProvider;
}

export interface ContextProvider {
    name: string;
    uid: number;
}

export interface ContextRegistration {
    unregister(): void;
    notifyAllocated(): void;
    notifyCreated(): void;
    setProvider(provider: ContextProvider): void;
}

/**
 * Notifications emitted by the app-level context registry.
 *
 * Every event is emitted synchronously. `"allocated"` fires when an
 * instance is created inside a component setup, `"provider"` when its
 * provider is assigned, `"created"` when it is provided, `"updated"` on
 * deep mutations, and `"disposed"` when it leaves the registry.
 */
export type ContextRegistryEvent =
    | {
        type: 'allocated';
        context: RegisteredContext;
    }
    | {
        type: 'provided';
        context: RegisteredContext;
    }
    | {
        type: 'created';
        context: RegisteredContext;
    }
    | {
        type: 'updated';
        context: RegisteredContext;
    }
    | {
        type: 'disposed';
        context: RegisteredContext;
    };

export type ContextRegistryListener = (
    event: ContextRegistryEvent,
) => void;

export type ContextProviderListener = (
    context: RegisteredContext,
) => void;

export type ContextAllocationListener = (
    context: RegisteredContext,
) => void;

/**
 * Vue plugin plus a small inspection API over every registered context in
 * that app.
 *
 * `subscribe` / `getInstances` / `disposeAll` work even before `install`,
 * but instances appear in the registry only after `app.use(plugin)`.
 */
export type ContextPlugin = ObjectPlugin & {
    subscribe(listener: ContextRegistryListener): () => void;
    subscribeAllocation(listener: ContextAllocationListener): () => void;
    subscribeProvider(listener: ContextProviderListener): () => void;
    getInstances(): RegisteredContext[];
    disposeAll(): void;
};
