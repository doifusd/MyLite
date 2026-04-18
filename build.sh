#!/bin/bash

# MyLite 多平台构建脚本
# Builds for macOS (M1/M2 and Intel), Linux, and Windows

set -e

echo "🚀 开始编译 MyLite 产品版本..."

# 清理之前的构建
echo "清理旧的构建文件..."
rm -rf src-tauri/target/release
rm -rf dist

# 前端构建
echo "编译前端..."
npm run build

# 检查系统和构建相应版本
UNAME_S=$(uname -s)
UNAME_M=$(uname -m)

if [ "$UNAME_S" = "Darwin" ]; then
    echo "🍎 检测到 macOS 系统 ($UNAME_M)"
    
    # 编译 macOS DMG (对应当前架构)
    echo "编译 macOS DMG (当前架构: $UNAME_M)..."
    npm run tauri:build
    
    # 检查是否是 Apple Silicon，如果是则也编译 Intel 版本
    if [ "$UNAME_M" = "arm64" ]; then
        echo "检测到 Apple Silicon (M1/M2/M3)，也编译 Intel 版本..."
        cargo install cargo-lipo
        npm run tauri:build -- --target x86_64-apple-darwin 2>/dev/null || echo "⚠️  Intel 版本编译失败，可能需要在 Intel Mac 上编译"
    fi
    
elif [ "$UNAME_S" = "Linux" ]; then
    echo "🐧 检测到 Linux 系统"
    
    # 编译 Linux deb + AppImage
    echo "编译 Linux 版本..."
    npm run tauri:build
    
elif [ "$UNAME_S" = "MINGW64_NT" ] || [ "$UNAME_S" = "MINGW32_NT" ]; then
    echo "🪟 检测到 Windows 系统"
    
    echo "编译 Windows 版本..."
    npm run tauri:build
fi

echo ""
echo "✅ 编译完成！"
echo ""
echo "📦 产品文件位置："
find src-tauri/target/release -type f \( -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.exe" -o -name "*.msi" -o -name "*.app" \) 2>/dev/null | while read file; do
    echo "  - $file"
done

echo ""
echo "📋 详细信息："
echo "  版本: 1.0.0"
echo "  产品名称: MyLite"
echo "  标识符: com.mylite.app"
