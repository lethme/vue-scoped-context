import {
    defineComponent,
    h,
    ref,
    type Ref,
} from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import {
    createContextPlugin,
    defineContext,
} from '../../src';

interface FormContext {
    fields: Map<string, string>;
    isDirty: boolean;
    isValid: boolean;
    validate: () => Promise<boolean>;
}

function createFormContext() {
    return defineContext<FormContext>({
        name: 'Form',

        factory: () => ({
            fields: new Map(),
            isDirty: false,
            isValid: true,
            validate: async () => true,
        }),
    });
}

describe('defineContext', () => {
    it('creates independent context instances', () => {
        const FormContext = createFormContext();

        const first = FormContext.create();
        const second = FormContext.create();

        first.fields.set('name', 'First');

        expect(second.fields.has('name')).toBe(false);
        expect(first).not.toBe(second);
    });

    it('merges instance-specific values over defaults', () => {
        const FormContext = createFormContext();

        const context = FormContext.create({
            factory: (defaults) => ({
                isValid: false,
                fields: new Map(defaults.fields),
            }),
        });

        expect(context.isValid).toBe(false);
        expect(context.isDirty).toBe(false);
        expect(context.fields).not.toBe(
            FormContext.create().fields,
        );
    });

    it('provides a context to descendants', () => {
        const FormContext = createFormContext();

        let received: FormContext | undefined;

        const Child = defineComponent({
            setup() {
                received = FormContext.use();

                return () => null;
            },
        });

        const Parent = defineComponent({
            setup() {
                FormContext.provideNew();

                return () => h(Child);
            },
        });

        mount(Parent);

        expect(received).toBeDefined();
        expect(received?.isValid).toBe(true);
    });

    it('uses the nearest provider in nested component trees', () => {
        const FormContext = createFormContext();

        let received: FormContext | undefined;

        const Child = defineComponent({
            setup() {
                received = FormContext.use();

                return () => null;
            },
        });

        const Inner = defineComponent({
            setup() {
                FormContext.provideNew({
                    factory: () => ({
                        isValid: false,
                    }),
                });

                return () => h(Child);
            },
        });

        const Parent = defineComponent({
            setup() {
                FormContext.provideNew();

                return () => h(Inner);
            },
        });

        mount(Parent);

        expect(received?.isValid).toBe(false);
    });

    it('returns undefined when tryUse has no provider', () => {
        const FormContext = createFormContext();

        let received: FormContext | undefined;

        const Component = defineComponent({
            setup() {
                received = FormContext.tryUse();

                return () => null;
            },
        });

        mount(Component);

        expect(received).toBeUndefined();
    });

    it('throws when use has no provider', () => {
        const FormContext = createFormContext();

        const Component = defineComponent({
            setup() {
                FormContext.use();

                return () => null;
            },
        });

        expect(() => mount(Component)).toThrow(
            'No provider found for "Form"',
        );
    });

    it('tracks changes in refs stored inside the context', () => {
        const CounterContext = defineContext<{
            count: Ref<number>;
        }>({
            name: 'Counter',
            factory: () => ({
                count: ref(0),
            }),
        });

        const plugin = createContextPlugin();
        const events: string[] = [];

        let received: { count: Ref<number> } | undefined;

        plugin.subscribe((event) => {
            events.push(event.type);
        });

        const Child = defineComponent({
            setup() {
                received = CounterContext.use();

                return () => null;
            },
        });

        const Parent = defineComponent({
            setup() {
                CounterContext.provideNew();

                return () => h(Child);
            },
        });

        mount(Parent, {
            global: {
                plugins: [plugin],
            },
        });

        expect(events).toEqual([
            'allocated',
            'provided',
            'created',
        ]);

        received!.count.value++;

        expect(events).toEqual([
            'allocated',
            'provided',
            'created',
            'updated',
        ]);
    });

    it('cleans up the instance when the provider is unmounted', () => {
        const cleanup = vi.fn();

        const FormContext = defineContext<FormContext>({
            name: 'Form',

            factory: (lifecycle) => {
                lifecycle.onDispose(cleanup);

                return {
                    fields: new Map(),
                    isDirty: false,
                    isValid: true,
                    validate: async () => true,
                };
            },
        });

        const Parent = defineComponent({
            setup() {
                FormContext.provideNew();

                return () => null;
            },
        });

        const wrapper = mount(Parent);

        expect(cleanup).not.toHaveBeenCalled();

        wrapper.unmount();

        expect(cleanup).toHaveBeenCalledOnce();
    });

    it('allows explicit disposal', () => {
        const cleanup = vi.fn();

        const FormContext = defineContext<FormContext>({
            name: 'Form',

            factory: (lifecycle) => {
                lifecycle.onDispose(cleanup);

                return {
                    fields: new Map(),
                    isDirty: false,
                    isValid: true,
                    validate: async () => true,
                };
            },
        });

        const context = FormContext.create();

        FormContext.dispose(context);
        FormContext.dispose(context);

        expect(cleanup).toHaveBeenCalledOnce();
    });

    it('notifies the registry about creation, allocation, provide and state changes', () => {
        const FormContext = createFormContext();
        const plugin = createContextPlugin();

        const events: string[] = [];

        plugin.subscribe((event) => {
            events.push(event.type);
        });

        const Parent = defineComponent({
            setup() {
                const context = FormContext.provideNew();

                context.isDirty = true;

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
            'updated',
        ]);

        wrapper.unmount();

        expect(events).toEqual([
            'allocated',
            'provided',
            'created',
            'updated',
            'disposed',
        ]);

        expect(plugin.getInstances()).toHaveLength(0);
    });

    it('disposes all registered instances', () => {
        const cleanup = vi.fn();

        const FormContext = defineContext<FormContext>({
            name: 'Form',

            factory: (lifecycle) => {
                lifecycle.onDispose(cleanup);

                return {
                    fields: new Map(),
                    isDirty: false,
                    isValid: true,
                    validate: async () => true,
                };
            },
        });

        const plugin = createContextPlugin();

        const Parent = defineComponent({
            setup() {
                FormContext.provideNew();

                return () => null;
            },
        });

        mount(Parent, {
            global: {
                plugins: [plugin],
            },
        });

        expect(plugin.getInstances()).toHaveLength(1);

        plugin.disposeAll();

        expect(cleanup).toHaveBeenCalledOnce();
        expect(plugin.getInstances()).toHaveLength(0);
    });
});
