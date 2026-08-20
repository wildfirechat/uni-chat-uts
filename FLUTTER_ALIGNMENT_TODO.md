# uni-chat-uts 对齐 flutter-chat 移动端 · 实施 TODO

> **基线**：`../flutter-chat` 的移动端形态（`chat/lib` 去掉 `pc/` 目录 + `moment/` 模块）。
> **本文档取代** `FEATURE_GAP_TODO.md`（那份以 `../android-chat` 为基线，已不适用，可删除）。
> **最后核对**：2026-08-05，对照 flutter-chat 分支当前状态。
> **进度**：M0 完成；M1 / M3 代码侧完成（真机验证待做）；M2 代码侧完成除入群申请审批一项（群二维码已随 M4 补上）；M4 代码侧完成除两项（创建/搜索频道、外部域，见 M4 小节）；M5 投票代码侧完成（真机验证待做），接龙 / 网盘未开工；**M6 朋友圈代码侧完成（真机验证待做），但只有鸿蒙端能跑 —— android / iOS 的 `sendMomentsRequest` 等原生插件更新**。

---

## 一、范围界定

### 对齐范围内

- flutter `chat/lib` 中所有非 `pc/` 代码（59.5k 行 dart）
- flutter `moment/` 朋友圈模块（3.8k 行 dart）
- 三端：Android / iOS / 鸿蒙

### 明确不做（不写进任何里程碑）

| 项 | 原因 |
| --- | --- |
| 桌面端 shell（`pc/` 全部 69 个文件） | uni-app x 不做桌面端 |
| 截图工具（输入框扩展面板 `screenshot` 项） | 已确认不需要 |
| PC 端备份/恢复（`backup/pc_*`，5 个页面） | PC 特有，且备份整体已降到最低优先级 |
| 位置消息 | **flutter 自己也没实现**：`plugin_board.dart` 里 `case "location": showToast(notSupported)`，无 cell_builder、无地图页。对齐 flutter 就不该做 |
| 密聊（端到端加密） | flutter 移动端无入口（主菜单只有 发起聊天/添加朋友/扫一扫） |
| PSTN 落地电话、消息归档、表情推荐 | flutter 移动端未实现 |

> **注意**：「移动端管理 PC」（扫码登录 PC、在线设备列表、踢 PC 下线）**属于对齐范围** —— 那是手机上的功能，不是桌面端功能。见 M4。

### UI 对齐的目标定义

**不追求像素一致，追求设计一致。** 原因是渲染模型不同：flutter 用 Skia 自绘，同一份代码三端像素一致；uni-app x vapor 编译成三端原生组件（Android View / UIView / ArkUI），文字度量、滚动回弹、输入法行为由平台决定。

具体分级：

- **必须一致**：色板、间距、圆角、字号层级、图标、页面结构与信息层次、交互流程与文案
- **尽量接近**：列表行高、头像尺寸、气泡形态、空状态
- **接受不同**：转场动画、媒体浏览器手势（捏合缩放/下拉关闭）、相册选择器样式（flutter 用应用内 `wechat_assets_picker`，uni 走系统选择器）、文本长按选择、任何模糊/毛玻璃效果

---

## 二、标记图例

| 标记 | 含义 |
| --- | --- |
| `[UI]` | SDK/接口齐全，只缺页面与交互，可直接开工 |
| `[SDK❌]` | 需要先补 `wfc/client/wfc.uts` + `uni_modules/wfc-client` 三端原生侧 |
| `[API❌]` | 需要先补 `api/appServerApi.uts`（纯 HTTP，无原生工作量） |
| `[AV❌]` | 需要扩展 `uni_modules/wfc-av-client` 三端原生侧 |
| `[平台]` | 依赖 uni-app x 平台能力，需先做可行性验证 |

**开工前先看 §8 的缺口台账** —— 所有原生侧改动应尽量攒成一批做，减少三端插件发版次数。

---

## 三、里程碑

### M0 · 横切基建（**最高优先级，先于一切新功能**）

这一节的四项是「越晚做越贵」的东西。现在项目约 90 个 uvue 文件，颜色全是硬编码；等涨到 150 个文件再做主题化，成本翻倍。

- [x] **主题层：色板 token + 深色模式** `[平台]`
  - flutter 参考：`../flutter-chat/chat/lib/theme/app_colors.dart`（60+ token 的 `AppColors`，light/dark 两套）
  - **关键约束（已实测确认）**：App 平台**不解析自定义 CSS 变量**。`uni-nvue-styler` 的 `normalizeCssVar` 只把 `var(--window-top)` / `var(--window-bottom)` / `var(--status-bar-height)` 三个内置变量替换成常量，其余 `var(--x)` 原样透传；鸿蒙 `runtime.har` 里根本没有解析 `var(` 的代码。写了不报错，运行时静默失效。所以主题只能走 JS 响应式。
  - 另一个坑：`reactive(new SomeClass())` 在 Android 端无效（见 store.uts 顶部注释），所以 store 用 `ref` 支撑，不用 `reactive`。
  - 产出：
    - [x] [common/theme.uts](common/theme.uts) —— 40 个语义色令牌（flutter 那 60 个里的桌面专用项按 §1 不带），light/dark 两套；`ref` 驱动；`uni.setAppTheme` + `uni.onOsThemeChange` 接系统主题；跟随系统/浅色/深色三档存本地
    - [x] [theme.json](theme.json) + [pages.json](pages.json) globalStyle/tabBar —— 原生外壳（导航栏、tabBar、页面底色）跟随，避免转场闪白
    - [x] 全量替换现有硬编码色值 —— 起点 69 个文件 / 295 处，现已全部处理
      - **刻意保留硬编码的三类**（不是漏网）：
        1. 常暗界面：[voip/Single](pages/voip/Single.uvue)、[voip/Multi](pages/voip/Multi.uvue)、[PreviewVideoPage](pages/misc/PreviewVideoPage.uvue) —— 通话页/视频预览本来就不跟随主题
        2. 常暗浮层：[chunLei-popups](components/chunLei-popups/chunLei-popups.uvue)、[main-action-menu](components/main-action-menu/main-action-menu.uvue) —— 深色遮罩菜单，两端都是这个形态
        3. `hover-class` 的按下态：[option-item](components/option-item/option-item.uvue)、[MePage](pages/me/MePage.uvue)、[bottom-action-sheet](components/bottom-action-sheet/bottom-action-sheet.uvue) —— `hover-class` 只认静态类名，拿不到 `:style`，明暗两个色值只能各写一份
      - 顺带修掉的存量问题：`.desc.unread` / `.tab-text.active` 等状态色一并改成 `:style`（颜色要跟主题走）
  - 验收：切换系统深色模式，所有页面跟随；杀进程重启保持用户选择
- [x] **字号缩放层** `[平台]`
  - flutter 参考：`settings/font_size_settings_screen.dart`（5 档：小/标准/中/大/特大）+ `LayoutScale`
  - 产出：
    - [x] [common/layoutScale.uts](common/layoutScale.uts) —— 8 档字号令牌（对齐 `app_typography.dart`）+ 5 档缩放 + 三类上限（`iconPx` / `rowPx` / `fontPx`）
    - [x] 设置页滑块 —— 见 M1 [FontSizeSettingsPage](pages/me/FontSizeSettingsPage.uvue)
  - 约定：正文类文字走 `fontPx` 完整跟随；角标、图标等图形不跟随（放大只会把同行文字挤出去）
- [ ] **i18n 词条基建**
  - 现状差距：uni 侧 3 语言 × 约 330 条（M1 补了约 95 条，M2 补了约 60 条）；flutter 侧 zh/en × 1066 条
  - ⚠️ 已知限制：`t()` 不是响应式的，切语言只改本地存的 locale，**已渲染的页面不会重刷**，重启才全量生效。通用设置页切完会给一条提示。真要做到即时生效，得把 `currentLocale` 换成 `ref` 并让 `t()` 读它
  - 不必一次补齐 —— **规则是：每做一个新页面，同批补齐该页面词条**，禁止新增硬编码中文
  - 产出：`i18n/lang-*.uts` 按模块分段，便于对照 `../flutter-chat/chat/lib/l10n/app_zh.arb`
  - 注：M0 的主题替换只动颜色和字号，**不顺手改存量硬编码中文**（保持 diff 可审）。存量词条按上面的规则在各自里程碑里补。
- [x] **通用组件补齐**（对应 flutter `widget/` 的基础件）
  - [x] [option-item](components/option-item/option-item.uvue) ← `widget/option_item.dart`
  - [x] [option-switch-item](components/option-switch-item/option-switch-item.uvue) ← `widget/option_switch_item.dart`
  - [x] [form-card](components/form-card/form-card.uvue) / [section-divider](components/section-divider/section-divider.uvue) ← `widget/form_card.dart`、`section_divider.dart`
  - [x] [bottom-action-sheet](components/bottom-action-sheet/bottom-action-sheet.uvue) ← `widget/bottom_action_sheet.dart`
  - [x] [option-button-item](components/option-button-item/option-button-item.uvue) ← `widget/option_button_item.dart`（M0 漏了，M2 补上）
  - 与 flutter 的三处刻意差异，见各组件头部注释：FormCard 不自动插分隔线（插槽拿不到子节点列表）、OptionSwitchItem 只有开关本身可点、BottomActionSheet 没有上滑入场动画

**M0 出口条件**：随便挑三个现有页面（会话列表、会话页、我的），切深色模式与最大字号，布局不塌、文字不截断。
> 代码侧已全部改造完（三端编译通过），**真机验证待做** —— 尤其是深色模式整体观感，和列表页在复用渲染下的表现。

### M0 的验证手段

改完跑这两条，三端都要过：

```bash
node scripts/check-uvue-css.js                      # 样式子集校验（分平台、分 vapor）
/Applications/HBuilderX.app/Contents/MacOS/cli publish app-android --type appResource --project uni-chat-uts
# 把 app-android 换成 app-harmony / app-ios 各跑一次，约 15~30 秒一轮
# 注意 --project 传的是**工程名**不是路径，写 `--project .` 会报「项目 . 不存在」
```

⚠️ **`publish --type appResource` 只出前端产物，android 端不跑 Kotlin 编译**（20 秒就结束，
日志里没有「编译为 android class」这一步）。下面「android 编译的五条硬规则」那一整类错误
它一条都报不出来。android 的类型检查必须用：

```bash
/Applications/HBuilderX.app/Contents/MacOS/cli launch app-android --project uni-chat-uts --compile true
# 约 75~135 秒一轮，日志里能看到「当前工程 N 个页面，正在编译为 android class」
```

`cli publish` 需要 HBuilderX 在后台运行。**没被任何页面引用的组件不会参与编译**，新组件要么接进页面，要么临时挂一个页面进 pages.json 编一次再摘掉。

**但编译通过 ≠ 跑得对，改完必须真机验证（当前主力测试平台是鸿蒙）。**

### list-view 的坑（会话列表塌掉的教训）

鸿蒙 vapor 下 `list-view` + `list-item` 编译出的**不是普通渲染路径，而是复用（recycle）路径** ——
产物 `unpackage/resources/app-harmony/__UNI__2077CCF/www/assets/pages/.../XxxPage.js` 里能看到
`createRecycleContext()` / `preCreateSharedDataRecycleFor()` / `UniDynamicSharedData(..., sharedDataClassId)`。
节点按 class id 预分配槽位、只推数据，和普通页面的语义不一样。

改这类页面的规矩：

1. **尺寸（height / width）留在 class 里**，只把颜色搬到 `:style`
2. **不要给 `list-item` 本身加动态 `:style`**；置顶态之类用 `:class` 在两个静态类之间切
3. 别把同一个尺寸表达式在模板里写两遍 —— 编译器会合并成同一个对象实例推给多个槽位

`check-uvue-css.js` 和三端编译对这类问题**完全无感**，只有真机能暴露。

### 写组件的两个静默坑（已踩）

1. **组件引用不到全局 class。** 样式隔离 2.0 下页面默认 `styleIsolation: 'app'`（吃得到 global.css），
   **组件默认 `isolated`（吃不到）**。组件里写 `class="icomoon"` 借全局的 `font-family` 是个空类，
   图标字形直接不渲染、不报错。修法：组件内自己声明一遍 `.icomoon { font-family: "icomoon"; }`
   （自包含，比开 `styleIsolation: 'app'` 干净，后者会把 global.css / wfc.css 的通用类名一起放进来）。
   字体本身是 App.uvue 里 `loadFontFace({ global: true })` 加载的，全局可用，**被隔离的只是 CSS 类**。
2. **`text` 带 `overflow: hidden` 必须有确定宽度。** 别写「标题 `flex-shrink: 0` + 一个 `flex: 1` 占位 view」——
   鸿蒙上 `flex-shrink: 0` 兜不住，占位 view 把宽度抢光，两个字的「关于」都会变成省略号。
   正确写法：要截断的文字自己 `flex: 1`，右侧次要值 `flex-shrink: 0`，不要占位 view。

### android 编译的五条硬规则（鸿蒙能过、android 过不去）

鸿蒙走 JS/ArkTS，类型宽松；android 落成 Kotlin，下面三条在鸿蒙上完全无感，只有 android 报错。
**先看清楚：编译器一轮只报 4 条错误就停，改完必须反复编到干净，不能看到「没报」就以为改完了。**

```bash
/Applications/HBuilderX.app/Contents/MacOS/cli launch app-android --project uni-chat-uts --compile true
# 约 75 秒一轮
```

1. **class 类型的 props，模板里取不到成员。** `defineProps<{ message: Message }>()` 编译出来是
   `open var message: Any by $props` —— 类型被抹成 `Any`，模板里 `message.direction` /
   `message._showTime` 一律报「找不到名称 xxx」（error18，其实就是 Kotlin 的 unresolved reference）。
   **数组和基础类型不受影响**（`UTSArray<Message>` / `String` 都保留了类型），所以
   `props.desc as string` 这种是白加的。
   修法：在 script 里 `as` 好类型，用 `computed` 暴露给模板 —— 别在模板里堆 `as`：

   ```uts
   const isOut = computed<boolean>((): boolean => (props.message as Message).direction == 0)
   ```

   script 里同理，`props.message.messageContent` 取不到，要先 `const m = props.message as Message`。
2. **模板里用到的导入函数必须是箭头函数常量。** 模板表达式编译成 `unref(fontPx)(10)`，
   `unref(...)` 要求 `fontPx` 是个**值**；`export function fontPx()` 落成 Kotlin 的 `fun fontPx()`，
   函数名不能当值用，直接报错。所以 `common/layoutScale.uts` 里给模板用的
   `px/fontPx/iconPx/rowPx` 全部写成 `export const x = (...) => {}`；
   只在 script 里调用的（`scale`、`fontClass`）保持 `export function` 没问题。
3. **`Int` 和 `Number` 不通用。** `urls.indexOf(x)` 在 android 上返回 `Int`，
   `let current = urls.indexOf(x)` 之后再 `current = urls.length - 1`（`Number`）就类型不匹配。
   变量显式标 `: number`。同理 `UTSJSONObject.toMap()` 落成 kotlin `Map`，
   `forEach` 只收一个 entry 参数，跨端要遍历动态 key 用静态的 `UTSJSONObject.keys(obj)`。
   **数字比较一律 `==` / `!=`，不要写 `===` / `!==`** —— 后者落成 Kotlin 的引用相等，
   `Number` 和 `Int` 装箱后比的是对象身份，编译器只给 warning，错在运行时（voip 页踩过）。
4. **`<script setup>` 里的 `const` 是顺序执行的 `val`，引用不到后面声明的。** 两个 `computed`
   互相引用时，被引用的那个必须写在前面，报「找不到名称 xxx」。
5. **箭头常量不能递归调自己。** `const load = () => { ... load() ... }` 落成
   `val load = fun(){ ... }`，初始化时自己还不存在。要递归就写成 `function load(): void {}`
   —— 但这样它就不能再出现在模板里了（见第 2 条），两者互斥。

---

### M1 · 「我的」与设置整块

flutter 侧 13 个设置页面。**代码侧已全部完成，三端编译通过，真机验证待做。**

- [x] **「我的」页面重做** `[UI]` — [MePage](pages/me/MePage.uvue) ← `settings/me_tab.dart`
  - 入口结构：头像卡片（含野火号）→ 消息通知 → 收藏、文件 → 账号与安全、隐私、设置
  - 图标沿用 flutter 的 PNG（已拷到 [static/image/setting/](static/image/setting/)），「隐私」用 icomoon 字形配 flutter 同款 `#576B95`
- [x] **通用设置页** `[UI]` — [GeneralSettingsPage](pages/me/GeneralSettingsPage.uvue) ← `settings/general_settings.dart`
  - 含：隐私入口、语言、字体大小、主题、关于、用户协议/隐私政策、举报、退出登录 / 注销账号
- [x] **消息通知设置** `[UI]` — [MessageNotificationSettingsPage](pages/me/MessageNotificationSettingsPage.uvue) ← `settings/message_notification_settings.dart`
  - 五项：接收新消息通知、接收通话通知、显示通知详情、免打扰（带时段文案）、同步草稿
- [x] **隐私设置** `[UI]` — [PrivacySettingsPage](pages/me/PrivacySettingsPage.uvue) ← `settings/privacy_settings_screen.dart`
  - 消息回执 / 在线状态两项受服务端能力控制，不支持时整行不展示（与 flutter 一致）
  - 朋友圈隐私入口依赖 M6，暂缺
- [x] **谁可以找到我** `[UI]` — [PrivacyFindMePage](pages/me/PrivacyFindMePage.uvue)，user setting scope 27 位掩码
- [x] **黑名单列表** `[UI]` — [BlacklistPage](pages/me/BlacklistPage.uvue)
- [x] **账号与安全** `[UI]` — [AccountSafetyPage](pages/me/AccountSafetyPage.uvue) + [ChangePasswordPage](pages/me/ChangePasswordPage.uvue)
- [x] **注销账号** `[API❌→已补]` — [DestroyAccountPage](pages/me/DestroyAccountPage.uvue)，接口补在 [appServerApi.uts](api/appServerApi.uts)
  - flutter 发码前会走滑块验证（`Config.ENABLE_SLIDE_VERIFY`），滑块组件属于 M4，接口已留好 token 参数位
- [x] **字体大小设置页** `[UI]` — [FontSizeSettingsPage](pages/me/FontSizeSettingsPage.uvue)，气泡预览 + 5 档滑块
- [x] **文件记录（我的文件）** `[UI]` — [FileRecordsPage](pages/me/FileRecordsPage.uvue) + [FileListPage](pages/me/FileListPage.uvue)
  - 四个入口齐全；「指定会话」用新加的 [PickConversationPage](pages/pick/PickConversationPage.uvue)（M2/M3 可复用）
  - flutter 的搜索是 AppBar 放大镜 + 全屏 SearchDelegate，这里改成常驻搜索框（与本项目其他列表页一致）
- [x] **收藏** `[API❌→已补]` — [FavoriteListPage](pages/me/FavoriteListPage.uvue) + [favoriteItem.uts](wfc/model/favoriteItem.uts)
  - 四个分类（全部/文件/相册/聊天记录）为客户端过滤，服务端 `/fav/list` 不支持按类型查
  - 只做了转发与删除；**「打开」预览**要接会话页那套渲染器，归 M3。消息长按菜单的「收藏」项本来就在 M3

**M1 出口条件**：flutter 我的页能点进去的每一个页面，uni 侧都有对应且开关生效。
> 代码侧已全部完成（`check-uvue-css` 通过 + 三端 `cli publish` 通过），**真机验证待做**，验证清单见下。

#### M1 真机验证清单（鸿蒙优先）

按依赖顺序走，前面不过后面不用试：

1. **我的页**：头像卡片显示昵称 + 野火号；点头像弹「拍照 / 从相册选择」，两条都能改头像；六个入口都能进
2. **消息通知**：逐个拨动五个开关 → 每次都有「设置成功」；**杀进程重进，开关状态与拨动后一致**（这条最容易出问题：读的是 user setting，写完服务端要回推）
   - 免打扰打开后，副标题应显示 `21:00 - 07:00`
3. **隐私**：三个开关同上；「谁可以找到我」两个开关来回拨，退出重进保持
4. **黑名单**：有黑名单数据时能列出（没有就先在用户详情页拉黑一个），点「移出」→ 确认 → 列表刷新
5. **修改密码**：错误旧密码要有失败提示；成功后自动返回
6. **字体大小**：拖滑块 → 上方三个气泡实时变大变小；返回后**会话列表 / 会话页 / 我的页**的正文跟着变；滑块下面那排档位名**不跟着变大**（跟着变就是写错了）
7. **文件记录**：四个入口分别进；列表能翻页（滚到底继续加载）；搜索框输入后 300ms 出结果；自己发的文件才有删除按钮；点行 → 转发 / 下载
8. **收藏**：四个分类切换；空数据时显示「暂无收藏」而不是白屏
9. **深色模式 + 最大字号**：切到深色 + 最大档，把上面每页再扫一遍，重点看**三个 list-view 页面（黑名单 / 文件列表 / 收藏）行有没有塌成 0 高**

---

### M2 · 会话信息页与群管理

**七个纯 UI 页代码侧已完成，三端编译通过，真机验证待做。** 剩两项按 §4「原生改动攒批做」的原则往后放，见本节末尾。

- [x] **单聊会话信息页重做** `[UI]` — [SingleConversationInfoPage](pages/conversation/SingleConversationInfoPage.uvue) ← `single_conversation_info_screen.dart`
  - 成员网格（对方 + 加号=拉人建群）→ 查找聊天内容 / 会话文件 → 免打扰 / 置顶 → 清空聊天记录
- [x] **群聊会话信息页重做** `[UI]` — [GroupConversationInfoPage](pages/conversation/GroupConversationInfoPage.uvue) ← `group_conversation_info_screen.dart`（634 行，最全的一页）
  - 六个分组：成员网格 → 群成员列表/群名称/群公告/群备注/群管理 → 查找聊天内容/会话文件 → 免打扰/置顶/保存到通讯录 → 我在本群的昵称/显示群成员昵称 → 清空记录/转让群主/解散或退群
  - 群名称、群备注、我在本群的昵称走 `uni.showModal({editable:true})` 就地编辑（三端都支持，鸿蒙 runtime 里是个 textarea，已核实）
- [x] **频道会话信息页** `[UI]` — [ChannelConversationInfoPage](pages/conversation/ChannelConversationInfoPage.uvue) ← `channel_conversation_info_screen.dart`
  - 顺带把 [ConversationPage](pages/conversation/ConversationPage.uvue) 的会话类型分支补上（原来频道会话点进去是「暂不支持」）
- [x] **群管理页** `[UI]` — [GroupManagePage](pages/conversation/GroupManagePage.uvue) ← `group_manage_screen.dart`
  - 管理员设置入口、禁言设置入口、允许临时会话、加群方式、群是否可被搜索；专业版服务端额外两项（群历史消息、群最大成员数），社区版整行不展示
- [x] **管理员设置** `[UI]` — [GroupManagerPage](pages/conversation/GroupManagerPage.uvue) ← `group_manager_screen.dart`
- [x] **禁言设置** `[UI]` — [GroupMutePage](pages/conversation/GroupMutePage.uvue) ← `group_mute_screen.dart`，全员禁言 + 禁言名单 + 白名单
- [x] **群成员列表独立页** `[UI]` — [GroupMemberListPage](pages/conversation/GroupMemberListPage.uvue)
  - flutter 这项其实是空实现（`OptionItem(groupMemberList, onTap: () {})`，网格的「查看更多」也是 `// TODO`），没有可对齐的版式，按本项目通讯录页做：搜索框 + 拼音分组
- [x] **群公告独立页** `[UI]` — [GroupAnnouncementPage](pages/conversation/GroupAnnouncementPage.uvue) ← `group_announcement_screen.dart`

顺带补的公共件（M3~M6 都会复用）：

| 产出 | 说明 |
| --- | --- |
| [member-grid](components/member-grid/member-grid.uvue) | 会话信息页顶部的成员头像网格，5 列 + 展开/收起 + 加号/减号格 |
| [member-row](components/member-row/member-row.uvue) | 管理类页面的成员行（头像 + 名字 + 角色 + 危险操作） |
| [option-button-item](components/option-button-item/option-button-item.uvue) | 居中着色的按钮行 ← `widget/option_button_item.dart`，M0 漏掉的一个 |
| [common/prompt.uts](common/prompt.uts) | `showEditDialog` / `showConfirmDialog` / `showSelectDialog` / `toast*`，替掉各页面各抄一遍 showModal |
| [common/conversationActions.uts](common/conversationActions.uts) | 新增 `searchConversationMessages`、`openConversationFiles`（复用 M1 的 FileListPage） |
| [modifyGroupInfoType.uts](wfc/model/modifyGroupInfoType.uts) | 补上 `Modify_Group_History_Message` / `Modify_Group_Max_Member_Count` |

**本轮刻意没做的三项**（不是漏网）：

- **入群申请审批** `[SDK❌]` —— flutter `group/join_group_request_screen.dart`（410 行）。门面缺 4 个 API（见 §4），三端原生插件要各改一遍再重打包，按「原生改动攒批做」和 M6 的 `sendMomentsRequest`、M4 的 `getDomainInfo` 一起做。
  - ⚠️ **已知副作用**：群管理页的「加群方式」现在可以选到「需管理员验证」，但这一端批不了申请，得去其他端处理。
- ~~**群二维码** `[平台]`~~ —— **M4 已补**：编码器见 [common/qrcode.uts](common/qrcode.uts)，页面见 [GroupQrCodePage](pages/conversation/GroupQrCodePage.uvue)，群信息页的入口也已接上。（当时判断要与「我的二维码」共用能力，后来核对发现 flutter 移动端根本没有「我的二维码」，见 M4 小节的核对表。最终没走 canvas，用 view 游程渲染。）
- **会话链接入口** —— 链接页本来就归 M3，那页落地时再把三个会话信息页的入口一起补上。

#### M2 真机验证清单（鸿蒙优先）

1. **单聊信息页**：点头像进用户详情；点「+」能拉人建群；免打扰/置顶拨完**杀进程重进保持**；「查找聊天内容」搜得到、点结果能跳回并高亮；「会话文件」列得出该会话的文件
2. **群聊信息页**：六个分组都在；成员超过 20 个时底部出现「查看更多群成员」，点开能展开、再点收起
3. **群名称/群备注/我在本群的昵称**：三个编辑弹窗都能预填当前值、改完立刻反映到行右侧（群名称非群主/管理员点了应提示「只有群主或管理员可以修改」）
4. **群公告**：非管理员进去只读、没有编辑按钮；管理员编辑保存后返回上一页，群公告行的 desc 跟着更新（靠 onShow 重拉）
5. **群管理**：加群方式/可被搜索的 actionSheet 选完，行右侧 desc 跟着变；社区版服务端下**不应出现**「新成员可查看历史消息」和「群最大成员数」两行
6. **管理员设置**：群主行没有「移除」；加管理员时已是管理员的应为选中且不可取消；移除要走二次确认
7. **禁言设置**：全员禁言开关；两份名单各自加人/移除都生效（注意两份名单语义相反，见页头注释）
8. **频道信息页**：从频道会话点进来（原来这里是「暂不支持」）；取消订阅后回到会话列表
9. **权限分支**：用非群主、非管理员的普通成员账号把群信息页和群管理页各走一遍 —— 群管理入口应不可见，减号格应不可见
10. **深色模式 + 最大字号**：把上面每页再扫一遍，重点看**成员网格**（5 列 20% 定宽 + 动态行高，最容易在最大档位下把名字挤出格子）

---

### M3 · 会话内检索、文件与消息菜单补齐

**代码侧已全部完成，`check-uvue-css` + 三端 `cli publish` 通过，真机验证待做。**

排期时把这三页当独立页写，落地时改了：flutter 现在**只有会话链接是独立页**，图片视频网格和日历
是「查找聊天内容」面板里的标签（`search/conversation_search_panel.dart`）。所以本轮按 flutter 的真实
形态做——三个内容体都写成组件，链接额外套一层独立页给会话信息页当入口。

- [x] ~~**会话文件**~~ — M2 里直接复用了 M1 的 [FileListPage](pages/me/FileListPage.uvue)（它本来就支持「指定会话」这一档），不再单写一页
- [x] **「查找聊天内容」重做成分类标签面板** `[UI]` — [SearchConversationMessagePage](pages/search/SearchConversationMessagePage.uvue) ← `search/conversation_search_panel.dart`
  - 搜索框 + 五个标签（全部 / 文件 / 图片与视频 / 链接 / 日期）+ 搜索历史（本地存 10 条）
  - 「全部」无关键字时是全量消息浏览（翻页），有关键字走 `searchMessageEx` 的 offset 分页，摘要里命中的词用主题色标出
  - 原来那一版只有一个输入框 + `wfc.searchMessage` 全量返回，没有分页、没有分类
- [x] **会话链接** `[UI]` — [conversation-links](components/conversation-links/conversation-links.uvue) + [ConversationLinksPage](pages/conversation/ConversationLinksPage.uvue) ← `conversation/conversation_links_screen.dart`
  - 入口已补到单聊/群聊会话信息页（「会话文件」下面一行）；频道页 flutter 没有这项，也不放
- [x] **图片视频网格** `[UI]` — [conversation-media-grid](components/conversation-media-grid/conversation-media-grid.uvue) ← `search/conversation_media_grid_screen.dart`
- [x] **按日期查找（日历）** `[UI]` — [conversation-calendar](components/conversation-calendar/conversation-calendar.uvue) ← `search/conversation_calendar_screen.dart`
- [x] **消息长按菜单补齐** — flutter 侧全集：复制、删除、语音转文字、转发、撤回、重新编辑、多选、引用、收藏、举报
  - [x] 语音转文字 `[UI]` — [common/asr.uts](common/asr.uts)，POST `Config.ASR_SERVER`，结果贴在语音气泡下方（[AudioMessageContentViewAMR](pages/conversation/message/content/AudioMessageContentViewAMR.uvue)）
  - [x] 收藏 — [common/favorite.uts](common/favorite.uts)，`FavoriteItem.fromMessage` 的 uts 版 + `/fav/add`
  - [x] 举报 — [common/report.uts](common/report.uts)，把设置页那份实现抽出来两处共用
  - 已有的部分不动：复制/删除/转发/撤回/重新编辑/多选/引用
- [x] **PC 在线横幅** `[UI]` — 会话列表顶部提示 + [PcOnlineDevicesPage](pages/me/PcOnlineDevicesPage.uvue)
  - ⚠️ **从 M4 提前**：横幅点了要有地方去，而「在线设备列表 + 踢下线」本来就不需要新接口（`getPCOnlineInfos` / `kickoffPCClient` 门面早就有）。M4 只剩「扫码登录 PC 确认页」那部分（需补 `/confirm_pc` 等）
- [x] **收藏页「打开」** `[UI]` — M1 留的尾巴，见 [FavoriteListPage](pages/me/FavoriteListPage.uvue) 的 `openItem`

#### 顺带补的公共件

| 产出 | 说明 |
| --- | --- |
| [common/asr.uts](common/asr.uts) | 语音转文字。`uni.request` 没有流式回调，只能等整个 SSE 响应体到齐再解析，所以结果**一次性出现**而不是逐字蹦 |
| [common/favorite.uts](common/favorite.uts) | `favoriteItemFromMessage` / `favoriteMessage`。放 common 不放模型上，是因为构造 origin 要查 wfc，而 `wfc/model/favoriteItem.uts` 刻意不依赖客户端 |
| [common/report.uts](common/report.uts) | 举报确认框 + 跳官方账号单聊，设置页和消息菜单共用 |
| `store.searchMessagePaged` | 会话内关键字搜索的 limit/offset 分页版（原来的 `searchMessage` 一次拿全量） |
| `store.getMessagesInTypesAndTimes` | 按类型 + 时间区间拉消息，链接/媒体/日历三处共用 |
| `store.getMessageCountByDay` | 日历用，返回 `yyyy-MM-dd -> count` |
| `miscState.pcOnlineInfos` + `store.refreshPCOnlineInfos()` | PC 在线状态，`SettingUpdate` 事件里刷新（PC 上下线走的就是 user setting） |

#### 落地时踩到 / 绕开的三个坑

1. **`getMessagesV2` 传不进 contentTypes。** 三端插件都把它写死成空数组，所以按类型取消息一律走
   `searchMessageByTypesAndTimes(conversation, '', types, ...)`（空关键字 = 不限关键字），
   与 android-chat uikit 的 `ConversationLinkRecordViewModel` / `ConversationMediaViewModel` 同一用法。
   顺带确认：**空的 contentTypes 数组 = 不限类型**（`hm-chat` 的 `proto.min.ets` 调 `getMessagesV2` 时就传 `[]`）。
2. **`aspect-ratio` 三端都不支持**（`check-uvue-css.js` 会报），百分比宽撑不出正方形。
   媒体网格的方格边长是 `(windowWidth - padding) / 3` 算出来后走 `:style` 下发的。
3. **icomoon 子集里没有链接/电脑字形。** 字体只收了 `f100`–`f4f7` 这 734 个码位，
   写 `&#xf0c1;`（FontAwesome 的 link）会渲染成豆腐块且不报错。所以链接列表的占位用域名首字母，
   PC 设备页顶部用设备数字。**新加图标前先确认码位在字体里**（可以 dump ttf 的 cmap 表核对）。

#### 时间单位（最容易写错的地方）

| 接口 | 单位 |
| --- | --- |
| `getMessageCountByDay` | **秒** |
| `searchMessageByTypesAndTimes` / `getMessagesInTypesAndTimes` | **毫秒** |

#### 与 flutter 的刻意差异

- **日期标签点某天**：flutter 在面板里内嵌当天消息列表、再点某条才定位；这里直接跳回会话页定位到当天最后一条
  —— 与 flutter **独立日历页**（`ConversationCalendarScreen` 不传 `onDaySelected`）的行为一致，少一层
- **搜索结果点消息**：flutter 先弹一个只有「定位到聊天位置」一项的菜单（PC 微信版式），移动端多这一步没收益，直接定位
- **媒体预览**：flutter 用自绘的 `MMPreviewView`（图片视频混排、捏合缩放、翻到两端继续翻页）；
  这里图片走 `uni.previewImage`、视频走 `PreviewVideoPage`，两者不在同一个滑动序列里。属 §1「接受不同」
- **收藏「打开」**：flutter 对文件/链接只 toast 一行字，这里分别走下载和 WebViewPage；
  合并转发的收藏两边都打不开（`FavoriteItem.buildContent` 没还原 Composite 的 payload）
- **PC 设备页顶部**：flutter 是个 80px 的电脑图标，这里换成设备数字（见上面第 3 个坑）

#### M3 真机验证清单（鸿蒙优先）

1. **查找聊天内容**：从单聊/群聊信息页进；五个标签都能切
   - 「全部」不输关键字应直接列出会话历史（新的在前），滚到底继续加载
   - 输入关键字 300ms 后出结果，**摘要里命中的词是主题色**；滚到底继续加载
   - 回车后关键字进「搜索历史」，点历史词能重新搜；「清空」把历史清掉
   - 点任意一条 → 跳回会话页并高亮那条消息
2. **文件标签**：列得出该会话的文件；点行弹「转发 / 下载」
3. **图片与视频**：三列方格**是正方形**（不是被压扁的长条）；视频右下角有播放角标；
   点图片能左右滑动切换，点视频进视频预览；滚到底继续加载
4. **链接**：有缩略图的显示缩略图，没有的显示**域名首字母**（不是豆腐块方框）；点行进 WebView
5. **日期**：从当月往前铺；**只有有消息的日期是实心可点的**；滚到底再补 3 个月；点某天跳回会话页定位到当天最后一条
6. **会话链接独立页**：单聊/群聊信息页的「会话链接」行能进；频道信息页**不应该有**这一行
7. **语音转文字**：长按语音消息 → 「转文字」；转换中气泡下方显示「转换中...」，成功后显示文字；
   **再长按同一条，菜单里不应再有「转文字」**；`Config.ASR_SERVER` 置空时这一项整体不出现
8. **收藏**：长按消息 → 「收藏」→ 「已收藏」；去「我的 → 收藏」能看到；点它选「打开」——
   图片进预览、视频进播放、链接进 WebView、文本弹全文
9. **举报**：长按消息 → 「举报」→ 确认后进官方账号单聊（与「我的 → 设置 → 举报」同一行为）
10. **PC 在线横幅**：PC/Web 端登录后，会话列表顶部出现「PC 客户端 已登录」+ 右箭头；
    点进去是设备列表，「下线」二次确认后该端掉线、列表刷新；**PC 退出后横幅应自动消失**（靠 SettingUpdate 事件）
11. **深色模式 + 最大字号**：把上面每页再扫一遍，重点看**日历**（7 列定宽 + 32px 圆点，最大档最容易把日期数字挤出圆）和**标签栏**（横向滚动，五个标签要能滑到「日期」）

---

### M4 · 通讯录、用户、登录

**大部分代码侧已完成**（`check-uvue-css` + 三端 `cli publish` 全通过），**真机验证待做**。
剩余两项见本节末尾「本轮没做的」。

排期时对 flutter 的几处判断在落地核对时被推翻了，先记在这里，后面的条目按修正后的范围写：

| 原计划 | 核对结果 |
| --- | --- |
| 「我的二维码」 | **flutter 移动端没有这个功能**。全项目只有两处 `QrImageView`：`conversation/group_qrcode_screen.dart`（群二维码，在范围内）和 `pc/pc_qr_login_screen.dart`（桌面登录页，§1 已排除）。用户详情页也没有二维码入口 —— 所以只做群二维码 |
| 「找回密码」 | **flutter 没有对应页面**。`app_server.dart` 里有 `sendResetCode` / `resetPassword`，但全项目零调用方，移动端登录页只有验证码/密码两种登录。对齐 flutter 就不该做；真要做属于产品新增，不算对齐 |
| 用户详情页的「更多信息」 | flutter 有这一行，但 onTap 是 `showToast(methodNotImpl)`，它自己也没实现。按 §M2「宁可不放入口，也不放一个点了弹『暂未实现』的行」**不放** |
| 「收藏的群」是空白 | **早就有了**：[GroupListPage](pages/contact/GroupListPage.uvue) + [GroupListView](pages/contact/GroupListView.uvue) 读的就是 `wfc.getFavGroupList()`，等价于 flutter 的 `FavGroupsPage`；[ChannelListPage](pages/contact/ChannelListPage.uvue) 同理等价于 `SubscribedChannelsPage`。只是行高/字号还是老版式，这轮没动 |

#### 已完成

- [x] **消息长按菜单形态对齐** `[UI]` — 新增 [popup-menu](components/popup-menu/popup-menu.uvue) ← `widget/popup_menu_overlay.dart`
  - 原来是 chunLei-popups 的深色**竖排纯文字列表**，flutter 是**深色卡片 + 4 列图标网格 + 指向气泡的小三角**，形态完全不同
  - 菜单项顺序按 flutter `buildMessageMenuItems`：删除 → 复制 → 转文字 → 转发 → 撤回 → 多选 → 引用 → 收藏 → 举报；uni 多出的一项（保存）紧跟同类项
  - 「删除」是**一项**不是两项：点了之后再弹 action sheet 选「删除本地消息 / 删除远程消息」，对齐 flutter `_showDeleteOptions`；没有 messageUid 的消息直接删本地
  - **会话列表的长按菜单不动** —— flutter 那边用的是 Material `showMenu`（浅色纯文字），chunLei-popups 已经对得上，两者本来就不是同一个形态
  - `PopupMenuItem` 挪到 [common/popupMenu.uts](common/popupMenu.uts)，两个菜单组件共用
- [x] **选人页对齐** `[UI]` — [PickUserPage](pages/pick/PickUserPage.uvue) ← `contact/pick_user_screen.dart`
  - 确认按钮从底部面板挪到标题栏右上角「完成(n)」；已选的人改成头像内嵌在搜索框左侧（flutter 没有那块底部面板）
  - 补上右侧字母索引条、`maxSelected` 上限、「从组织架构选择」入口
  - 调用方按 flutter 对齐了标题与开关：发起群聊 / 添加群成员（保留组织入口）/ 移除群成员（`showOrganizationEntry: false`）
  - [NavBar](pages/common/NavBar.uvue) 补 `rightText` / `rightTextDisabled` / `interceptBack` ← `widget/app_bar_actions.dart`
- [x] **用户详情页重做** `[UI]` — [UserDetailPage](pages/contact/UserDetailPage.uvue) ← `user_info_widget.dart` 的 `_buildMobileBody`
  - 原来是「备注名/野火ID/地区/标签」四行表格 + 一排底部图标，与 flutter 不是一个版式
  - 现在：头像卡片（含备注行、野火号、星标图标）→ 所在组织 → 设置备注/修改昵称 → 发消息/加好友 + 音视频通话
  - 右上角菜单（加入/移出黑名单、设为/取消星标朋友、删除好友、添加好友）复用 popup-menu，不再引入第二种菜单形态
  - 朋友圈入口依赖 M6，暂缺
- [x] **邀请好友** `[UI]` — [InviteFriendPage](pages/contact/InviteFriendPage.uvue) ← `contact/invite_friend.dart`
  - 原来「添加好友」是拿写死的「你好，我是xxx」直接发出去，没给用户填的机会
- [x] **组织架构补齐** `[UI]` — [OrganizationPage](pages/contact/OrganizationPage.uvue) ← `organization/organization_screen.dart`，取代原 `OrganizationTreePage`
  - 补上：搜索部门成员（300ms 防抖）、下级部门/成员分组、层级内后退（返回键先退一级）、**选人模式**（选人页的组织入口落点）
  - 新增 [api/organizationModel.uts](api/organizationModel.uts) 把 `UTSJSONObject` 取值收成类型化模型，三个调用方共用
  - **顺带修掉两个接口参数 bug**：`getOrgEmployees` 传的是 `ids` 应为 `id`；`searchEmployee` 少传 `count`/`page` 且返回体是 `{contents:[...]}` 没解包 —— 两者都会让接口静默返回空
- [x] **二维码生成** `[平台]` — [common/qrcode.uts](common/qrcode.uts) + [qr-code](components/qr-code/qr-code.uvue) + [GroupQrCodePage](pages/conversation/GroupQrCodePage.uvue)
  - 群信息页补上「群二维码」这一行（M2 欠的那项）
- [x] **扫码结果分支补齐** `[UI]` — [main-action-menu](components/main-action-menu/main-action-menu.uvue) ← `home.dart _handleQrCode`
  - 原来只认用户二维码，现在补齐 群 / 频道 / PC 扫码登录 / 会议（会议属 M7，如实提示不支持）
  - `WfcScheme` 补 `buildGroupLink` / `parse` / `queryParam`
- [x] **扫码后的三个落地页**（不补的话扫码分支就是死链）
  - [PcLoginConfirmPage](pages/me/PcLoginConfirmPage.uvue) ← `pc/pc_login_screen.dart`（文件在 `pc/` 下但**是手机上的页面**，属对齐范围）；`appServerApi` 补 `/scan_pc/{token}`、`/confirm_pc`、`/cancel_pc`
  - [GroupInfoPage](pages/conversation/GroupInfoPage.uvue) ← `group/group_info_screen.dart`，扫群码后的加群预览页
  - [ChannelDetailPage](pages/contact/ChannelDetailPage.uvue) ← `channel/channel_info_widget.dart`，频道详情 + 订阅/取消订阅
- [x] **通话入口抽公共** — [common/avcall.uts](common/avcall.uts) ← `call/av_call_launcher.dart`，会话页和用户详情页共用
- [x] **登录页补齐** `[API❌→已补]` — [LoginPage](pages/login/LoginPage.uvue) ← `login_screen.dart` + `login/login_form_controller.dart`
  - 原来只有「手机号 + 验证码」两个下划线输入框，现在：标题随模式变（密码登录 / 手机号登录）、
    密码登录与验证码登录切换、发码 60s 倒计时、用户协议/隐私政策勾选（两个链接分别可点，走 WebViewPage）、滑块验证
  - 新增 [slide-verify-dialog](components/slide-verify-dialog/slide-verify-dialog.uvue) ← `widget/slide_verify_dialog.dart`
  - `appServerApi` 补 `/slide_verify/generate`、`/slide_verify/verify`，并给 `/send_code`、`/login`、`/login_pwd`
    加上可选的 `slideVerifyToken`（服务端 `forceSlideVerify` 开着时是必填）
  - 滑块什么时候弹、登录请求带不带 token，逐条对齐 flutter，见 LoginPage 文件头注释
  - **找回密码不做**，理由见本节开头的核对表
  - 与 flutter 的差异：协议那行用并列 `<text>` + `flex-wrap` 而不是 RichText（嵌套 text 的子节点点不了）；
    回弹没有缓动动画（uni 只有 transition 没有 animation）；重发按钮显示的是**剩余**秒数而不是 flutter 的已过秒数
- [x] **消息转发页对齐** `[UI]` — [ForwardMessagePage](pages/conversation/message/forward/ForwardMessagePage.uvue) ← `conversation/forward/pick_forward_page.dart`
  - 原来是「选会话 / 创建会话」两个整页视图，各自底部常驻一块「已选 + 预览 + 留言 + 发送」面板，且**恒为多选**
  - 现在按 flutter：标题栏可切**单选/多选**（标题跟着变「选择一个聊天 / 选择多个聊天」）；单选点一行直接弹确认框，多选在底栏点「发送(n)」再弹；已选目标以头像内嵌在搜索框左侧
  - 新增 [ForwardTargetListView](pages/conversation/message/forward/ForwardTargetListView.uvue) ← `forward/widgets/forward_target_list.dart`：「创建群聊」入口 + 「最近聊天」；**搜索按 flutter 的 searchTypes 只搜好友和群**（不搜全网用户，否则陌生人会混进转发目标），结果分「好友 / 群组」两段
  - 新增 [ForwardConfirmationSheet](pages/conversation/message/forward/ForwardConfirmationSheet.uvue) ← `conversation/forward_confirmation_sheet.dart`：发送给 + 内容预览（图片/视频带缩略图，视频叠播放角标）+ 留言 + 取消/发送
  - 「创建群聊」改成 flutter 的语义：**选人 → 建群 → 回本页用新群弹确认框**（微信的做法），只选一个人时不建群、直接转到单聊；群名按「创建者,成员1,成员2…」拼接，超 24 字收尾成「xxx等」
  - 与 flutter 的三处刻意差异（各文件头部有注释）：建群选人复用已有的 [PickUserPage](pages/pick/PickUserPage.uvue) 而不是在本页原地换界面；预览文字限高裁切而不是 3 行省略号（`lines` 鸿蒙 vapor 无效）；确认框的键盘避让自己接管（`adjust-position=false` + 等高 padding）
  - 删除：`ForwardMessageByPickConversationView` / `ForwardMessageByCreateConversationView` / `ForwardMessageView` 三个旧视图，以及只服务于它们的 `store.forwardByCreateConversation`

#### 本轮没做的

- [ ] **创建频道 / 搜索频道** `[UI]` — `channel/search_channel.dart`，SDK 的 `createChannel` / `searchChannel` 都有。频道详情页已落地，这两个是它的上游入口
- [ ] **外部域 / 互联互通** `[SDK❌ getDomainInfo]` — 仍按「原生改动攒批做」的原则，和 M2 的入群申请审批、M6 的 `sendMomentsRequest` 一起做
- [ ] 收藏的群 / 订阅的频道两页的**行版式**（56px 行高 + 40px 头像 + 16px 标题）还是老样式，功能等价但不够贴 flutter

#### 二维码是怎么验证的（这块没法靠肉眼看）

项目里没有二维码能力，编码器是新写的约 500 行位运算，写错了不会报错、只会生成一张扫不出来的图。
所以落地前先在 JS 里写了同一套逻辑做对拍，三层验证：

1. **Reed-Solomon 纠错码**：用 ISO/IEC 18004 附录 I 的标准例子（1-M）逐字节比对，完全一致
   （顺带发现临时写来交叉验证的那份 Python 实现才是错的，标准向量把它挡下来了）
2. **UTS 版与验证过的 JS 原型逐位一致**：242 条样本（含中文、emoji）矩阵完全相同 —— 保证转写没走样
3. **端到端解码**：渲染成图后用 OpenCV 解码，240 条真实业务 payload 成功 237 条；
   同一批 payload 用 segno（成熟参考实现）编码再解码是 238 条 —— **两者统计上没有差别**，
   剩下的失败是识别器本身在该尺寸上的抖动，不是编码错误

> 副产品结论：**纠错级别用 M 而不是 flutter 的 L**。实测 L 档在识别器上明显更容易失败（我的实现和 segno
> 都会掉 3~4 成），M 档两者都稳定在 99%。二维码是满屏展示的，尺寸不紧张，多点冗余换识别率划算。

**以上都是桌面端对拍，真机上还要用系统相机/各端扫码库实际扫一次。**

#### 与 flutter 的刻意差异

- **长按菜单锚点是触点不是气泡矩形**：flutter 传气泡的全局 Rect，vapor 下本项目没有用过 element API、
  拿不到节点矩形，所以传 longpress 的触点。效果是三角指向手指而不是气泡中心，更贴手
- **字母索引条只支持点击，不支持按住滑动**：flutter `SidebarIndex` 按住时屏幕中央有大字母气泡，
  uni 侧索引条是一排独立 view，拿不到「手指滑过第几个」而不引入手势换算
- **组织架构没有缓存层**：flutter 有跨页的 `OrganizationCache`，移动端一次只看一个部门，
  进出重拉一次的代价小于维护缓存一致性
- **二维码用 view 画不用 canvas**：canvas 要拿 `getContext('2d')` 就得走 element API，
  本项目是 vapor 模式且全项目没有先例；按行做游程合并后节点数从 1089（v4 逐模块）降到两三百
- **单选仍是独立页**：flutter 的 `maxSelected == 1` 复用同一个选人页，uni 侧 `PickSingleUserPage` 一直是独立的，保持不动

#### 落地时踩到的三个坑

1. **`defineOptions({...})` 里最后一个属性后面不能留注释。** Android 端的 SFC 转换会把尾随注释甩到对象
   字面量外面，生成 `}\n// 注释\n, props, {` 这种残缺代码，报
   `Unexpected token ':' ... for the computed key`，而且**报的是编译产物的行号**，很难定位。
   鸿蒙（vapor）那条编译路径完全不受影响 —— 只编鸿蒙会漏掉这个错。
2. **`check-uvue-css.js` 查不出非法选择器。** 它只校验属性名，`.org-row .row-title` 这种**后代选择器**
   （uni-app x 不支持）它一声不吭，只有 `cli publish` 会报 `Invalid selector`。
   要截断的文字自己 `flex: 1`，不要靠后代选择器补样式。
3. **`cli publish --project` 传的是工程名不是路径。** §M0 那条命令里写的 `--project .` 实际会报
   「项目 . 不存在，请先导入」，要写 `--project uni-chat-uts`。

#### M4 真机验证清单（鸿蒙优先）

1. **消息长按菜单**：长按任意消息 → 深色卡片 + 4 列图标网格，三角指向手指；靠近屏幕顶部的消息菜单应翻到下方；
   点空白关闭、点菜单项执行；**图标不能是豆腐块方框**（码位没收进字体就会这样）
2. **选人页**：从「+ → 发起群聊」进 —— 标题「发起群聊」，右上角「确定(n)」随选中数变化；
   已选的人以头像出现在搜索框左侧，点头像可取消；右侧字母索引条点某字母能跳到该段；
   配了组织服务时顶部有「从组织架构选择」，进去选完人回来能并进已选
3. **添加/移除群成员**：群信息页 → 添加成员，已在群里的显示为勾选且点不动；移除成员页**不应有**组织架构入口
4. **组织架构**：通讯录 → 组织 → 逐级进部门，面包屑跟着变、点上级能回上级；
   **在下级部门时按返回键是退一级而不是关页面**，退到根部门再按才关；搜索框输入 300ms 后出成员
5. **用户详情**：头像/昵称/备注行/野火号；右上角菜单四项都生效（拉黑、星标、删好友、加好友）；
   点「添加好友」进邀请页填理由后能发出去；星标后名字右边出现黄色星
6. **群二维码**：群信息页 → 群二维码 → **用另一台手机的微信/系统相机扫，能识别出 `wildfirechat://group/...`**；
   深色模式下二维码区域仍是白底黑码
7. **扫码分支**：分别扫 用户码 / 群码 / 频道码 / PC 登录码，各自进对应页面；
   扫群码进的是「加入群聊」预览页（不是会话信息页），点加入能进群
8. **PC 扫码登录**：PC 端打开登录二维码 → 手机扫 → 确认页显示电脑图标 → 点「登录」PC 端登录成功；
   点「取消登录」PC 端应回到未登录态
9. **频道详情**：从频道列表或扫码进入，订阅/取消订阅切换正常，已订阅时才有「进入会话」
10. **登录页**（退出登录后进；需要 app server 打开 `slide_verify` 相关接口）：
    - 不勾协议直接点登录 → 提示「请先同意用户协议和隐私政策」；点「用户协议」「隐私政策」各自打开对应网页，
      **点这两个词以外的地方不应跳网页**
    - 手机号不满 11 位时「发送验证码」和「登录」都是灰的、点不动，也不该有按下态
    - `Config.ENABLE_SLIDE_VERIFY = true` 时点发验证码 → 弹「安全验证」：缺口图 + 底部轨道；
      拖滑块时**图上的白色拼图块跟着一起走**（两者位移必须一致，不一致说明轨道宽和图宽没对齐）；
      拖到缺口处抬手 → 滑块变绿 + 「验证成功」→ 半秒后关窗并真的收到短信；
      故意拖歪 → 「验证失败，请重试」，回弹后 1 秒自动换一张新图
    - 验证码登录：发码通过滑块后再点登录**不应再弹一次滑块**；登录失败后再点登录**应该重新弹**
    - 密码登录：点底部「密码登录」切过去 —— 标题变「密码登录」、输入框变密码掩码、
      「发送验证码」按钮消失、倒计时被取消；每次点登录都弹滑块
    - 倒计时：发码成功后按钮显示「60 s」并每秒减一，到 0 恢复「发送验证码」；
      **倒计时期间切到密码登录再切回来，按钮应已复位**
    - `Config.ENABLE_SLIDE_VERIFY = false` 时全程不弹滑块，发码/登录都能直接走通
11. **深色模式 + 最大字号**：把上面每页再扫一遍，重点看**长按菜单的 4 列格子**（最大档最容易把文字挤出格）、
    **选人页搜索框**（已选头像 + 输入框同处一行，头像多了会不会把输入框挤没）
    和**登录页的协议那行**（最大档下「我已阅读并同意 用户协议 和 隐私政策」要能折行而不是被裁掉）

---

### M5 · 扩展业务：投票、接龙、网盘

这三个都是**纯 HTTP 服务 + 消息类型**，不碰原生，性价比高。

- [x] **投票** `[API❌ POLL_SERVER→已补]` — **代码侧完成**（`check-uvue-css` + 三端 `cli publish` 通过），**真机验证待做**
  - flutter 参考：`poll/`（8 个文件，2.2k 行），接口 `/api/polls`、`/api/polls/my`
  - 产出：
    - [config.uts](config.uts) 补 `POLL_SERVER`；置空则扩展面板不显示入口、消息气泡也不可点（与 flutter 的 `PollService.isAvailable` 同义）
    - [api/authCodeApiClient.uts](api/authCodeApiClient.uts) ← `utils/auth_code_api_client.dart` —— **接龙和网盘直接复用这个**，三家都是 authCode 鉴权 + `{code,message,data}` 响应
    - [api/pollModel.uts](api/pollModel.uts) / [api/pollServerApi.uts](api/pollServerApi.uts) ← `poll_model.dart` / `poll_service.dart`
    - [wfc/messages/pollMessageContent.uts](wfc/messages/pollMessageContent.uts)（消息类型 18）+ [messageConfig.uts](wfc/client/messageConfig.uts) 注册
    - [PollHomePage](pages/poll/PollHomePage.uvue) / [CreatePollPage](pages/poll/CreatePollPage.uvue) / [PollListPage](pages/poll/PollListPage.uvue) / [PollDetailPage](pages/poll/PollDetailPage.uvue)
    - [PollMessageContentView](pages/conversation/message/content/PollMessageContentView.uvue) ← `poll_cell_builder.dart`
    - 输入框扩展面板入口（[MessageInputView](pages/conversation/MessageInputView.uvue)）：**群会话 + 配了服务地址**才出现，与 `plugin_board.dart` 一致
    - [components/form-text-row](components/form-text-row/form-text-row.uvue) ← `widget/form_card.dart` 的 `FormTextRow`，接龙的创建页会复用
    - i18n 三语各 69 条
  - **创建投票后客户端不发消息** —— 投票服务端会自己往群里投那条 type=18 的消息，所以创建页只 `POST /api/polls` 然后返回
  - 顺带修掉的存量问题：扩展面板的图标字形原来没写 `color`，深色模式下是黑字压深色底板（flutter 那边是 `iconSecondary`）
- [ ] **接龙** `[API❌ COLLECTION_SERVER]`
  - flutter 参考：`collection/`（6 个文件，1.1k 行），接口 `/api/collections`
  - 含：创建接龙、接龙详情、`collection_cell_builder` 消息气泡、扩展面板入口
- [ ] **网盘** `[API❌ PAN_SERVER]`
  - flutter 参考：`pan/pan_home_screen.dart`（1060 行）+ `pan_service.dart`（755 行）
  - 认证走 `getAuthCode`（uni 门面已有），含空间列表、目录浏览、上传下载、大文件预签名上传
  - 入口在发现页
- [ ] **发现页补齐** `[UI]` — 对照 `discovery/discovery_tab.dart`：朋友圈、聊天室、机器人、**会议**、开发文档、**云盘**（uni 侧现有：聊天室、机器人、频道、开发手册）

#### 投票 · 与 flutter 的刻意差异

- **截止时间是一个三列 picker，不是「日期弹窗 → 时间弹窗」两步**：uni-app x 的 `<picker>` 只能由
  点击拉起，没法在前一个关闭后程序化拉起下一个。合成一个（日期 / 时 / 分）的 `multiSelector`，
  日期列第一项「不设置」用来清掉截止时间 —— flutter 那边选过之后反而清不掉
- **「我的投票」删除是长按，不是左滑**：flutter 移动端用 `Dismissible`，uni 侧自己接管 touchmove
  会和 scroll-view 的纵向滚动打架。删除还有第二条路：创建者进详情页（管理模式）底部就有「删除投票」
- **不放「转发投票」入口**：flutter 的 `_forwardPoll` 只 toast「开发中」，按 §M2 的规矩
  （宁可不放入口，也不放点了弹「暂未实现」的行）整个入口不出现
- **导出明细走 `uni.openDocument`**：flutter 缺 share_plus，只把 CSV 落到临时目录再 toast 路径；
  这里写完 CSV 后交给系统应用打开（用户可另存/分享），打不开时才退回 toast 路径 ——
  与 [common/mediaSaver.uts](common/mediaSaver.uts) 保存文件的做法一致
- **投票类型 / 最多选几项用 actionSheet**：没有 flutter `showFormOptionPicker` 的「当前项打勾」，
  当前值已经显示在行右侧的 desc 上，信息不缺
- **气泡标题单行截断**：flutter 是 2 行省略号，`lines` 在鸿蒙 vapor 无效（见 §M4），只能 nowrap
- **不带投票结果消息（类型 19）**：flutter 的 imclient 注册了 `PollResultMessageContent`，但它自己
  也没有对应的 cell_builder，渲染不出来。对齐 flutter 就不该做

#### 投票 · 真机验证清单（鸿蒙优先）

前置：`Config.POLL_SERVER` 指向可用的投票服务，且当前账号在某个群里。

1. **入口可见性**：群会话 → 输入框「+」→ 面板里有「群投票」，图标是柱状图**不是豆腐块方框**；
   **单聊的面板里不应该有这一项**；把 `POLL_SERVER` 置空重编，群里也不应该有
2. **发起投票**：进「群投票 → 发起投票」，标题为空时右上角「发布」是灰的、点不动；
   填了标题但某个选项为空，仍然点不动；两项都填齐才变蓝
3. **选项增删**：默认两个选项，「添加选项」最多加到 10 个（第 11 次给提示）；
   选项超过 2 个时每行右边出现减号，减到 2 个后减号消失
4. **投票类型**：切到「多选」后下面**多出一行「最多选几项」**，可选值是 2~选项总数；
   切回「单选」这一行消失；删选项删到比 maxSelect 少时，maxSelect 应自动跟着降
5. **截止时间**：点这一行弹三列 picker（日期 / 时 / 分）—— **确认这一下能弹出来**
   （行是 option-item 包在 picker 里，靠点击冒泡触发）；选完行右侧显示 `MM/DD HH:mm`；
   再点进去选日期列的「不设置」，行右侧回到「无截止时间」
6. **发布**：点「发布」→「投票创建成功」→ 回到群会话，**群里出现一条投票消息气泡**
   （消息是服务端发的，可能有一两秒延迟）
7. **气泡**：标题 + 描述 + 「0票 · 进行中 · 还剩 N 天」+ 分隔线 + 「参与投票」；
   深色模式下发送气泡是实心蓝，气泡内所有文字都还读得出来
8. **投票**：点气泡进详情 —— 单选是圆形勾选框、多选是方形；多选勾到上限时再点给提示，
   标题栏变成「已选 2/3」；点「提交投票」→「投票成功」→ 页面刷新出票数条，
   自己投的那项是主色、其余是灰色；**返回会话，气泡上的票数跟着变了**（靠回写本地消息）
9. **重复投票**：已投票后再进详情，勾选框消失、自己投的那项左边是实心对勾，底部没有「提交投票」
10. **我的投票**：「群投票 → 我的投票」列出自己发起的；下拉能刷新；空数据显示柱状图占位而不是白屏
11. **管理模式**：从「我的投票」点进自己发起的投票 —— **没有勾选框**，底部是「导出明细」+「结束投票」；
    点「结束投票」二次确认后状态变「已结束」，底部主按钮变成红色的「删除投票」
12. **导出明细**：实名投票才有这个按钮（把投票建成匿名的再验一遍，**匿名时不应出现**）；
    点了能唤起系统应用打开 CSV，打不开时应 toast 出文件路径而不是静默失败
13. **删除**：详情页删除后返回列表，该条消失；列表页**长按**某条也能删（二次确认）
14. **服务不可用**：把 `POLL_SERVER` 指到一个不通的地址，各页面应给出提示而不是空白卡住
15. **深色模式 + 最大字号**：把上面每页再扫一遍，重点看**详情页的选项行**
    （勾选框 + 选项文字 + 「N票 · NN%」挤在一行，最大档最容易把百分比顶出去）
    和**创建页的选项行**（输入框 + 减号同行）

---

### M6 · 朋友圈

**成本比看上去低。** flutter 的 `moment/` 是**纯 Dart 实现**（`momentclient.dart:100` 注释明确说明），底层只通过一个通道 API `Imclient.sendMomentsRequest(path, data, cb)` 收发。所以 uni 侧只要门面补这一个方法，业务全部可以用 uts 写。

**代码侧已全部完成，`check-uvue-css` + 三端编译通过，真机验证待做。**
⚠️ **只有鸿蒙端能真跑** —— android / iOS 的原生插件还没导出 `sendMomentsRequest`，见下面第一项。

- [x] **门面补 `sendMomentsRequest`** `[SDK❌→鸿蒙已通]`
  - 鸿蒙：`harmony-configs/libs/marswrapper.har` **换成了 `../hongmeng_sdk` 里 8/6 那次构建的产物**
    —— 项目里原来那份的 `libmarswrapper.so` 是 5/29 编的，NAPI 导出表里**根本没有 `sendMomentsRequest`**
    （har 里没有 `.d.ets`，缺方法编译期无感，只会在运行时报 undefined）。
    新 har 是**纯增量**：项目实际调用的 166 个 `clientModule.*` 方法一个不少，另外还补上了
    `getDomainInfo` / `getFirstUnreadMessageId` / `getGroupMemberIds` / `isGlobalSlient` /
    `setJoinGroupRequestUpdateCallback` 等（正好覆盖 §4 里还欠的几项，后面做那些不用再换 har）
  - android / iOS：`ClientModule`（aar / xcframework）里都还没有这个方法，
    插件里先按 `ErrorCode.kEcServerNotImplement`（254）返回，SDK 更新后把 TODO 注释里那行换上即可
  - 顺带把 `getMessagesEx2V2` 三端都导出了（朋友圈消息落在 line=1 的单聊会话里，跨会话取只能走它）
    —— 这个方法三端 `ClientModule` 本来就有，只是插件没导出
- [x] **朋友圈客户端层** — [wfc/moment/momentClient.uts](wfc/moment/momentClient.uts) ← `momentclient.dart`（814 行）
  - 模型拆到 [momentModel.uts](wfc/moment/momentModel.uts)（Feed / Comment / FeedEntry / MomentProfiles + 四个枚举）
  - 消息类型 501/502：[momentFeedMessageContent.uts](wfc/moment/momentFeedMessageContent.uts) /
    [momentCommentMessageContent.uts](wfc/moment/momentCommentMessageContent.uts)，已在 `messageConfig.uts` 注册
  - **路径与报文键是对着 android `momentclient-release.aar` 反编译核对的**（按 §七 的规矩，
    消息层不以 flutter 为准）：501 的键 `feedId`/`t`/`s`/`c`/`ms`/`to`/`ex`/`e`，
    媒体是 `m`/`t`/`w`/`h`；接口路径 `/moments/{feed,comment,profiles}/*` + `/moments_pb/feed/pull{,_one}` —— 与 flutter 一致
- [x] **信息流页** — [MomentFeedListPage](pages/moment/MomentFeedListPage.uvue) ← `feed_list_page.dart`
  - 一页两用：不带参数是朋友圈首页（封面 + 头像 + 未读条 + 发布入口），带 `userId` 是某人的朋友圈
  - 单条渲染抽成 [moment-feed-item](components/moment-feed-item/moment-feed-item.uvue)
    ← `feed_item_widget.dart` + `comment_widget.dart` + `nine_grid_view.dart`（详情页复用）
- [x] **发布页** — [PublishFeedPage](pages/moment/PublishFeedPage.uvue) ← `publish_feed_page.dart`
- [x] **详情页 / 消息列表 / 可见范围** — [FeedDetailPage](pages/moment/FeedDetailPage.uvue) /
  [MomentMessagesPage](pages/moment/MomentMessagesPage.uvue) / [VisibleScopePage](pages/moment/VisibleScopePage.uvue)
- [x] **朋友圈隐私设置** — [MomentPrivacySettingsPage](pages/me/MomentPrivacySettingsPage.uvue) +
  [MomentBlockListPage](pages/me/MomentBlockListPage.uvue) ← `settings/moment_privacy_settings_screen.dart`
- [x] **入口** — 发现页（带未读红点，`Config.ENABLE_MOMENTS` 控制）+ 用户详情页 + 隐私设置页
- [x] i18n 三语各 55 条

#### 顺带补的公共件

| 产出 | 说明 |
| --- | --- |
| [pages/moment/momentUi.uts](pages/moment/momentUi.uts) | 时间格式化、媒体上传（含缩略图）、视频判定、默认可见范围存取 —— 合并了 flutter `moment_time.dart` / `moment_upload.dart` / `moment_media_picker.dart` / `moment_permission.dart` |
| [publishState.uts](pages/moment/publishState.uts) / [visibleScopeState.uts](pages/moment/visibleScopeState.uts) / [momentBlockListState.uts](pages/me/momentBlockListState.uts) | 跨页传参/回传，沿用 `common/picker.uts` 那套模块级暂存（本项目没有用过 eventChannel） |
| `wfc.getMessagesByStatusEx` | 按会话类型 + line + 消息状态跨会话取消息（原生的 `getMessagesEx2V2`） |
| `Config.ENABLE_MOMENTS` | 对齐 flutter 的同名开关，关掉时两个入口都不出现 |

#### 与 flutter 的刻意差异

- **上传用 `MessageContentMediaType.Moments`(8) 而不是 Image/Video** —— 与 android `momentclient` 一致
  （它取的就是 `MessageContentMediaType.MOMENTS`）；flutter 传的是 IMAGE/VIDEO，会落到别的桶
- **缩略图用 `uni.compressImage` 生成**，不是 flutter 那套自己解码再编 PNG；
  取不到图片信息或压缩失败**不阻断发布**，退化成只有原图
- **评论输入用 `showModal({editable:true})`**，不是 flutter 的底部输入面板 —— 少一个组件，
  键盘避让交给系统（会话页那套手动避让是因为输入框常驻，这里是一次性弹窗）
- **「··」菜单复用 [popup-menu](components/popup-menu/popup-menu.uvue)**（2 列图标网格），不另写一种弹出形态
- **清未读用「列出 line=1 的会话再逐个清」**，不是 flutter 的 `clearConversationsUnreadStatus(types, lines)`
  —— 那个方法只有鸿蒙原生有，android/iOS 的 `ClientModule` 没导出；换成现成接口，不再欠一笔原生债
- **点赞人/评论用嵌套 `<text>` 混排**，不是 Wrap（uni-app x 没有）。代价是点赞人名字不能单独点击
- **「允许朋友查看的范围」用 actionSheet**，不是独立一页
- **发布时的默认可见范围入口放在朋友圈隐私设置页** —— flutter 把 `MomentPermission.openSettingsPage`
  放在 PC 端的账号与安全里，移动端根本没入口，但发布页又要读它
- **不做「长按发布按钮直接发纯文字」**：uni 侧同一节点上 `@longpress` 后仍会补一次 `@tap`，行为不稳

#### M6 真机验证清单（鸿蒙优先）

前置：**用装了新 `marswrapper.har` 的鸿蒙包**（android/iOS 上所有朋友圈操作都会提示失败 254，属预期）；
服务端要开朋友圈服务。

1. **入口**：发现页第一行是「朋友圈」；有人评论/点赞后回到发现页，行右侧出现未读数；
   `Config.ENABLE_MOMENTS` 置 false 重编，发现页和用户详情页都**不应有**这一行
2. **首页**：封面顶到状态栏之下，标题栏压在封面上是**白字**；往下滚，标题栏渐变成不透明、字变深色；
   自己的头像+昵称压在封面右下角
3. **发布纯文字**：右上角相机图标 → 「发表文字」→ 填字 →「发表」→ 返回后列表第一条就是它
4. **发布图片**：右上角 →「从相册选择」→ 选 3~9 张 → 发布页能看到九宫格 + 右上角 × 删单张 +
   「+」继续加（最多 9 张）→「发表」→ 上传进度是「上传中(2/5)」这种 → 列表里九宫格**是正方形**
5. **单图**：只发一张图，气泡里那张图**按原图比例**显示（不是正方形，也不是被拉伸的）
6. **视频**：发一个视频（相册里选到 .mp4），九宫格上有播放角标，点开进视频预览页
7. **点赞/评论**：点「··」→ 深色两列菜单（赞 / 评论），**图标不能是豆腐块方框**；
   点赞后灰底区出现「❤ 你」；再点「··」第一项变「取消」；
   评论弹输入框，发出去后灰底区出现「你：xxx」
8. **回复与删除评论**：点别人的评论 → 直接弹回复输入框；点自己的评论 / 长按任意评论 →
   actionSheet（复制 / 回复 /（自己的才有）删除）
9. **删除朋友圈**：自己发的那条时间右边有红色「删除」→ 二次确认 → 列表里消失
10. **翻页**：滚到底继续加载；一条都没有时显示「暂无朋友圈」而不是白屏
11. **消息列表**：有未读时首页出现「您有 N 条未读消息」条 → 点进去；
    每行是 头像 + 名字 + 「赞了你的朋友圈」/评论正文 + 时间 + 右侧 56×56 缩略（有图显示图，没图显示正文）；
    **进过一次后回首页，未读条应消失**；点某行进详情页
12. **@提醒**：A 发朋友圈时「提醒谁看」选 B，B 的消息列表里应出现「在评论中提到了你」
13. **可见范围**：发布页「谁可以看」→ 四项都能选，选「部分可见/不给谁看」会拉起选人页；
    选完行右侧显示「部分可见(3)」；用不在范围里的账号看，**看不到这条**
14. **个人朋友圈**：用户详情页 →「朋友圈」→ 只有那个人的动态，标题是他的名字，**没有封面和发布入口**
15. **隐私设置**：我的 → 隐私 → 朋友圈 —— 五项都在；
    「不看他(她)」/「不让他(她)看」加人、移除都生效（注意两份名单语义相反）；
    「允许陌生人查看十条朋友圈」拨完**杀进程重进保持**；
    「允许朋友查看朋友圈的范围」选完行右侧 desc 跟着变
16. **服务不可用**：把服务端朋友圈服务停掉，各页面应给出「加载失败(N)」而不是白屏卡住
17. **深色模式 + 最大字号**：把上面每页再扫一遍，重点看**九宫格**（定宽方格 + 动态字号）
    和**灰底评论区**（多条评论 + 长名字最容易撑破）

---

### M7 · 音视频会议

**风险最高的一块**，因为要动原生。

- [ ] **可行性验证（先做这一步再排期）** `[AV❌]`
  - 现状：[wfc-av-client](uni_modules/wfc-av-client/utssdk/app-android/index.uts) 导出 28 个方法，**全是单人/多人通话，一个会议 API 都没有**
  - flutter 侧会议依赖 `avenginekit` 的 conference 能力 + `/conference/*` 系列 app server 接口
  - 需要确认：三端原生 avenginekit 是否都提供会议 API、har/framework 是否需要重打（鸿蒙侧参考已有经验）
- [ ] **会议 app server 接口** `[API❌]` — `/conference/get_my_id`、`/create`、`/info`、`/put_info`、`/fav_conferences`
- [ ] **会议页面**（17 个文件，约 4.8k 行）
  - 会议首页/创建/预约/加入：`call/conference/conference_home_screen.dart` 等
  - 会中：`conference_call_screen.dart`（1201 行）、网格/演讲者/焦点三种布局、参会者列表、举手、申请开麦（音频/视频两个列表）、屏幕共享控制

---

### Backlog · 备份与恢复（**最低优先级**）

按你的要求放到最后。flutter 侧 `backup/` 共 12 个文件 4.2k 行，其中 5 个是 PC 备份/恢复（已排除，见 §1）。

- [ ] 备份与恢复主页 — `backup/backup_and_restore_screen.dart`
- [ ] 备份目标选择 — `backup/backup_destination_screen.dart`
- [ ] 备份/恢复管理器 — `backup/backup_manager.dart`（1080 行）+ `backup_models.dart`
- [ ] 需先评估：uni-app x 的文件系统 API 能否支撑本地库文件的打包/校验/写出

---

## 四、SDK / API 缺口台账

**原则：原生侧改动攒批做。** 每次改 `uni_modules/*` 都要三端各改一遍 + 重新打包验证，尽量一次做完。

### 需要改原生插件（`uni_modules/wfc-client`，三端）

| API | 用于 | 优先级 |
| --- | --- | --- |
| `getJoinGroupRequests` / `handleJoinGroupRequest` / `clearJoinGroupRequest` / `clearJoinGroupRequestUnread` | M2 入群申请审批 + 会话页提示条 | 高 |
| ~~`sendMomentsRequest(path, data, cb)`~~ | M6 朋友圈全部功能。**鸿蒙已通**（换了 marswrapper.har，见 M6）；android / iOS 的 `ClientModule` 还没导出，插件里先返回 254 | 高（只剩两端） |
| ~~`getMessagesEx2V2`~~ | 跨会话按状态取消息（M6 朋友圈消息列表）。三端 `ClientModule` 本来就有，M6 已把插件导出补上 | 已完成 |
| `getDomainInfo` | M4 外部域。**鸿蒙侧新 har 已经有这个 NAPI 方法了**，只差插件导出 | 低 |
| `getFirstUnreadMessageId` | 精确定位首条未读（现用「按未读数反推」的近似方案）。同上，鸿蒙新 har 已有 | 低 |
| `getMessagesV2` 支持 `contentTypes` | 三端插件都把它写死成空数组。M3 用 `searchMessageByTypesAndTimes` 传空关键字绕过去了，够用，但语义上绕 | 低 |
| `cancelSendingMessage` | flutter 有此 API 但菜单未用，可不做 | 忽略 |

### 需要改音视频插件（`uni_modules/wfc-av-client`，三端）

| 能力 | 用于 |
| --- | --- |
| 会议全套（创建/加入/会控/参会者/屏幕共享） | M7，需先做可行性验证 |

### 只需改 `api/appServerApi.uts`（纯 HTTP，无原生工作量）

- 已补（M1）：`/send_destroy_code`、`/destroy`、`/fav/list`、`/fav/add`、`/fav/del/{id}`
- 已补（M4）：`/scan_pc/{token}`、`/confirm_pc`、`/cancel_pc`
- 已补（M4 登录页）：`/slide_verify/generate`、`/slide_verify/verify`，以及 `/send_code`、`/login`、`/login_pwd` 的 `slideVerifyToken` 参数
- 待补：`/change_name`、`/pc_session`（PC 端生成二维码用，手机侧用不到）、`/conference/*`、`/group/members_for_portrait`
- **不补**：`/send_reset_code`、`/reset_pwd` —— flutter 里有这两个封装但零调用方，移动端没有找回密码页面，见 M4 小节

M3 用到但**不在 app server 上**的独立服务：ASR（`Config.ASR_SERVER`，见 [common/asr.uts](common/asr.uts)）

### M1 顺手补的门面方法（`wfc/client/wfc.uts`，都没动原生）

| 方法 | 说明 |
| --- | --- |
| `getNoDisturbingTimes` / `setNoDisturbingTimes` / `clearNoDisturbingTimes` | 三端插件都没导出，但它本来就是 user setting scope 17（值 `"起\|止"`，UTC 分钟数，服务端 `MemoryMessagesStore.isUserNoDisturbing` 就是这么解析的），直接读写 user setting 即可 |
| `isVoipSilent` / `setVoipSilent` | 同上，scope 21 |
| `isGlobalSlient` | **改了实现**：原来走 `native.isGlobalSlient()`，鸿蒙插件里那个方法写死 `return false`，设置页会永远显示「开」。改成读 scope 2，与原生实现等价且三端一致 |
| `getConversationFileRecords` | 参数 `conversation` 放宽为可空，null = 不限会话（拉全部文件），对齐 `searchFiles` 的语义 |

### 独立服务（新建 api 文件）

- 已补（M5）：`poll` → `/api/polls`，见 [api/pollServerApi.uts](api/pollServerApi.uts)；
  鉴权的公共部分抽在 [api/authCodeApiClient.uts](api/authCodeApiClient.uts)，**接龙和网盘直接复用**
- 待补：`collection` → `/api/collections`；`pan` → 网盘接口
- 不在 app server 上的其它服务：ASR → `Config.ASR_SERVER`（见 [common/asr.uts](common/asr.uts)）

---

## 五、已对齐清单（核对用，无需重做）

- **会话列表**：列表/未读角标/置顶/静音/删除/标记已读未读/连接状态提示/tabBar badge；长按菜单（置顶、取消置顶、标记已读、标记未读、删除）与 flutter `conversation_list_widget.dart` 一致
- **会话页**：文本、图片、视频、语音(AMR)、文件、表情贴纸、链接、名片、合并转发、引用、@提醒（含@全体）、撤回+重新编辑、多选（逐条/合并转发、删除）、草稿、下拉加载历史、向下翻页、消息定位高亮、未读/@我提示条、正在输入提示、已读回执（含群已读详情页）、清空聊天记录、保存到相册/本地
- **消息类型注册**：64 项（M5 补了投票消息类型 18；消息层对齐补了拒绝入群通知类型 125，见 §七）
- **通讯录**：新的朋友、群聊、频道列表、组织架构树、好友搜索/添加/删除、拼音索引
- **群**：创建群、群名/公告、加人/踢人、退群/解散、保存到通讯录
- **搜索**：门户（用户/联系人/群/会话消息）+ 会话内「查找聊天内容」面板（全部/文件/图片与视频/链接/日期 五个标签 + 搜索历史）
- **工作台**：WebView + JS bridge
- **音视频**：单人/多人通话、对讲 PTT
- **其他**：扫一扫（用户/群/频道/PC 扫码登录四类分支齐全）、群二维码生成、头像上传、UniPush clientId 上报
- **通讯录/用户**：用户详情页（备注、星标朋友、黑名单、所在组织、发消息/加好友/音视频通话）、邀请好友、组织架构（面包屑/搜索/分组/选人模式）
- **选人**：多选页（标题栏「完成(n)」、已选头像内嵌搜索框、字母索引、maxSelected、从组织架构选择）
- **PC**：在线设备列表 + 踢下线、扫码登录确认
- **群投票**：发起 / 参与 / 详情 / 我的投票 / 结束 / 删除 / 导出明细、投票消息气泡、群聊扩展面板入口
- **朋友圈**（仅鸿蒙可跑）：时间线 / 个人朋友圈 / 发布（文字·图片·视频）/ 点赞 / 评论 / 回复 / 删除 /
  可见范围 / 提醒谁看 / 消息列表 / 封面 / 隐私设置（两份名单、陌生人十条、可见范围）、消息类型 501·502

### 渲染器差距（22 vs 17）

flutter 有而 uni 没有的 cell_builder：`collection_cell_builder`（随 M5 接龙）、`raw_call_start_cell_builder`。
朋友圈的 501/502 两条消息**不需要 cell_builder** —— 它们落在 line=1 的会话里、`digest` 返回空串，
只在朋友圈消息页渲染，不进会话列表和会话页（与 android / flutter 一致）。
`poll_cell_builder` 已随 M5 投票补上。其余已对齐。

> `raw_call_start_cell_builder` **不用补**：那是 flutter 在没集成 avenginekit 时，
> 400 消息落到 `RawVoipMessageContent` 的兜底渲染。uni 的 `messageConfig` 恒定注册
> `CallStartMessageContent`，走不到这个分支。

---

## 六、执行建议

1. **M0 不做完不要开新功能页面。** 主题层和字号层是横切改造，每晚一周成本就多一点。
2. **M1 优先于 M2。** 设置整块是当前最明显的空白，且几乎全是 `[UI]`，做完能立刻拉平观感。
3. **M5 三项（投票/接龙/网盘）可以并行插队。** 它们不碰原生、不碰主题以外的公共代码，适合在等原生插件发版时穿插做。
4. **M7 先做可行性验证再排期。** 如果三端 avenginekit 的会议能力不齐，这一块可能要重新评估甚至砍掉。
5. **每完成一个页面，同批补齐 i18n 词条**，不要留技术债。

---

## 七、消息层对齐（`wfc/messages/*` + `messageConfig.uts`）

把 uni 的消息类型注册表、持久化标记、各消息的 encode/decode 与 flutter `imclient/lib/message/` 逐条对过一遍。

### 关键结论：这一层不能以 flutter 为准

flutter 的 imclient 是 Dart 手写移植，**有几处它自己就是错的**。判定基准应该是
`../android-chat/client`（uni 三端插件包的就是这套原生 SDK，也是服务端实际下发的报文格式），
flutter 只在与 android 一致时才作为参照。已确认 flutter 写错的地方：

| 类型 | flutter 的实现 | 服务端实际报文（android / ios） |
| --- | --- | --- |
| 16 未送达 | 读 `payload.content` 当 reason | binaryContent 的 `mid`/`all`/`us`/`lme`/`lbe`/`rbe`/`rme`/`em` |
| 124 修改群设置 | 读 `s`（map） | 读 `g`/`o`/`n`/`m` |
| 125 拒绝入群 | 读 `m`（string）/`r`（string） | 读 `g`/`o`/`mi`（map: 用户 id → 原因码） |
| 420 对讲邀请 | searchableContent=频道 id、pushContent=频道名 | content=callId，binaryContent 的 `h`/`t`/`d`/`p`（见 `WFCCPTTInviteMessageContent.m`） |

**所以 16 / 124 / 420 三项没有补**——照抄 flutter 会得到一个永远解不出内容的类，比现在
落到 `UnknownMessageContent` 更糟。要补的话按上表的报文格式写，别看 flutter。
（124 在 android 侧是 `No_Persist`，本来就不入库、不渲染，补了也看不见。）

### 本轮修掉的（都是 uni 侧的实际缺陷）

- **类型 92 / 93 的 creator 装反了** —— `messageConfig.uts` 里 92（打招呼内容）注册的是
  `FriendAddedNotification`、93（已成为好友）注册的是 `FriendGreetingNotification`。
  结果这两条通知**互相显示了对方的文案**
- **图片 / 视频 / 语音 / 表情 encode 时没写 `searchableContent`** —— android 和 flutter
  都会写 `[图片]`/`[视频]`/`[语音]`/`[动态表情]`。服务端推送文案取的就是这个字段，
  少了它**对端收到的推送正文是空的**；合并转发拼 searchableContent 时也会少掉这几类
- **表情消息 `mediaType` 写死成 `File`** —— android（`STICKER`）和 flutter（`Media_Type_STICKER`）
  都是 Sticker，会把表情传到 file 桶
- **`AllowGroupMemberNotification` 的 `super()` 传的是 `MuteGroupMember_Notification`(118)** ——
  应为 119。decode 时会被 `payload.type` 覆盖掉所以没暴露，但 encode 出去就是错的
- **类型 40（开始密聊）的 flag 是 `Persist_And_Count`** —— android 和 flutter 都是 `Persist`，
  多出来的 count 会让这条通知在后台时弹一条「新消息来了」
- **补上类型 125（拒绝入群通知）** —— 按 android 的报文格式写，见
  [rejectJoinGroupNotification.uts](wfc/messages/notification/rejectJoinGroupNotification.uts)。
  它是 `NotificationMessageContent` 子类，会话页自动按灰色居中提示渲染，不用写渲染器。
  没补之前群里会显示成「未知消息」

### 刻意没动的

- **类型 400（通话）的 flag 保持 `Persist`，没跟 android/flutter 改成 `Persist_And_Count`。**
  uni 这张表里的 flag 只影响两件事：`store.notify()` 的本地通知横幅、以及 decode 失败时
  是否兜底成 `UnknownMessageContent`；**真正的入库和未读计数由原生 SDK 决定，不看这张表**。
  而 `notify()` 只在 App 退到后台时触发，此时来电已经由 VOIP 原生层弹了通知，
  再加一条「新消息来了」是重复打扰。要改的话得先确认 VOIP 的通知路径
- **12 / 31 / 71 / 72 / 408 / 416 / 417 的 flag 与 flutter 不同**——这几项 uni 与 android 一致，
  是 flutter 把一批通知类消息统一写成了 `PERSIST`。不跟随
- **19（投票结果）/ 25（会议纪要）/ 26（转写）** —— flutter 注册了但自己也没有 cell_builder，
  渲染结果和不注册一样是「未知消息」。26 在 android 侧是 `Transparent`，flutter 写的 `PERSIST` 也是错的
- **601/602（IoT）、610~613（备份/恢复）** —— 备份属 Backlog，IoT 不在移动端形态内

### 验证

`node scripts/check-uvue-css.js` 无新增问题；三端 `cli publish` 均编译通过。
**真机验证待做**，清单见下。

#### 消息层真机验证清单（鸿蒙优先）

1. **推送正文**（最主要的一条）：A 给 B 发图片/视频/语音/表情各一条，**B 的 App 退到后台**，
   看系统通知的正文是不是 `[图片]`/`[视频]`/`[语音]`/`[动态表情]`，而不是空白
2. **表情发送**：发一条表情贴纸，对端能正常显示（mediaType 改了，走的是 sticker 桶，
   **重点确认图还能拉出来**，历史消息不受影响）
3. **好友通知文案**：加一个新好友，会话里那两条通知——打招呼那条显示「以上是打招呼的内容」，
   成为好友那条显示「你们已经是好友了，可以开始聊天了。」（**改之前是反的**）
4. **合并转发**：多选几条图片/语音合并转发，转发出去的消息在会话列表的摘要里能看到内容
5. **拒绝入群**：在其他端（PC/Android）把某人的入群申请拒掉，uni 这边的群里应显示
   「XXX 拒绝了 YYY 的入群申请」，而不是「未知消息」
6. **回归**：普通图片/视频/语音/文件/表情的收发、会话列表摘要、群通知类消息的灰条文案各扫一遍
