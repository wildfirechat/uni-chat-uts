# wfcclient —— 鸿蒙端 `@wfc/client` 适配层（源码）

> 本目录是**源码**，构建产物是
> `uni_modules/wfc-av-client/utssdk/app-harmony/libs/wfcclient.har`。
> 改完源码后执行 `./build-har.sh` 重新生成 har，两者要一起提交。

## 这是什么

`uni_modules/wfc-av-client` 的鸿蒙实现直接使用了野火官方的 **ArkTS 版音视频 SDK**
`@wfc/avenginekit`（`uni_modules/wfc-av-client/utssdk/app-harmony/libs/avenginekit.har`，
取自原生鸿蒙工程 hm-chat 的 `uikit/libs/avenginekit.har`）。

和 Android/iOS 不同，鸿蒙版 avenginekit 不是一个自包含的原生库，而是一份用 ArkTS 写的
WebRTC 信令实现，它在编译产物里**硬编码**了对野火原生鸿蒙工程里 `@wfc/client` 模块的引用：

```
@wfc/client                                             // wfc 单例
@wfc/client/src/main/ets/config                         // Config.ICE_SERVERS
@wfc/client/src/main/ets/wfc/av/messages/*              // 各类 voip 信令消息
@wfc/client/src/main/ets/wfc/messages/{message,messageContent,messageContentType}
@wfc/client/src/main/ets/wfc/model/{conversation,conversationType,userInfo}
@wfc/client/src/main/ets/wfc/client/wfcEvent
@wfc/client/src/main/ets/wfc/util/{long,longUtil}
@wfc/client/src/main/ets/wfc/type/types
```

本项目（uni-app x）的 IM 层是 UTS 写的（`wfc/**`），并不存在这样一个 ArkTS 包，
所以这里提供一个**最小适配层**：包名就叫 `@wfc/client`，目录结构与 hm-chat 的 client 模块
一一对应，但只实现 avenginekit 真正用到的那一小部分。

## 为什么不直接把 hm-chat 的 client 模块搬过来

hm-chat 的 `client` 模块是完整的 IM SDK（156 个 .ets），并且自带一份
`libmarswrapper.so`。本项目已经通过 `libs/marswrapper.har` 打包了同一个 so，
搬过来会出现 so 重复打包、以及 `setReceiveMessageListener` 等单例监听器被覆盖的问题。

因此这里只保留纯数据/编解码相关的类（从 hm-chat 原样拷贝），
而 `wfc.ets` 门面只实现 avenginekit 用到的那几个方法，底层复用已经打进 App 的
`@wfc/marswrapper`（同一个 libmarswrapper.so 实例，和 UTS 侧共用一条连接）：

| avenginekit 调用            | 本适配层实现                                   |
| --------------------------- | ---------------------------------------------- |
| `getUserId()`               | `marswrapper.getUserId()`                      |
| `getServerDeltaTime()`      | `marswrapper.getServerDeltaTime()`             |
| `getMessageByUid(uid)`      | `marswrapper.getMessageByUid()` + 本地解码     |
| `updateMessageContent()`    | `marswrapper.updateMessage()`                  |
| `sendConversationMessage()` | `marswrapper.sendMessage()`                    |
| `sendConferenceRequestEx()` | `marswrapper.sendConferenceRequest()`          |

> `sendConferenceRequestEx` 是会议版 avenginekit 才用到的（create_room / join_pub / mute /
> kick / leave / keepalive 等会议信令走这条通道，不是 IM 消息）。
> native 的参数顺序是 `(sessionId, roomId, request, data, successCB, failCB, advance)`，
> **advance 在最后**，和 UTS 侧 `wfc.uts#sendConferenceRequestEx` 的签名不一样，
> 以 `uni_modules/wfc-client/utssdk/app-harmony/index.uts` 为准。

## 为什么要打成 har，而不是当源码模块用

鸿蒙工程开了 `useNormalizedOHMUrl` 之后：

- **源码模块**（`build-profile.json5` 里的 module）必须被引用方在**自己的**
  `oh-package.json5` 里显式声明，只写在工程根 `oh-package.json5` 里不管用
  （实测报 `Failed to resolve OhmUrl ... @wfc/client`）；
- 而 uts 插件生成的 `oh-package.json5` 只能通过 `utssdk/app-harmony/config.json` 配置，
  config.json 里的相对路径又会被编译器夹到插件目录以内（见
  `@dcloudio/uni-uts-v1/dist/arkts/index.js` 的 `parsePackageDeps`），指不到本目录；
- **har 依赖**没有这个限制：放进插件的 `libs/` 并写进 config.json 即可，
  连 avenginekit.har 内部的 `import '@wfc/client/...'` 也能正确解析（debug/release 都验证过）。

## 收消息

avenginekit 在 `setup(context, callback)` 时通过
`context.eventHub.on(EventType.ReceiveMessage, ...)` 订阅消息。
本项目的消息是 UTS 侧 `wfc.uts` 收到的，所以由
`uni_modules/wfc-av-client/utssdk/app-harmony/messageBridge.ets` 负责把原始 proto 消息
用本适配层的 `Message.fromProtoMessage` 解码后，emit 到同一个 eventHub 上。
链路见 `wfc/client/wfc.uts` → `EventType.ReceiveProtoMessages` → `avEngineKit.uts`
→ 插件 `dispatchReceivedMessages()`。

`messageBridge.ets` 里有一张 `VOIP_CONTENT_TYPES` 白名单，只有名单里的类型才会被解码后喂给引擎。
**升级 avenginekit 后如果它开始处理新的消息类型（比如会议版新增的 410 changeMode、411 kickoff），
要同时改三处**：白名单、`message.ets` 的 `createMessageContent`、以及对应的 `av/messages/*.ets`；
少改一处的表现是引擎收到消息但 `messageContent.callId` 是 undefined，静默不生效。

## 维护提示

- 升级 `avenginekit.har` 后，先用 `grep -rhoE '@wfc/client[a-zA-Z0-9_/.]*'` 检查它引用的
  文件列表有没有变化，缺文件会在编译期报 `Unresolved reference` / `Failed to resolve OhmUrl`。
- `messageContentType.ets` / `av/messages/*.ets` 等文件是从 hm-chat 原样拷贝的，
  改动前先确认 hm-chat 那边是不是也变了，两边的编解码必须完全一致，否则信令无法互通。
- 本适配层发出去的信令消息不经过 UTS 侧 `wfc.uts` 的发送封装，因此不会触发
  onSendPrepare/onSendSuccess 事件。这与 Android/iOS 上原生 AVEngineKit 自行发信令的行为一致
  （通话相关消息要重新加载会话才会出现在消息列表里）。
