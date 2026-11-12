import {
    CONTEXT_NODE_PREFIX,
    PROPERTY_NODE_SEPARATOR,
} from '../constants';
import type { InspectorNode } from '../types';
import type { RegisteredContext } from 'vue-scoped-context';

export function contextNodeId(context: RegisteredContext): string {
    return `${CONTEXT_NODE_PREFIX}${context.id}`;
}

export function propertyNodeId(
    context: RegisteredContext,
    property: string,
): string {
    return `${contextNodeId(context)}${PROPERTY_NODE_SEPARATOR}${encodeURIComponent(property)}`;
}

export function findInspectorNode(
    contexts: RegisteredContext[],
    nodeId: string,
): InspectorNode | undefined {
    const [contextIdPart, propertyPart] = nodeId.split(PROPERTY_NODE_SEPARATOR);
    const contextId = Number(contextIdPart?.slice(CONTEXT_NODE_PREFIX.length));
    const context = contexts.find((entry) => entry.id === contextId);

    if (!context) {
        return undefined;
    }

    if (propertyPart === undefined) {
        return {
            kind: 'context',
            context,
        };
    }

    return {
        kind: 'property',
        context,
        property: decodeURIComponent(propertyPart),
    };
}
