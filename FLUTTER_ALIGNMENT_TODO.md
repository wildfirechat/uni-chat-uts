# uni-chat-uts 对齐 flutter-chat 移动端 · 实施 TODO

> **基线**：`../flutter-chat` 的移动端形态（`chat/lib` 去掉 `pc/` 目录 + `moment/` 模块）。
> **最后核对**：2026-08-20，逐模块对照 flutter-chat `master` 当前状态。
> **状态**：原 M0~M7 主体全部落地。剩余工作见 §三，按「能不能立刻开工」重排成三个批次，不再按里程碑编号。
>
> flutter 侧 2026-08-05 之后只增加了 Pad 适配（P0~P5）与 PC 设置页改动，两者都在 §一 排除范围内 —— 基线未变。

---

## 一、范围界定

### 对齐范围内

- flutter `chat/lib` 中所有非 `pc/` 代码
- flutter `moment/` 朋友圈模块
- 三端：Android / iOS / 鸿蒙

### 明确不做

| 项 | 原因 |
| --- | --- |
| 桌面端 shell（`pc/` 全部） | uni-app x 不做桌面端 |
| Pad 适配（`pad/`，flutter 2026-08-15 新增） | 分栏形态，同属桌面端形态 |
| 桌面快捷键（`shortcuts/ambient_shortcuts.dart`） | 键盘/焦点树，移动端无此概念 |
| 截图工具（扩展面板 `screenshot` 项） | 已确认不需要；flutter 侧也只在原生桌面显示 |
| PC 端备份/恢复（`backup/pc_*`） | PC 特有，且备份整体在 Backlog |
| iOS Share Extension（`share/share_service.dart`） | 要写 iOS 原生扩展 + App Group 共享容器，uni-app x 侧成本远高于收益 |
| 位置消息 | **flutter 自己也没实现**：`plugin_board.dart` 里 `case "location": showToast(notSupported)`，无 cell_builder、无地图页 |
| 密聊（端到端加密） | flutter 移动端无入口 |
| PSTN 落地电话、消息归档、表情推荐 | flutter 移动端未实现 |

**flutter 侧的死代码，不要照着做**（都已逐个核实过零调用方/零导航入口）：

| 项 | 核实结果 |
| --- | --- |
| 星标朋友页 `contact/fav_users.dart` | 类定义在，但全项目没有任何地方 `FavUsersPage(` 导航过去 |
| 找回密码 | `app_server.dart` 有 `sendResetCode` / `resetPassword`，零调用方；移动端登录页只有验证码/密码两种登录 |
| 「我的二维码」 | flutter 移动端没有。全项目只有两处 `QrImageView`：群二维码（在范围内）和 PC 桌面登录页（已排除） |
| 用户详情页「更多信息」 | onTap 是 `showToast(methodNotImpl)` |
| 通用设置「诊断」 | 同上 |
| 投票「转发投票」 | `_forwardPoll` 只 toast「开发中」 |
| 投票结果消息（类型 19）、会议纪要（25）、转写（26） | imclient 注册了，但没有对应 cell_builder，渲染结果等同未注册 |
| `raw_call_start_cell_builder` | 那是 flutter 没集成 avenginekit 时 400 消息落到 `RawVoipMessageContent` 的兜底。uni 的 `messageConfig` 恒定注册 `CallStartMessageContent`，走不到 |

> **本项目的规矩**：宁可不放入口，也不放一个点了弹「暂未实现」的行。上表里 flutter 放了入口但点了没用的，uni 侧一律不放。

> **注意**：「移动端管理 PC」（扫码登录 PC、在线设备列表、踢 PC 下线）**属于对齐范围** —— 那是手机上的功能，不是桌面端功能，已完成。

### UI 对齐的目标定义

**不追求像素一致，追求设计一致。** 渲染模型不同：flutter 用 Skia 自绘，三端像素一致；uni-app x vapor 编译成三端原生组件（Android View / UIView / ArkUI），文字度量、滚动回弹、输入法行为由平台决定。

- **必须一致**：色板、间距、圆角、字号层级、图标、页面结构与信息层次、交互流程与文案
- **尽量接近**：列表行高、头像尺寸、气泡形态、空状态
- **接受不同**：转场动画、媒体浏览器手势、相册选择器样式（flutter 用应用内 `wechat_assets_picker`，uni 走系统选择器）、文本长按选择、任何模糊/毛玻璃效果

---

## 二、已对齐（核对用，无需重做）

### 横切基建

- **主题层**：[common/theme.uts](common/theme.uts) 40 个语义色令牌、light/dark 两套、跟随系统/浅色/深色三档存本地；[theme.json](theme.json) + [pages.json](pages.json) 让原生外壳（导航栏、tabBar、页面底色）一起跟随
  - **关键约束**：App 平台**不解析自定义 CSS 变量**，`var(--x)` 写了不报错、运行时静默失效，所以主题只能走 JS 响应式；`reactive(new SomeClass())` 在 Android 端无效，store 用 `ref` 支撑
  - **刻意保留硬编码色值的三类**：常暗界面（[voip/Single](pages/voip/Single.uvue)、[voip/Multi](pages/voip/Multi.uvue)、[PreviewVideoPage](pages/misc/PreviewVideoPage.uvue)）、常暗浮层（[chunLei-popups](components/chunLei-popups/chunLei-popups.uvue)、[main-action-menu](components/main-action-menu/main-action-menu.uvue)）、`hover-class` 的按下态（只认静态类名，拿不到 `:style`）
- **字号缩放层**：[common/layoutScale.uts](common/layoutScale.uts) 8 档字号令牌 + 5 档缩放 + 三类上限（`iconPx` / `rowPx` / `fontPx`）。正文走 `fontPx` 完整跟随，角标与图标不跟随
- **通用组件**：[option-item](components/option-item/option-item.uvue)、[option-switch-item](components/option-switch-item/option-switch-item.uvue)、[option-button-item](components/option-button-item/option-button-item.uvue)、[form-card](components/form-card/form-card.uvue)、[form-text-row](components/form-text-row/form-text-row.uvue)、[section-divider](components/section-divider/section-divider.uvue)、[bottom-action-sheet](components/bottom-action-sheet/bottom-action-sheet.uvue)、[popup-menu](components/popup-menu/popup-menu.uvue)、[member-grid](components/member-grid/member-grid.uvue)、[member-row](components/member-row/member-row.uvue)、[qr-code](components/qr-code/qr-code.uvue)、[slide-verify-dialog](components/slide-verify-dialog/slide-verify-dialog.uvue)、[quick-index-bar](components/quick-index-bar/quick-index-bar.uvue)
- **公共逻辑**：[common/prompt.uts](common/prompt.uts)、[common/conversationActions.uts](common/conversationActions.uts)、[common/asr.uts](common/asr.uts)、[common/favorite.uts](common/favorite.uts)、[common/report.uts](common/report.uts)、[common/qrcode.uts](common/qrcode.uts)、[common/avcall.uts](common/avcall.uts)、[common/popupMenu.uts](common/popupMenu.uts)、[common/mediaSaver.uts](common/mediaSaver.uts)、[api/authCodeApiClient.uts](api/authCodeApiClient.uts)（接龙/网盘复用）

### 功能模块

- **会话列表**：列表/未读角标/置顶/静音/删除/标记已读未读/连接状态提示/tabBar badge/长按菜单；PC 在线横幅 + [PcOnlineDevicesPage](pages/me/PcOnlineDevicesPage.uvue)
- **会话页**：文本、图片、视频、语音(AMR)、文件、表情贴纸、链接、名片、合并转发、引用、@提醒（含@全体）、撤回+重新编辑、多选、草稿、下拉加载历史、向下翻页、消息定位高亮、未读/@我提示条、正在输入提示、对方在线状态、已读回执（含群已读详情页）、清空聊天记录、保存到相册/本地
- **消息长按菜单**：删除（再选本地/远程）→ 复制 → 转文字 → 转发 → 撤回 → 多选 → 引用 → 收藏 → 举报 → 保存
- **消息类型注册**：64 项；渲染器覆盖 flutter 除 `collection_cell_builder`（随接龙）之外的全部
- **我的与设置**：[MePage](pages/me/MePage.uvue)、[GeneralSettingsPage](pages/me/GeneralSettingsPage.uvue)、[MessageNotificationSettingsPage](pages/me/MessageNotificationSettingsPage.uvue)、[PrivacySettingsPage](pages/me/PrivacySettingsPage.uvue)、[PrivacyFindMePage](pages/me/PrivacyFindMePage.uvue)、[BlacklistPage](pages/me/BlacklistPage.uvue)、[AccountSafetyPage](pages/me/AccountSafetyPage.uvue) + [ChangePasswordPage](pages/me/ChangePasswordPage.uvue)、[DestroyAccountPage](pages/me/DestroyAccountPage.uvue)、[FontSizeSettingsPage](pages/me/FontSizeSettingsPage.uvue)、[FileRecordsPage](pages/me/FileRecordsPage.uvue) + [FileListPage](pages/me/FileListPage.uvue)、[FavoriteListPage](pages/me/FavoriteListPage.uvue)
- **会话信息与群管理**：[SingleConversationInfoPage](pages/conversation/SingleConversationInfoPage.uvue)、[GroupConversationInfoPage](pages/conversation/GroupConversationInfoPage.uvue)、[ChannelConversationInfoPage](pages/conversation/ChannelConversationInfoPage.uvue)、[GroupManagePage](pages/conversation/GroupManagePage.uvue)、[GroupManagerPage](pages/conversation/GroupManagerPage.uvue)、[GroupMutePage](pages/conversation/GroupMutePage.uvue)、[GroupMemberListPage](pages/conversation/GroupMemberListPage.uvue)、[GroupAnnouncementPage](pages/conversation/GroupAnnouncementPage.uvue)、[GroupQrCodePage](pages/conversation/GroupQrCodePage.uvue)
- **会话内检索**：[SearchConversationMessagePage](pages/search/SearchConversationMessagePage.uvue)（全部/文件/图片与视频/链接/日期 五个标签 + 搜索历史）+ [conversation-links](components/conversation-links/conversation-links.uvue)、[conversation-media-grid](components/conversation-media-grid/conversation-media-grid.uvue)、[conversation-calendar](components/conversation-calendar/conversation-calendar.uvue)、[ConversationLinksPage](pages/conversation/ConversationLinksPage.uvue)
- **通讯录与用户**：[UserDetailPage](pages/contact/UserDetailPage.uvue)、[InviteFriendPage](pages/contact/InviteFriendPage.uvue)、[OrganizationPage](pages/contact/OrganizationPage.uvue)（搜索/面包屑/分组/层级内后退/选人模式）、[GroupListPage](pages/contact/GroupListPage.uvue)、[ChannelListPage](pages/contact/ChannelListPage.uvue)、[ChannelDetailPage](pages/contact/ChannelDetailPage.uvue)、[GroupInfoPage](pages/conversation/GroupInfoPage.uvue)、好友搜索/添加/删除、拼音索引
- **选人与转发**：[PickUserPage](pages/pick/PickUserPage.uvue)（标题栏「完成(n)」、已选头像内嵌搜索框、字母索引、maxSelected、从组织架构选择）、[PickConversationPage](pages/pick/PickConversationPage.uvue)、[ForwardMessagePage](pages/conversation/message/forward/ForwardMessagePage.uvue) + [ForwardConfirmationSheet](pages/conversation/message/forward/ForwardConfirmationSheet.uvue)（单选/多选切换 + 创建群聊入口）
- **登录**：[LoginPage](pages/login/LoginPage.uvue) —— 密码/验证码两种模式、60s 倒计时、协议勾选、滑块验证
- **扫码**：用户 / 群 / 频道 / PC 扫码登录四类分支 + [PcLoginConfirmPage](pages/me/PcLoginConfirmPage.uvue)
- **群投票**：[PollHomePage](pages/poll/PollHomePage.uvue) / [CreatePollPage](pages/poll/CreatePollPage.uvue) / [PollListPage](pages/poll/PollListPage.uvue) / [PollDetailPage](pages/poll/PollDetailPage.uvue) + [PollMessageContentView](pages/conversation/message/content/PollMessageContentView.uvue) + 扩展面板入口（群会话且配了 `POLL_SERVER`）
- **朋友圈**（iOS 除外，见 §三批次 A）：[wfc/moment/momentClient.uts](wfc/moment/momentClient.uts) + 时间线 / 个人朋友圈 / 发布 / 点赞 / 评论 / 回复 / 删除 / 可见范围 / 提醒谁看 / 消息列表 / 封面 / 隐私设置、消息类型 501·502
- **音视频**：单人/多人通话、对讲 PTT
- **音视频会议**：[ConferencePortalPage](pages/voip/conference/ConferencePortalPage.uvue) / [CreateConferencePage](pages/voip/conference/CreateConferencePage.uvue) / [OrderConferencePage](pages/voip/conference/OrderConferencePage.uvue) / [JoinConferencePage](pages/voip/conference/JoinConferencePage.uvue) / [ConferenceInfoPage](pages/voip/conference/ConferenceInfoPage.uvue) / [ConferencePage](pages/voip/conference/ConferencePage.uvue) / [ConferenceManagePage](pages/voip/conference/ConferenceManagePage.uvue) + [api/conferenceApi.uts](api/conferenceApi.uts)（11 个接口，含 recording / focus）+ 三端 `wfc-av-client` 各 35 个导出（`startConference` / `joinConference` / `dispatchConferenceEvent` 齐全）
  - ⚠️ 会议页是**从老 uni-chat 的 nvue 迁过来的，不是照 flutter 版式做的**，刻意差异见 §五
- **工作台**：WebView + JS bridge
- **其他**：头像上传、UniPush clientId 上报

---

## 三、剩余工作

### 批次 A · 原生插件攒批（每动一次都要三端各改一遍 + 重新打包验证，尽量一次做完）

- [ ] **入群申请审批** —— flutter `group/join_group_request_screen.dart`（410 行）
  - 需要 `getJoinGroupRequests` / `handleJoinGroupRequest` / `clearJoinGroupRequest` / `clearJoinGroupRequestUnread`
  - 配套还要补：会话列表**群会话行的「N 条新入群申请」角标**（flutter `home/conversation_list_widget.dart:677`）+ 群管理页的审批入口
  - ⚠️ **现存副作用**：群管理页的「加群方式」已经能选到「需管理员验证」，但这一端批不了申请，得去其他端处理 —— 这是个活的断链
  - 📌 flutter 侧的实现经验值得抄：`utils/join_group_request_unread_cache.dart` 说明每行各查一次未读会打爆 IPC，要「滚动停下后只查视野内的群 + 按 groupId 缓存」
- [ ] **外部域 / 互联互通** —— 需要 `getDomainInfo`
  - **不止两页**：除 `mesh/domain_list_screen.dart`、`mesh/domain_profile_screen.dart` 外，还有 `mesh_cache.dart` 和 `utils/mesh_user_name.dart` / `mesh_user_display.dart` / `external_target_utils.dart` —— **渗到所有显示用户名的地方**，改动面比看上去大
- [ ] **iOS 朋友圈** —— [app-ios/index.uts:543](uni_modules/wfc-client/utssdk/app-ios/index.uts#L543) 的 `sendMomentsRequest` 还是 `failCB(254)`，等 `WFClientUniPlugin.xcframework` 里的 `ClientModule` 导出后把 TODO 注释里那行换上。android / 鸿蒙已通
- [ ] **`getFirstUnreadMessageId`**（低）—— 精确定位首条未读，现用「按未读数反推」的近似方案
- [ ] **`getMessagesV2` 支持 `contentTypes`**（低）—— 三端插件都把它写死成空数组，现用 `searchMessageByTypesAndTimes` 传空关键字绕过去，够用但语义上绕

> **鸿蒙侧这批是零 SDK 工作量，可以先单独跑通。** 已核实 `harmony-configs/libs/marswrapper.har` 里的
> `libmarswrapper.so` 导出表包含 `getJoinGroupRequests` / `handleJoinGroupRequest` /
> `clearJoinGroupRequest` / `clearJoinGroupRequestUnread` / `setJoinGroupRequestUpdateCallback` /
> `getDomainInfo` / `getFirstUnreadMessageId` 全部七个，且 har 的 `Index.ets` 结尾是
> `export default addon`（NAPI 直通）—— 所以鸿蒙**只差 `uni_modules/wfc-client/utssdk/app-harmony/index.uts`
> 的 `export function` 和 `wfc/client/wfc.uts` 的门面方法**。android / iOS 要等各自 SDK。
> 核对方法见 §七「har 导出表怎么查」。

### 批次 B · 纯 UI / HTTP，随时可开工

- [ ] **频道菜单栏（公众号底部菜单）** ← flutter `conversation/input_bar/channel_menu_widget.dart`
  - flutter 在**移动端**输入栏就渲染它（`message_input_bar.dart:378`）：频道有 menus 时输入栏左侧出现菜单/键盘切换按钮，切过去后输入区整体换成一级菜单等分排列，带子菜单的项点开在上方弹出
  - 行为：`view` → 内嵌 WebView 打开链接；`click` → 向频道发一条 `ChannelMenuEventMessageContent` 透传消息；其它类型给提示而不是静默无反应
  - **uni 侧模型和消息类型早就有了**（[wfc/model/channelMenu.uts](wfc/model/channelMenu.uts)、[wfc/messages/channelMenuEventMessageContent.uts](wfc/messages/channelMenuEventMessageContent.uts)），[MessageInputView](pages/conversation/MessageInputView.uvue) 里**零处 channel 引用** —— 只缺这一层 UI。频道会话信息页已经做了，这是现成断链，也是剩余项里最便宜的
- [ ] **创建频道 / 搜索频道** ← `channel/search_channel.dart`
  - 三端插件的 `createChannel` / `searchChannel` **都已导出**，只缺页面。[ChannelDetailPage](pages/contact/ChannelDetailPage.uvue) 已落地，这两个是它的上游入口
- [ ] **接龙** `[API❌ COLLECTION_SERVER]` ← `collection/`（6 个文件，1.1k 行）
  - 含：创建接龙、接龙详情、`collection_cell_builder` 消息气泡、扩展面板入口（群会话 + 配了服务地址才出现）
  - 接口 `/api/collections`，鉴权直接复用 [api/authCodeApiClient.uts](api/authCodeApiClient.uts)；创建页可复用 [form-text-row](components/form-text-row/form-text-row.uvue)
- [ ] **网盘** `[API❌ PAN_SERVER]` ← `pan/pan_home_screen.dart`（1060 行）+ `pan_service.dart`（755 行）
  - 认证走 `getAuthCode`（门面已有），含空间列表、目录浏览、上传下载、大文件预签名上传
- [ ] **发现页补「云盘」一行** —— flutter 是 朋友圈/聊天室/机器人/会议/开发文档/**云盘**，uni 现有六项里缺云盘（多一项频道，保留）。随网盘一起做
- [ ] **全局水印** ← flutter `widget/watermark_overlay.dart`
  - `Config.ENABLE_WATER_MARKER` 默认 true，`main.dart` 用 Stack 铺在整个 App 之上，**移动端同样生效**：当前用户 ID + 动态时间、倾斜平铺、按分钟刷新；启动页/登录页不显示（没有用户身份）
  - uni 全项目零处实现。注意 uni-app x 没有全局 Overlay，要么每页套一层组件，要么只在敏感页面（会话页、朋友圈、文件预览）加
- [ ] **收藏的群 / 订阅的频道 行版式** —— [GroupListPage](pages/contact/GroupListPage.uvue) / [ChannelListPage](pages/contact/ChannelListPage.uvue) 功能等价，但行高/字号还是老版式（目标：56px 行高 + 40px 头像 + 16px 标题）
- [ ] **扩展面板「位置」项的文案** —— [MessageInputView.uvue:654](pages/conversation/MessageInputView.uvue#L654) 现在落到 default 分支 toast `TODO 位置`。flutter 也只是 toast，但文案是「该功能暂不支持」。要么改文案，要么按 §一 的规矩把这一项去掉

### 批次 C · 横切，持续做

- [ ] **i18n 词条补齐**
  - 现状：uni 597 条 × 3 语言；flutter `app_zh.arb` 1074 条（含 PC 专用）。仍有 127 个 uvue 带硬编码中文，约 244 处字符串字面量
  - ⚠️ **已知限制**：`t()` 不是响应式的，切语言只改本地存的 locale，**已渲染的页面不会重刷**，重启才全量生效。通用设置页切完会给一条提示。要即时生效得把 `currentLocale` 换成 `ref` 并让 `t()` 读它
  - **规则**：每做一个新页面，同批补齐该页面词条，禁止新增硬编码中文
- [ ] **验收扫尾** —— 见 §八

### Backlog

- [ ] **备份与恢复** —— flutter `backup/` 12 个文件 4.2k 行，其中 5 个是 PC 备份/恢复（已排除）。需先评估 uni-app x 的文件系统 API 能否支撑本地库文件的打包/校验/写出
- [ ] **双网媒体 URL 重定向** —— flutter `utils/media_url_redirector.dart`：配了 `MAIN_MEDIA_URL_PREFIX` / `BACKUP_MEDIA_URL_PREFIX` 时按当前网络环境互换媒体 URL 前缀。flutter 默认 null 不启用，uni 门面已有 `setBackupAddress` / `setBackupAddressStrategy` 但没有前缀互换。等有双网部署需求再做
- [ ] **会议的演讲者布局 / 屏幕共享发起** —— 见 §五的刻意差异，要不要补取决于产品判断

---

## 四、SDK / API 缺口台账（只列还缺的）

### `uni_modules/wfc-client` 三端原生

| API | 用于 | android | 鸿蒙 | iOS |
| --- | --- | --- | --- | --- |
| `getJoinGroupRequests` / `handleJoinGroupRequest` / `clearJoinGroupRequest` / `clearJoinGroupRequestUnread` | 入群申请审批 | 待 SDK | **只差插件导出** | 待 SDK |
| `sendMomentsRequest` | 朋友圈 | ✅ 已通 | ✅ 已通 | 插件里返回 254 |
| `getDomainInfo` | 外部域 | 待 SDK | **只差插件导出** | 待 SDK |
| `getFirstUnreadMessageId` | 精确定位首条未读 | 待 SDK | **只差插件导出** | 待 SDK |
| `getMessagesV2` 支持 `contentTypes` | 按类型取消息 | 写死空数组 | 写死空数组 | 写死空数组 |
| `cancelSendingMessage` | flutter 有此 API 但菜单未用 | 忽略 | 忽略 | 忽略 |

**鸿蒙侧已知的运行时空实现**（编译期无感，真机才暴露）：`clearAllNotification`、`getListenedChannels`、`initProto`、`getUserMessages*` 系列在 [app-harmony/index.uts](uni_modules/wfc-client/utssdk/app-harmony/index.uts) 里是 `// TODO` 空壳，用到再补。

### `api/appServerApi.uts`（纯 HTTP，无原生工作量）

- 待补：`/change_name`、`/group/members_for_portrait`
- **不补**：`/send_reset_code`、`/reset_pwd`（flutter 零调用方）、`/pc_session`（PC 端生成二维码用，手机侧用不到）

### 独立服务

- 已有：`poll` → [api/pollServerApi.uts](api/pollServerApi.uts)、会议 → [api/conferenceApi.uts](api/conferenceApi.uts)、组织 → [api/organizationServerApi.uts](api/organizationServerApi.uts)、ASR → `Config.ASR_SERVER`（[common/asr.uts](common/asr.uts)）
- 待补：`collection` → `/api/collections`、`pan` → 网盘接口。两者都复用 [api/authCodeApiClient.uts](api/authCodeApiClient.uts)

---

## 五、与 flutter 的刻意差异（汇总，避免被当成 bug 重做）

| 模块 | 差异 | 原因 |
| --- | --- | --- |
| 通用组件 | FormCard 不自动插分隔线 | 插槽拿不到子节点列表 |
| 通用组件 | OptionSwitchItem 只有开关本身可点；BottomActionSheet 无上滑入场动画 | transition 三端时序不一致 |
| 长按菜单 | 锚点是触点不是气泡矩形 | vapor 下拿不到节点矩形，效果是三角指向手指，更贴手 |
| 字母索引条 | 只支持点击，不支持按住滑动 | 索引条是一排独立 view，拿不到「手指滑过第几个」 |
| 组织架构 | 没有缓存层 | 移动端一次只看一个部门，进出重拉的代价小于维护缓存一致性 |
| 二维码 | 用 view 游程渲染不用 canvas；**纠错级别用 M 不是 flutter 的 L** | canvas 要走 element API，本项目是 vapor 且无先例；实测 L 档识别率掉 3~4 成，M 档稳定 99% |
| 选人 | 单选仍是独立页（`PickSingleUserPage`） | flutter 用 `maxSelected == 1` 复用同一页，uni 侧一直是分开的 |
| 转发 | 建群选人跳 [PickUserPage](pages/pick/PickUserPage.uvue) 而不是原地换界面；预览文字限高裁切不用 3 行省略号 | `lines` 在鸿蒙 vapor 无效 |
| 转发 | 搜索只搜好友和群 | 对齐 flutter 的 searchTypes，不搜全网用户，否则陌生人会混进转发目标 |
| 会话检索 | 日期标签点某天直接跳回会话页定位；搜索结果点消息直接定位 | 与 flutter 独立日历页行为一致；flutter 那个「只有一项的菜单」是 PC 版式 |
| 媒体预览 | 图片走 `uni.previewImage`、视频走 [PreviewVideoPage](pages/misc/PreviewVideoPage.uvue)，两者不在同一滑动序列 | flutter 用自绘 `MMPreviewView`，属 §一「接受不同」 |
| 收藏 | 「打开」对文件走下载、链接走 WebViewPage | flutter 只 toast 一行字。合并转发的收藏两边都打不开（`FavoriteItem.buildContent` 没还原 Composite payload） |
| PC 设备页 | 顶部用设备数字，不是电脑图标 | icomoon 子集里没有电脑字形 |
| 链接列表 | 无缩略图时用域名首字母占位 | 同上，没有链接字形 |
| 语音转文字 | 结果一次性出现，不逐字蹦 | `uni.request` 没有流式回调，只能等整个 SSE 响应体到齐 |
| 登录页 | 协议行用并列 `<text>` + `flex-wrap` 不用 RichText；回弹无缓动；重发显示**剩余**秒数 | 嵌套 text 的子节点点不了；uni 只有 transition 没有 animation |
| 投票 | 截止时间是一个三列 picker 不是两步弹窗 | `<picker>` 只能由点击拉起，没法程序化拉起下一个。日期列第一项「不设置」用来清掉截止时间，flutter 那边选过反而清不掉 |
| 投票 | 「我的投票」删除是长按不是左滑 | 自己接管 touchmove 会和 scroll-view 的纵向滚动打架。详情页（管理模式）底部也有删除 |
| 投票 | 导出明细走 `uni.openDocument` | flutter 缺 share_plus，只把 CSV 落到临时目录再 toast 路径 |
| 投票 | 类型/最多选几项用 actionSheet；气泡标题单行截断 | 当前值已显示在行右侧 desc；`lines` 鸿蒙 vapor 无效 |
| 投票 | 创建后客户端不发消息 | 投票服务端自己往群里投那条 type=18 的消息 |
| 朋友圈 | 上传用 `MessageContentMediaType.Moments`(8) | 与 android `momentclient` 一致；flutter 传 IMAGE/VIDEO 会落到别的桶 |
| 朋友圈 | 缩略图用 `uni.compressImage`；取不到图片信息或压缩失败**不阻断发布** | 不做 flutter 那套自己解码再编 PNG |
| 朋友圈 | 评论输入用 `showModal({editable:true})` | 少一个组件，键盘避让交给系统 |
| 朋友圈 | 清未读用「列出 line=1 的会话再逐个清」 | `clearConversationsUnreadStatus(types, lines)` 只有鸿蒙原生有，换成现成接口不欠原生债 |
| 朋友圈 | 点赞人/评论用嵌套 `<text>` 混排；可见范围用 actionSheet；默认可见范围入口放在隐私设置页 | uni-app x 没有 Wrap；flutter 把默认可见范围放在 PC 的账号与安全里，移动端根本没入口但发布页要读它 |
| 朋友圈 | 不做「长按发布按钮直接发纯文字」 | 同一节点上 `@longpress` 后仍会补一次 `@tap`，行为不稳 |
| 会议 | **只有宫格布局，没有演讲者/焦点布局**（[ConferencePage.uvue:77](pages/voip/conference/ConferencePage.uvue#L77)） | 移动端小屏上演讲者视图价值不大；焦点用户排在第一格 |
| 会议 | **不提供屏幕共享发起入口**（[ConferencePage.uvue:79](pages/voip/conference/ConferencePage.uvue#L79)） | Android/iOS 的 uts 插件还没接，原版这段代码也是注释掉的 |
| 会议 | 管理页把 flutter 的 4 个组件（参会者列表/举手/申请开麦音视频）合成一页用 mode 切，参与者操作用 actionSheet | 移动端不适合原版那种同屏多列表的桌面布局；actionSheet 对应原版的右键菜单 |

---

## 六、消息层：**不能以 flutter 为准**

flutter 的 imclient 是 Dart 手写移植，**有几处它自己就是错的**。判定基准是 `../android-chat/client`（uni 三端插件包的就是这套原生 SDK，也是服务端实际下发的报文格式），flutter 只在与 android 一致时才作为参照。

已确认 flutter 写错、因而 **uni 侧刻意没补** 的三项（照抄会得到一个永远解不出内容的类，比落到 `UnknownMessageContent` 更糟）：

| 类型 | flutter 的实现 | 服务端实际报文（android / ios） |
| --- | --- | --- |
| 16 未送达 | 读 `payload.content` 当 reason | binaryContent 的 `mid`/`all`/`us`/`lme`/`lbe`/`rbe`/`rme`/`em` |
| 124 修改群设置 | 读 `s`（map） | 读 `g`/`o`/`n`/`m`。android 侧是 `No_Persist`，本来就不入库不渲染 |
| 420 对讲邀请 | searchableContent=频道 id、pushContent=频道名 | content=callId，binaryContent 的 `h`/`t`/`d`/`p`（见 `WFCCPTTInviteMessageContent.m`） |

**刻意与 flutter 不同的 flag**：

- **类型 400（通话）保持 `Persist`，不跟 android/flutter 改成 `Persist_And_Count`。** uni 这张表里的 flag 只影响 `store.notify()` 的本地通知横幅和 decode 失败时的兜底；真正的入库和未读计数由原生 SDK 决定，不看这张表。而 `notify()` 只在退到后台时触发，此时来电已由 VOIP 原生层弹了通知，再加一条是重复打扰
- **12 / 31 / 71 / 72 / 408 / 416 / 417** 与 flutter 不同 —— 这几项 uni 与 android 一致，是 flutter 把一批通知类消息统一写成了 `PERSIST`。不跟随
- **601/602（IoT）、610~613（备份/恢复）** —— 备份属 Backlog，IoT 不在移动端形态内

---

## 七、工程约束（开工前必读）

### 编译与校验

```bash
node scripts/check-uvue-css.js                      # 样式子集校验（分平台、分 vapor）

# 前端产物 + 鸿蒙/iOS 类型检查，约 15~30 秒一轮
/Applications/HBuilderX.app/Contents/MacOS/cli publish app-android --type appResource --project uni-chat-uts
# app-android 换成 app-harmony / app-ios 各跑一次

# android 的类型检查必须用这条，约 75~135 秒一轮
/Applications/HBuilderX.app/Contents/MacOS/cli launch app-android --project uni-chat-uts --compile true
```

- ⚠️ **`publish --type appResource` 只出前端产物，android 端不跑 Kotlin 编译** —— 下面「android 五条硬规则」那一整类错误它一条都报不出来。日志里能看到「正在编译为 android class」才算真编了
- `cli publish` 需要 HBuilderX 在后台运行；`--project` 传的是**工程名不是路径**，写 `--project .` 会报「项目 . 不存在」
- **没被任何页面引用的组件不会参与编译**，新组件要么接进页面，要么临时挂一个页面进 pages.json 编一次再摘掉
- `check-uvue-css.js` **查不出非法选择器**：`.org-row .row-title` 这种后代选择器（uni-app x 不支持）它一声不吭，只有 `cli publish` 会报 `Invalid selector`
- **编译通过 ≠ 跑得对，改完必须真机验证（当前主力测试平台是鸿蒙，其次 Android）**

### android 编译的五条硬规则（鸿蒙能过、android 过不去）

编译器**一轮只报 4 条错误就停**，改完必须反复编到干净，不能看到「没报」就以为改完了。

1. **class 类型的 props，模板里取不到成员。** `defineProps<{ message: Message }>()` 编译出来是 `open var message: Any by $props`，模板里 `message.direction` 一律报「找不到名称 xxx」。**数组和基础类型不受影响**。修法：script 里 `as` 好类型，用 `computed` 暴露给模板
   ```uts
   const isOut = computed<boolean>((): boolean => (props.message as Message).direction == 0)
   ```
2. **模板里用到的导入函数必须是箭头函数常量。** 模板表达式编译成 `unref(fontPx)(10)`，`unref` 要求它是个**值**；`export function` 落成 Kotlin 的 `fun` 不能当值用。所以 `px/fontPx/iconPx/rowPx` 全部写成 `export const x = (...) => {}`
3. **`Int` 和 `Number` 不通用。** 变量显式标 `: number`。**数字比较一律 `==` / `!=`，不要写 `===` / `!==`** —— 后者落成 Kotlin 的引用相等，编译器只给 warning，错在运行时（voip 页踩过）。`UTSJSONObject.toMap()` 落成 kotlin `Map`，跨端遍历动态 key 要用 `UTSJSONObject.keys(obj)`
4. **`<script setup>` 里的 `const` 是顺序执行的 `val`**，两个 `computed` 互相引用时被引用的那个必须写在前面
5. **箭头常量不能递归调自己。** 要递归就写成 `function load(): void {}` —— 但这样它就不能再出现在模板里了（见第 2 条），两者互斥

另：**`defineOptions({...})` 里最后一个属性后面不能留注释。** android 端的 SFC 转换会把尾随注释甩到对象字面量外面，报的还是编译产物的行号，很难定位；鸿蒙那条路径完全不受影响。

### list-view 是复用渲染（会话列表塌掉的教训）

鸿蒙 vapor 下 `list-view` + `list-item` 编译出的是**复用（recycle）路径** —— 产物里能看到 `createRecycleContext()` / `preCreateSharedDataRecycleFor()`，节点按 class id 预分配槽位、只推数据。

1. **尺寸（height / width）留在 class 里**，只把颜色搬到 `:style`
2. **不要给 `list-item` 本身加动态 `:style`**，置顶态之类用 `:class` 在两个静态类之间切
3. 别把同一个尺寸表达式在模板里写两遍 —— 编译器会合并成同一个对象实例推给多个槽位

`check-uvue-css.js` 和三端编译对这类问题**完全无感**，只有真机能暴露。

### 写组件的两个静默坑

1. **组件引用不到全局 class。** 页面默认 `styleIsolation: 'app'`（吃得到 global.css），**组件默认 `isolated`（吃不到）**。组件里写 `class="icomoon"` 是个空类，图标字形直接不渲染、不报错。修法：组件内自己声明一遍 `.icomoon { font-family: "icomoon"; }`。字体本身是 App.uvue 里 `loadFontFace({ global: true })` 加载的，全局可用，**被隔离的只是 CSS 类**
2. **`text` 带 `overflow: hidden` 必须有确定宽度。** 别写「标题 `flex-shrink: 0` + 一个 `flex: 1` 占位 view」—— 鸿蒙上占位 view 会把宽度抢光，两个字的「关于」都会变成省略号。正确写法：要截断的文字自己 `flex: 1`，右侧次要值 `flex-shrink: 0`

### 其他已知约束

- **`aspect-ratio` 三端都不支持**，百分比宽撑不出正方形。媒体网格的方格边长要算好后走 `:style` 下发
- **icomoon 子集只收了 `f100`–`f4f7` 这 734 个码位**，写不在表里的码位会渲染成豆腐块且不报错。**新加图标前先 dump ttf 的 cmap 表核对**
- **时间单位**（最容易写错）：`getMessageCountByDay` 用**秒**；`searchMessageByTypesAndTimes` / `getMessagesInTypesAndTimes` 用**毫秒**

### har 导出表怎么查（鸿蒙缺方法编译期无感）

har 里没有 `.d.ets`，NAPI 少一个方法只会在真机点到时报 `not a function`。核对方法：

```bash
T=$(mktemp -d); tar -xf harmony-configs/libs/marswrapper.har -C $T
SO=$(find $T -name 'libmarswrapper.so' | head -1)
strings -a "$SO" | grep -x 'getDomainInfo'      # 有输出即导出了
```

同理，uts 插件少导出一个 `export function`（插件走运行时 proxy）也是编译期无感、真机才报。

---

## 八、验收基线

日常功能已在真机上反复迭代过（见 git 历史里那批 `修复 Android 端…` / `修复鸿蒙…` 的 commit），下面只保留**不会被日常使用顺带覆盖到、必须专门走一遍**的项：

1. **深色模式 + 最大字号全量扫一遍。** 重点看这几处定宽 + 动态字号的组合：
   - 三个复用渲染的 list-view 页（黑名单 / 文件列表 / 收藏）—— 行有没有塌成 0 高
   - 成员网格（5 列 20% 定宽 + 动态行高）、日历（7 列定宽 + 32px 圆点）、朋友圈九宫格
   - 长按菜单的 4 列图标格、投票详情的选项行（勾选框 + 文字 + 「N票 · NN%」挤一行）
   - 登录页协议行（「我已阅读并同意 用户协议 和 隐私政策」要能折行而不是被裁掉）
2. **杀进程重进后设置项保持。** 所有读写 user setting 的开关（消息通知五项、隐私三项、谁可以找到我、免打扰时段、朋友圈陌生人十条）—— 写完要等服务端回推，这条最容易出问题
3. **服务不可用时的兜底。** 分别把 `POLL_SERVER` 指到不通地址、停掉服务端朋友圈服务、`ASR_SERVER` 置空 —— 各页面应给提示而不是白屏卡住；置空时对应入口应整体不出现
4. **二维码真机扫码。** 群二维码要用**另一台手机的微信/系统相机**扫得出 `wildfirechat://group/...`（桌面端对拍已做过三层验证：ISO/IEC 18004 标准向量比对、UTS 与 JS 原型 242 条逐位一致、OpenCV 端到端解码 240 条成功 237 条，与 segno 统计上无差别）
5. **推送正文。** A 给 B 发图片/视频/语音/表情各一条，**B 退到后台**，看系统通知正文是不是 `[图片]`/`[视频]`/`[语音]`/`[动态表情]` 而不是空白（这几类的 `searchableContent` 是补过的）
6. **iOS 端整体过一遍。** 当前主力是鸿蒙 + Android，iOS 除了已知的朋友圈 254，其余功能基本没系统走过
7. **权限分支。** 用非群主、非管理员的普通成员账号把群信息页和群管理页各走一遍 —— 群管理入口应不可见，成员网格的减号格应不可见
