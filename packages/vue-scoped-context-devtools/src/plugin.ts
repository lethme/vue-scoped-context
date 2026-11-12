import { setupDevtoolsPlugin } from '@vue/devtools-api';
import type { App } from 'vue';
import {
    createContextPlugin,
    createContextLogger,
    type ContextPlugin,
    type RegisteredContext,
} from 'vue-scoped-context';

import { INSPECTOR_ID, PROPERTIES_SECTION } from './constants';
import { editProperty } from './helpers/edit-property';
import { createHighlightProvider } from './helpers/highlight-provider';
import { findInspectorNode } from './helpers/node-id';
import { toInspectorTreeNode } from './helpers/tree';
import { describeValue } from './helpers/value';

const logger = createContextLogger('vue-scoped-context-devtools');

function getProperties(context: RegisteredContext) {
    const instance = context.instance as Record<string, unknown>;

    return Object.entries(instance).map(([key, value]) => {
        const description = describeValue(value);

        return {
            key,
            value: description.value,
            editable: description.editable,
            objectType: description.objectType,
        };
    });
}

function editContextProperty(
    context: RegisteredContext,
    property: string,
    path: string[],
    edit: {
        value?: unknown;
        newKey?: string | null;
        remove?: boolean;
    },
): void {
    editProperty(
        context.instance,
        property,
        path,
        {
            ...edit,
            newKey: edit.newKey ?? undefined,
        },
    );
}

/**
 * Creates one Vue plugin that installs the context registry and adds a
 * "Scoped Contexts" inspector to Vue Devtools.
 */
export function createContextDevtoolsPlugin(): ContextPlugin {
    const contextPlugin = createContextPlugin();

    return {
        install(app: App) {
            app.use(contextPlugin);
            logger.info('Plugin initialized; waiting for Vue Devtools.');

            const highlightProvider = createHighlightProvider();

            setupDevtoolsPlugin(
                {
                    id: 'vue-scoped-context-devtools',
                    label: 'Scoped Contexts',
                    logo: '/logo.png',
                    packageName: 'vue-scoped-context-devtools',
                    app,
                    enableEarlyProxy: true,
                },
                (api) => {
                    logger.info('Scoped Contexts inspector registered.');

                    api.addInspector({
                        id: INSPECTOR_ID,
                        label: 'Scoped Contexts',
                        icon: 'account_tree',
                        treeFilterPlaceholder: 'Search contexts…',
                        noSelectionText: 'Select a context or property to inspect it.',
                        nodeActions: [
                            {
                                icon: 'lightbulb',
                                tooltip: 'Highlight provider component',
                                action: async (nodeId) => {
                                    const node = findInspectorNode(
                                        contextPlugin.getInstances(),
                                        nodeId,
                                    );

                                    if (node) {
                                        await highlightProvider(
                                            api,
                                            app,
                                            node.context,
                                        );
                                    }
                                },
                            },
                        ],
                    });

                    api.on.getInspectorTree((payload) => {
                        if (payload.inspectorId !== INSPECTOR_ID) {
                            return;
                        }

                        payload.rootNodes = contextPlugin
                            .getInstances()
                            .filter((context) => context.name
                                .toLowerCase()
                                .includes(payload.filter.toLowerCase()))
                            .map(toInspectorTreeNode);
                    });

                    api.on.getInspectorState((payload) => {
                        if (payload.inspectorId !== INSPECTOR_ID) {
                            return;
                        }

                        const node = findInspectorNode(
                            contextPlugin.getInstances(),
                            payload.nodeId,
                        );

                        if (!node) {
                            return;
                        }

                        if (node.kind === 'context') {
                            payload.state = {
                                Context: [
                                    {
                                        key: 'Name',
                                        value: node.context.name,
                                    },
                                    {
                                        key: 'Instance ID',
                                        value: node.context.id,
                                    },
                                    {
                                        key: 'Provider',
                                        value: node.context.provider
                                            ? `${node.context.provider.name} (#${node.context.provider.uid})`
                                            : 'None',
                                    },
                                ],
                                [PROPERTIES_SECTION]: getProperties(node.context),
                            };
                            return;
                        }

                        const instance = node.context.instance as Record<string, unknown>;
                        const value = instance[node.property];
                        const description = describeValue(value);

                        payload.state = {
                            Property: [
                                {
                                    key: 'Name',
                                    value: node.property,
                                },
                                {
                                    key: 'Value',
                                    value: description.value,
                                    editable: description.editable,
                                    objectType: description.objectType,
                                },
                                {
                                    key: 'Provider',
                                    value: node.context.provider
                                        ? `${node.context.provider.name} (#${node.context.provider.uid})`
                                        : 'None',
                                },
                            ],
                        };
                    });

                    api.on.editInspectorState((payload) => {
                        if (payload.inspectorId !== INSPECTOR_ID) {
                            return;
                        }

                        const node = findInspectorNode(
                            contextPlugin.getInstances(),
                            payload.nodeId,
                        );

                        if (!node || !payload.path.length) {
                            return;
                        }

                        const property = node.kind === 'property'
                            ? node.property
                            : payload.path[0];

                        const path = node.kind === 'property' && payload.path[0] === 'Value'
                            ? payload.path.slice(1)
                            : node.kind === 'context' && payload.path[0] === property
                                ? payload.path.slice(1)
                                : payload.path;

                        editContextProperty(
                            node.context,
                            property,
                            path,
                            payload.state,
                        );

                        api.sendInspectorTree(INSPECTOR_ID);
                        api.sendInspectorState(INSPECTOR_ID);
                    });

                    const refreshTree = () => {
                        api.sendInspectorTree(INSPECTOR_ID);
                    };

                    const refreshState = () => {
                        api.sendInspectorState(INSPECTOR_ID);
                    };

                    contextPlugin.subscribe((event) => {
                        refreshTree();

                        if (event.type === 'provided' || event.type === 'updated') {
                            refreshState();
                        }
                    });
                },
            );
        },
        subscribe: contextPlugin.subscribe,
        subscribeAllocation: contextPlugin.subscribeAllocation,
        subscribeProvider: contextPlugin.subscribeProvider,
        getInstances: contextPlugin.getInstances,
        disposeAll: contextPlugin.disposeAll,
    };
}
