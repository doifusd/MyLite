# MyLite v1.3.7 Release Notes

**Release Date:** May 1, 2026

## ✨ What's New

### SQL Editor Enhancements
- **Parameterized Queries** - Safe parameter injection with auto-escaping
- **SQL Snippets** - 6 built-in templates (SELECT, INSERT, UPDATE, DELETE, COUNT, JOIN)
- **EXPLAIN Analysis** - View query execution plans for optimization
- **Dracula Theme** - Custom dark/light themes for Monaco Editor with optimized syntax highlighting

### Data Grid Features
- **Advanced Sorting** - Multi-column sorting with visual indicators (⬆️ ⬇️ ↕️)
- **Column Filtering** - Case-insensitive substring filtering on any column

### Table Design Tools
- **Visual Table Designer** - Drag-to-reorder columns, configure types and constraints
- **SQL Preview** - Real-time CREATE TABLE statement generation
- **Multi-Format Export** - CSV, Excel, and SQL INSERT statement exports

## 🐛 Bug Fixes
- Fixed Monaco Editor syntax highlighting in production builds
- Corrected TypeScript type definitions for query results
- Fixed parameter replacement logic for edge cases
- Resolved bracket matching validation issues

## 📈 Improvements
- Optimized data grid rendering for large result sets
- Improved initial load time with lazy-loaded Monaco modules
- Full TypeScript type safety throughout
- Better error handling and resource cleanup

## 📦 Installation

```bash
# Clone and setup
git clone https://github.com/doifusd/MyLite.git
cd MyLite

# Install and run
npm install
npm run tauri build

# Or start development
npm run dev
```

## 🛠️ Technical Stack
- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS + Monaco Editor
- **Backend:** Tauri 2.0 (Rust) + SQLx + MySQL
- **Build:** Cross-platform (macOS, Linux, Windows)

## 📝 Breaking Changes
None. This is a fully backward-compatible release.

## 🚀 Known Limitations
- EXPLAIN plan displays first 5 rows for readability
- Filter matching is substring-based (not regex)
- Maximum visible grid rows limited for performance

## 📄 License
MIT License - See LICENSE for details

---
For detailed documentation, see [README.md](README.md)
