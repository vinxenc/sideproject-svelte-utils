import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

const background = { resizeOptions: { background: '#171717' } };

export default defineConfig({
	preset: {
		...preset,
		maskable: { ...preset.maskable, ...background },
		apple: { ...preset.apple, ...background }
	},
	images: ['static/icon.svg']
});
