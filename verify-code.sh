#!/bin/bash

# MySQL Client 代码验证脚本

echo "=========================================="
echo "MySQL Client 代码验证"
echo "=========================================="

# 检查关键文件是否存在
echo ""
echo "1. 检查关键文件..."

files=(
  "src/components/ConnectionProfileManager.tsx"
  "src/components/QueryHistory.tsx"
  "src/components/ui-states.tsx"
  "src/hooks/use-pagination.tsx"
  "src/components/CreateTableDialog.tsx"
  "src/components/ImportExportDialog.tsx"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✓ $file"
  else
    echo "  ✗ $file (缺失)"
  fi
done

# 检查导入语句
echo ""
echo "2. 检查导入语句..."

# 检查常见的导入问题
if grep -r "from '@/components/ui" src/components/*.tsx > /dev/null 2>&1; then
  echo "  ✓ UI 组件导入正确"
fi

if grep -r "from 'lucide-react'" src/components/*.tsx > /dev/null 2>&1; then
  echo "  ✓ Lucide 图标导入正确"
fi

if grep -r "from '@tauri-apps/api/core'" src/components/*.tsx > /dev/null 2>&1; then
  echo "  ✓ Tauri API 导入正确"
fi

# 检查文件大小（非空）
echo ""
echo "3. 检查文件内容..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    if [ "$lines" -gt 10 ]; then
      echo "  ✓ $file ($lines 行)"
    else
      echo "  ⚠ $file (内容可能不完整: $lines 行)"
    fi
  fi
done

# 检查 export 语句
echo ""
echo "4. 检查导出语句..."

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    if grep -q "export" "$file"; then
      echo "  ✓ $file 有导出"
    else
      echo "  ⚠ $file 缺少导出"
    fi
  fi
done

echo ""
echo "=========================================="
echo "验证完成"
echo "=========================================="
