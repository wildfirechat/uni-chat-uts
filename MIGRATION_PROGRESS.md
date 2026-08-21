# uni-app → uni-app x 迁移进度与约定

> 本文档是迁移工作的唯一事实来源。每完成一个文件的转换，必须更新下面的清单。
> 范围：全部功能迁移，**音视频通话（voip/av engine）、对讲（ptt）除外**（用户明确暂不支持）。
> 目标：UI 与功能与原 uni-app 版本保持一致。原 .js/.vue 文件在对应 .uts/.uvue 完成后删除（git 保留历史）。

## 〇、组合式 API（蒸汽模式）迁移 ✅ 已完成

> 蒸汽模式（Vapor）仅支持组合式 API，不支持选项式。全部 `.uvue` 的 `<script>` 块已从选项式
> 迁移到 `<script setup lang="uts">`（模板与 style 未改动），`get_errors` 全项目 0 错误。

迁移约定（后续新增/改动 .uvue 必须遵守）：

- `export default { name }` → `defineOptions({ name })`；`components: {}` 注册不再需要（import 即注册）。
- `props: { x: { type, default } }` → `withDefaults(defineProps<{...}>(), {...})`，模板里直接用，脚本里用 `props.x`。
- `data()` → `ref<T>()`，脚本内访问用 `.value`，模板自动解包。
- `computed` → `computed<T>((): T => ...)`，内部引用 ref/computed 需 `.value`。
- `methods` → `const fn = () => {}`（箭头函数），定义在使用之前（UTS 静态"used before declaration"检查）。
- `mounted/beforeUnmount/onLoad/onUnload/onShow/onHide/onBackPress` → `onMounted/onBeforeUnmount/onLoad/onUnload/onShow/onHide/onBackPress` 回调形式。
- `watch` → `watch(ref, handler, { deep, immediate })`。
- `this.$nextTick` → `nextTick`（自动导入）；`this.$emit` → `emit()`（`const emit = defineEmits([...])`）。
- 子组件方法需父组件 `$callMethod` 调用时，子组件必须 `defineExpose({ methodName })`。
- ref 泛型：数组 `ref<T[]>([] as T[])`；可空 `ref<T | null>(null as T | null)`；模板引用 `ref<ComponentPublicInstance | null>(null)`。
- ref、computed、watch、生命周期、nextTick 等均为自动导入，无需 import。

## 一、总体架构决策（已定，不要反复）

1. **就地迁移**：dev-unix 分支，`.js → .uts`、`.vue → .uvue`。
2. **底层插件不动**：`uni_modules/wfc-client` 已是 UTS 插件且声明支持 uni-app-x（HBuilderX ^4.84）。
3. **64 位整数**：`messageUid` 等一律用 **string**；`timestamp` 用 number（毫秒）。
   `wfc/util/longUtil.uts`：eq/gt/gte/lt/lte/compare/numberValue/stringValue/longValue/_patchToJavaLong/_reverseToJsLongString。
4. **JSON 解析**：模型类均有 `static fromJsonObject(obj: UTSJSONObject)`，用 getString/getNumber/getBoolean/getArray/getJSON 显式取值。
5. **消息工厂**：`MessageConfig.MessageContents` 为 `MessageContentRegistry[]`（含 `creator: () => MessageContent`）；`MessageConfig.createMessageContent(type)` 替代动态 clazz；自定义消息注册 `wfc.registerMessageContent(name, flag, type, creator)`。
6. **三层合一**：proto.min.js + utsWfcClient.js + wfc.js → `wfc/client/wfc.uts` 单文件门面（对外 API 名不变，含 eventEmitter、defaultUserPortrait/defaultGroupPortrait、native 事件分发 _handleNativeEvent）。`wfc/proto/*` 不再使用。
7. **EventEmitter**：`wfc/util/eventEmitter.uts`。监听器签名 `(args: Array<any|null>) => void`，emit 传参数数组，监听方按位置取参转型。事件参数顺序与原 EventType 注释一致。
8. **循环依赖规避**：消息类不 import wfc；改用：
   - `wfc/client/userBrief.uts`：getUserId/getUserInfo/getUserInfos/getUserDisplayName/getGroupMemberDisplayName（直接调插件）。
   - `wfc/util/base64.uts`：utf8_to_b64/b64_to_utf8（纯 UTS 实现）。
   - digest 签名：基类 `digest(message: any | null = null): string`；子类 override 时**不带默认值**（Kotlin 语义）。formatNotification(message: any | null) 同理。
   - RecallMessageNotification 增加 `_conversation` 字段（fromProtoMessage 时填充，用于群撤回显示名）。
9. **状态管理**：去 pinia。`store.uts`：每个子 store 是 UTS class（字段全部显式声明，含原来动态补丁的 `_xx` 字段），实例经 `reactive()` 导出；action 方法在 `store` 默认导出对象上，方法名与原 store.js 一致。页面用 computed 引用 store 状态。⚠️ 待编译验证 reactive(class 实例) 在 app 平台的支持。
10. **i18n**：`i18n/i18n.uts` 提供 t/t1/t2 + setLocale/getLocale；语言包 `i18n/lang-*.uts`（由 assets/lang/*.json 生成）。页面 `$t('x')` → `t('x')`。
11. **v-html 移除**：文本消息分段渲染（text/link 分段 + v-for）；emoji 直接用系统 unicode 渲染（不再用 twemoji 图片）。
12. **pinyin**：`common/pinyin.uts`（pinyinOf/pinyinFirstLetters）+ `common/pinyinData.uts`（由 node_modules/pinyin dict-zi 生成，0x4E00-0x9FA5 首读音无声调，分块字符串防 Kotlin 64KB 限制）。
13. **导航栏按钮**：uni-app x 不支持 titleNView buttons。ConversationListPage/ConversationPage/ChannelListPage/ContactListPage/NewFriendListPage 已在 pages.json 设为 navigationStyle:custom，需页面内自定义导航栏（计划 `pages/common/NavBar.uvue`）。
14. **页面参数传递**：`common/nav.uts`：navigateToPage(url, options)（全局栈暂存）+ takePageOptions()（页面 onLoad 取）+ go2ConversationPage() + notify(text)。替代 eventChannel 与 globalProperties。
15. **事件总线**：`common/eventBus.uts`（$on/$off/$emit），替代 mitt。
16. **voip/ptt**：voip（单聊/多人/会议）与 ptt 已接入，见 uni_modules/wfc-av-client、wfc/av、pages/voip。wfc/av/messages 里 voip 信令消息（callAnswer/callBye/callSignal…）仍是 voipStubMessageContent.uts 占位——原生 SDK 自己收发这些信令，应用层不需要解析；会议指令类（conferenceCommand/ChangeMode/KickoffMember）是完整实现。会议依赖高级版音视频 SDK，见 README-AV.md。
17. **Config**：config.uts（class 静态字段；ICEServer 类；去掉了动态 Config.config()——无人使用）。ENABLE_VOIP/ENABLE_PTT 置 false。

## 二、关键技术风险（编译/运行时验证点）

- [ ] `reactive(new Class())` 支持情况；不行则改 UTSJSONObject。
- [ ] native 回调 args：sendMessage 等回调收到 `(value: object)`，wfc.uts 用 argsOf() 转数组（instanceof Array + JSON 兜底）；wfc-event 事件对象取 `.args`（UTSJSONObject/JSON 兜底）。⚠️ 真机验证。
- [ ] JSON.parse<Array<string>> / JSON.parseObject / JSON.parseArray / obj.get() 的可用性与语义。
- [ ] `uni.env.CACHE_PATH` + FileSystemManager（compositeMessageContent.createTextFile）。
- [x] @font-face 自定义 iconfont（uni-app x 用 loadFontFace + 文本内联 unicode；⚠️ 已修复两次：①wx_iconfont.ttf/customicons.ttf 内部字体名均为 "iconfont"，鸿蒙 Render Service 注册同名冲突导致图标不显示，已将内部名改为 wxfont/customicons；MessageInputView/VideoMessageContentView 误用 customicons 类引用 wxfont 字形，已改为 wxfont；②蒸汽模式(vapor)强制样式隔离2.0，组件默认 isolated 不可引用全局 class，已给全部 11 个使用图标类的组件加 defineOptions({ styleIsolation: 'app' })：NavBar/MessageInputView/VideoMessageContentView/AudioMessageContentViewAMR/CallStartMessageContentView/NormalOutMessageContentContainerView/QuoteMessageView/MessageMultiSelectActionView/ConversationItemView/round-checkbox/main-action-menu）；video/switch/slider/picker-view 组件可用性。
- [ ] uni.getPushClientId/onPushMessage（App.uvue）。
- [ ] messageConfig 中 default 参数覆盖的构造器（各消息类构造函数已带默认参数）。

## 三、文件转换清单

标记：[x] 已完成 [ ] 未开始 [-] 不迁移

### 骨架/基础设施
- [x] manifest.json（uni-app-x）
- [x] pages.json（去 voip、5 个页面改 custom 导航）
- [x] config.js → config.uts
- [x] wfcScheme.js → wfcScheme.uts
- [x] i18n/i18n.uts + lang-zh-CN/zh-TW/en.uts（生成）
- [x] common/eventBus.uts、common/nav.uts、common/pinyin.uts、common/pinyinData.uts
- [x] wfc/util/eventEmitter.uts、longUtil.uts、base64.uts
- [x] pages/util/storageHelper.uts、helper.uts
- [ ] main.js → main.uts
- [ ] App.vue → App.uvue
- [ ] global.css / wfc.css 适配
- [ ] pages/common/NavBar.uvue（新）

### wfc/client
- [x] wfcEvent.uts、connectionStatus.uts、userSettingScope.uts、errorCode.uts（后两个为 cp）
- [x] userBrief.uts（新）
- [x] messageConfig.uts（creator 工厂 + 62 项注册，voip 用 stub）
- [x] wfc.uts（三层合一门面，~1700 行）

### wfc/model（已全部完成）
- [x] conversation.uts（含 ConversationTarget 类，_target 统一类型）
- [x] conversationInfo.uts、userInfo.uts（clone()+补丁字段）、nullUserInfo、groupInfo、nullGroupInfo、groupMember、unreadCount、channelInfo、NullChannelInfo、channelMenu、chatRoomInfo、chatRoomMemberInfo、friendRequest、friend、readEntry、fileRecord、userOnlineState、userClientState、userCustomState、pcOnlineInfo、modifyMyInfoEntry、mention、userSettingEntry、pcsession、secretChatInfo、internal/friendInfo、quoteInfo（QuoteInfo.init(uid,from,digest) 替代 initWithMessage）、conversationSearchResult、groupSearchResult
- [x] 枚举 cp：conversationType/groupType/groupMemberType/searchType/modifyMyInfoType/modifyGroupInfoType/pcOnlineType/secretChatState/ModifyChannelInfoType
- [-] favItem.js（无人使用，暂不迁移）

### wfc/messages（已全部完成）
- [x] messagePayload（toJsonObject/toJsonStr/fromJsonObject）、messageContent、mediaMessageContent、message（fromProtoMessage 仅移动端分支 + clone()）
- [x] text/ptext/image/video/sound(含 _isPlaying)/file(FILE_NAME_PREFIX)/sticker/location/link/card/composite(文件写入用 FileSystemManager)/articles(含 Article)/typing/markUnread/streaming×2/enterChannel/leaveChannel/channelMenuEvent/delete/pcLoginRequest/unknown/unsupport
- [x] notification 全部 20 个（基于 userBrief + base64）
- [x] 枚举 cp：messageStatus/persistFlag/messageContentMediaType/messageContentType
- [x] wfc/av/messages：callStartMessageContent.uts、conferenceInviteMessageContent.uts、conferenceCommandMessageContent.uts、conferenceChangeModeContent.uts、conferenceKickoffMemberMessageContent.uts、voipStubMessageContent.uts（voip 信令类仍为 stub）
- [x] wfc_custom_message 全部 4 个

### store
- [ ] store.js + pstore.js → store.uts（**下一步，进行中**）
  - 子状态类：ConversationState/ContactState/SearchState/PickState/MiscState（MiscState 补 isAppHidden 字段；inputClearHandler 改为 timer id number；misc.config 字段去掉，页面直接 import Config）
  - PreviewMediaItem/SendingProgress 辅助类
  - action 全量移植；pinyin 排序用 common/pinyin.uts

### pages/util
- [ ] draft.js、clipboard.js、imageUtil.js（转换页面时一并处理）

### common/
- [ ] picker.js（$pick）、forward.js（$forward）→ 改为导出函数 + 参数经 nav.uts 传递
- [ ] permission.js（plus.* 需重写或用 uni-app x API）

### components/
- [ ] chunLei-popups、main-action-menu、uni-list

### store / api / 组件 / 页面（进行中，最新状态）
- [x] store.uts（含 5 个 reactive 子状态 + 全部 action；PreviewMediaItem/MediaProgress 类）
- [x] main.uts、App.uvue（onLaunch 里 wfc.init/store.init/loadFontFace/push）、global.css、wfc.css
- [x] api/appServerApi.uts(+LoginResult)、appServerError.uts、organizationServerApi.uts、organizationServerError.uts
- [x] common/picker.uts（pickUsers/pickUser + currentXxxOptions/notifyPickedXxx 模式）、common/forward.uts（forward/currentForwardOptions）
- [x] components/chunLei-popups/chunLei-popups.uvue + popupMenu.uts（PopupMenuItem 类，上下文数据由调用方自存）
- [x] components/main-action-menu/main-action-menu.uvue
- [x] pages/common/NavBar.uvue（自定义导航栏：title/showBack/rightIcon1/rightIcon2 + right1Tap/right2Tap）、LoadingView.uvue（简化）
- [x] pages/util/helper.uts、draft.uts(+DraftContent)、storageHelper.uts
- [x] pages/SplashPage.uvue、login/LoginPage.uvue
- [x] conversationList/ConversationListPage.uvue（NavBar 图标  搜索  加号）+ ConversationItemView.uvue
- [x] conversation/emojiStickerConfig.uts（生成）、MessageInputView.uvue、message/AudioInputView.uvue
- [x] conversation/message/：MessageContentContainerView、QuoteMessageView、NormalIn/Out 容器、Notification/RecallNotification、Contextable/RichNotification/Articles、MessageMultiSelectActionView、messageEvents.uts(OpenMessageContextMenuEvent)
- [x] conversation/message/content/：Text/StreamingText/Image/Video/Sticker/File/AudioAMR/Composite/UserCard/CallStart/ConferenceInvite/Unknown/Unsupport/TestCustom（全部完成）
- [x] conversation/ConversationPage.uvue（custom NavBar+返回+更多；scroll-view 下拉刷新加载历史；eventBus openMessageContextMenu(OpenMessageContextMenuEvent)/reeditMessage/contextMenuClosed；watch messageList 自动滚底；语音播放统一在本页 innerAudioContext）
- [x] conversation/SingleConversationInfoPage、GroupConversationInfoPage、message/CompositeMessagePage、forward/ 全部4个（extraText 经 $callMethod('getExtraText')）
- [x] pages/util/clipboard.uts（仅 copyText）
- [x] user/UserListView.uvue（emitClickEvent+userClick 事件替代函数 prop）、CheckableUserListView.uvue
- [x] contact/：ContactListPage(custom NavBar)、OrganizationListView、FriendRequestListView、NewFriendListPage、GroupListPage、GroupListView、ChannelListPage、UserDetailPage、FriendRequestDetailPage、SearchUserPage、OrganizationTreePage（组织路径改逐级加载）
- [x] pick/PickUserPage、PickSingleUserPage（经 common/picker.uts currentXxxOptions/notifyPickedXxx）
- [x] discovery/DiscoveryPage（去会议入口）、ChatroomListPage
- [x] me/MePage（头像上传 uploadMediaFile+modifyMyInfo）
- [x] misc/WebViewPage、PreviewMediaPage（原 PreviewVideoPage，已与图片预览合并）
- [x] search/SearchPortalPage（options 拆成4个 boolean props）、SearchResultView、SearchConversationMessagePage（SearchState 增加 conversation 字段）
- [x] voip/Single.uvue、voip/Multi.uvue、voip/conference/*（Portal/Create/Order/Join/Info/Conference/Manage；会议入口按 avEngineKit.isSupportConference() 显隐）
- [ ] workspace/WorkspacePage、WorkspaceWebViewPage（nvue+JS bridge，待做，可先简化为 web-view+authCode）
- [ ] misc/ApiTestPage（待做）
- [-] pick/PickerConversationPage、pick/CheckableOrganizationTreeView、contact/GroupDetailView(未路由)、test/*(未路由)、message/PreviewMessageView、MessageReceiptDetailView、DeleteMessageDialogView(未被引用则不迁)
- [ ] 清理：删除旧 .js/.vue/.nvue、wfc/proto、wfc/av engine、wfc/ptt、pages/voip、emoji/、common/stringify-object.js、permission.js
- 图标映射表：scratchpad/iconmap.json（class→unicode）

### 清理（最后统一做）
- [ ] 删除已被 .uts 替换的 .js 原文件（wfc/**、config.js、wfcScheme.js、store.js、pstore.js、main.js、App.vue、pages/util/*.js、common/*.js 等）
- [ ] 删除 wfc/proto/、wfc/av/engine|internal、wfc/ptt、pages/voip
- [ ] package.json 依赖清理（pinia/vue-i18n/long/mitt/events/pinyin 等均不再需要）

## 四、下一步顺序

1. store.uts（正在写）
2. main.uts + App.uvue + 全局 CSS + NavBar.uvue
3. 核心页面：SplashPage → LoginPage → ConversationListPage（+子视图）→ ConversationPage（+MessageInputView+消息内容视图）
4. 其余页面批量转换
5. 清理旧文件，HBuilderX cli 创建自定义基座/编译验证

## 五、页面转换 checklist（每个 .vue → .uvue 都过一遍）

- template：div→view，span/p/h*→text，img→image，a→text+tap，ul/li→view，i(图标)→text+iconfont class，v-html→分段渲染，button/input/textarea/switch 保留
- 文本必须包在 <text> 里；class 绑定语法不变
- script：lang="uts"；data() 返回字段全部有类型（null 用 `null as X | null`）；props 用 type+default；methods 参数/返回值加类型
- $t → import { t }；$navigateToPage → navigateToPage()；$notify → notify()；$eventBus → eventBus；$go2ConversationPage → go2ConversationPage()；$pick/$forward → common 里的函数
- store：`import store, { conversationState, ... } from '@/store.uts'`，模板绑定经 computed
- style：去 :root 变量（内联值）、去 HTML 标签选择器、只用 flex；百分比高度改 flex:1
- onLoad 里 takePageOptions() 取参数
