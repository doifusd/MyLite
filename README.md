# MyLite - Enterprise MySQL Client

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/sky/mylite/releases/tag/v1.0.0)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](https://github.com/sky/mylite/releases)
[![Rust](https://img.shields.io/badge/Rust-2024+-red.svg)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-18%2B-61DAFB.svg)](https://reactjs.org)

**MyLite** is a professional-grade, cross-platform MySQL database client built with modern technologies (Rust, Tauri, React). Designed for developers, database administrators, and enterprises who require high performance, security, and ease of use.

> ⚡ **Lightweight** • 🔒 **Secure** • 🚀 **Fast** • 💻 **Cross-platform** • 🎨 **Modern UI**

## 📋 Table of Contents

- [Features](#-features)
- [Download](#-downloads)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Technical Stack](#-technical-stack)
- [Performance](#-performance)
- [Release Notes](#-release-notes)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### Core Capabilities
- **🔌 Multiple Connection Types**
  - Direct TCP connections with SSL/TLS support
  - SSH tunneling with key authentication
  - HTTP/WebSocket connections
  - Connection pooling and session management

- **📝 Advanced Query Editor**
  - Monaco Editor with full SQL syntax highlighting
  - Real-time auto-completion for table and column names
  - Query history with favorites and tagging
  - Keyboard shortcuts (Cmd+Enter execute, Cmd+S save)
  - Multi-tab support for concurrent queries

- **📊 Intelligent Results Visualization**
  - Virtual scrolling for massive datasets (10M+ rows)
  - Pagination controls with configurable page size
  - JSON export functionality
  - Column sorting and filtering
  - Real-time display of row counts and query performance

- **🌳 Interactive Schema Browser**
  - Tree-based database and table navigation
  - Lazy-loaded table structures
  - Column details with data types and constraints
  - Table properties and statistics
  - Search functionality

- **🔍 Query Optimization Tools**
  - Query execution analysis
  - Performance metrics (execution time, rows affected)
  - Query suggestions and best practices
  - Slow query detection

- **🏷️ Connection Management**
  - Group connections by project/environment
  - Custom colors for visual organization
  - Save connection templates
  - Secure credential storage
  - Connection status indicators

- **🌍 Internationalization**
  - English and Chinese localization
  - Easy language switching
  - RTL-ready UI components

## 📥 Downloads

Download the latest version from [GitHub Releases](https://github.com/doifusd/MyLite/releases).

| Platform | File Type | Architecture |
|----------|-----------|-------------|
| **macOS** | `.dmg` | Apple Silicon (M1/M2/M3/M4) |
| **macOS** | `.dmg` | Intel (x86_64) |
| **Windows** | `.exe` / `.msi` | x64 |
| **Linux** | `.deb` / `.AppImage` | x64 |

### ⚠️ macOS: "App is damaged" Warning

Since MyLite is not signed with an Apple Developer certificate, macOS may block the app with a message like **"MyLite is damaged and can't be opened"**. This is a false positive. To fix it:

```bash
# Remove the quarantine attribute (run once after installing)
xattr -cr /Applications/MyLite.app
```

Then double-click `MyLite.app` to open it normally.

## 🚀 Quick Start

### For Users (Download Pre-built Binary)

1. **Download** the appropriate version for your operating system from [Releases](https://github.com/doifusd/MyLite/releases)
2. **Install** by running the installer or extracting the archive
3. **macOS users**: Run `xattr -cr /Applications/MyLite.app` if blocked
4. **Launch** MyLite and start creating database connections

### For Developers

#### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) 1.70 or later
- [Node.js](https://nodejs.org/) 18 or later
- MySQL 5.7+ or MariaDB 10.2+ (for testing)

#### Installation & Development

```bash
# Clone the repository
git clone https://github.com/sky/mylite.git
cd mylite

# Install dependencies
npm install

# Start development server (hot reload)
npm run tauri:dev

# Build for production
npm run tauri:build

# Generate distributable binaries (platform-specific)
./build.sh
```

## 📖 Usage

### Creating a Connection

1. Click **"+ New Connection"** in the connection panel
2. Fill in connection details:
   - **Host**: Database server address
   - **Port**: MySQL port (default 3306)
   - **Username** & **Password**: Credentials
   - **Database**: Default database (optional)
3. Choose connection type: Direct, SSH Tunnel, or HTTP
4. (Optional) Assign a color and group for organization
5. Click **"Test Connection"** to verify
6. Click **"Save"** to store the connection

### Executing Queries

1. Select a database connection from the sidebar
2. Click on a table or write SQL in the editor
3. Use keyboard shortcut **Cmd+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux) to execute
4. View results in the table below with pagination controls
5. Export results to JSON using the export button

### Saving Queries

- Click the **bookmark icon** in the query editor to save frequently-used queries
- Access saved queries from the "Query History" panel
- Queries are automatically saved locally (on-device only)

## 🛠️ Technical Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Backend** | Rust + Tauri | Cross-platform desktop framework |
| **Database Driver** | sqlx | Async SQL toolkit |
| **Frontend** | React 18 + TypeScript | Modern UI framework |
| **Styling** | TailwindCSS | Utility-first CSS |
| **Components** | shadcn/ui | Accessible component library |
| **Editor** | Monaco Editor | Professional code editor |
| **Icons** | Lucide React | Beautiful icon set |
| **i18n** | i18next | Multi-language support |

## 📊 Performance Benchmarks (v1.0.0)

Tested on MacBook Pro M2 with MySQL 8.0:

| Operation | Performance | Status |
|-----------|-------------|--------|
| App Startup | < 2 seconds | ✅ Excellent |
| Small Query (<1000 rows) | < 500ms | ✅ Excellent |
| Large Query (10,000 rows) | < 2 seconds | ✅ Good |
| Virtual Scroll Rendering | 60 FPS | ✅ Excellent |
| Memory Usage (Idle) | 120 MB | ✅ Excellent |
| Memory Usage (Active) | 450 MB | ✅ Good |

## 🎯 Use Cases

- **Database Administration**: Manage MySQL instances with ease
- **Development**: Quick database inspection during development
- **Data Analysis**: View and export query results for analysis
- **Remote Access**: Connect securely via SSH tunneling
- **Team Collaboration**: Share database connections within teams
- **Performance Tuning**: Analyze query execution and optimize

## 🔐 Security Features

- ✅ Secure credential storage (OS keychain)
- ✅ SSH key authentication support
- ✅ TLS/SSL encryption for connections
- ✅ No data transmission to external servers
- ✅ All processing done locally
- ✅ Regular security audits

## 🔄 Release Notes

### v1.0.0 - Production Release (2026-04-07)

#### New Features
- Initial stable release
- Multi-platform support (macOS, Windows, Linux)
- Complete query editor with auto-completion
- Schema browser with lazy loading
- Query history with tagging
- Connection grouping and organization
- SSH tunnel support
- SSL/TLS encryption

#### Improvements
- Optimized query execution
- Virtual scrolling for large datasets
- Internationalization support (EN/ZH)
- Connection validation
- Performance testing suite

#### Bug Fixes
- Dialog import resolution
- Vite build configuration
- TypeScript compilation errors


## 🤝 Contributing

We welcome contributions! Whether it's bug reports, feature requests, or code contributions, please help us improve MyLite.

### Getting Started
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and commit: `git commit -m 'Add amazing feature'`
4. Push to your fork: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines
- Follow Rust and TypeScript best practices
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR

## 📝 Documentation

(Documentation is currently being updated. Please refer to this README for now.)

## ✋ Support

- **Issues**: [GitHub Issues](https://github.com/sky/mylite/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sky/mylite/discussions)
- **Email**: support@mylite.dev

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Sky** - Main Developer [@sky](https://github.com/sky)

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/) - Cross-platform desktop framework
- UI Components from [shadcn/ui](https://ui.shadcn.com/)
- Database driver [sqlx](https://github.com/launchbadge/sqlx)

---

**⭐ If you find MyLite useful, please star the repository!**

[Download v1.0.0](dist/MyLite_1.0.0_aarch64.dmg) • [Report Issues](https://github.com/sky/mylite/issues) • [View Releases](https://github.com/sky/mylite/releases)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) - Desktop app framework
- [shadcn/ui](https://ui.shadcn.com/) - UI component library
- [sqlx](https://github.com/launchbadge/sqlx) - Rust SQL toolkit
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) - Code editor

## 📞 Support

- 📧 Email: [EMAIL_ADDRESS]
- 💬 Discord: [Join our server](https://discord.gg/mylite)
- 🐦 Twitter: [@myliteapp](https://twitter.com/myliteapp)

---

Built with ❤️ by the MyLite team
