#!/usr/bin/env node
// Reads src/manifest.json, writes dist/script.user.js (CLAUDE.md §3). One build, one output — no
// loader/payload split, no credential embedding (the live userscript gets credentials from its own
// Settings panel at runtime, never at build time — CLAUDE.md §4).
'use strict';

var lib = require('./lib.js');

function main() {
  var manifest = lib.readManifest('src/manifest.json');
  var output = lib.buildBundle(manifest);
  var written = lib.writeOutput(manifest.outputFile, output);
  console.log('Build succeeded: ' + manifest.outputFile + ' (' + written.byteSize + ' bytes)');
}

main();
