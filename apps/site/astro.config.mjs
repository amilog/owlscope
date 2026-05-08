import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://owlscope.dev',
  integrations: [
    starlight({
      title: 'OwlScope',
      description: 'Mobile debug & monitoring tool for React Native and Flutter',
      logo: {
        src: './public/owlscope-logo-animated.svg',
        replacesTitle: false,
      },
      favicon: '/owlscope-favicon.svg',
      social: {
        github: 'https://github.com/YOUR_USERNAME/owlscope',
        twitter: 'https://twitter.com/owlscope',
        discord: 'https://discord.gg/owlscope',
      },
      customCss: [
        './src/styles/globals.css',
        './src/styles/owlscope-theme.css',
      ],
      sidebar: [
        {
          label: 'Get Started',
          items: [
            { label: 'Introduction', link: '/getting-started/' },
            { label: 'Installation', link: '/getting-started/installation/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'React Native', link: '/guides/react-native/' },
            { label: 'Flutter', link: '/guides/flutter/' },
          ],
        },
        {
          label: 'Resources',
          items: [
            { label: 'FAQ', link: '/faq/' },
            { label: 'Download', link: '/download', attrs: { target: '_self' } },
            { label: 'Blog', link: '/blog', attrs: { target: '_self' } },
          ],
        },
      ],
      components: {
        Header: './src/components/overrides/Header.astro',
      },
      lastUpdated: true,
      pagination: true,
      head: [
        {
          tag: 'meta',
          attrs: {
            property: 'og:image',
            content: 'https://owlscope.dev/og-image.svg',
          },
        },
        {
          tag: 'meta',
          attrs: {
            name: 'twitter:card',
            content: 'summary_large_image',
          },
        },
        {
          // Apply stored or default-dark theme before first paint to prevent
          // a flash of light mode.
          tag: 'script',
          attrs: { 'is:inline': true },
          content: `
            (function () {
              const stored = localStorage.getItem('starlight-theme');
              document.documentElement.dataset.theme = stored || 'dark';
            })();
          `,
        },
      ],
    }),
    tailwind({ applyBaseStyles: false }),
    react(),
  ],
});
