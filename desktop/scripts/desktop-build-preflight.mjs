import {
  copyFileSync,
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const SUPPORTED_NODE_RANGE = '>=22.12.0 <23';

export function assertSupportedNode(version = process.versions.node) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  if (!match) {
    throw new Error(`desktop_build_node_version_invalid:${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (major !== 22 || minor < 12) {
    throw new Error(
      `desktop_build_requires_node_${SUPPORTED_NODE_RANGE}:current=${version}`,
    );
  }
}

export function resolveSquirrelPackageRoot() {
  return path.dirname(require.resolve('electron-winstaller/package.json'));
}

function assertSquirrelPackage(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error('squirrel_vendor_package_missing');
  }

  const metadata = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (metadata.name !== 'electron-winstaller') {
    throw new Error('squirrel_vendor_package_invalid');
  }
}

export function prepareSquirrelVendor({
  packageRoot = resolveSquirrelPackageRoot(),
  arch = process.arch,
} = {}) {
  assertSquirrelPackage(packageRoot);

  if (!['x64', 'arm64'].includes(arch)) {
    throw new Error(`squirrel_vendor_arch_unsupported:${arch}`);
  }

  const vendorRoot = path.join(packageRoot, 'vendor');
  if (!existsSync(vendorRoot) || path.basename(vendorRoot) !== 'vendor') {
    throw new Error('squirrel_vendor_directory_invalid');
  }

  const prepared = [];
  for (const extension of ['exe', 'dll']) {
    const source = path.join(vendorRoot, `7z-${arch}.${extension}`);
    const target = path.join(vendorRoot, `7z.${extension}`);
    const temporary = `${target}.tmp`;

    if (!existsSync(source) || statSync(source).size === 0) {
      throw new Error(`squirrel_vendor_source_missing:${path.basename(source)}`);
    }

    try {
      copyFileSync(source, temporary);
      if (statSync(temporary).size !== statSync(source).size) {
        throw new Error(`squirrel_vendor_copy_invalid:${path.basename(target)}`);
      }
      renameSync(temporary, target);
    } finally {
      rmSync(temporary, { force: true });
    }

    prepared.push(target);
  }

  return prepared;
}

export function runDesktopBuildPreflight({
  version = process.versions.node,
  prepareSquirrel = false,
} = {}) {
  assertSupportedNode(version);
  return prepareSquirrel ? prepareSquirrelVendor() : [];
}

const isDirectInvocation = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectInvocation) {
  const prepared = runDesktopBuildPreflight({
    prepareSquirrel: process.argv.includes('--prepare-squirrel'),
  });
  if (prepared.length > 0) {
    console.log(
      `Prepared Squirrel vendor tools for ${process.arch}: ${prepared
        .map((entry) => path.basename(entry))
        .join(', ')}`,
    );
  }
}
