# MyLite - Modern MySQL Client

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/sky/mylite)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange.svg)](https://www.rust-lang.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://reactjs.org)

A modern, lightweight MySQL client built with Rust + Tauri + React.

![MyLite Screenshot](screenshot.png)

## ✨ Features

- 🔌 **Multiple Connection Types**: Direct, SSH Tunnel, HTTP/WebSocket, SSL/TLS
- 📊 **Query Editor**: Monaco Editor with SQL syntax highlighting and auto-completion
- 📈 **Results Visualization**: Table view with virtual scrolling, export to JSON
- 🌳 **Schema Browser**: Tree view with lazy loading, table details, column info
- 📜 **Query History**: Auto-save with favorites, tags, and statistics
- 🔍 **SQL Analyzer**: Query analysis and optimization suggestions
- 🏷️ **Connection Groups**: Organize connections with custom groups and colors
- ⚡ **High Performance**: Virtual scrolling, pagination, connection pooling

## 🚀 Quick Start

### Download

Download the latest release for your platform:

- [macOS (Intel/Apple Silicon)](https://github.com/sky/mylite/releases)
- [Windows](https://github.com/sky/mylite/releases)
- [Linux (AppImage)](https://github.com/sky/mylite/releases)

### Development

#### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) 1.70+
- [Node.js](https://nodejs.org/) 18+
- [MySQL](https://www.mysql.com/) (for testing)

#### Setup

```bash
# Clone the repository
git clone https://github.com/sky/mylite.git
cd mylite

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## 📸 Screenshots

### Connection Manager
![Connection Manager](docs/screenshots/connection-manager.png)

### Query Editor
![Query Editor](docs/screenshots/query-editor.png)

### Schema Browser
![Schema Browser](docs/screenshots/schema-browser.png)

## 🛠️ Tech Stack

- **Backend**: Rust + Tauri + sqlx
- **Frontend**: React + TypeScript + TailwindCSS
- **UI Components**: shadcn/ui
- **Editor**: Monaco Editor
- **Icons**: Lucide React

## 📊 Performance

| Metric | Target | Status |
|--------|--------|--------|
| Query Execution (<1000 rows) | < 1s | ✅ |
| Query Execution (10000 rows) | < 3s | ✅ |
| Memory Usage | < 500MB | ✅ |
| App Startup | < 3s | ✅ |
| Virtual Scroll | 60fps | ✅ |

## 📝 Documentation

- [User Guide](docs/USER_GUIDE.md)
- [Development Guide](docs/DEVELOPMENT.md)
- [API Reference](docs/API.md)
- [Performance Report](PERFORMANCE_TEST.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
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

- 📧 Email: support@mylite.app
- 💬 Discord: [Join our server](https://discord.gg/mylite)
- 🐦 Twitter: [@myliteapp](https://twitter.com/myliteapp)

---

Built with ❤️ by the MyLite team
