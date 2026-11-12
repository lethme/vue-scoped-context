import {
    watch,
    type App,
    type InjectionKey,
} from 'vue';

import { throwIfCleanupFailed } from './errors';
import { createContextLogger } from './logger';
import type {
    ContextPlugin,
    ContextAllocationListener,
    ContextProvider,
    ContextProviderListener,
    ContextRegistration,
    ContextRegistryEvent,
    ContextRegistryListener,
    RegisteredContext,
} from './types';

const logger = createContextLogger();

interface ContextRegistry {
    register(
        name: string,
        instance: object,
        dispose: () => void,
        provider?: ContextProvider,
    ): ContextRegistration;
}

export const contextRegistryKey: InjectionKey<ContextRegistry> =
    Symbol('vue-scoped-context:registry');

/** The most recently installed context registry plugin in this JS runtime. */
let activeContextPlugin: ContextPlugin | undefined;

/**
 * Returns the most recently installed context registry plugin, if any.
 *
 * This is a convenience for single-app client applications. For SSR or
 * applications with multiple Vue apps, retain and use each app's plugin
 * instance directly.
 */
export function getActiveContextPlugin(): ContextPlugin | undefined {
    return activeContextPlugin;
}

/**
 * App-scoped index of provided instances.
 *
 * Lives behind {@link createContextPlugin} so SSR can give every request
 * its own registry, and so a Vue app can opt into inspection without
 * making `defineContext` depend on DevTools.
 */
class AppContextRegistry implements ContextRegistry {
    private readonly entries = new Map<
        object,
        {
            context: RegisteredContext;
            stop: () => void;
            dispose: () => void;
        }
    >();

    private readonly listeners = new Set<ContextRegistryListener>();
    private nextId = 1;

    register(
        name: string,
        instance: object,
        dispose: () => void,
        provider?: ContextProvider,
    ): ContextRegistration {
        if (this.entries.has(instance)) {
            throw new Error(
                `[vue-scoped-context] Context instance "${name}" ` +
                'is already registered.',
            );
        }

        const context: RegisteredContext = {
            id: this.nextId++,
            name,
            instance,
            provider,
        };

        // Deep + sync so inspectors see each mutation as it happens, not on
        // the next tick after the providing component has moved on.
        const stop = watch(
            instance,
            () => {
                this.emit({
                    type: 'updated',
                    context,
                });
            },
            {
                deep: true,
                flush: 'sync',
            },
        );

        this.entries.set(instance, {
            context,
            stop,
            dispose,
        });

        let active = true;

        return {
            unregister: () => {
                if (!active) {
                    return;
                }

                active = false;

                const entry = this.entries.get(instance);

                if (!entry) {
                    return;
                }

                entry.stop();
                this.entries.delete(instance);

                this.emit({
                    type: 'disposed',
                    context: entry.context,
                });
            },

            notifyCreated: () => {
                if (active) {
                    this.emit({
                        type: 'created',
                        context,
                    });
                }
            },

            notifyAllocated: () => {
                if (!active) {
                    return;
                }

                this.emit({ type: 'allocated', context });
            },

            setProvider: (nextProvider) => {
                if (!active) {
                    return;
                }

                context.provider = nextProvider;

                this.emit({ type: 'provided', context });
            },
        };
    }

    subscribe(listener: ContextRegistryListener): () => void {
        this.listeners.add(listener);

        return () => {
            this.listeners.delete(listener);
        };
    }

    subscribeProvider(listener: ContextProviderListener): () => void {
        return this.subscribe((event) => {
            if (event.type === 'provided') {
                listener(event.context);
            }
        });
    }

    subscribeAllocation(listener: ContextAllocationListener): () => void {
        return this.subscribe((event) => {
            if (event.type === 'allocated') {
                listener(event.context);
            }
        });
    }

    getInstances(): RegisteredContext[] {
        return Array.from(
            this.entries.values(),
            ({ context }) => context,
        );
    }

    disposeAll(): void {
        const entries = Array.from(this.entries.values());
        const errors: unknown[] = [];

        for (const entry of entries) {
            try {
                entry.dispose();
            } catch (error) {
                errors.push(error);
            }
        }

        throwIfCleanupFailed('disposeAll', errors);
    }

    private emit(event: ContextRegistryEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                // A DevTools subscriber must not be able to break context
                // creation, updates or disposal.
                logger.error('Registry listener failed:', error);
            }
        }
    }
}

/**
 * Creates an app-scoped context registry.
 *
 * Create a separate plugin instance for every Vue app and every SSR request.
 */
export function createContextPlugin(): ContextPlugin {
    const registry = new AppContextRegistry();

    let installedApp: App | undefined;

    const plugin: ContextPlugin = {
        install(app: App) {
            if (installedApp && installedApp !== app) {
                throw new Error(
                    '[vue-scoped-context] A context plugin instance ' +
                    'cannot be shared between Vue apps.',
                );
            }

            installedApp = app;
            activeContextPlugin = plugin;

            app.provide(contextRegistryKey, registry);
            logger.info('Plugin initialized.');
        },

        subscribe(listener) {
            return registry.subscribe(listener);
        },

        subscribeProvider(listener) {
            return registry.subscribeProvider(listener);
        },

        subscribeAllocation(listener) {
            return registry.subscribeAllocation(listener);
        },

        getInstances() {
            return registry.getInstances();
        },

        disposeAll() {
            registry.disposeAll();
        },
    };

    return plugin;
}
