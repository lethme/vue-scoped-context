import type { EffectScope } from 'vue';

import type { ContextLifecycle, ContextRegistration } from './types';

type ContextInstanceStatus =
    | 'active'
    | 'disposing'
    | 'disposed';

/**
 * Bookkeeping for one instance. Stored in a WeakMap keyed by the reactive
 * object so lookup is by identity and the map does not keep instances alive.
 */
export interface ContextInstanceState {
    scope: EffectScope;
    status: ContextInstanceStatus;
    cleanups: Array<() => void>;
    disposalErrors: unknown[];
    /** Guards against providing the same instance from two components. */
    provided: boolean;
    /** Registry unregistration; set only after a successful provide. */
    unregister?: () => void;
    registration?: ContextRegistration;
}

export function createInstanceState(scope: EffectScope): {
    state: ContextInstanceState;
    lifecycle: ContextLifecycle;
} {
    const state: ContextInstanceState = {
        scope,
        status: 'active',
        cleanups: [],
        disposalErrors: [],
        provided: false,
    };

    const lifecycle: ContextLifecycle = {
        onDispose(callback) {
            if (state.status === 'active') {
                state.cleanups.push(callback);
                return;
            }

            if (state.status === 'disposing') {
                // A factory or cleanup may register more work while we are
                // already tearing down. Run it now so it is not lost after
                // the cleanup queue has been drained.
                try {
                    callback();
                } catch (error) {
                    state.disposalErrors.push(error);
                }

                return;
            }

            // Registering cleanup after disposal executes it immediately.
            // At this point, there is no active disposal operation to collect
            // its error, so the error is propagated to the caller.
            callback();
        },
    };

    return {
        state,
        lifecycle,
    };
}

/**
 * Stops all resources owned by an instance.
 *
 * This function is deliberately non-throwing. The caller decides how to
 * report collected errors after every cleanup operation has been attempted.
 *
 * Order: unregister from the app registry, stop the effect scope, then run
 * `onDispose` callbacks last-in-first-out. Registry first so DevTools do not
 * observe a half-dead instance; scope next so reactive effects stop before
 * user cleanups run.
 */
export function disposeInstanceState(
    state: ContextInstanceState,
): readonly unknown[] {
    if (state.status !== 'active') {
        return [];
    }

    state.status = 'disposing';

    const unregister = state.unregister;
    state.unregister = undefined;

    if (unregister) {
        try {
            unregister();
        } catch (error) {
            state.disposalErrors.push(error);
        }
    }

    try {
        state.scope.stop();
    } catch (error) {
        state.disposalErrors.push(error);
    }

    while (state.cleanups.length > 0) {
        const cleanup = state.cleanups.pop();

        if (!cleanup) {
            continue;
        }

        try {
            cleanup();
        } catch (error) {
            state.disposalErrors.push(error);
        }
    }

    state.status = 'disposed';

    const errors = [...state.disposalErrors];

    state.disposalErrors.length = 0;

    return errors;
}
