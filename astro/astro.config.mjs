import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// SSR completo: o Astro serve o site, o painel, o portal, a administração
// e toda a API (substitui o backend Express).
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

export default defineConfig({
  output: 'server',
  adapter: isVercel ? vercel() : node({ mode: 'standalone' }),
  server: { port: Number(process.env.PORT) || 3000, host: true },
});
