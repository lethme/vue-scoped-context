import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    ContextLifecycleError,
    createContextPlugin,
    defineContext,
} from '../../src';

describe('context registry plugin', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('registers contexts allocated during setup and reports provider lifecycle', () => {
        const Context = defineContext<{ value: number }>({
            name: 'Registry context',
            factory: () => ({ value: 0 }),
        });

        const plugin = createContextPlugin();
        const events: string[] = [];

        plugin.subscribe((event) => events.push(event.type));

        const Provider = defineComponent({
            name: 'NamedProvider',
            setup() {
                const instance = Context.create();

                expect(plugin.getInstances()).toHaveLength(1);
                expect(instance.value).toBe(0);

                Context.provide(instance);

                return () => null;
            },
        });

        const wrapper = mount(Provider, { global: { plugins: [plugin] } });
        const [registered] = plugin.getInstances();

        expect(events).toEqual(['allocated', 'provided', 'created']);
        expect(registered).toMatchObject({
            id: 1,
            name: 'Registry context',
            provider: { name: 'NamedProvider' },
        });

        wrapper.unmount();
        expect(events.at(-1)).toBe('disposed');
        expect(plugin.getInstances()).toEqual([]);
    });

    it('supports allocation and provider convenience subscriptions', () => {
        const Context = defineContext({ name: 'Subscribable', factory: () => ({}) });
        const plugin = createContextPlugin();
        const allocated = vi.fn();
        const providers = vi.fn();
        const stopAllocation = plugin.subscribeAllocation(allocated);
        const stopProvider = plugin.subscribeProvider(providers);

        const Provider = defineComponent({
            setup() {
                Context.provide(Context.create());
                return () => null;
            },
        });

        const wrapper = mount(Provider, { global: { plugins: [plugin] } });

        expect(allocated).toHaveBeenCalledOnce();
        expect(providers).toHaveBeenCalledOnce();

        stopAllocation();
        stopProvider();
        wrapper.unmount();
        expect(allocated).toHaveBeenCalledOnce();
        expect(providers).toHaveBeenCalledOnce();
    });

    it('allows listeners to unsubscribe and isolates listener exceptions', () => {
        const Context = defineContext<{ value: number }>({
            name: 'Listener context',
            factory: () => ({ value: 0 }),
        });

        const plugin = createContextPlugin();

        const badListener = vi.fn(() => { throw new Error('listener failed'); });
        const goodListener = vi.fn();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});

        let instance!: ReturnType<typeof Context.create>;

        const unsubscribe = plugin.subscribe(badListener);

        plugin.subscribe(goodListener);

        const Provider = defineComponent({
            setup() {
                instance = Context.create();
                Context.provide(instance);
                return () => null;
            },
        });

        const wrapper = mount(Provider, { global: { plugins: [plugin] } });

        expect(goodListener).toHaveBeenCalledTimes(3);
        expect(error).toHaveBeenCalledTimes(3);

        unsubscribe();

        instance.value = 1;

        expect(badListener).toHaveBeenCalledTimes(3);
        expect(goodListener).toHaveBeenCalledTimes(4);

        wrapper.unmount();
        expect(plugin.getInstances()).toHaveLength(0);
    });

    it('rejects installing one plugin instance into different apps', () => {
        const plugin = createContextPlugin();
        const first = defineComponent({ render: () => null });
        const second = defineComponent({ render: () => null });

        mount(first, { global: { plugins: [plugin] } });

        expect(() => mount(second, { global: { plugins: [plugin] } })).toThrow(
            'cannot be shared between Vue apps',
        );
    });

    it('collects failures from multiple registered instances during disposeAll', () => {
        const firstError = new Error('first disposal failed');
        const secondError = new Error('second disposal failed');

        const first = defineContext({
            name: 'First',
            factory: (lifecycle) => {
                lifecycle.onDispose(() => { throw firstError; });
                return {};
            },
        });

        const second = defineContext({
            name: 'Second',
            factory: (lifecycle) => {
                lifecycle.onDispose(() => { throw secondError; });
                return {};
            },
        });

        const plugin = createContextPlugin();

        const Provider = defineComponent({
            setup() {
                first.provide(first.create());
                second.provide(second.create());

                return () => null;
            },
        });

        const wrapper = mount(Provider, { global: { plugins: [plugin] } });

        let disposalError: unknown;

        try {
            plugin.disposeAll();
        } catch (error) {
            disposalError = error;
        }

        expect(disposalError).toBeInstanceOf(ContextLifecycleError);

        const errors = (disposalError as ContextLifecycleError).errors;

        expect(errors).toHaveLength(2);

        expect(errors).toEqual([
            expect.objectContaining({ errors: [firstError] }),
            expect.objectContaining({ errors: [secondError] }),
        ]);

        expect(plugin.getInstances()).toHaveLength(0);

        wrapper.unmount();
    });
});
