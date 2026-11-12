import type { RegisteredContext } from 'vue-scoped-context';

import { contextNodeId, propertyNodeId } from './node-id';
import { describeValue } from './value';
import type { PropertyDescription } from '../types';

const TYPE_COLORS: Record<string, number> = {
    string: 0x6aab73,       // Soft sage green
    number: 0x6b9ac4,       // Soft sky blue
    boolean: 0xff9a76,      // Soft coral
    array: 0xe47cba,        // Soft pink
    object: 0x9e7bb5,       // Soft lavender
    function: 0x7fb5b5,     // Soft teal
    date: 0x5fbaa7,         // Soft mint
    element: 0xf0a65e,      // Warmer soft orange
    node: 0xc9a48a,         // Muted sand
    set: 0xc08570,          // Soft rose‑brown
    map: 0x8899d4,          // Soft periwinkle
    null: 0x9b8f96,         // Warm mauve-gray
    undefined: 0x8a9299,    // Cool slate-gray
};

const DEFAULT_TYPE_COLOR = 0x5c4b34; // Deep brown

function typeTag(type: PropertyDescription) {
    const color = TYPE_COLORS[type.rawType.toLowerCase()] ?? DEFAULT_TYPE_COLOR;

    return [
        {
            label: type.type,
            textColor: 0xffffff,
            backgroundColor: color,
        },
    ];
}

export function toInspectorTreeNode(context: RegisteredContext) {
    const instance = context.instance as Record<string, unknown>;

    return {
        id: contextNodeId(context),
        label: `${context.name} (#${context.id})`,
        tags: [
            context.provider
                ? {
                    label: context.provider.name,
                    textColor: 0xffffff,
                    backgroundColor: 0x42b883,
                    tooltip: `Provided by component #${context.provider.uid}`,
                }
                : {
                    label: 'unprovided',
                    textColor: 0x333333,
                    backgroundColor: 0xe0e0e0,
                },
        ],
        children: Object.entries(instance).map(([key, value]) => {
            const description = describeValue(value);

            return {
                id: propertyNodeId(context, key),
                label: key,
                tags: typeTag(description),
            };
        }),
    };
}
