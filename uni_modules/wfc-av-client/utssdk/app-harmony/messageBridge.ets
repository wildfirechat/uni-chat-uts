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
    MessageContentType.VOIP_Join_Call_Request,
    // 会议：主持人请求切换观众/互动者、把成员移出会议
    MessageContentType.CONFERENCE_CONTENT_TYPE_CHANGE_MODE,
    MessageContentType.CONFERENCE_CONTENT_TYPE_KICKOFF_MEMBER
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

/**
 * 把会议事件（janus videoroom 事件的原始 JSON 文本）emit 到 ability 的 eventHub 上。
 *
 * 高级版（会议版）avenginekit 在 setup() 时除了 EventType.ReceiveMessage，还监听了
 * EventType.ConferenceEvent（多人版不监听，所以之前只转发消息也能跑），媒体订阅全靠它：
 * 高级版所有通话（含单人/多人）都走 janus SFU，远端流必须显式 join_sub 订阅，而
 * 「谁发布了流」只有两个来源 —— join_pub 应答里的 publishers 列表，以及这条事件通道里的
 * data.publishers。发布是加入房间之后才完成的异步动作，双方几乎同时入会时两边的 publishers
 * 都是空，缺了这条通道就谁也不会去订阅谁，表现为接通后看不到对方画面（音频同理）。
 * 另外静音状态（mute）、离开/被踢（leaving/kicked）、观众列表（joining/attendees）也走这里。
 *
 * 事件体不解析，引擎的 onConferenceEvent 自己认字符串（内部 typeof === 'string' 时 JSON.parse）。
 */
export function emitConferenceEvent(context: common.UIAbilityContext, event: string): void {
    if (!event) {
        return;
    }
    context.eventHub.emit(EventType.ConferenceEvent, event);
}
