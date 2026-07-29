import assert from 'node:assert/strict';
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  assertSupportedNode,
  prepareSquirrelVendor,
} from '../scripts/desktop-build-preflight.mjs';

function makeFakePackage(t) {
  const packageRoot = path.join(
    os.tmpdir(),
    `keshi-squirrel-test-${process.pid}-${Date.now()}-${Math.random()}`,
  );
  const vendorRoot = path.join(packageRoot, 'vendor');
  mkdirSync(vendorRoot, { recursive: true });
  writeFileSync(
    path.join(packageRoot, 'package.json'),
    JSON.stringify({ name: 'electron-winstaller' }),
  );
  t.after(() => rmSync(packageRoot, { recursive: true, force: true }));
  return { packageRoot, vendorRoot };
}

test('desktop build accepts the pinned Node 22 line only', () => {
  assert.doesNotThrow(() => assertSupportedNode('22.12.0'));
  assert.doesNotThrow(() => assertSupportedNode('22.99.0'));
  assert.throws(() => assertSupportedNode('22.11.0'), /requires_node/);
  assert.throws(() => assertSupportedNode('24.16.0'), /requires_node/);
  assert.throws(() => assertSupportedNode('not-semver'), /version_invalid/);
});

test('Squirrel preparation copies only the matching architecture tools', (t) => {
  const { packageRoot, vendorRoot } = makeFakePackage(t);
  writeFileSync(path.join(vendorRoot, '7z-x64.exe'), 'x64-exe');
  writeFileSync(path.join(vendorRoot, '7z-x64.dll'), 'x64-dll');
  writeFileSync(path.join(vendorRoot, '7z-arm64.exe'), 'arm64-exe');
  writeFileSync(path.join(vendorRoot, '7z-arm64.dll'), 'arm64-dll');

  const prepared = prepareSquirrelVendor({ packageRoot, arch: 'x64' });
  assert.doesNotThrow(() => prepareSquirrelVendor({ packageRoot, arch: 'x64' }));

  assert.deepEqual(
    prepared.map((entry) => path.basename(entry)),
    ['7z.exe', '7z.dll'],
  );
  assert.equal(readFileSync(path.join(vendorRoot, '7z.exe'), 'utf8'), 'x64-exe');
  assert.equal(readFileSync(path.join(vendorRoot, '7z.dll'), 'utf8'), 'x64-dll');
});

test('Squirrel preparation rejects invalid packages, architectures, and sources', (t) => {
  const invalidRoot = path.join(
    os.tmpdir(),
    `keshi-invalid-squirrel-test-${process.pid}-${Date.now()}`,
  );
  mkdirSync(path.join(invalidRoot, 'vendor'), { recursive: true });
  writeFileSync(
    path.join(invalidRoot, 'package.json'),
    JSON.stringify({ name: 'other-package' }),
  );
  t.after(() => rmSync(invalidRoot, { recursive: true, force: true }));

  assert.throws(
    () => prepareSquirrelVendor({ packageRoot: invalidRoot, arch: 'x64' }),
    /package_invalid/,
  );

  const { packageRoot } = makeFakePackage(t);
  assert.throws(
    () => prepareSquirrelVendor({ packageRoot, arch: 'ia32' }),
    /arch_unsupported/,
  );
  assert.throws(
    () => prepareSquirrelVendor({ packageRoot, arch: 'x64' }),
    /source_missing/,
  );
});
