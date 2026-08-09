#!/usr/bin/env node
/**
 * 用 uni-app x 自己的样式编译器（uni-nvue-styler）跑一遍项目里所有 <style> 块，
 * 把「标准 CSS 里合法、但 uni-app x 不支持」的写法全部报出来。
 *
 *   node scripts/check-uvue-css.js
 *
 * uni-app x 只支持标准 CSS 的一个子集（https://doc.dcloud.net.cn/uni-app-x/css/），
 * 不支持的属性只是编译期一条 warning，运行时被静默丢弃，很难从表现上倒推。
 * 而且支持度是分平台、分渲染模式的：本项目 manifest.json 里 uni-app-x.vapor = true，
 * 走的是 unixVaporVer 那一列，比非 vapor 少一些属性（例如 lines 在鸿蒙就不支持）。
 *
 * HBuilderX 装在别处时用 HBUILDERX_HOME 指定。
 */
const fs = require('fs');
const path = require('path');

const HBUILDERX = process.env.HBUILDERX_HOME || '/Applications/HBuilderX.app/Contents/HBuilderX';
const STYLER = path.join(
    HBUILDERX,
    'plugins/uniapp-cli-vite/node_modules/@dcloudio/uni-nvue-styler/dist/uni-nvue-styler.cjs.js'
);
const ROOT = path.resolve(__dirname, '..');
const PLATFORMS = ['app-android', 'app-ios', 'app-harmony'];
const SKIP_DIRS = new Set(['node_modules', 'unpackage', '.git', 'tmp', 'harmony-configs', 'gradle', 'screenshots']);

if (!fs.existsSync(STYLER)) {
    console.error(`找不到 uni-nvue-styler：${STYLER}\n用 HBUILDERX_HOME 指定 HBuilderX 安装目录。`);
    process.exit(2);
}

// vapor 模式决定查 unixVaporVer 还是 unixVer，必须在 require 之前设置
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
if (manifest['uni-app-x']?.vapor === true) {
    process.env.UNI_APP_X_DOM2 = 'true';
}
const { parse } = require(STYLER);

function walk(dir, out) {
    for (const name of fs.readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p, out);
        else if (/\.(uvue|css)$/.test(name)) out.push(p);
    }
    return out;
}

// .css 整个文件是一块；.uvue 取每个 <style> 块，记下行号偏移
function extractBlocks(file, src) {
    if (file.endsWith('.css')) return [{ css: src, lineOffset: 0 }];
    const blocks = [];
    const re = /<style[^>]*>([\s\S]*?)<\/style>/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const head = src.slice(0, m.index + m[0].indexOf('>') + 1);
        blocks.push({ css: m[1], lineOffset: head.split('\n').length - 1 });
    }
    return blocks;
}

(async () => {
    const issues = new Map(); // 诊断信息 -> { platforms, locs }
    const files = walk(ROOT, []);

    for (const file of files) {
        const src = fs.readFileSync(file, 'utf8');
        for (const blk of extractBlocks(file, src)) {
            if (blk.css.trim() === '') continue;
            for (const platform of PLATFORMS) {
                const { messages } = await parse(blk.css, {
                    filename: file,
                    type: 'uvue',
                    platform,
                    logLevel: 'NOTE',
                    noCode: true
                });
                for (const msg of messages) {
                    const start = msg.node?.source?.start;
                    const decl = msg.node?.prop !== undefined
                        ? `${msg.node.prop}: ${msg.node.value}`
                        : msg.node?.selector ?? '';
                    if (!issues.has(msg.text)) issues.set(msg.text, { platforms: new Set(), locs: new Set() });
                    const issue = issues.get(msg.text);
                    issue.platforms.add(platform.replace('app-', ''));
                    issue.locs.add(`${path.relative(ROOT, file)}:${start ? start.line + blk.lineOffset : 0}  ${decl}`);
                }
            }
        }
    }

    const rank = (text) => (text.startsWith('ERROR') ? 0 : text.startsWith('WARNING') ? 1 : 2);
    const sorted = [...issues].sort((a, b) => rank(a[0]) - rank(b[0]) || b[1].locs.size - a[1].locs.size);
    for (const [text, issue] of sorted) {
        console.log(`\n${text}   [${[...issue.platforms].join(', ')}]`);
        for (const loc of issue.locs) console.log(`    ${loc}`);
    }
    console.log(`\n扫描 ${files.length} 个文件，${sorted.length} 类问题。`);
    process.exit(sorted.some(([text]) => text.startsWith('ERROR')) ? 1 : 0);
})();
