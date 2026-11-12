import {
    effectScope,
    getCurrentInstance,
    inject,
    onScopeDispose,
    getCurrentScope,
    provide as vueProvide,
    shallowReactive,
    type InjectionKey,
} from 'vue';

import { ContextLifecycleError, throwIfCleanupFailed } from './errors';
import { createInstanceState, disposeInstanceState, type ContextInstanceState } from './instance';
import { createContextLogger } from './logger';
import { contextRegistryKey } from './registry';
import type {
    ContextDefinition,
    ContextInstance,
    CreateContextOptions,
    DefineContextOptions,
} from './types';

/**
 * Sentinel for {@link inject}: a missing provider must not be confused with
 * a provided value, so `tryUse` never uses `undefined` as the inject default.
 */
const MISSING_CONTEXT = Symbol('vue-scoped-context:missing');
const logger = createContextLogger();

function assertContextObject(
    value: unknown,
    name: string,
    source: string,
): asserts value is object {
    const prototype = typeof value === 'object' && value !== null
        ? Object.getPrototypeOf(value)
        : undefined;

    if (
        typeof value !== 'object' ||
        value === null ||
        Array.isArray(value) ||
        (prototype !== Object.prototype && prototype !== null)
    ) {
        throw new TypeError(
            `[vue-scoped-context] The ${source} factory for "${name}" ` +
            'must return a plain object.',
        );
    }
}

/**
 * Define a context type that can be created, provided, consumed, and disposed.
 *
 * Each call produces a distinct injection key. Two `defineContext` results
 * with the same `name` still do not share instances.
 *
 * @example
 * ```ts
 * const UserContext = defineContext({
 *     name: 'User',
 *     factory: ({ onDispose }) => {
 *         const store = createUserStore();
 *         onDispose(() => store.dispose());
 *         return store;
 *     },
 * });
 *
 * // in a parent setup():
 * const user = UserContext.create();
 * UserContext.provide(user);
 * // or
 * const user = UserContext.provideNew();
 *
 * // in a child setup():
 * const user = UserContext.use();
 * ```
 */
export function defineContext<TContext extends object>(
    options: DefineContextOptions<TContext>,
): ContextDefinition<TContext> {
    const name = options.name?.trim() || 'Unnamed context';
    const key: InjectionKey<ContextInstance<TContext>> = Symbol(`vue-scoped-context:${name}`);

    const states = new WeakMap<ContextInstance<TContext>, ContextInstanceState>();

    function dispose(instance: ContextInstance<TContext>): void {
        const state = states.get(instance);

        if (!state) {
            throw new Error(
                '[vue-scoped-context] Cannot dispose an instance that ' +
                `does not belong to "${name}".`,
            );
        }

        const errors = disposeInstanceState(state);

        if (errors.length > 0) {
            logger.error(`Failed to dispose "${name}" context.`, ...errors);
        } else {
            logger.debug(`Disposed "${name}" context.`);
        }

        throwIfCleanupFailed('dispose', errors);
    }

    function create(
        instanceOptions: CreateContextOptions<TContext> = {},
    ): ContextInstance<TContext> {
        // Detached scope: creation must not attach to the caller's scope.
        // Lifetime is either explicit (`dispose`) or bound later in `provide`.
        const scope = effectScope(true);
        const { state, lifecycle } = createInstanceState(scope);

        try {
            const instance = scope.run(() => {
                const defaults = options.factory(lifecycle);

                assertContextObject(defaults, name, 'definition');

                const overrides = instanceOptions.factory?.(defaults, lifecycle) ?? {} as Partial<TContext>;

                assertContextObject(overrides, name, 'instance');

                return shallowReactive({
                    ...defaults,
                    ...overrides,
                }) as ContextInstance<TContext>;
            });

            // `effectScope.run` returns `undefined` if the scope is already
            // stopped (should not happen here, but fail loudly if it does due to some magic stuff).
            if (!instance) {
                throw new Error(
                    `[vue-scoped-context] Failed to create "${name}" context.`,
                );
            }

            logger.debug(`Created "${name}" context.`);

            states.set(instance, state);

            if (getCurrentInstance()) {
                const registry = inject(contextRegistryKey, undefined);

                if (registry) {
                    const registration = registry.register(
                        name,
                        instance,
                        () => {
                            dispose(instance);
                        },
                    );

                    state.registration = registration;
                    state.unregister = registration.unregister;
                    registration.notifyAllocated();
                }
            }

            return instance;
        } catch (cause) {
            // Factory threw (or we did). Roll back anything it already
            // registered — watchers, onDispose callbacks — then rethrow.
            const errors = disposeInstanceState(state);

            if (errors.length > 0) {
                logger.error(`Failed to create "${name}" context.`, cause, ...errors);
                throw new ContextLifecycleError(
                    'create',
                    errors,
                    cause,
                );
            }

            logger.error(`Failed to create "${name}" context.`, cause);

            throw cause;
        }
    }

    function provide(
        instance: ContextInstance<TContext>,
    ): ContextInstance<TContext> {
        const currentInstance = getCurrentInstance();

        if (!currentInstance) {
            throw new Error(
                `[vue-scoped-context] "${name}".provide() must be called ` +
                'during component setup().',
            );
        }

        const state = states.get(instance);

        if (!state || state.status !== 'active') {
            throw new Error(
                '[vue-scoped-context] Cannot provide an unknown or disposed ' +
                `"${name}" context instance.`,
            );
        }

        if (state.provided) {
            throw new Error(
                `[vue-scoped-context] "${name}" context instance has ` +
                'already been provided.',
            );
        }

        // Set before injecting so a re-entrant provide of the same instance
        // (e.g. from a registry subscriber) is rejected rather than nested.
        state.provided = true;
        logger.debug(`Providing "${name}" context.`);

        try {
            vueProvide(key, instance);

            // The providing component's current effect scope owns the instance.
            if (getCurrentScope() !== undefined) {
                onScopeDispose(() => {
                    dispose(instance);
                });
            }

            const registry = inject(contextRegistryKey, undefined);

            const providerType = currentInstance.type as {
                name?: string;
                __name?: string;
                __file?: string;
            };

            const provider = {
                name: providerType.name || providerType.__name ||
                    providerType.__file?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ||
                    'Anonymous component',
                uid: currentInstance.uid,
            };

            if (state.registration) {
                state.registration.setProvider(provider);
                state.registration.notifyCreated();
            } else if (registry) {
                const registration = registry.register(
                    name,
                    instance,
                    () => {
                        dispose(instance);
                    },
                    provider,
                );

                // Save the handle before notifying listeners. A subscriber
                // may synchronously dispose the instance from that event.
                state.registration = registration;
                state.unregister = registration.unregister;
                registration.notifyCreated();
            }
        } catch (cause) {
            const errors = disposeInstanceState(state);

            if (errors.length > 0) {
                logger.error(`Failed to provide "${name}" context.`, cause, ...errors);

                throw new ContextLifecycleError(
                    'provide',
                    errors,
                    cause,
                );
            }

            logger.error(`Failed to provide "${name}" context.`, cause);

            throw cause;
        }

        return instance;
    }

    function provideNew(
        instanceOptions: CreateContextOptions<TContext> = {},
    ): ContextInstance<TContext> {
        return provide(create(instanceOptions));
    }

    function tryUse(): ContextInstance<TContext> | undefined {
        const instance = inject(
            key,
            MISSING_CONTEXT as unknown as
                | ContextInstance<TContext>
                | typeof MISSING_CONTEXT,
        );

        return instance === MISSING_CONTEXT ? undefined : instance;
    }

    function use(): ContextInstance<TContext> {
        const instance = tryUse();

        if (instance === undefined) {
            throw new Error(
                `[vue-scoped-context] No provider found for "${name}". ` +
                'Call the context definition\'s provide() in an ancestor ' +
                'component setup().',
            );
        }

        return instance;
    }

    return {
        name,
        create,
        provide,
        provideNew,
        use,
        tryUse,
        dispose,
    };
}
