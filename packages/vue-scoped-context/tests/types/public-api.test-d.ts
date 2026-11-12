import { defineContext } from '../../src';

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends
    (<Value>() => Value extends Right ? 1 : 2)
        ? true
        : false;

type Assert<Value extends true> = Value;

const Counter = defineContext({
    name: 'Counter',
    factory: () => ({
        count: 0,
        increment: () => undefined,
    }),
});

const counter = Counter.create();
counter.count = 1;
counter.increment();

// The context preserves the inferred shape and rejects invalid assignments.
// @ts-expect-error count is a number
counter.count = 'one';

const customized = Counter.create({
    factory: (defaults) => ({
        count: defaults.count + 1,
    }),
});
customized.increment();

// @ts-expect-error override values must match the inferred context shape
Counter.create({ factory: () => ({ count: 'one' }) });

export type TryUseReturnsOptionalContext = Assert<Equal<
    ReturnType<typeof Counter.tryUse>,
    ReturnType<typeof Counter.create> | undefined
>>;

const required = Counter.use();
required.increment();

// @ts-expect-error definitions require a factory
defineContext({ name: 'Missing factory' });

// @ts-expect-error unknown options are rejected
Counter.create({ unexpected: true });
