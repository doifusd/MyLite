# MyLite v1.2.0 Release Notes

**Release Date:** May 1, 2026  
**GitHub Release:** [v1.2.0](https://github.com/doifusd/MyLite/releases/tag/v1.2.0)

---

## ✨ What's New

### SQL Editor Enhancements

#### 1. **Parameterized Queries** 🔐
- Support for SQL parameter placeholders using `?` syntax
- Automatic parameter detection and extraction
- Parameter input panel for safe value injection
- Proper escaping for string values (prevents SQL injection)
- Supports both numeric and string parameter types

**Example:**
```sql
SELECT * FROM users WHERE id = ? AND status = ?
-- Parameters detected: param_1, param_2
-- Enter values in the parameter input panel
```

#### 2. **SQL Snippets** 📝
- 6 built-in SQL templates for quick query generation:
  - `SELECT` - Basic SELECT statement
  - `INSERT` - INSERT INTO template
  - `UPDATE` - UPDATE with WHERE clause
  - `DELETE` - DELETE with safety check
  - `COUNT` - COUNT aggregation
  - `JOIN` - INNER JOIN example

- Click snippet to insert at cursor position
- Placeholder text for easy customization

#### 3. **EXPLAIN Execution Plan** 📊
- Click "Explain" button to analyze query performance
- View first 5 rows of execution plan
- Understand query optimization opportunities
- JSON format display for detailed analysis

#### 4. **Dracula Theme Support** 🎨
- Custom Dracula dark theme for Monaco Editor
- Light mode variant (Dracula Light)
- Optimized syntax highlighting for SQL:
  - Keywords: Pink (`#ff79c6`)
  - Strings: Light Yellow (`#f1fa8c`)
  - Numbers: Purple (`#bd93f9`)
  - Types: Cyan (`#8be9fd`)
  - Comments: Blue-Gray (`#6272a4`)

### Data Grid Enhancements

#### 5. **Advanced Sorting** 🔀
- Click column headers to sort (ascending/descending/none)
- Visual indicators on sorted columns:
  - ⬆️ Ascending
  - ⬇️ Descending
  - ↕️ No sort
- Sort cycles through all three states

#### 6. **Column Filtering** 🔍
- Toggle filter panel with "Filter" button
- Case-insensitive substring matching
- Filter multiple columns simultaneously
- "Clear Filters" button to reset
- Filters apply to all export formats

### Table Design Enhancements

#### 7. **Visual Table Designer** 🏗️
Enhanced CreateTableDialog with:

**Column Editor**
- Add/remove columns dynamically
- Configure column properties:
  - Data type (10+ MySQL types)
  - NOT NULL constraint
  - DEFAULT value
  - PRIMARY KEY
  - AUTO INCREMENT
  - UNIQUE constraint
  - INDEX
- Expandable column configuration with chevron toggle
- Drag-to-reorder columns (sort)

**Data Types Supported**
- Numeric: INT, BIGINT, DECIMAL(10,2)
- String: VARCHAR(255), TEXT
- Date/Time: DATETIME, TIMESTAMP
- Other: BOOLEAN, JSON, ENUM

**Table Settings**
- Engine selection: InnoDB, MyISAM, Memory, Archive
- Character Set: utf8mb4, utf8, latin1, ascii
- Collation: 6 common options (utf8mb4_unicode_ci, etc.)

#### 8. **SQL Preview** 📋
- Real-time DDL generation as you configure table
- Dark code block display
- View complete CREATE TABLE statement before creation
- Syntax validation

### Export Enhancements

#### 9. **Multi-Format Export** 💾
- **CSV Format** - Standard comma-separated values
- **Excel Format** - .xlsx with proper formatting
- **SQL Format** - INSERT statements for data migration
- Exports respect applied filters and sort order
- All data included (pagination-aware)

---

## 🐛 Bug Fixes

- Fixed Monaco Editor syntax highlighting in production builds
- Corrected TypeScript type definitions for query result data
- Fixed parameter replacement logic for edge cases
- Resolved bracket matching validation issues

---

## 📈 Improvements

### Performance
- Optimized data grid rendering for large result sets
- Lazy-loaded Monaco Editor modules
- Efficient sorting and filtering algorithms
- Reduced initial load time

### Code Quality
- Full TypeScript type safety
- Immutable state patterns throughout
- Comprehensive error handling
- Proper resource cleanup in React hooks

### User Experience
- Responsive UI with Tailwind CSS
- Consistent design with shadcn/ui components
- Intuitive keyboard navigation
- Clear visual feedback for all actions

---

## 🛠️ Technical Details

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Editor**: Monaco Editor with custom themes
- **UI Components**: shadcn/ui + Tailwind CSS
- **Build Tool**: Vite v5.4.21
- **State Management**: React Hooks + Zustand

### Backend Stack
- **Runtime**: Tauri 2.0
- **Language**: Rust
- **Database Driver**: SQLx with MySQL support
- **Async Runtime**: Tokio

### Build Status
- ✅ Frontend: TypeScript compilation passing
- ✅ Backend: Rust compilation passing
- ✅ Production build: 47.28s
- ✅ All components type-safe

---

## 📦 Installation & Upgrade

### For Existing Users
```bash
# Update to latest version
npm install

# Rebuild Tauri app
npm run tauri build
```

### For New Users
```bash
# Clone repository
git clone https://github.com/doifusd/MyLite.git
cd MyLite

# Install dependencies
npm install

# Start development server
npm run dev

# Or build production app
npm run tauri build
```

---

## 🎯 Feature Comparison with Navicat

| Feature | MyLite | Navicat |
|---------|--------|---------|
| SQL Editing | ✅ | ✅ |
| Syntax Highlighting | ✅ | ✅ |
| Parameterized Queries | ✅ **NEW** | ❌ |
| SQL Snippets | ✅ **NEW** | ❌ |
| EXPLAIN Analysis | ✅ | ✅ |
| Visual Table Designer | ✅ | ✅ |
| Data Export (CSV/Excel/SQL) | ✅ | ✅ |
| Advanced Sorting | ✅ | ✅ |
| Column Filtering | ✅ | ✅ |
| SSH Tunneling | ✅ | ✅ |
| Lightweight | ✅ **TAURI** | ❌ |
| Open Source | ✅ | ❌ |

---

## 📝 Breaking Changes

None. This is a fully backward-compatible release.

---

## 🚀 Known Limitations

- EXPLAIN plan displays first 5 rows (by design for readability)
- Parameter escaping uses MySQL/PDO rules
- Filter matching is substring-based (not regex)
- Maximum visible grid rows limited for performance

---

## 🙏 Contributors

Special thanks to the MyLite development team for making this release possible!

---

## 📞 Support & Feedback

- **Issues**: [GitHub Issues](https://github.com/doifusd/MyLite/issues)
- **Discussions**: [GitHub Discussions](https://github.com/doifusd/MyLite/discussions)
- **Email**: sky@xingyaokechuang.com

---

## 📄 License

MyLite is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

**Enjoy MyLite v1.2.0!** 🎉
