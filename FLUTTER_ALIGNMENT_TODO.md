# uni-chat-uts 对齐 flutter-chat 移动端 · 实施 TODO

> **基线**：`../flutter-chat` 的移动端形态（`chat/lib` 去掉 `pc/` 目录 + `moment/` 模块）。
> **本文档取代** `FEATURE_GAP_TODO.md`（那份以 `../android-chat` 为基线，已不适用，可删除）。
> **最后核对**：2026-08-05，对照 flutter-chat 分支当前状态。
> **进度**：M0 完成；M1 / M3 代码侧完成（真机验证待做）；M2 代码侧完成除两项（入群申请审批 / 群二维码，见 M2 小节）。

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
/Applications/HBuilderX.app/Contents/MacOS/cli publish app-android --type appResource --project .
# 把 app-android 换成 app-harmony / app-ios 各跑一次，约 15~30 秒一轮
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
- **群二维码** `[平台]` —— 项目里没有二维码生成能力，要先在 uts 里写 QR 编码器（约 500 行）+ canvas 绘制。挪到 M4 与「我的二维码」一起做，共用同一套能力。所以群信息页现在**没有**「群二维码」这一行 —— 宁可不放入口，也不放一个点了弹「暂未实现」的行。
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

- [ ] **用户详情页补齐** `[UI]`
  - flutter 参考：`user_info_widget.dart`（747 行）
  - 缺：更多信息、所在组织、朋友圈入口（依赖 M6）、黑名单开关、用户二维码
- [ ] **收藏的群** `[UI]` — `contact/fav_groups.dart`，SDK 已有 `getFavGroupList` / `setFavGroup`
- [ ] **邀请好友** `[UI]` — `contact/invite_friend.dart`
- [ ] **组织架构补齐** `[UI]`
  - flutter 参考：`organization/organization_screen.dart`（554 行）+ `organization_cache.dart`
  - 缺：员工详情、部门成员列表、从组织架构选人
- [ ] **外部域 / 互联互通** `[SDK❌ getDomainInfo]`
  - flutter 参考：`mesh/domain_list_screen.dart`、`mesh/domain_profile_screen.dart`（合计 452 行，较小）
- [ ] **频道补齐** `[UI]` — 频道详情/订阅、创建频道、搜索频道，SDK 均已有
- [ ] **二维码生成与扫码分支** `[平台]`
  - 我的二维码 / 群二维码生成（与 M2 共用 canvas 方案）
  - 扫码结果分支：现在 [main-action-menu.uvue](components/main-action-menu/main-action-menu.uvue) 只处理用户，需补 群、频道、**PC 扫码登录**
- [ ] **移动端管理 PC** `[API❌]`
  - [x] 在线设备列表 + 踢下线 — **M3 已做**，见 [PcOnlineDevicesPage](pages/me/PcOnlineDevicesPage.uvue)（会话列表的 PC 在线横幅要有落点）
  - [ ] 扫码登录 PC 确认页：需补 `/confirm_pc`、`/cancel_pc`、`/pc_session`
- [ ] **登录页补齐** `[API❌]`
  - flutter 参考：`login_screen.dart`
  - 缺：密码登录 + 登录方式切换（`/login_pwd` 已有）、用户协议/隐私政策勾选、找回密码（需补 `/send_reset_code`、`/reset_pwd`）
  - 滑块验证 `widget/slide_verify_dialog.dart`（451 行，含拖拽动画）—— uni 侧只有 `transition` 没有 `animation`，实现要简化，可接受

---

### M5 · 扩展业务：投票、接龙、网盘

这三个都是**纯 HTTP 服务 + 消息类型**，不碰原生，性价比高。

- [ ] **投票** `[API❌ POLL_SERVER]`
  - flutter 参考：`poll/`（8 个文件，2.2k 行），接口 `/api/polls`、`/api/polls/my`
  - 含：创建投票、投票详情、我的投票列表、`poll_cell_builder` 消息气泡、输入框扩展面板入口
- [ ] **接龙** `[API❌ COLLECTION_SERVER]`
  - flutter 参考：`collection/`（6 个文件，1.1k 行），接口 `/api/collections`
  - 含：创建接龙、接龙详情、`collection_cell_builder` 消息气泡、扩展面板入口
- [ ] **网盘** `[API❌ PAN_SERVER]`
  - flutter 参考：`pan/pan_home_screen.dart`（1060 行）+ `pan_service.dart`（755 行）
  - 认证走 `getAuthCode`（uni 门面已有），含空间列表、目录浏览、上传下载、大文件预签名上传
  - 入口在发现页
- [ ] **发现页补齐** `[UI]` — 对照 `discovery/discovery_tab.dart`：朋友圈、聊天室、机器人、**会议**、开发文档、**云盘**（uni 侧现有：聊天室、机器人、频道、开发手册）

---

### M6 · 朋友圈

**成本比看上去低。** flutter 的 `moment/` 是**纯 Dart 实现**（`momentclient.dart:100` 注释明确说明），底层只通过一个通道 API `Imclient.sendMomentsRequest(path, data, cb)` 收发。所以 uni 侧只要门面补这一个方法，业务全部可以用 uts 写。

- [ ] **门面补 `sendMomentsRequest`** `[SDK❌]` — 三端原生 SDK 均有对应方法，工作量小，见 §8
- [ ] **朋友圈客户端层** — 移植 `moment/lib/client/momentclient.dart`（814 行）为 `wfc/moment/momentClient.uts`
- [ ] **信息流页** — `moment/lib/src/feed_list_page.dart`（637 行），九宫格图片 `nine_grid_view.dart`
- [ ] **发布页** — `publish_feed_page.dart`（341 行）
- [ ] **详情页 / 消息列表 / 可见范围** — `feed_detail_page.dart`、`feed_messages_page.dart`、`visible_scope_page.dart`
- [ ] **朋友圈隐私设置** — `settings/moment_privacy_settings_screen.dart`（431 行）+ 黑名单
- [ ] **入口** — 发现页 + 用户详情页

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
| `sendMomentsRequest(path, data, cb)` | M6 朋友圈全部功能 | 中 |
| `getDomainInfo` | M4 外部域 | 低 |
| `getFirstUnreadMessageId` | 精确定位首条未读（现用「按未读数反推」的近似方案） | 低 |
| `getMessagesV2` 支持 `contentTypes` | 三端插件都把它写死成空数组。M3 用 `searchMessageByTypesAndTimes` 传空关键字绕过去了，够用，但语义上绕 | 低 |
| `cancelSendingMessage` | flutter 有此 API 但菜单未用，可不做 | 忽略 |

### 需要改音视频插件（`uni_modules/wfc-av-client`，三端）

| 能力 | 用于 |
| --- | --- |
| 会议全套（创建/加入/会控/参会者/屏幕共享） | M7，需先做可行性验证 |

### 只需改 `api/appServerApi.uts`（纯 HTTP，无原生工作量）

- 已补（M1）：`/send_destroy_code`、`/destroy`、`/fav/list`、`/fav/add`、`/fav/del/{id}`
- 待补：`/send_reset_code`、`/reset_pwd`、`/change_name`、`/confirm_pc`、`/cancel_pc`、`/pc_session`、`/conference/*`、`/group/members_for_portrait`

M3 用到但**不在 app server 上**的独立服务：ASR（`Config.ASR_SERVER`，见 [common/asr.uts](common/asr.uts)）

### M1 顺手补的门面方法（`wfc/client/wfc.uts`，都没动原生）

| 方法 | 说明 |
| --- | --- |
| `getNoDisturbingTimes` / `setNoDisturbingTimes` / `clearNoDisturbingTimes` | 三端插件都没导出，但它本来就是 user setting scope 17（值 `"起\|止"`，UTC 分钟数，服务端 `MemoryMessagesStore.isUserNoDisturbing` 就是这么解析的），直接读写 user setting 即可 |
| `isVoipSilent` / `setVoipSilent` | 同上，scope 21 |
| `isGlobalSlient` | **改了实现**：原来走 `native.isGlobalSlient()`，鸿蒙插件里那个方法写死 `return false`，设置页会永远显示「开」。改成读 scope 2，与原生实现等价且三端一致 |
| `getConversationFileRecords` | 参数 `conversation` 放宽为可空，null = 不限会话（拉全部文件），对齐 `searchFiles` 的语义 |

### 独立服务（新建 api 文件）

`poll` → `/api/polls`；`collection` → `/api/collections`；`pan` → 网盘接口；ASR → `Config.ASR_SERVER`

---

## 五、已对齐清单（核对用，无需重做）

- **会话列表**：列表/未读角标/置顶/静音/删除/标记已读未读/连接状态提示/tabBar badge；长按菜单（置顶、取消置顶、标记已读、标记未读、删除）与 flutter `conversation_list_widget.dart` 一致
- **会话页**：文本、图片、视频、语音(AMR)、文件、表情贴纸、链接、名片、合并转发、引用、@提醒（含@全体）、撤回+重新编辑、多选（逐条/合并转发、删除）、草稿、下拉加载历史、向下翻页、消息定位高亮、未读/@我提示条、正在输入提示、已读回执（含群已读详情页）、清空聊天记录、保存到相册/本地
- **消息类型注册**：62 项
- **通讯录**：新的朋友、群聊、频道列表、组织架构树、好友搜索/添加/删除、拼音索引
- **群**：创建群、群名/公告、加人/踢人、退群/解散、保存到通讯录
- **搜索**：门户（用户/联系人/群/会话消息）+ 会话内「查找聊天内容」面板（全部/文件/图片与视频/链接/日期 五个标签 + 搜索历史）
- **工作台**：WebView + JS bridge
- **音视频**：单人/多人通话、对讲 PTT
- **其他**：扫一扫（仅用户二维码）、头像上传、UniPush clientId 上报

### 渲染器差距（22 vs 16）

flutter 有而 uni 没有的 cell_builder：`poll_cell_builder`（随 M5）、`collection_cell_builder`（随 M5）、`raw_call_start_cell_builder`。其余已对齐。

---

## 六、执行建议

1. **M0 不做完不要开新功能页面。** 主题层和字号层是横切改造，每晚一周成本就多一点。
2. **M1 优先于 M2。** 设置整块是当前最明显的空白，且几乎全是 `[UI]`，做完能立刻拉平观感。
3. **M5 三项（投票/接龙/网盘）可以并行插队。** 它们不碰原生、不碰主题以外的公共代码，适合在等原生插件发版时穿插做。
4. **M7 先做可行性验证再排期。** 如果三端 avenginekit 的会议能力不齐，这一块可能要重新评估甚至砍掉。
5. **每完成一个页面，同批补齐 i18n 词条**，不要留技术债。
