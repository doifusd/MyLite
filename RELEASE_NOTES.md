# MyLite v1.3.14

## macOS Installation Note

If you see "MyLite is damaged and can't be opened" on macOS:

1. Open **Terminal**.
2. Run: `sudo xattr -rd com.apple.quarantine /Applications/MyLite.app`
3. Enter your password when prompted.

---

## Highlights

- Parameterized Queries with safe parameter injection and auto-escaping
- SQL Snippets with 6 built-in templates for common operations
- EXPLAIN Analysis to view query execution plans
- Dracula Theme with custom dark/light modes for Monaco Editor
- Advanced Sorting with multi-column support and visual indicators
- Column Filtering with case-insensitive substring matching

## Changes

- Visual Table Designer with drag-to-reorder and type configuration
- SQL Preview for real-time CREATE TABLE statement generation
- Multi-Format Export supporting CSV, Excel, and SQL INSERT formats
- Database connection profiles with SSH tunnel support
- Schema browser with table structure inspection
- QueryHistory tracking and persistence

## Bug Fixes

- Fixed Monaco Editor syntax highlighting in production builds
- Corrected TypeScript type definitions for query results
- Fixed parameter replacement logic for edge cases
- Resolved bracket matching validation issues

See [README.md](README.md) for installation and detailed documentation.
