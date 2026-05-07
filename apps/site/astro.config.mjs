import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://owlscope.dev',
  integrations: [
    starlight({
      title: 'OwlScope',
      description: 'Universal debug & monitoring tool for JavaScript and Flutter',
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
            { label: 'Quick Start', link: '/getting-started/quick-start/' },
            { label: 'Configuration', link: '/getting-started/configuration/' },
            { label: 'First Debug Session', link: '/getting-started/first-debug-session/' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'React', link: '/guides/react/' },
            { label: 'React Native', link: '/guides/react-native/' },
            { label: 'Flutter', link: '/guides/flutter/' },
            { label: 'Node.js', link: '/guides/nodejs/' },
            { label: 'Redux', link: '/guides/redux/' },
            { label: 'Zustand', link: '/guides/zustand/' },
            { label: 'Network Debugging', link: '/guides/network-debugging/' },
            { label: 'Error Tracking', link: '/guides/error-tracking/' },
            { label: 'Time-Travel Debug', link: '/guides/time-travel/' },
          ],
        },
        {
          label: 'API Reference',
          autogenerate: { directory: 'api-reference' },
        },
        {
          label: 'Advanced',
          autogenerate: { directory: 'advanced' },
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
