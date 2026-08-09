#!/usr/bin/env node
/**
 * Detect "used before textually defined" references to top-level
 * `const NAME = (...) => { ... }` functions/computed inside <script setup lang="uts">
 * blocks of .uvue files.
 *
 * This is a heuristic scanner for the Android UTS compiler bug where top-level
 * const arrow functions/computed are NOT hoisted — any reference (even inside a
 * deferred callback like .then()/onLoad()/onMounted()/@tap handler) that appears
 * textually BEFORE the const's own declaration line fails with:
 *   error: 找不到名称"NAME"
 *
 * Usage: node scripts/find-forward-refs.js [--dir pages] [glob...]
 *
 * NOTE: read-only / reporting only. Does not modify files. Review each hit and
 * move the declaration earlier (see /memories/repo for established fix patterns).
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'unpackage' || entry.name === 'gradle') continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walk(full, out)
        } else if (entry.name.endsWith('.uvue')) {
            out.push(full)
        }
    }
}

function extractScript(content) {
    const m = content.match(/<script[^>]*>([\s\S]*?)<\/script>/)
    if (!m) return null
    return m[1]
}

function findDeclarations(script) {
    // top-level (0-indentation) const NAME = ... => {  or  const NAME = computed...
    const declRe = /^const\s+([A-Za-z_$][\w$]*)\s*=/gm
    const decls = new Map()
    let mm
    while ((mm = declRe.exec(script)) !== null) {
        const name = mm[1]
        const lineIdx = script.slice(0, mm.index).split('\n').length - 1
        if (!decls.has(name)) decls.set(name, lineIdx)
    }
    return decls
}

function findUsages(script, name) {
    const usages = []
    const useRe = new RegExp('(?<![\\w$.])' + name.replace(/[$]/g, '\\$') + '\\s*\\(', 'g')
    let mm
    while ((mm = useRe.exec(script)) !== null) {
        const lineIdx = script.slice(0, mm.index).split('\n').length - 1
        usages.push(lineIdx)
    }
    return usages
}

function main() {
    const files = []
    walk(ROOT, files)
    let totalHits = 0
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8')
        const script = extractScript(content)
        if (!script) continue
        const decls = findDeclarations(script)
        const hits = []
        for (const [name, declLine] of decls) {
            const usages = findUsages(script, name)
            for (const u of usages) {
                if (u < declLine) {
                    hits.push({ name, declLine: declLine + 1, useLine: u + 1 })
                }
            }
        }
        if (hits.length > 0) {
            totalHits += hits.length
            const rel = path.relative(ROOT, file)
            console.log(rel)
            for (const h of hits.sort((a, b) => a.useLine - b.useLine)) {
                console.log(`  '${h.name}' used at script-line ${h.useLine}, declared at script-line ${h.declLine}`)
            }
        }
    }
    console.log(`\nTotal forward-reference hits: ${totalHits}`)
}

main()
