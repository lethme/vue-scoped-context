export { ContextLifecycleError } from './core/errors';
export { defineContext } from './core/define-context';
export { createContextPlugin, getActiveContextPlugin } from './core/registry';
export { createContextLogger, setContextLogLevel } from './core/logger';

export type {
    ContextAllocationListener,
    ContextProvider,
    ContextProviderListener,
    ContextRegistration,
    ContextDefinition,
    ContextInstance,
    ContextLifecycle,
    ContextLifecycleOperation,
    ContextPlugin,
    ContextRegistryEvent,
    ContextRegistryListener,
    CreateContextOptions,
    DefineContextOptions,
    RegisteredContext,
} from './core/types';
export type { ContextLogLevel } from './core/logger';
