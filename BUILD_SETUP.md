# Build Setup for Ubuntu 24.04

## WebKitGTK Version Compatibility Issue

### Problem
Ubuntu 24.04 (Noble) provides WebKitGTK 4.1, but older versions of Tauri (v1.5) require WebKitGTK 4.0. This causes link errors during the build:
```
rust-lld: error: unable to find library -lwebkit2gtk-4.0
rust-lld: error: unable to find library -ljavascriptcoregtk-4.0
```

### Solution
We've implemented a library aliasing workaround that creates symbolic links mapping version 4.1 to 4.0:

1. **Create symlink directories and aliases**:
```bash
mkdir -p /tmp/pkg-config /tmp/lib64

# Create pkg-config symlinks
ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/javascriptcoregtk-4.1.pc /tmp/pkg-config/javascriptcoregtk-4.0.pc
ln -sf /usr/lib/x86_64-linux-gnu/pkgconfig/webkit2gtk-4.1.pc /tmp/pkg-config/webkit2gtk-4.0.pc

# Create library symlinks
ln -sf /usr/lib/x86_64-linux-gnu/libwebkit2gtk-4.1.so /tmp/lib64/libwebkit2gtk-4.0.so
ln -sf /usr/lib/x86_64-linux-gnu/libwebkit2gtk-4.1.so.0 /tmp/lib64/libwebkit2gtk-4.0.so.0
ln -sf /usr/lib/x86_64-linux-gnu/libjavascriptcoregtk-4.1.so /tmp/lib64/libjavascriptcoregtk-4.0.so
ln -sf /usr/lib/x86_64-linux-gnu/libjavascriptcoregtk-4.1.so.0 /tmp/lib64/libjavascriptcoregtk-4.0.so.0
```

2. **Run with environment variables**:
```bash
export PKG_CONFIG_PATH=/tmp/pkg-config
export LIBRARY_PATH=/tmp/lib64:/usr/lib/x86_64-linux-gnu
export LD_LIBRARY_PATH=/tmp/lib64:/usr/lib/x86_64-linux-gnu
npm run tauri:dev
```

### Automated Setup
The npm scripts in `package.json` have been updated to include these environment variables automatically:
- `npm run tauri:dev` - starts the development server
- `npm run tauri:build` - builds the production app

No manual environment variable setup is needed when using these npm scripts.

### Note for First-Time Setup
If this is your first build on a new system, you may need to re-run the symlink creation commands above to ensure the `/tmp` directory structure is in place.
