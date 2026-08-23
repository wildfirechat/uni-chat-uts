#!/usr/bin/env node
/**
 * 用 uni-app x 自带的 uts 编译器把 .uts 文件本地转成 Kotlin / ArkTS / Swift，
 * 不启动 HBuilderX、不连真机，秒级出结果。
 *
 *   node scripts/uts-transpile.js                      # 默认查 store.uts，三端都转
 *   node scripts/uts-transpile.js wfc/client/wfc.uts   # 指定入口（会连同它 import 的文件一起 bundle）
 *   node scripts/uts-transpile.js --target kotlin      # 只转一端
 *   node scripts/uts-transpile.js --out /tmp/utsout    # 保留产物，用来核对生成的代码
 *
 * 能查出什么：语法错误、UTS 不支持的写法、代码生成层面的问题，以及「生成的 Kotlin 到底长什么样」
 * —— 后者是唯一能在本地确认 `reactive({...} as T)` 有没有真的生成响应式子类的办法（见 store.uts 头部注释）。
 *
 * 查不出什么：**类型错误**。真机编译还要过 tsc 和 kotlinc/ArkTS 编译器这两关，
 * 这个脚本过了不等于 HBuilderX 能编过，只是能在编之前挡掉一批低级错误。
 * 入口只能是 .uts，.uvue 要先过 vue 编译器，这里转不了。
 *
 * HBuilderX 装在别处时用 HBUILDERX_HOME 指定。
 */
const fs = require('fs');
const path = require('path');

const HBUILDERX = process.env.HBUILDERX_HOME || '/Applications/HBuilderX.app/Contents/HBuilderX';
const UTS = path.join(HBUILDERX, 'plugins/uniapp-uts-v1/node_modules/@dcloudio/uts');
const ROOT = path.resolve(__dirname, '..');

if (!fs.existsSync(UTS)) {
    console.error(`找不到 uts 编译器：${UTS}\n用 HBUILDERX_HOME 指定 HBuilderX 安装目录。`);
    process.exit(2);
}
const uts = require(UTS);

const TARGETS = {
    kotlin: [uts.UTSTarget.KOTLIN, 'kt'],
    arkts: [uts.UTSTarget.ARKTS, 'ets'],
    swift: [uts.UTSTarget.SWIFT, 'swift'],
};

const args = process.argv.slice(2);
const entries = [];
let only = null;
let outDir = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target') only = args[++i];
    else if (args[i] === '--out') outDir = path.resolve(args[++i]);
    else entries.push(args[i]);
}
if (entries.length === 0) entries.push('store.uts');
if (only !== null && TARGETS[only] === undefined) {
    console.error(`--target 只能是 ${Object.keys(TARGETS).join(' / ')}`);
    process.exit(2);
}
if (outDir === null) outDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'uts-transpile-'));

// 原生插件不在这里编译，但入口 import 了它们时要报出名字，否则 bundle 直接 GenericFailure
const uniModules = fs.existsSync(path.join(ROOT, 'uni_modules'))
    ? fs.readdirSync(path.join(ROOT, 'uni_modules')).filter((n) => !n.startsWith('.'))
    : [];

async function run(entry, name) {
    const [target, extname] = TARGETS[name];
    const res = await uts.bundle(target, {
        mode: 'development',
        input: {
            root: ROOT,
            filename: path.resolve(ROOT, entry),
            paths: {
                vue: 'io.dcloud.uniapp.vue',
                '@dcloudio/uni-app': 'io.dcloud.uniapp.framework',
                '@dcloudio/uni-runtime': 'io.dcloud.uniapp.framework.runtime',
            },
            uniXPages: [],
            uniModules,
            uniModulesPrefix: 'uts.sdk.modules',
        },
        output: {
            errorFormat: 'json',
            isX: true,
            isApp: true,
            isSingleThread: true,
            isPlugin: false,
            outDir: path.join(outDir, name),
            outFilename: path.basename(entry, '.uts') + '.' + extname,
            package: 'uni.transpilecheck',
            extname,
            logFilename: true,
            noColor: true,
        },
    });
    return res && res.error ? res.error : null;
}

(async () => {
    let failed = 0;
    for (const entry of entries) {
        if (!fs.existsSync(path.resolve(ROOT, entry))) {
            console.error(`✗ ${entry}：文件不存在`);
            failed++;
            continue;
        }
        for (const name of only !== null ? [only] : Object.keys(TARGETS)) {
            const error = await run(entry, name);
            if (error === null) {
                console.log(`✓ ${entry} → ${name}`);
            } else {
                failed++;
                console.error(`✗ ${entry} → ${name}`);
                console.error(typeof error === 'string' ? error : JSON.stringify(error, null, 2));
            }
        }
    }
    console.log(`\n产物：${outDir}`);
    process.exit(failed > 0 ? 1 : 0);
})();
