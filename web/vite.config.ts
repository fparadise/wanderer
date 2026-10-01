import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import openapiPlugin from 'sveltekit-openapi-generator';
import { defineConfig } from 'vitest/config';
import { openapiOptions } from './openapi.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

export default defineConfig({
	plugins: [enhancedImages(), openapiPlugin(openapiOptions(packageJson.version)), tailwindcss(), sveltekit()],
	resolve: {
		alias: {
			stream: path.resolve(__dirname, 'src/lib/util/empty_stream.ts')
		}
	},
	test: { include: ['src/**/*.{test,spec}.{js,ts}'] },
	ssr: { noExternal: ['three'] },
	...(process.env.WANDERER_ENV == "dev" ? {
		server: {
			// https: {
			// 	key: fs.readFileSync('.svelte-kit/key.pem'),
			// 	cert: fs.readFileSync('.svelte-kit/cert.pem')
			// },
			// host: true, // true
			// port: 443 // 443
		}
	} : {})
});
