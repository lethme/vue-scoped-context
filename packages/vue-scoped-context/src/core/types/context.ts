import type { ShallowReactive } from 'vue';

/**
 * A live context object produced by {@link ContextDefinition.create}.
 *
 * The instance itself is `shallowReactive`: replacing a top-level field is
 * tracked, nested mutations are not, unless the factory stores reactive
 * values in those fields.
 */
export type ContextInstance<TContext extends object> = ShallowReactive<TContext>;

/**
 * Hooks available to factories while an instance is being built.
 *
 * Callbacks registered with {@link ContextLifecycle.onDispose} run when the
 * instance is disposed, in reverse registration order.
 */
export interface ContextLifecycle {
    /**
     * Register work that must run when this instance is torn down
     * (unsubscribe, abort, close, etc.).
     *
     * - While the instance is active, the callback is queued.
     * - During disposal, it runs immediately and any thrown error is collected.
     * - After disposal, it runs immediately and errors propagate to the caller.
     */
    onDispose(callback: () => void): void;
}

/**
 * Options for {@link defineContext}.
 *
 * The factory is the definition-level constructor: it runs once per instance
 * and returns the default shape. Per-instance overrides go through
 * {@link CreateContextOptions.factory}.
 */
export interface DefineContextOptions<TContext extends object> {
    /**
     * Human-readable name used in errors, injection keys, and the registry.
     * Falls back to `"Unnamed context"`.
     */
    name?: string;

    /**
     * Builds the default context object.
     *
     * Must return a plain object (an object literal or null-prototype object).
     * Class instances and other objects with custom prototypes are rejected:
     * context creation copies own enumerable properties into a reactive object.
     *
     * Runs inside a detached effect scope owned by the instance, so
     * `watch` / `computed` / `onScopeDispose` created here are tied to
     * this instance rather than the caller.
     */
    factory: (lifecycle: ContextLifecycle) => TContext;
}

/**
 * Per-instance options for {@link ContextDefinition.create}.
 */
export interface CreateContextOptions<TContext extends object> {
    /**
     * Optional overlay on top of the definition factory result.
     *
     * Receives the default object (not yet reactive) and may return a
     * plain partial object whose own enumerable keys overwrite matching defaults.
     */
    factory?: (
        defaults: Readonly<TContext>,
        lifecycle: ContextLifecycle,
    ) => Partial<TContext>;
}

/**
 * A named context type: one injection key, many instances.
 *
 * Typical usage is `create()` in a parent, `provide()` during that
 * parent's `setup()`, then `use()` / `tryUse()` in descendants.
 */
export interface ContextDefinition<TContext extends object> {
    readonly name: string;

    /**
     * Allocate a new instance without injecting it.
     *
     * The instance is not bound to a component until {@link provide}.
     * Call {@link dispose} yourself if you never provide it.
     */
    create(
        options?: CreateContextOptions<TContext>,
    ): ContextInstance<TContext>;

    /**
     * Inject `instance` for descendants of the current component and bind
     * its lifetime to that component's effect scope.
     *
     * Must be called during `setup()`. Each instance may be provided only
     * once. If a {@link createContextPlugin} is installed, the instance is
     * also registered for inspection.
     *
     * @returns The same instance, for chaining.
     */
    provide(
        instance: ContextInstance<TContext>,
    ): ContextInstance<TContext>;

    /**
     * Allocate a new instance and inject `instance`
     * for descendants of the current component and bind
     * its lifetime to that component's effect scope.
     *
     * Must be called during `setup()`. Each instance may be provided only
     * once. If a {@link createContextPlugin} is installed, the instance is
     * also registered for inspection.
     */
    provideNew(
        options?: CreateContextOptions<TContext>,
    ): ContextInstance<TContext>;

    /**
     * Resolve the nearest provided instance of this definition.
     *
     * @throws Error If no ancestor provided this context.
     */
    use(): ContextInstance<TContext>;

    /**
     * Like {@link use}, but returns `undefined` when no provider exists.
     */
    tryUse(): ContextInstance<TContext> | undefined;

    /**
     * Tear down an instance created by this definition: stop its scope,
     * run `onDispose` callbacks, and unregister it.
     *
     * @throws {ContextLifecycleError} If one or more cleanup steps failed.
     */
    dispose(instance: ContextInstance<TContext>): void;
}
