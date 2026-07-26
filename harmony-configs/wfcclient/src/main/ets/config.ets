/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

/**
 * avenginekit.har 只读取 `Config.ICE_SERVERS[0]`，形如 [url, username, credential]。
 * 真正的取值来自应用层 config.uts 的 Config.ICE_SERVERS —— UTS 侧在
 * `avEngineKit.init()` 里逐个调 `addICEServer()`，最终写到这里（见
 * uni_modules/wfc-av-client/utssdk/app-harmony/avengine.ets 的 addICEServer）。
 * 这里的默认值只是兜底，避免 addICEServer 之前就发起通话时下标越界。
 */
export default class Config {
    static ICE_SERVERS: string[][] = [['turn:turn.wildfirechat.net:3478', 'wfchat', 'wfchat123']];
}
