
npm run tauri:dev

npm run tauri:build


#要创建平台特定的安装包：

# macOS .dmg
cd mysqlClient && npm run tauri:build

# Windows .msi (需要 Windows + WiX)
# cd mysqlClient && npm run tauri:build

# Linux .AppImage (需要 Linux)
# cd mysqlClient && npm run tauri:build

