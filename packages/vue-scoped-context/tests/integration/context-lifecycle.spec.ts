import {
    defineComponent,
    nextTick,
    ref,
    watchEffect,
} from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import {
    ContextLifecycleError,
    createContextPlugin,
    defineContext,
} from '../../src';

interface TestContext {
    value: number;
}

function createTestContext() {
    return defineContext<TestContext>({
        name: 'Test',

        factory: () => ({
            value: 0,
        }),
    });
}

describe('context lifecycle', () => {
    describe('cleanup registration', () => {
        it('runs cleanup callbacks in reverse registration order', () => {
            const order: string[] = [];
            const Context = defineContext<TestContext>({
                name: 'Test',
                factory: (lifecycle) => {
                    lifecycle.onDispose(() => order.push('first'));
                    lifecycle.onDispose(() => order.push('second'));

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();
            Context.dispose(context);

            expect(order).toEqual(['second', 'first']);
        });

        it('runs all cleanup callbacks even if some throw', () => {
            const firstError = new Error('First cleanup failed');
            const secondError = new Error('Second cleanup failed');

            const order: string[] = [];

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        order.push('first');
                        throw firstError;
                    });

                    lifecycle.onDispose(() => {
                        order.push('second');
                        throw secondError;
                    });

                    lifecycle.onDispose(() => {
                        order.push('third');
                    });

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();

            let error: unknown;

            try {
                Context.dispose(context);
            } catch (caught) {
                error = caught;
            }

            expect(error).toBeInstanceOf(ContextLifecycleError);

            expect((error as ContextLifecycleError).errors).toEqual([
                secondError,
                firstError,
            ]);

            expect(order).toEqual([
                'third',
                'second',
                'first',
            ]);
        });

        it('allows cleanup callbacks to register more cleanup callbacks', () => {
            const order: string[] = [];

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        order.push('first');

                        lifecycle.onDispose(() => {
                            order.push('nested');
                        });
                    });

                    lifecycle.onDispose(() => {
                        order.push('second');
                    });

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();

            Context.dispose(context);

            expect(order).toEqual([
                'second',
                'first',
                'nested',
            ]);
        });

        it('executes cleanup immediately when registered after disposal', () => {
            let lifecycle!: Parameters<Parameters<typeof defineContext<TestContext>>[0]['factory']>[0];

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (factoryLifecycle) => {
                    lifecycle = factoryLifecycle;

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();
            const cleanup = vi.fn();

            Context.dispose(context);

            lifecycle.onDispose(cleanup);

            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('runs cleanup registered during disposal immediately and collects its error', () => {
            const nestedError = new Error('Nested cleanup failed');
            let lifecycle!: Parameters<Parameters<typeof defineContext<TestContext>>[0]['factory']>[0];
            const Context = defineContext<TestContext>({
                name: 'Test',
                factory: (factoryLifecycle) => {
                    lifecycle = factoryLifecycle;

                    factoryLifecycle.onDispose(() => {
                        factoryLifecycle.onDispose(() => {
                            throw nestedError;
                        });
                    });

                    return { value: 0 };
                },
            });

            expect(() => Context.dispose(Context.create())).toThrowError(
                expect.objectContaining({ errors: [nestedError] }),
            );

            expect(lifecycle).toBeDefined();
        });
    });

    describe('disposal', () => {
        it('is idempotent', () => {
            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(cleanup);

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();

            Context.dispose(context);
            Context.dispose(context);
            Context.dispose(context);

            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('does not recursively dispose an instance', () => {
            // eslint-disable-next-line prefer-const
            let instance!: ReturnType<ReturnType<typeof createTestContext>['create']>;

            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        cleanup();

                        Context.dispose(instance);
                    });

                    return {
                        value: 0,
                    };
                },
            });

            instance = Context.create();

            Context.dispose(instance);

            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('stops effects created inside the instance scope', async () => {
            const source = ref(0);
            const observed: number[] = [];

            const Context = defineContext<{
                value: number;
            }>({
                name: 'Test',

                factory: () => {
                    watchEffect(() => {
                        observed.push(source.value);
                    });

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();

            expect(observed).toEqual([0]);

            source.value = 1;
            await nextTick();
            expect(observed).toEqual([0, 1]);

            Context.dispose(context);

            source.value = 2;
            await nextTick();
            expect(observed).toEqual([0, 1]);
        });

        it('throws cleanup errors only after all cleanup has finished', () => {
            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        throw new Error('Cleanup failed');
                    });

                    lifecycle.onDispose(cleanup);

                    return {
                        value: 0,
                    };
                },
            });

            const context = Context.create();

            expect(() => {
                Context.dispose(context);
            }).toThrow(ContextLifecycleError);

            expect(cleanup).toHaveBeenCalledOnce();

            // The failed cleanup must not make the instance active again.
            expect(() => {
                Context.dispose(context);
            }).not.toThrow();
        });
    });

    describe('factory failures', () => {
        it('cleans up resources when the definition factory throws', () => {
            const originalError = new Error('Factory failed');
            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(cleanup);

                    throw originalError;
                },
            });

            expect(() => {
                Context.create();
            }).toThrow(originalError);

            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('preserves the original error when cleanup also fails', () => {
            const originalError = new Error('Factory failed');
            const cleanupError = new Error('Cleanup failed');

            const cleanup = vi.fn(() => {
                throw cleanupError;
            });

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(cleanup);

                    throw originalError;
                },
            });

            let error: unknown;

            try {
                Context.create();
            } catch (caught) {
                error = caught;
            }

            expect(error).toBeInstanceOf(ContextLifecycleError);

            expect((error as ContextLifecycleError).cause).toBe(
                originalError,
            );

            expect((error as ContextLifecycleError).errors).toEqual([
                cleanupError,
            ]);

            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('cleans up both factories when the instance factory throws', () => {
            const order: string[] = [];
            const originalError = new Error('Instance factory failed');

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        order.push('defaults');
                    });

                    return {
                        value: 0,
                    };
                },
            });

            expect(() => {
                Context.create({
                    factory: (_defaults, lifecycle) => {
                        lifecycle.onDispose(() => {
                            order.push('instance');
                        });

                        throw originalError;
                    },
                });
            }).toThrow(originalError);

            expect(order).toEqual([
                'instance',
                'defaults',
            ]);
        });
    });

    describe('Vue provider ownership', () => {
        it('disposes the instance when the provider is unmounted', () => {
            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(cleanup);

                    return {
                        value: 0,
                    };
                },
            });

            const Parent = defineComponent({
                setup() {
                    Context.provide(
                        Context.create(),
                    );

                    return () => null;
                },
            });

            const wrapper = mount(Parent);

            expect(cleanup).not.toHaveBeenCalled();
            wrapper.unmount();
            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('does not dispose the instance twice after manual disposal', () => {
            const cleanup = vi.fn();

            const Context = defineContext<TestContext>({
                name: 'Test',

                factory: (lifecycle) => {
                    lifecycle.onDispose(cleanup);

                    return {
                        value: 0,
                    };
                },
            });

            let instance: ReturnType<typeof Context.create>;

            const Parent = defineComponent({
                setup() {
                    instance = Context.create();

                    Context.provide(instance);

                    return () => null;
                },
            });

            const wrapper = mount(Parent);

            Context.dispose(instance!);
            expect(cleanup).toHaveBeenCalledOnce();

            wrapper.unmount();
            expect(cleanup).toHaveBeenCalledOnce();
        });

        it('rejects providing the same instance twice', () => {
            const Context = createTestContext();

            const instance = Context.create();
            let error: unknown;

            const Parent = defineComponent({
                setup() {
                    Context.provide(instance);

                    try {
                        Context.provide(instance);
                    } catch (caught) {
                        error = caught;
                    }

                    return () => null;
                },
            });

            mount(Parent);

            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toContain(
                'already been provided',
            );
        });

        it('rejects provide outside component setup', () => {
            const Context = createTestContext();
            const instance = Context.create();

            expect(() => {
                Context.provide(instance);
            }).toThrow('must be called during component setup');
        });
    });

    describe('registry integration', () => {
        it('removes manually disposed instances from the registry', () => {
            const Context = createTestContext();
            const plugin = createContextPlugin();

            let instance: ReturnType<typeof Context.create>;

            const Parent = defineComponent({
                setup() {
                    instance = Context.create();

                    Context.provide(instance);

                    return () => null;
                },
            });

            const wrapper = mount(Parent, {
                global: {
                    plugins: [plugin],
                },
            });

            expect(plugin.getInstances()).toHaveLength(1);
            Context.dispose(instance!);
            expect(plugin.getInstances()).toHaveLength(0);
            wrapper.unmount();
            expect(plugin.getInstances()).toHaveLength(0);
        });

        it('continues disposing all instances if one cleanup fails', () => {
            const FirstContext = defineContext<TestContext>({
                name: 'First',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        throw new Error('First cleanup failed');
                    });

                    return {
                        value: 0,
                    };
                },
            });

            const SecondContext = defineContext<TestContext>({
                name: 'Second',

                factory: (lifecycle) => {
                    lifecycle.onDispose(() => {
                        secondCleanup();
                    });

                    return {
                        value: 0,
                    };
                },
            });

            const secondCleanup = vi.fn();
            const plugin = createContextPlugin();

            const Parent = defineComponent({
                setup() {
                    FirstContext.provide(
                        FirstContext.create(),
                    );

                    SecondContext.provide(
                        SecondContext.create(),
                    );

                    return () => null;
                },
            });

            const wrapper = mount(Parent, {
                global: {
                    plugins: [plugin],
                },
            });

            expect(plugin.getInstances()).toHaveLength(2);

            expect(() => {
                plugin.disposeAll();
            }).toThrow(ContextLifecycleError);

            expect(secondCleanup).toHaveBeenCalledOnce();
            expect(plugin.getInstances()).toHaveLength(0);

            wrapper.unmount();
        });

        it('supports disposal from a synchronous created listener', () => {
            const Context = createTestContext();
            const plugin = createContextPlugin();

            const events: string[] = [];

            plugin.subscribe((event) => {
                events.push(event.type);

                if (event.type === 'created') {
                    Context.dispose(
                        event.context.instance as ReturnType<
                            typeof Context.create
                        >,
                    );
                }
            });

            const Parent = defineComponent({
                setup() {
                    Context.provide(
                        Context.create(),
                    );

                    return () => null;
                },
            });

            const wrapper = mount(Parent, {
                global: {
                    plugins: [plugin],
                },
            });

            expect(events).toEqual([
                'allocated',
                'provided',
                'created',
                'disposed',
            ]);

            expect(plugin.getInstances()).toHaveLength(0);

            wrapper.unmount();
        });
    });
});
