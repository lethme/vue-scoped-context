import {
    isReactive,
    isReadonly,
    isRef,
} from 'vue';

import type { PropertyDescription } from '../types';

function rawValueType(value: unknown): string {
    if (value === null) {
        return 'Null';
    }

    if (Array.isArray(value)) {
        return 'Array';
    }

    if (value instanceof Map) {
        return 'Map';
    }

    if (value instanceof Set) {
        return 'Set';
    }

    if (value instanceof Date) {
        return 'Date';
    }

    if (value instanceof Element) {
        return 'Element';
    }

    if (value instanceof Node) {
        return 'Node';
    }

    if (typeof value === 'object') {
        return 'Object';
    }

    if (typeof value === 'function') {
        return 'Function';
    }

    return typeof value === 'string'
        ? 'String'
        : typeof value === 'number'
            ? 'Number'
            : typeof value === 'boolean'
                ? 'Boolean'
                : typeof value === 'undefined'
                    ? 'Undefined'
                    : typeof value === 'bigint'
                        ? 'BigInt'
                        : typeof value === 'symbol'
                            ? 'Symbol'
                            : 'Unknown';
}

function typeWithReactivity(value: unknown): string {
    const prefix = isReactive(value)
        ? 'Reactive '
        : isReadonly(value)
            ? 'Readonly '
            : '';

    return `${prefix}${rawValueType(value)}`;
}

export function describeValue(value: unknown): PropertyDescription {
    if (isRef(value)) {
        const innerValue = value.value;
        const computed = isReadonly(value) && 'effect' in value;
        const wrapper = computed
            ? 'Computed'
            : isReadonly(value)
                ? 'Readonly Ref'
                : 'Ref';

        const t = typeWithReactivity(innerValue);

        return {
            type: `${wrapper}<${t}>`,
            rawType: t.replace(/^(Reactive |Readonly )/, ''),
            objectType: computed ? 'computed' : 'ref',
            value: innerValue,
            editable: !isReadonly(value),
        };
    }

    const t = typeWithReactivity(value);

    return {
        type: t,
        rawType: t.replace(/^(Reactive |Readonly )/, ''),
        objectType: isReactive(value)
            ? 'reactive'
            : 'other',
        value,
        editable: !isReadonly(value) && typeof value !== 'function',
    };
}
