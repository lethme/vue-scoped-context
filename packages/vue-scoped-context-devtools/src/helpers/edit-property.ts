import { isRef } from 'vue';

import type { EditableValue } from '../types';

function assignAtPath(
    parent: Record<string, unknown> | unknown[] | Map<unknown, unknown> | Set<unknown>,
    key: string,
    edit: EditableValue,
): void {
    if (parent instanceof Map) {
        if (edit.remove) {
            parent.delete(key);
        } else if (edit.newKey !== undefined) {
            if (!parent.has(key)) {
                parent.set(edit.newKey, edit.value);
                return;
            }

            const value = parent.get(key);
            parent.delete(key);
            parent.set(edit.newKey, value);
        } else {
            parent.set(key, edit.value);
        }

        return;
    }

    if (parent instanceof Set) {
        const values = [...parent];
        const index = Number(key);
        const value = values[index];

        if (value === undefined && !Number.isInteger(index)) {
            return;
        }

        if (value === undefined && index >= values.length) {
            if (!edit.remove) {
                parent.add(edit.value);
            }

            return;
        }

        if (edit.remove) {
            parent.delete(value);
        } else if (edit.newKey !== undefined) {
            parent.delete(value);
            parent.add(edit.value === undefined ? value : edit.value);
        } else {
            parent.delete(value);
            parent.add(edit.value);
        }

        return;
    }

    if (edit.remove) {
        if (Array.isArray(parent)) {
            parent.splice(Number(key), 1);
        } else {
            delete parent[key];
        }

        return;
    }

    if (edit.newKey !== undefined) {
        const value = (parent as Record<string, unknown>)[key];

        if (Array.isArray(parent)) {
            const index = Number(key);

            if (Number.isInteger(index) && index >= 0 && index < parent.length) {
                parent[Number(edit.newKey)] = value;
                parent.splice(index, 1);
            } else {
                parent[Number(edit.newKey)] = edit.value;
            }
        } else if (!(key in parent)) {
            parent[edit.newKey] = edit.value;
        } else {
            delete parent[key];
            parent[edit.newKey] = value;
        }

        return;
    }

    if (Array.isArray(parent)) {
        parent[Number(key)] = edit.value;
    } else {
        (parent as Record<string, unknown>)[key] = edit.value;
    }
}

function getAtPath(parent: unknown, key: string): unknown {
    if (parent instanceof Map) {
        return parent.get(key);
    }

    if (parent instanceof Set) {
        return [...parent][Number(key)];
    }

    return (parent as Record<string, unknown>)[key];
}

export function editProperty(
    instance: object,
    property: string,
    path: string[],
    edit: EditableValue,
): void {
    const context = instance as Record<string, unknown>;
    const currentValue = context[property];

    const value = isRef(currentValue)
        ? currentValue.value
        : currentValue;

    const nestedPath = path[0] === property
        ? path.slice(1)
        : path;

    if (nestedPath.length === 0) {
        if (edit.newKey !== undefined) {
            const nextValue = currentValue;
            delete context[property];
            context[edit.newKey] = nextValue;
        } else if (edit.remove) {
            delete context[property];
        } else if (isRef(currentValue)) {
            currentValue.value = edit.value;
        } else {
            context[property] = edit.value;
        }

        return;
    }

    let parent: unknown = value;

    for (const segment of nestedPath.slice(0, -1)) {
        if (parent === null || typeof parent !== 'object') {
            return;
        }

        parent = getAtPath(parent, segment);
    }

    const leaf = nestedPath[nestedPath.length - 1];

    if (
        !leaf ||
        parent === null ||
        typeof parent !== 'object'
    ) {
        return;
    }

    assignAtPath(
        parent as Record<string, unknown> | unknown[] | Map<unknown, unknown> | Set<unknown>,
        leaf,
        edit,
    );
}
