import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 1420,
    strictPort: false,
    middlewareMode: false,
  },
  build: {
    outDir: "dist",
    sourcemap: false, // 禁用生产 sourcemap 节省内存
    minify: "terser",
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-context-menu'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['clsx', 'tailwind-merge', 'class-variance-authority'],
          // Monaco 单独打包，延迟加载
          'monaco': ['monaco-editor'],
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
    exclude: ['monaco-editor'],
  },
});
