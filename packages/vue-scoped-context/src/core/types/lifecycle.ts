/**
 * Which public operation was in progress when cleanup errors were collected.
 */
export type ContextLifecycleOperation =
    | 'create'
    | 'provide'
    | 'dispose'
    | 'disposeAll';
