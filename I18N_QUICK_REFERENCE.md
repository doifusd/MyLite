# i18n Quick Reference

## Quick Start

### Add translation to any React component:

```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <h1>{t('connection.title')}</h1>
  );
}
```

## Common Translation Keys by Feature

### Connections
```typescript
t('connection.title')           // Connections / 连接
t('connection.new')             // New Connection / 新建连接
t('connection.edit')            // Edit Connection / 编辑连接
t('connection.delete')          // Delete Connection / 删除连接
t('connection.testConnection')  // Test Connection / 测试连接
t('connection.testPassed')      // Test Passed / 测试通过
t('connection.testFailed')      // Test Failed / 测试失败
```

### Common UI Elements
```typescript
t('ui.add')                     // Add / 添加
t('ui.edit')                    // Edit / 编辑
t('ui.delete')                  // Delete / 删除
t('ui.save')                    // Save / 保存
t('ui.cancel')                  // Cancel / 取消
t('ui.search')                  // Search / 搜索
t('ui.loading')                 // Loading... / 加载中...
```

### Messages (Toasts/Alerts)
```typescript
t('messages.connectionSuccess')  // Connected successfully / 连接成功
t('messages.connectionFailed')   // Connection failed / 连接失败
t('messages.querySuccess')       // Query executed successfully / 查询执行成功
t('messages.saved')              // Saved successfully / 保存成功
t('messages.deleted')            // Deleted successfully / 删除成功
```

### Database Operations
```typescript
t('database.title')             // Database / 数据库
t('database.tables')            // Tables / 表
t('database.newTable')          // New Table / 新建表
t('database.export')            // Export / 导出
t('database.import')            // Import / 导入
```

### Query Editor
```typescript
t('query.title')                // Query / 查询
t('query.newQuery')             // New Query / 新建查询
t('query.execute')              // Execute / 执行
t('query.results')              // Results / 结果
t('query.history')              // History / 历史记录
```

## Language Switching

### Current Language
```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { i18n } = useTranslation();
  
  console.log(i18n.language); // 'en' or 'zh'
}
```

### Change Language
```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { i18n } = useTranslation();
  
  const switchLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('appLanguage', lang);
  };
  
  return (
    <>
      <button onClick={() => switchLanguage('en')}>English</button>
      <button onClick={() => switchLanguage('zh')}>中文</button>
    </>
  );
}
```

## Use the Custom Hook

For convenience, use the custom hooks in `src/hooks/useTranslation.ts`:

```typescript
import { useLanguage, useChangeLanguage } from '@/hooks/useTranslation';

export function MyComponent() {
  const currentLang = useLanguage();  // Returns current language code
  const changeLanguage = useChangeLanguage();
  
  return (
    <>
      <p>Current: {currentLang}</p>
      <button onClick={() => changeLanguage('en')}>English</button>
      <button onClick={() => changeLanguage('zh')}>中文</button>
    </>
  );
}
```

## Adding New Translations

### 1. Add to translation files

**src/i18n/locales/en.json:**
```json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is my feature"
  }
}
```

**src/i18n/locales/zh.json:**
```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "这是我的功能"
  }
}
```

### 2. Use in component

```typescript
import { useTranslation } from 'react-i18next';

export function MyFeature() {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1>{t('myFeature.title')}</h1>
      <p>{t('myFeature.description')}</p>
    </div>
  );
}
```

## Dynamic Values

### Interpolation

```typescript
// Translation file
{
  "message": "Hello {{name}}"
}

// Usage
<p>{t('message', { name: 'John' })}</p>
// Output: "Hello John"
```

### Pluralization

```typescript
// Translation file
{
  "items_one": "You have {{count}} item",
  "items_other": "You have {{count}} items"
}

// Usage
<p>{t('items', { count: 5 })}</p>
// Output: "You have 5 items"

<p>{t('items', { count: 1 })}</p>
// Output: "You have 1 item"
```

## Language Persistence

The selected language is remembered in localStorage under the key `appLanguage`.

### Clear Saved Language

```typescript
localStorage.removeItem('appLanguage');
// App will detect system language on next load
```

## Current Language Support

| Language | Code | Status |
|----------|------|--------|
| English | `en` | ✅ Complete |
| Chinese (Simplified) | `zh` | ✅ Complete |

## Adding New Languages

See `I18N_SETUP.md` for detailed instructions on adding new languages.

## Translation Coverage

Key areas translated:
- ✅ App title and descriptions
- ✅ Menu items
- ✅ Connection management
- ✅ Database operations
- ✅ Table management
- ✅ Query editor
- ✅ UI buttons and labels
- ✅ Message notifications
- ✅ Keyboard shortcuts

## File Locations

- **Config**: `src/i18n/config.ts`
- **English**: `src/i18n/locales/en.json`
- **Chinese**: `src/i18n/locales/zh.json`
- **UI Component**: `src/components/LanguageToggle.tsx`
- **Custom Hooks**: `src/hooks/useTranslation.ts`
- **Documentation**: `I18N_SETUP.md`
