#!/usr/bin/env node
/**
 * 检查 store.uts 里每个 state 的字段都被「初值字面量」和「resetXxxState()」覆盖到。
 *
 *   node scripts/check-store-reset.js
 *
 * 为什么要这个脚本：state 用的是 `type` + `reactive({...} as T)`，初值只能内联在字面量里
 * （原因见 store.uts 头部注释第 2 条），reset 只能一行行手写。新加一个字段忘了补 reset，
 * 症状是「上一个账号的状态漏给下一个账号」——退登再登才看得出来，很难联想到是漏了一行。
 * 这里把它变成一条本地秒出的检查。
 *
 * 故意不重置的字段登记在 INTENTIONALLY_NOT_RESET 里，理由写在 store.uts 对应注释上。
 */
const fs = require('fs');
const path = require('path');

const STORE = path.resolve(__dirname, '..', 'store.uts');

// 版本号类字段只负责「变了」这个信号，归零反而可能让 computed 读到和上次相同的值；
// isAppHidden 是 App 前后台的真实状态，跟登录的是谁无关。
const INTENTIONALLY_NOT_RESET = {
    ConversationState: ['conversationTargetVersion'],
    MiscState: ['isAppHidden', 'onlineStateVersion'],
};

const src = fs.readFileSync(STORE, 'utf8');
const lines = src.split('\n');

// export type XxxState = { ... }  ->  字段名
function parseTypeFields(typeName) {
    const start = lines.findIndex((l) => l.startsWith(`export type ${typeName} = {`));
    if (start < 0) return null;
    const fields = [];
    for (let i = start + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('}')) break;
        const m = /^\s{4}(\w+)\s*:/.exec(line);
        if (m !== null) fields.push(m[1]);
    }
    return fields;
}

// export const xxxState = reactive({ ... } as XxxState)  ->  写了初值的字段名
function parseLiteralFields(constName) {
    const start = lines.findIndex((l) => l.startsWith(`export const ${constName} = reactive({`));
    if (start < 0) return null;
    const fields = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^\} as \w+\)/.test(lines[i])) break;
        const m = /^\s{4}(\w+)\s*:/.exec(lines[i]);
        if (m !== null) fields.push(m[1]);
    }
    return fields;
}

// function resetXxxState(): void { ... }  ->  被赋值的字段名
function parseResetFields(fnName, constName) {
    const start = lines.findIndex((l) => l.startsWith(`function ${fnName}(): void {`));
    if (start < 0) return null;
    const fields = [];
    const re = new RegExp(`^\\s+${constName}\\.(\\w+)\\s*=`);
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith('}')) break;
        const m = re.exec(lines[i]);
        if (m !== null) fields.push(m[1]);
    }
    return fields;
}

const STATES = [
    ['ConversationState', 'conversationState', 'resetConversationState'],
    ['ContactState', 'contactState', 'resetContactState'],
    ['SearchState', 'searchState', 'resetSearchState'],
    ['PickState', 'pickState', 'resetPickState'],
    ['MiscState', 'miscState', 'resetMiscState'],
];

let problems = 0;
for (const [typeName, constName, fnName] of STATES) {
    const declared = parseTypeFields(typeName);
    const initialized = parseLiteralFields(constName);
    const reset = parseResetFields(fnName, constName);

    if (declared === null || initialized === null || reset === null) {
        console.error(`✗ ${typeName}：没找到 ${declared === null ? 'type 定义' : initialized === null ? 'reactive 初值字面量' : fnName + '()'}，store.uts 结构变了就来改这个脚本`);
        problems++;
        continue;
    }

    const skip = INTENTIONALLY_NOT_RESET[typeName] || [];
    const missingInit = declared.filter((f) => !initialized.includes(f));
    const missingReset = declared.filter((f) => !reset.includes(f) && !skip.includes(f));
    const staleSkip = skip.filter((f) => !declared.includes(f));
    const unknownInit = initialized.filter((f) => !declared.includes(f));
    const unknownReset = reset.filter((f) => !declared.includes(f));

    for (const [label, list] of [
        ['初值字面量里缺', missingInit],
        [`${fnName}() 里缺`, missingReset],
        ['初值字面量里多出（type 里没有）', unknownInit],
        [`${fnName}() 里多出（type 里没有）`, unknownReset],
        ['INTENTIONALLY_NOT_RESET 里登记了但 type 里已没有', staleSkip],
    ]) {
        if (list.length > 0) {
            console.error(`✗ ${typeName} ${label}：${list.join(', ')}`);
            problems++;
        }
    }

    if (missingInit.length + missingReset.length + unknownInit.length + unknownReset.length + staleSkip.length === 0) {
        console.log(`✓ ${typeName}（${declared.length} 个字段，${skip.length > 0 ? '故意不重置 ' + skip.join('/') : '全部重置'}）`);
    }
}

process.exit(problems > 0 ? 1 : 0);
