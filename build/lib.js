// Shared bundling/validation core (CLAUDE.md §3), used by build.js. Plain Node, no deps, no npm install
// required to run directly.
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');

function fail(message) {
  console.error('BUILD FAILED: ' + message);
  process.exit(1);
}

function readFile(relPath) {
  var fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    fail('missing file: ' + relPath);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

// Parses a leading "// requires: App.a.b, App.c.d" (or "(none)") comment on the first line.
function parseRequires(source, relPath) {
  var firstLine = source.split('\n', 1)[0];
  var match = firstLine.match(/^\/\/\s*requires:\s*(.*)$/);
  if (!match) {
    fail(relPath + ' is missing a leading "// requires: ..." header comment (CLAUDE.md §2.5).');
  }
  var body = match[1].trim();
  if (body === '(none)') return [];
  var found = body.match(/App(?:\.[A-Za-z_$][\w$]*)+/g);
  return found || [];
}

// Finds `App.x.y = ...` assignments, split into real exports (duplicate-checked) and namespace guards
// (`App.x = App.x || {}`, expected to repeat harmlessly across files — these still count as "defining"
// the path for dependency-satisfaction purposes, just not for duplicate detection).
function findAssignments(source) {
  var exportPaths = [];
  var namespacePaths = [];
  var lineRe = /^\s*App((?:\.[A-Za-z_$][\w$]*)+)\s*=\s*(.+)$/gm;
  var match;
  while ((match = lineRe.exec(source)) !== null) {
    var dottedPath = match[1];
    var rhs = match[2].trim();
    var guardRe = new RegExp('^App' + dottedPath.replace(/\./g, '\\.') + '\\s*\\|\\|');
    if (guardRe.test(rhs)) {
      namespacePaths.push('App' + dottedPath);
    } else {
      exportPaths.push('App' + dottedPath);
    }
  }
  return { exports: exportPaths, namespaces: namespacePaths };
}

function checkTrailingSemicolon(source, relPath) {
  var trimmed = source.replace(/\s+$/, '');
  if (!trimmed.endsWith(';')) {
    fail(relPath + ' does not end with an explicit semicolon (CLAUDE.md §2.8).');
  }
}

function readManifest(manifestRelPath) {
  var fullPath = path.join(ROOT, manifestRelPath);
  if (!fs.existsSync(fullPath)) {
    fail('missing manifest: ' + manifestRelPath);
  }
  var manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  if (!Array.isArray(manifest.moduleOrder) || manifest.moduleOrder.length === 0) {
    fail(manifestRelPath + ': "moduleOrder" must be a non-empty array');
  }
  if (!manifest.bootstrapCall) fail(manifestRelPath + ': missing "bootstrapCall"');
  if (!manifest.outputFile) fail(manifestRelPath + ': missing "outputFile"');
  if (!manifest.metadataFile) fail(manifestRelPath + ': missing "metadataFile"');
  return manifest;
}

// Concatenates + validates per CLAUDE.md §3 (dependency check, duplicate-export check, trailing
// semicolon, vm.Script syntax validation).
function buildBundle(manifest) {
  var definedExports = {}; // App.x.y -> file that defined it (real exports, duplicate-checked)
  var definedPaths = {}; // App.x.y -> true for anything (export, namespace guard, or assumed-external)
  var moduleSources = [];

  (manifest.assumeDefined || []).forEach(function (p) {
    definedPaths[p] = true;
  });

  manifest.moduleOrder.forEach(function (relPath) {
    var source = readFile(relPath);
    checkTrailingSemicolon(source, relPath);

    var requires = parseRequires(source, relPath);
    requires.forEach(function (dep) {
      if (!definedPaths[dep]) {
        fail(
          relPath +
            ' requires "' +
            dep +
            '" but nothing earlier in moduleOrder defines it (and it is not in the manifest\'s ' +
            '"assumeDefined" list). Fix moduleOrder/assumeDefined in the manifest or the source that ' +
            'should define it.'
        );
      }
    });

    var assignments = findAssignments(source);
    assignments.exports.forEach(function (exportPath) {
      if (definedExports[exportPath]) {
        fail(
          'Duplicate export "' + exportPath + '" defined in both ' + definedExports[exportPath] + ' and ' + relPath + '.'
        );
      }
      definedExports[exportPath] = relPath;
      definedPaths[exportPath] = true;
    });
    assignments.namespaces.forEach(function (namespacePath) {
      definedPaths[namespacePath] = true;
    });

    moduleSources.push('// --- ' + relPath + ' ---\n' + source.replace(/\s+$/, '') + '\n');
  });

  var body = moduleSources.join('\n') + '\n' + manifest.bootstrapCall.trim() + '\n';

  var metadata = readFile(manifest.metadataFile);
  if (!/==UserScript==/.test(metadata) || !/==\/UserScript==/.test(metadata)) {
    fail(manifest.metadataFile + ' does not contain a valid ==UserScript== block.');
  }
  var output = metadata.replace(/\s+$/, '') + '\n\n' + body;

  try {
    new vm.Script(output, { filename: manifest.outputFile });
  } catch (syntaxError) {
    fail('generated output is not valid JavaScript: ' + syntaxError.message);
  }

  return output;
}

function writeOutput(outputRelPath, output) {
  var outputPath = path.join(ROOT, outputRelPath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output, 'utf8');
  return { path: outputPath, byteSize: Buffer.byteLength(output, 'utf8') };
}

module.exports = {
  ROOT: ROOT,
  fail: fail,
  readFile: readFile,
  readManifest: readManifest,
  buildBundle: buildBundle,
  writeOutput: writeOutput,
};
