import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// 自定义插件：处理 Tauri API 在开发模式下的导入
const tauriApiPlugin = {
  name: 'tauri-api-plugin',
  apply: 'serve', // 仅在开发模式应用
  resolveId(id) {
    // 将 Tauri API 的动态导入标记为外部
    if (id.startsWith('@tauri-apps/api/')) {
      return { id, external: true };
    }
    return null;
  },
};

export default defineConfig({
  plugins: [tauriApiPlugin, react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: false,
    middlewareMode: false,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 1420,
    },
  },
  ssr: {
    external: ['@tauri-apps/api/dialog', '@tauri-apps/api/core'],
  },
  build: {
    outDir: "dist",
    sourcemap: false, // 禁用生产 sourcemap 节省内存
    minify: "terser",
    reportCompressedSize: false,
    rollupOptions: {
      external: [
        '@tauri-apps/api/dialog',
        '@tauri-apps/api/core',
        'monaco-editor',  // 从 CDN 加载，不打包
      ],
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-context-menu'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    // 禁用 CSS 代码分割以减少 HTTP 请求
    cssCodeSplit: false,
  },
  // 优化依赖预构建
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['monaco-editor', '@tauri-apps/api'],
    esbuildOptions: {
      target: 'es2020',
    },
  },
  define: {
    // 禁用 Monaco 的 worker（在 Tauri 中可能导致白屏）
    'process.env.MONACO_EDITOR_WORKER_PATH': '"/"',
  },
});
