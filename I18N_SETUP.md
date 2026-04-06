# Internationalization (i18n) Guide

## Overview

MyLite now supports multiple languages using **i18next** and **react-i18next**. The application includes built-in support for:

- **English** (en)
- **Simplified Chinese** (zh)

## Adding New Languages

### 1. Create a Translation File

Add a new JSON file in `src/i18n/locales/`:

```bash
src/i18n/locales/
├── en.json
├── zh.json
└── es.json  # Example: Spanish
```

Example `src/i18n/locales/es.json`:
```json
{
  "app": {
    "title": "MyLite",
    "description": "Cliente de Base de Datos MySQL"
  },
  "connection": {
    "title": "Conexiones",
    "new": "Nueva Conexión",
    ...
  }
}
```

### 2. Register the Language

Modify `src/i18n/config.ts`:

```typescript
import esTranslations from './locales/es.json';

const resources = {
  en: {
    translation: enTranslations,
  },
  zh: {
    translation: zhTranslations,
  },
  es: {
    translation: esTranslations,  // Add this
  },
};
```

### 3. Update Language List (Optional)

Update `src/components/LanguageToggle.tsx` to add the new language to the dropdown:

```typescript
const languages = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'es', label: 'Español' },  // Add this
];
```

## Using Translations in Components

### Basic Usage

```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('connection.title')}</h1>
      <button>{t('ui.save')}</button>
    </div>
  );
}
```

### Nested Keys

```typescript
// JSON structure
{
  "connection": {
    "dialog": {
      "title": "New Connection"
    }
  }
}

// Usage
<h1>{t('connection.dialog.title')}</h1>
```

### Dynamic Values (Interpolation)

```typescript
// JSON
{
  "messages": {
    "rowCount": "Found {{count}} rows"
  }
}

// Usage
<span>{t('messages.rowCount', { count: 100 })}</span>
// Output: "Found 100 rows"
```

### Pluralization

```typescript
// JSON
{
  "connection": {
    "connections_one": "1 connection",
    "connections_other": "{{count}} connections"
  }
}

// Usage
<span>{t('connection.connections', { count: 5 })}</span>
// Output: "5 connections"
```

## Language Detection

The app automatically:

1. **Checks localStorage** for saved language preference (`appLanguage`)
2. **Detects system language** (if starts with 'zh', uses Chinese; otherwise English)
3. **Falls back to English** if language not available

## Changing Language Programmatically

```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { i18n } = useTranslation();

  const switchToEnglish = () => {
    i18n.changeLanguage('en');
    localStorage.setItem('appLanguage', 'en');
  };

  const switchToChinese = () => {
    i18n.changeLanguage('zh');
    localStorage.setItem('appLanguage', 'zh');
  };

  return (
    <div>
      <button onClick={switchToEnglish}>English</button>
      <button onClick={switchToChinese}>中文</button>
    </div>
  );
}
```

## Translation Structure

The translation files are organized by feature/domain:

```
{
  "app": { ... },         # Application-level
  "menu": { ... },        # Menu items
  "connection": { ... },  # Connection management
  "database": { ... },    # Database operations
  "table": { ... },       # Table operations
  "query": { ... },       # Query editor
  "ui": { ... },          # Common UI elements
  "messages": { ... },    # Toast messages, alerts
  "shortcuts": { ... }    # Keyboard shortcuts
}
```

## Best Practices

### 1. **Keep translations organized**
- Group related translations under logical keys
- Use consistent naming conventions

### 2. **Use meaningful keys**
```typescript
// Good
t('connection.testConnection')  // ✓

// Bad
t('btn1')  // ✗
```

### 3. **Avoid hardcoded strings**
```typescript
// Bad
<h1>Connections</h1>

// Good
<h1>{t('connection.title')}</h1>
```

### 4. **Use appropriate namespaces**
```typescript
// If using multiple namespaces
const { t: tCommon } = useTranslation('common');
const { t: tErrors } = useTranslation('errors');
```

### 5. **Test all languages**
- Always test UI with different language strings
- Consider text length changes (German is verbose, Chinese is compact)

## Common Issues

### Issue: Translation not updating
**Solution**: Make sure you're calling `i18n.changeLanguage()` or the component is using the translation properly.

### Issue: Missing translations
**Solution**: Check that all keys exist in all language files. Use i18next-scanner to find missing keys.

### Issue: Special characters not displaying
**Solution**: Ensure JSON files are saved as UTF-8 with BOM removed.

## File Structure

```
src/
├── i18n/
│   ├── config.ts              # i18n configuration
│   └── locales/
│       ├── en.json            # English translations
│       └── zh.json            # Chinese translations
├── components/
│   ├── LanguageToggle.tsx      # Language switcher UI
│   └── ...
├── App.tsx                     # Uses translations
└── main.tsx                    # Imports i18n config
```

## Resources

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Guide](https://react.i18next.com/)
- [i18next Browser Language Detection](https://github.com/i18next/i18next-browser-languageDetector)
