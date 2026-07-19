# 野火 IM uni-app 项目向 uni-app x 迁移可行性评估报告

> [!NOTE]
> 本报告针对当前项目 `uni-chat-uts` 从 **uni-app (Vue3 + JS/TS)** 平台迁移至 **uni-app x (纯原生渲染 UTS)** 的可行性、技术难点及工作量进行全面评估。

---

## 一、 项目现状与技术栈统计

经过对当前项目的代码库扫描，项目整体技术指标如下：

1. **文件规模**：
   - **Vue 组件/页面文件**：`97` 个 （如 `ConversationPage.vue`, `TextMessageContentView.vue`, `LoginPage.vue` 等）
   - **JavaScript 逻辑文件**：`183` 个 （如 `wfc.js`, `store.js`, `pstore.js` 等）
   - **总计**：`280` 个核心源码文件。

2. **核心依赖项 (package.json)**：
   - 状态管理：`pinia`
   - 国际化：`vue-i18n`
   - 工具库：`events` (Node.js 事件总线), `long` (64位整数表示), `mitt` (小型事件订阅), `base64-arraybuffer`
   - 文本与 Emoji 过滤：`anchorme` (链接解析), `pinyin` (拼音转换), `emojilib`, `twemoji`, `universal-emoji-parser`

3. **原生依赖 (Native Plugins)**：
   - 核心即时通讯底层：`wfc-client`（已在 `uni_modules` 中实现了部分的 UTS 原生包装）
   - 音视频通话插件：`wf-uni-wfc-avclient`（位于 `nativeplugins` 下，属于标准的 Weex / 5+ 架构原生插件）
   - 对讲机插件：`wf-uni-wfc-pttclient`（位于 `nativeplugins` 下）

---

## 二、 迁移到 uni-app x 的可行性结论

**评估结论：可行，但需要极高的工作量（近乎于 UI 层的重新开发与封装层重构），风险点较多。**

在 uni-app 中，App 平台底层仍基于 JS 引擎（JavaScriptCore/V8）+ Webview/nvue 渲染。而 **uni-app x** 在 App 平台上是**纯原生编译（UTS -> Kotlin/Swift）**，运行期**没有 JavaScript 运行环境，也没有标准的 HTML/DOM**。

基于此架构差异，项目面临以下几个核心的迁移断层，必须进行全面改造。

---

## 三、 核心技术难点与改造工作量

### 1. 开发语言迁移 (JS $\rightarrow$ UTS)
- **现状**：项目中拥有多达 `183` 个 JS 文件，包含复杂的即时通讯协议封装、消息解析、重试逻辑等。
- **痛点**：uni-app x 上的 App 端不运行 JS，必须将所有的 JS 文件重命名为 `.uts`。UTS 采用静态、严格的类型系统（类似于 TypeScript）。
- **改造点**：
  - 必须为所有导出的类（如 `Message`, `Conversation`, `UserInfo`）定义严格的 interface/class 类型。
  - 消除 JS 动态特性（如动态属性添加 `obj[dynamicKey] = value`，或者未定义的变量属性访问）。
  - 处理 64 位整数：目前项目使用 `long` 库进行 64 位整型（比如 messageUid, 毫秒时间戳）处理。在 UTS 中，应该直接映射到 native 的 `Long` (Kotlin) 或 `Int64` (Swift)，需将 `longUtil.js` 及其所有依赖调用全部重构。

### 2. UI 标签与 DOM 依赖消除 (HTML $\rightarrow$ 规范组件)
- **现状**：大量 Vue 文件（至少 70 个以上）的 `<template>` 中混用了 HTML 标签（如 `div`, `p`, `span`, `img`, `button`, `ul`, `ol` 等）。
- **痛点**：uni-app x App 平台不包含浏览器环境，不支持任何标准的 HTML 标签，只支持 `view`, `text`, `image`, `scroll-view` 等标准 uni-app 组件。
- **改造点**：
  - 必须对所有 `97` 个 Vue 文件进行扫描，将所有的 `div` 替换为 `view`，`span`/`p` 替换为 `text`，`img` 替换为 `image`，`ul`/`ol`/`li` 替换为 `view`/`list-item`。
  - 需要在全局 CSS 中删除对 HTML 标签选择器（如 `*`, `div`, `p` 等）的定义，重构为类选择器。

### 3. v-html 与 Emoji/链接富文本渲染
- **现状**：消息渲染的核心组件（如 [TextMessageContentView.vue](file:///Users/jiangecho/bitbucket/wildfirechat/uni-chat-uts/pages/conversation/message/content/TextMessageContentView.vue#L1-L6)）采用 `v-html` 加载包含 `<img class="emoji">` 及 `<a>` 标签的 HTML 字符串来呈现图文混排的表情和解析出的链接。
- **痛点**：**uni-app x App 平台完全不支持 `v-html`**。
- **改造点**：
  - 无法再采用简单的正则表达式拼装 HTML 字符串的渲染方案。
  - 必须自行编写富文本解析器，将包含表情、超链接的文本拆解为结构化数组，例如：
    `[{type: "text", content: "你好"}, {type: "emoji", src: "/static/emoji/1.png"}, {type: "link", url: "https://..."}]`
  - 在页面模板中通过 `v-for` 循环，根据 type 渲染对应的 `<text>` 或 `<image>` 标签，并处理事件绑定。由于 iOS/Android 原生文字与图片混排的布局特性限制，可能会遇到错行或换行格式不够美观的问题。

### 4. 状态管理与国际化重构 (Pinia & vue-i18n)
- **现状**：项目使用 Pinia 做跨组件的状态管理（`pstore.js`），并利用 `vue-i18n` 进行多语言管理。
- **痛点**：目前 `pinia` 和 `vue-i18n` 官方库无法在 uni-app x App 平台上运行。
- **改造点**：
  - **状态管理**：需要移除 Pinia，改用 UTS 的响应式 API（如直接导出全局的 `reactive` 对象或使用简单的自定义发布订阅模式）重新实现全局 store。
  - **国际化**：需要改为 uni-app x 官方自带的国际化翻译 API，或自行编写轻量级 UTS 字典查询函数。

### 5. 原生插件升级 (Native Plugins $\rightarrow$ UTS Plugins)
- **现状**：音视频通话（`wf-uni-wfc-avclient`）和对讲机（`wf-uni-wfc-pttclient`）属于 5+ 标准原生插件，且代码中多处使用了 `uni.requireNativePlugin` 和 `plus.globalEvent.addEventListener` 来与原生端通信。
- **痛点**：**uni-app x 不支持标准 5+ 原生插件和 `plus` 全局对象**。
- **改造点**：
  - 必须将这两个原生插件重构为 **UTS 插件**。
  - 这要求在 Android/iOS 的 UTS 原生模块层，使用 Kotlin/Swift 重新桥接野火音视频 SDK 原生库，并通过 UTS 的导出接口提供给前端。
  - 将 `plus.globalEvent` 的事件通知机制，改用 UTS 插件提供的 Callback、Delegate 监听或 uni-app x 的自定义事件分发通道。

### 6. CSS 样式大面积重写
- **现状**：项目编写了大量 Web 风格的 CSS，如使用 `:root` 变量、浮动布局、复杂的绝对定位和百分比高宽等。
- **痛点**：uni-app x App 平台仅支持极其受限的 **Flexbox 布局子集**，并且很多 CSS 属性（如百分比高度计算、过渡动画属性等）存在限制。
- **改造点**：
  - 每一个 Vue 文件的样式部分必须按照 uni-app x 的 CSS 规范重新审查，避免布局崩塌。

---

## 四、 迁移工作量估算

| 模块 | 改造内容 | 工作量占比 | 难点级别 |
| :--- | :--- | :---: | :---: |
| **原生桥接层** | 将 `avclient` 和 `pttclient` 转换为 UTS 插件，重构原生事件订阅 | 30% | ⭐⭐⭐⭐⭐ (极高) |
| **基础逻辑层** | 将 183 个 JS 文件重构为强类型的 UTS 文件，重写 `longUtil` 和事件分发 | 25% | ⭐⭐⭐⭐ (高) |
| **模板与标签** | 清理 97 个 Vue 文件中的 HTML 标签，重构页面结构 | 15% | ⭐⭐⭐ (中) |
| **富文本表情** | 重写 `v-html`，开发 UTS 规范的图文混排/表情解析渲染方案 | 15% | ⭐⭐⭐⭐ (高) |
| **状态/语言** | 替换 Pinia 和 vue-i18n 为 UTS 兼容方案 | 10% | ⭐⭐⭐ (中) |
| **样式与 CSS** | 适配 UTS Flexbox 布局，清理不支持的 CSS 属性 | 5% | ⭐⭐⭐ (中) |

---

## 五、 决策建议

针对是否迁移，我们提供以下两条路线供评估：

### 路线 A：暂缓迁移，保持当前架构（推荐）
* **原因**：野火 IM 项目涉及非常繁重的原生音视频（RTC）、复杂的消息解析、高频的事件总线。在当前的 uni-app (Vue3) 架构下，依靠 `utsWfcClient`（仅对核心 IM SDK 进行了 UTS 封装）已经能够保证出色的运行性能和稳定性。
* **好处**：开发成本极低，社区生态支持完善。

### 路线 B：全面拥抱 uni-app x，进行长期重构
* **适用场景**：对 App 的启动速度、纯原生流畅度（尤其是超大型群聊长列表滚动）有极致苛刻的要求，且有充足的研发预算和熟悉 Kotlin/Swift/UTS 开发的工程师资源。
* **做法**：建议首先完成底层核心 `wfc-client` 与 `avclient` 的 UTS 插件化重构，确保底层链路打通，然后再逐步将主项目的 UI 和 JS 逻辑按模块分批迁移为 UTS 和纯 native 组件。
