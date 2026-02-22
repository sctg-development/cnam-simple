import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { githubPagesSpa } from "@sctg/vite-plugin-github-pages-spa";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { visualizer } from 'rollup-plugin-visualizer';

import _package from "./package.json" with { type: "json" };

/**
 * Package.json type definition for React project
 *
 * Provides TypeScript typing for package.json structure with
 * common fields used in React applications
 */
export type PackageJson = {
  name: string;
  private: boolean;
  version: string;
  type: string;
  scripts: {
    "dev:env": string;
    "build:env": string;
    lint: string;
    "preview:env": string;
    [key: string]: string;
  };
  dependencies: {
    react: string;
    "react-dom": string;
    "react-router-dom": string;
    [key: string]: string;
  };
  devDependencies: {
    typescript: string;
    eslint: string;
    vite: string;
    [key: string]: string;
  };
};

const packageJson: PackageJson = _package;

/**
 * Extract dependencies with a specific vendor prefix
 *
 * @param packageJson - The package.json object
 * @param vendorPrefix - Vendor namespace prefix (e.g. "@heroui")
 * @returns Array of dependency names matching the vendor prefix
 *
 * Used for chunk optimization in the build configuration
 */
export function extractPerVendorDependencies(
  packageJson: PackageJson,
  vendorPrefix: string | string[],
): string[] {
  const dependencies = Object.keys(packageJson.dependencies || {});

  return dependencies.filter((dependency) =>
    Array.isArray(vendorPrefix)
      ? vendorPrefix.some(prefix => dependency.startsWith(`${prefix}`))
      : dependency.startsWith(`${vendorPrefix}`),
  );
}

/**
 * Vite configuration
 * @see https://vitejs.dev/config/
 */
function mdAsString(): import("vite").Plugin {
  return {
    name: "vite:md-as-string",
    enforce: "pre",
    transform(src, id) {
      const cleanId = id.split("?")[0].split("#")[0];
      if (!cleanId.endsWith(".md")) return null;
      return `export default ${JSON.stringify(src)};`;
    },
  };
}

export default defineConfig({
  define: {
    "import.meta.env.CLOUDFLARE_BACKEND": JSON.stringify(process.env.CLOUDFLARE_BACKEND),
  },
  plugins: [nodePolyfills(), mdAsString(), react(), tsconfigPaths(), tailwindcss(), githubPagesSpa(), visualizer({
    filename: 'dist/bundle-stats.html',
    open: true,           // ouvre automatiquement dans le navigateur
    gzipSize: true,       // montre tailles gzip
  }), {
    name: 'omit-fonts-sourcemap',
    generateBundle(options, bundle) {
      // look for the chunk whose logical name is "fonts" and remove its
      // accompanying sourcemap.  this keeps working even if you change
      // chunkFileNames to a pattern that doesn't include the word "fonts".
      for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
        if (
          chunkOrAsset.type === 'chunk' &&
          chunkOrAsset.name === 'fonts'
        ) {
          const mapName = fileName + '.map';
          if (bundle[mapName]) delete bundle[mapName];
        }
      }
    },
  },],
  build: {
    // Enable source maps for better debugging experience
    // This should be disabled in production for better performance and security
    sourcemap: true,

    // Inline assets smaller than 1KB
    // This is for demonstration purposes only
    // and should be adjusted based on the project requirements
    assetsInlineLimit: 1024,
    rollupOptions: {
      output: {
        // Customizing the output file names
        assetFileNames: `assets/${packageJson.name}-[name]-[hash][extname]`,
        entryFileNames: `js/${packageJson.name}-[hash].js`,
        chunkFileNames: `js/${packageJson.name}-[hash].js`,

        /**
         * Manual chunk configuration for better code splitting
         *
         * Groups all @heroui dependencies into a single chunk
         * to optimize loading performance and avoid oversized chunks
         */
        // manualChunks is a function so we can handle both vendor bundles and
        // a special chunk for the huge fonts file. Rollup will invoke this for
        // every module id that it encounters during the build.
        manualChunks(id) {
          // put `fonts.ts` in its own chunk so it doesn't blow up the main bundle
          if (id.includes('/src/printpdf/fonts.ts') || id.endsWith('printpdf/fonts.ts')) {
            return 'fonts';
          }

          // existing vendor-based splitting, re‑using helper to keep config DRY
          if (id.includes('node_modules')) {
            const deps = Object.entries({
              axios: extractPerVendorDependencies(packageJson, "axios"),
              heroui: extractPerVendorDependencies(packageJson, ["@heroui", "tailwindcss", "tailwind-variants"]),
              markedMermaid: extractPerVendorDependencies(packageJson, "@maddyguthridge"),
              marked: extractPerVendorDependencies(packageJson, ["marked", "highlight.js"]),
              html: extractPerVendorDependencies(packageJson, ["html", "dompurify"]),
              react: extractPerVendorDependencies(packageJson, ["react", "@react-aria", "react-dom", "react-router-dom", "react-i18next", "i18next"]),
              framerMotion: extractPerVendorDependencies(packageJson, "framer-motion"),
            });

            for (const [name, list] of deps) {
              if (list.some(dep => id.includes(`/node_modules/${dep}/`))) {
                return name;
              }
            }
          }
        },
      },
    },
  },
});
