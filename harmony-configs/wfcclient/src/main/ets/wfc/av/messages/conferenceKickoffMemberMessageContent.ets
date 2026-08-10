/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import MessageContent from "../../messages/messageContent";
import MessageContentType from "../../messages/messageContentType";
import MessagePayload from '../../messages/messagePayload';
import Message from '../../messages/message';

/**
 * 主持人把成员移出会议。只有 callId 一个字段，放在 content 里。
 * avenginekit 只接收这个类型（自己不发），但收消息时要能解出 callId，
 * 所以适配层必须有对应的类，否则 message.ets 只能给个基类占位、
 * avenginekit 读 messageContent.callId 会拿到 undefined。
 * 编解码必须与 UTS 侧 wfc/av/messages/conferenceKickoffMemberMessageContent.uts 完全一致。
 */
export default class ConferenceKickoffMemberMessageContent extends MessageContent {
    callId = '';

    constructor(callId = '') {
        super(MessageContentType.CONFERENCE_CONTENT_TYPE_KICKOFF_MEMBER);
        this.callId = callId;
    }

    digest(message?: Message): string {
        return '[被移出会议]';
    }

    encode() {
        let payload = super.encode();
        payload.content = this.callId;
        return payload;
    }

    decode(payload: MessagePayload) {
        super.decode(payload);
        this.callId = payload.content;
    }
}
