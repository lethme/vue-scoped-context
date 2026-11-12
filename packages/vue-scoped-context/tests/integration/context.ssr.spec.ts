import {
    createSSRApp,
    defineComponent,
    h,
    nextTick,
    ref,
    watchEffect,
    type Ref,
} from 'vue';
import { renderToString } from '@vue/server-renderer';
import { describe, expect, it, vi } from 'vitest';

import {
    createContextPlugin,
    defineContext,
    type ContextInstance,
} from '../../src';

interface TestContext {
    value: Ref<number>;
}

type TestContextDefinition = ReturnType<typeof createTestContext>;

interface SsrFixture {
    app: ReturnType<typeof createSSRApp>;
    plugin: ReturnType<typeof createContextPlugin>;
    instance: ContextInstance<TestContext>;
    effect: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
    updates: ReturnType<typeof vi.fn>;
}

function createTestContext() {
    return defineContext<TestContext>({
        name: 'SSR test context',
        factory: () => ({
            value: ref(0),
        }),
    });
}

function createSsrFixture(Context: TestContextDefinition): SsrFixture {
    const plugin = createContextPlugin();

    const effect = vi.fn();
    const cleanup = vi.fn();
    const updates = vi.fn();

    let instance!: ContextInstance<TestContext>;

    plugin.subscribe((event) => {
        if (event.type === 'updated') {
            updates();
        }
    });

    const app = createSSRApp(defineComponent({
        setup() {
            instance = Context.provide(Context.create({
                factory: (_defaults, lifecycle) => {
                    const value = ref(0);

                    lifecycle.onDispose(cleanup);

                    watchEffect(() => {
                        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                        value.value;
                        effect();
                    }, {
                        flush: 'sync',
                    });

                    return { value };
                },
            }));

            return () => h('div', String(instance.value.value));
        },
    }));

    app.use(plugin);

    return {
        app,
        plugin,
        effect,
        cleanup,
        updates,
        get instance() {
            return instance;
        },
    };
}

describe('SSR lifecycle', () => {
    it('isolates registries and instances between independent apps', async () => {
        const Context = createTestContext();

        const first = createSsrFixture(Context);
        const second = createSsrFixture(Context);

        await renderToString(first.app);
        await renderToString(second.app);

        expect(first.plugin.getInstances()).toHaveLength(1);
        expect(second.plugin.getInstances()).toHaveLength(1);

        expect(first.instance).not.toBe(second.instance);

        expect(first.instance.value.value).toBe(0);
        expect(second.instance.value.value).toBe(0);

        expect(first.cleanup).not.toHaveBeenCalled();
        expect(second.cleanup).not.toHaveBeenCalled();

        first.plugin.disposeAll();

        expect(first.plugin.getInstances()).toHaveLength(0);
        expect(second.plugin.getInstances()).toHaveLength(1);

        expect(first.cleanup).toHaveBeenCalledOnce();
        expect(second.cleanup).not.toHaveBeenCalled();

        // Changing first instance does nothing to second
        first.instance.value.value++;

        expect(first.instance.value.value).toBe(1);
        expect(second.instance.value.value).toBe(0);

        // Second app continues to own its context
        second.instance.value.value++;

        expect(second.instance.value.value).toBe(1);
        expect(second.plugin.getInstances()).toHaveLength(1);

        second.plugin.disposeAll();

        expect(second.plugin.getInstances()).toHaveLength(0);
        expect(second.cleanup).toHaveBeenCalledOnce();
    });

    it('does not retain SSR watchers after renderToString', async () => {
        const Context = createTestContext();
        const fixture = createSsrFixture(Context);

        await renderToString(fixture.app);

        expect(fixture.plugin.getInstances()).toHaveLength(1);

        // Synchronous watchEffect runs in SSR setup
        expect(fixture.effect).toHaveBeenCalledOnce();

        // Vue should stop SSR watchers after the SSR rendering
        fixture.instance.value.value++;

        await nextTick();

        expect(fixture.effect).toHaveBeenCalledOnce();
        expect(fixture.updates).not.toHaveBeenCalled();

        // The context remains until explicit disposeAll() call
        expect(fixture.plugin.getInstances()).toHaveLength(1);
        expect(fixture.cleanup).not.toHaveBeenCalled();

        fixture.plugin.disposeAll();

        expect(fixture.plugin.getInstances()).toHaveLength(0);
        expect(fixture.cleanup).toHaveBeenCalledOnce();

        // Consecutive disposal must be safe
        fixture.plugin.disposeAll();

        expect(fixture.cleanup).toHaveBeenCalledOnce();
    });
});
