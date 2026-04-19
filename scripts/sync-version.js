import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');

try {
  console.log('Starting version synchronization...');

  // Read version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  if (!version) {
    console.error('Error: No version found in package.json');
    process.exit(1);
  }

  console.log(`Target version from package.json: ${version}`);

  // Read Cargo.toml
  if (!fs.existsSync(cargoTomlPath)) {
    console.error(`Error: Cargo.toml not found at ${cargoTomlPath}`);
    process.exit(1);
  }

  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');

  // Replace version in [package] section using regex
  // This matches 'version = "..."' at the beginning of a line
  const versionRegex = /^version\s*=\s*"[^"]*"/m;
  const newCargoToml = cargoToml.replace(
    versionRegex,
    `version = "${version}"`
  );

  if (cargoToml === newCargoToml) {
    console.log('Status: src-tauri/Cargo.toml version is already up to date.');
  } else {
    fs.writeFileSync(cargoTomlPath, newCargoToml);
    console.log(`Success: Synced src-tauri/Cargo.toml version to ${version}`);
  }
} catch (error) {
  console.error('Fatal Error syncing version:', error.message);
  process.exit(1);
}
