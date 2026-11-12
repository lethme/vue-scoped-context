import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/integration/**/*.spec.ts'],
        exclude: ['tests/integration/**/*.ssr.spec.ts'],
        clearMocks: true,
    },
});
