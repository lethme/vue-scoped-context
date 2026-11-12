import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: [
            'tests/integration/**/*.ssr.spec.ts',
        ],
        passWithNoTests: true,
    },
});
