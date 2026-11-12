import type { RegisteredContext } from 'vue-scoped-context';

export interface PropertyDescription {
    type: string;
    rawType: string;
    objectType: 'ref' | 'computed' | 'reactive' | 'other';
    value: unknown;
    editable: boolean;
}

export type InspectorNode =
    | {
        kind: 'context';
        context: RegisteredContext;
    }
    | {
        kind: 'property';
        context: RegisteredContext;
        property: string;
    };

export interface EditableValue {
    value?: unknown;
    newKey?: string;
    remove?: boolean;
}
