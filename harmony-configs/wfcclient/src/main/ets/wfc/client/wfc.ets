/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import util from '@ohos.util';
import protoProxy from '@wfc/marswrapper';

import Long from '../util/long';
import Conversation from '../model/conversation';
import Message from '../messages/message';
import MessageContent from '../messages/messageContent';
import MessagePayload from '../messages/messagePayload';
import {
    CallbackWithValue_1_OrNull,
    CallbackWithValue_2_OrNull,
    FailCallbackOrNull
} from '../type/types';

const TAG = 'wfc-client-shim';

const base64Helper = new util.Base64Helper();
const textEncoder = new util.TextEncoder('utf-8');
const textDecoder = util.TextDecoder.create('utf-8');

/**
 * avenginekit.har 依赖的 `@wfc/client` 门面，只实现它真正调用到的方法，
 * 底层直接复用已经打进 App 的 `@wfc/marswrapper`（同一个 libmarswrapper.so 实例，
 * 与 UTS 侧 wfc-client 插件共用同一条连接）。整体说明见模块根目录 README.md。
 *
 * 注意：这里发出去的信令消息不会经过 UTS 侧 `wfc.uts` 的发送封装，
 * 因此不会触发 onSendPrepare/onSendSuccess 事件。这与 Android/iOS 上
 * 原生 AVEngineKit 自行发信令的行为一致（通话相关消息在重新加载会话时才出现在消息列表）。
 */
export class WfcClientShim {

    getUserId(): string {
        // 注意：libmarswrapper.so 导出的是 getCurrentUserId，没有 getUserId
        // （UTS 侧 wfc-client 插件里那行 getUserId 是注释掉的，别照抄）
        return protoProxy.getCurrentUserId() as string;
    }

    /**
     * 服务器时间和本地时间的差值
     */
    getServerDeltaTime(): number {
        return protoProxy.getServerDeltaTime() as number;
    }

    getMessageByUid(messageUid: Long | string | number): Message | null {
        const str = protoProxy.getMessageByUid(Long.fromValue(messageUid).toString()) as string;
        if (!str) {
            return null;
        }
        try {
            return Message.fromProtoMessage(JSON.parse(str) as Record<string, Object>);
        } catch (e) {
            console.error(TAG, 'getMessageByUid parse failed', JSON.stringify(e));
            return null;
        }
    }

    updateMessageContent(messageId: number, messageContent: MessageContent): void {
        const payload: MessagePayload = messageContent.encode();
        protoProxy.updateMessage(messageId, JSON.stringify(payload));
    }

    /**
     * 发送消息。参数顺序与 hm-chat 的 wfc.sendConversationMessage 保持一致，
     * avenginekit 会按 (conversation, content, toUsers, null, null, null, successCB, failCB) 调用。
     */
    sendConversationMessage(conversation: Conversation, messageContent: MessageContent, toUsers: string[] = [],
        preparedCB: CallbackWithValue_2_OrNull<number, number> = null,
        progressCB: CallbackWithValue_2_OrNull<number, number> = null,
        uploadedCB: CallbackWithValue_1_OrNull<string> = null,
        successCB: CallbackWithValue_2_OrNull<Long, number> = null,
        failCB: FailCallbackOrNull = null): void {
        const payload: MessagePayload = messageContent.encode();
        protoProxy.sendMessage(JSON.stringify(conversation), JSON.stringify(payload), toUsers, 0,
            (messageId: number, timestamp: number) => {
                preparedCB?.(messageId, timestamp);
            },
            (uploaded: number, total: number) => {
                progressCB?.(uploaded, total);
            },
            (mediaUrl: string) => {
                uploadedCB?.(mediaUrl);
            },
            (messageUid: string, timestamp: string) => {
                successCB?.(Long.fromValue(messageUid), Long.fromValue(timestamp).toNumber());
            },
            (errorCode: number) => {
                console.error(TAG, 'send voip message failed', messageContent.type, errorCode);
                failCB?.(errorCode);
            });
    }

    /**
     * 只被 AddParticipants/MuteVideo 这类通知消息的 formatNotification 用到，
     * 而 avenginekit 从不调用 formatNotification（通知文案由 UTS 侧的消息类负责），
     * 这里返回 userId 兜底即可。
     */
    getGroupMemberDisplayName(_groupId: string, memberId: string): string {
        return memberId;
    }

    utf8_to_b64(str: string): string {
        return base64Helper.encodeToStringSync(textEncoder.encodeInto(str));
    }

    b64_to_utf8(str: string): string {
        if (!str) {
            return '';
        }
        return textDecoder.decodeToString(base64Helper.decodeSync(str));
    }
}

const self = new WfcClientShim();

export default self;
