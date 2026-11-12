import { describe, expect, it, vi } from 'vitest';

import { defineContext } from '../../src';

describe('defineContext factories', () => {
    it('uses the trimmed name or the unnamed fallback', () => {
        const named = defineContext({ name: '  Profile  ', factory: () => ({}) });
        const unnamed = defineContext({ name: '  ', factory: () => ({}) });

        expect(named.name).toBe('Profile');
        expect(unnamed.name).toBe('Unnamed context');
    });

    it('uses a distinct injection identity for definitions with the same name', () => {
        const first = defineContext({ name: 'Shared', factory: () => ({ value: 1 }) });
        const second = defineContext({ name: 'Shared', factory: () => ({ value: 2 }) });

        expect(first.create()).not.toBe(second.create());
    });

    it.each([
        ['null', () => null],
        ['an array', () => []],
        ['a primitive', () => 1],
    ])('rejects %s from the definition factory', (_description, factory) => {
        const Context = defineContext({
            name: 'Invalid',
            factory: factory as () => object,
        });

        expect(() => Context.create()).toThrow('definition factory for "Invalid"');
    });

    it('rejects invalid instance factory results and rolls back registered cleanup', () => {
        const cleanup = vi.fn();

        const Context = defineContext<{ value: number }>({
            name: 'Invalid override',
            factory: () => ({ value: 1 }),
        });

        expect(() => Context.create({
            factory: (_defaults, lifecycle) => {
                lifecycle.onDispose(cleanup);
                return [] as never;
            },
        })).toThrow('instance factory for "Invalid override"');

        expect(cleanup).toHaveBeenCalledOnce();
    });

    it('requires plain objects from factories', () => {
        class CustomContext {
            value = 1;
        }

        const ClassContext = defineContext({
            name: 'Class context',
            factory: () => new CustomContext(),
        });

        expect(() => ClassContext.create()).toThrow(
            'definition factory for "Class context" must return a plain object',
        );

        const NullPrototypeContext = defineContext({
            name: 'Null prototype context',
            factory: () => Object.assign(Object.create(null) as { value: number }, {
                value: 1,
            }),
        });

        expect(NullPrototypeContext.create().value).toBe(1);
    });

    it('passes the defaults and lifecycle to the instance factory and overlays its result', () => {
        const defaults = { value: 2, label: 'default' };

        const Context = defineContext({
            name: 'Overlay',
            factory: () => defaults,
        });

        const seen: unknown[] = [];

        const instance = Context.create({
            factory: (factoryDefaults, lifecycle) => {
                seen.push(factoryDefaults, lifecycle);
                return { value: 3 };
            },
        });

        expect(seen[0]).toBe(defaults);
        expect(seen[1]).toMatchObject({ onDispose: expect.any(Function) });
        expect(instance).toMatchObject({ value: 3, label: 'default' });
        expect(instance).not.toBe(defaults);
    });

    it('rejects disposal of an instance from another definition', () => {
        const first = defineContext({ name: 'First', factory: () => ({}) });
        const second = defineContext({ name: 'Second', factory: () => ({}) });

        expect(() => first.dispose(second.create())).toThrow('does not belong to "First"');
    });
});
