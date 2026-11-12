import type { App, ComponentInternalInstance } from 'vue';
import type { RegisteredContext } from 'vue-scoped-context';

interface ComponentHighlightApi {
    getComponentInstances(app: App): Promise<Array<ComponentInternalInstance>>;
    highlightElement(instance: unknown): Promise<unknown>;
    unhighlightElement(): Promise<unknown>;
}

export function createHighlightProvider() {
    let highlightTimeoutId: NodeJS.Timeout | null = null;
    let highlightedUID: number | null = null;

    function cleanup() {
        highlightTimeoutId = null;
        highlightedUID = null;
    }

    async function highlightProvider(
        api: ComponentHighlightApi,
        app: App,
        context: RegisteredContext,
    ): Promise<void> {
        const providerUID = context.provider?.uid;

        if (providerUID === undefined) {
            return;
        }

        if (providerUID === highlightedUID) {
            await api.unhighlightElement();

            if (highlightTimeoutId !== null) {
                clearTimeout(highlightTimeoutId);
            }

            cleanup();

            return;
        }

        const components = await api.getComponentInstances(app);

        const provider = components.find(
            (component) => Number(component.uid) === providerUID,
        );

        if (provider) {
            await api.highlightElement(provider);

            highlightedUID = provider.uid;

            if (highlightTimeoutId !== null) {
                clearTimeout(highlightTimeoutId);
            }

            highlightTimeoutId = setTimeout(async () => {
                await api.unhighlightElement();

                cleanup();
            }, 2000);
        }
    }

    return highlightProvider;
}
