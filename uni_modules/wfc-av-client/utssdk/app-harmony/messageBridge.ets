import { common } from '@kit.AbilityKit';
import Message from '@wfc/client/src/main/ets/wfc/messages/message';
import MessageContentType from '@wfc/client/src/main/ets/wfc/messages/messageContentType';
import EventType from '@wfc/client/src/main/ets/wfc/client/wfcEvent';

const TAG = 'wfc-av-harmony';

/**
 * avenginekit 关心的 voip 消息类型。其余类型不用喂给引擎，
 * 免得每来一条普通消息都白解一次码。
 */
const VOIP_CONTENT_TYPES: number[] = [
    MessageContentType.VOIP_CONTENT_TYPE_START,
    MessageContentType.VOIP_CONTENT_TYPE_ACCEPT,
    MessageContentType.VOIP_CONTENT_TYPE_ACCEPT_T,
    MessageContentType.VOIP_CONTENT_TYPE_END,
    MessageContentType.VOIP_CONTENT_TYPE_SIGNAL,
    MessageContentType.VOIP_CONTENT_TYPE_MODIFY,
    MessageContentType.VOIP_CONTENT_TYPE_ADD_PARTICIPANT,
    MessageContentType.VOIP_CONTENT_TYPE_MUTE_VIDEO,
    MessageContentType.VOIP_Join_Call_Request
];

/**
 * 把 UTS 侧 wfc.uts 收到的原始 proto 消息（JSON 数组字符串）解码后，
 * emit 到 ability 的 eventHub 上 —— avenginekit 在 setup() 时正是在这个 eventHub 上
 * 监听 EventType.ReceiveMessage 的。
 *
 * 解析必须放在 .ets 里做：uts 的 JSON.parseArray 产出的是 UTSJSONObject，
 * 而 @wfc/client 适配层的 Message.fromProtoMessage 要的是原生 Record<string, Object>。
 */
export function dispatchProtoMessages(context: common.UIAbilityContext, messagesJson: string, hasMore: boolean): void {
    if (!messagesJson) {
        return;
    }
    let arr: Record<string, Object>[];
    try {
        arr = JSON.parse(messagesJson) as Record<string, Object>[];
    } catch (e) {
        console.error(TAG, 'parse proto messages failed', JSON.stringify(e));
        return;
    }
    if (!arr || arr.length === 0) {
        return;
    }
    const msgs: Message[] = [];
    for (const obj of arr) {
        const payload = obj.content as Record<string, Object>;
        if (!payload) {
            continue;
        }
        if (VOIP_CONTENT_TYPES.indexOf(payload.type as number) < 0) {
            continue;
        }
        const msg = Message.fromProtoMessage(obj);
        if (msg) {
            msgs.push(msg);
        }
    }
    if (msgs.length > 0) {
        context.eventHub.emit(EventType.ReceiveMessage, msgs, hasMore);
    }
}
