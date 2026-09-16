import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      'react-native': fileURLToPath(
        new URL('./tests/react-native.tsx', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    server: { deps: { inline: ['lucide-react-native'] } },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
