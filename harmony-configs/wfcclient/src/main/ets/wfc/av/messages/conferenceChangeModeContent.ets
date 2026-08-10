/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from "../../messages/messageContent";
import MessageContentType from "../../messages/messageContentType";
import MessagePayload from '../../messages/messagePayload';
import Message from '../../messages/message';
import wfc from "../../client/wfc";

/**
 * 主持人请求某个成员切换观众/互动者身份。
 * content 放 callId，binaryContent 为 base64(JSON)，字段 a=audience。
 * 编解码必须与 UTS 侧 wfc/av/messages/conferenceChangeModeContent.uts 完全一致。
 */
export default class ConferenceChangeModeContent extends MessageContent {
    callId = '';
    audience = false;

    constructor(callId = '', audience = false) {
        super(MessageContentType.CONFERENCE_CONTENT_TYPE_CHANGE_MODE);
        this.callId = callId;
        this.audience = audience;
    }

    digest(message?: Message): string {
        return '[会议模式变更]';
    }

    encode() {
        let payload = super.encode();
        payload.content = this.callId;

        let obj = {
            a: this.audience,
        } as Data;
        payload.binaryContent = wfc.utf8_to_b64(JSON.stringify(obj));

        return payload;
    }

    decode(payload: MessagePayload) {
        super.decode(payload);
        this.callId = payload.content;
        if (payload.binaryContent) {
            let obj = JSON.parse(wfc.b64_to_utf8(payload.binaryContent)) as Data;
            this.audience = obj.a;
        }
    }
}

class Data {
    a = false;
}
