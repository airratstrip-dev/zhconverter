// vite.config.ts
import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
    build: {
        outDir: path.join(__dirname, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.join(__dirname, 'index.html'),
                progress: path.join(__dirname, 'progress.html')
            }
        }
    },
    plugins: [
        electron({
            main: {
                entry: 'src/main/main.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron/main',
                        rollupOptions: {
                            external: ['cheerio', 'yaml']
                        }
                    }
                }
            },
            preload: {
                input: 'src/preload/index.ts',
                vite: {
                    build: {
                        outDir: 'dist-electron/preload'
                    }
                }
            },
            renderer: process.env.NODE_ENV === 'test' ? undefined : {}
        })
    ]
});