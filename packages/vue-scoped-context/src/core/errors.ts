import type { ContextLifecycleOperation } from './types';

/**
 * Thrown when one or more operations performed during context cleanup fail.
 *
 * When operation is `"create"` or `"provide"`, `cause` is the original error
 * that triggered rollback. `errors` lists failures from cleanup itself.
 */
export class ContextLifecycleError extends Error {
    readonly errors: readonly unknown[];
    readonly cause: unknown;

    constructor(
        operation: ContextLifecycleOperation,
        errors: readonly unknown[],
        cause?: unknown,
    ) {
        super(
            `[vue-scoped-context] "${operation}" failed with ` +
            `${errors.length} cleanup error(s).`,
        );

        this.name = 'ContextLifecycleError';
        this.errors = errors;
        this.cause = cause;
    }
}

export function throwIfCleanupFailed(
    operation: ContextLifecycleOperation,
    errors: readonly unknown[],
    cause?: unknown,
): void {
    if (errors.length > 0) {
        throw new ContextLifecycleError(operation, errors, cause);
    }
}
