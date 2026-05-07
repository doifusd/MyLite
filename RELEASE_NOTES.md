# MyLite v1.3.18

## macOS Installation Note

If you see "MyLite is damaged and can't be opened" on macOS:

1. Open **Terminal**.
2. Run: `sudo xattr -rd com.apple.quarantine /Applications/MyLite.app`
3. Enter your password when prompted.

---

## What's New in v1.3.18

### 🚀 New Features
- **Connection Reordering**: You can now drag and drop database connections in the sidebar to custom sort them within their groups.

### 🐛 Bug Fixes
- **SSH Private Key Authentication**: Fixed an issue where the SSH private key input was read-only and prevented manual entry.
- **File Dialog Compatibility**: Resolved an issue where the file picker dialog for SSH keys would not open due to Tauri v2 migration.

---

## Previous Highlights (v1.3.x)

- Parameterized Queries with safe parameter injection and auto-escaping
- SQL Snippets with 6 built-in templates for common operations
- EXPLAIN Analysis to view query execution plans
- Dracula Theme with custom dark/light modes for Monaco Editor
- Advanced Sorting with multi-column support and visual indicators
- Column Filtering with case-insensitive substring matching
- Visual Table Designer with drag-to-reorder and type configuration
- SQL Preview for real-time CREATE TABLE statement generation
- Multi-Format Export supporting CSV, Excel, and SQL INSERT formats
- Schema browser with table structure inspection

See [README.md](README.md) for installation and detailed documentation.
