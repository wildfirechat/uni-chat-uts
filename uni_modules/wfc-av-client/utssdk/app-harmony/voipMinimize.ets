/**
 * 鸿蒙的「通话最小化」与「怎么回到通话页」。
 *
 * ---- 三件事 ----
 * 1. 长时任务（backgroundTaskManager）：退到后台后通话不被系统掐掉，同时系统会自动挂出一条
 *    「正在后台运行」的常驻通知 —— 这就是鸿蒙的通知栏通话通知，不需要我们自己 publish。
 *    点它会按 wantAgent 把 App 拉回前台，我们在 want 里塞一个标记，供第 2 条识别。
 *    ⚠️ 依赖 harmony-configs/entry/src/main/module.json5 里 EntryAbility 的 backgroundModes 声明。
 * 2. 前台监听：uni-app x 的 EntryAbility 在运行时模板里，我们钩不到它的 onNewWant。
 *    改用 applicationContext.on('abilityLifecycle')，在 onAbilityForeground 里读
 *    ability.lastRequestWant 的标记，认出「这次回到前台是点通知回来的」，回调应用层打开通话页。
 *    （对比 ../hm-chat 是在 EntryAbility.onNewWant 里读 want.parameters.continuousTaskLabel，
 *      本项目没有 EntryAbility 源码，只能从生命周期回调里绕。）
 * 3. 画中画（PiP）：鸿蒙没有 Android 那种跨应用悬浮窗权限（SYSTEM_FLOAT_WINDOW 是系统级权限，
 *    三方应用申请不到），系统认可的通话挂起 UI 就是画中画。实现照抄 ../hm-chat 的
 *    uikit/src/main/ets/pages/voip/{pipHelper,VoipPiPNodeController}.ets。
 *
 * ---- 为什么是 .ets 不是 .uts ----
 * @Builder / BuilderNode / NodeController 这些声明式 UI 的东西 uts 写不了；
 * Want.parameters、AbilityLifecycleCallback 这类 ArkTS 强类型结构在 uts 里也很难对上。
 * uts 可以直接调用同目录 .ets 里导出的函数（同 videoBuilder.ets / messageBridge.ets）。
 */
import { BuilderNode, FrameNode, NodeController, PiPWindow, UIContext } from '@kit.ArkUI'
import { AbilityLifecycleCallback, common, UIAbility, Want, wantAgent, WantAgent } from '@kit.AbilityKit'
import { backgroundTaskManager } from '@kit.BackgroundTasksKit'
import { BusinessError, deviceInfo } from '@kit.BasicServicesKit'

import avengineKitImpl from '@wfc/avenginekit'
import CallSession from '@wfc/avenginekit/src/main/ets/wfc/av/engine/callSession'
import CallState from '@wfc/avenginekit/src/main/ets/wfc/av/engine/callState'
import WFCVideoRenderController, { ScalingMode } from '@wfc/avenginekit/src/main/ets/wfc/av/xcomponent/WFCVideoRenderController'

const TAG = 'wfc-av-harmony-minimize'

/** 塞进长时任务 wantAgent 的标记：认出「App 是被通话通知拉回前台的」 */
const RESUME_WANT_KEY = 'wfcVoipResume'

// 通知/画中画上的文案。默认中文，应用层 avEngineKit.init() 会用当前语言的 i18n 词条覆盖一次
// （插件读不到 App 的 i18n，只能由应用层送进来）。
let textOngoing = '通话中'
let textWaitingAnswer = '等待接听'
let textConnecting = '接听中'

export function setVoipMinimizeTexts(ongoing: string, waitingAnswer: string, connecting: string): void {
    textOngoing = ongoing
    textWaitingAnswer = waitingAnswer
    textConnecting = connecting
}

function currentSession(): CallSession | null {
    const session = avengineKitImpl.getCurrentSession()
    if (session === undefined) {
        return null
    }
    if (session.status === CallState.STATUS_IDLE) {
        return null
    }
    return session
}

function stateText(session: CallSession): string {
    if (session.status === CallState.STATUS_OUTGOING || session.status === CallState.STATUS_INCOMING) {
        return textWaitingAnswer
    }
    if (session.status === CallState.STATUS_CONNECTING) {
        return textConnecting
    }
    return textOngoing
}

function durationText(session: CallSession): string {
    if (session.status !== CallState.STATUS_CONNECTED) {
        return ''
    }
    // connectedTime 是接通那一刻才赋值的，此前是 undefined —— 直接减会算出 NaN，
    // 渲染出来就是 "NaN:NaN"。统一按「算出来不大于 0 就当 0」兜住（同 index.uts 的 callDuration）。
    const elapsed = Math.floor((new Date().getTime() - session.connectedTime) / 1000)
    const sec = elapsed > 0 ? elapsed : 0
    const mm = Math.floor(sec / 60) % 60
    const ss = sec % 60
    const hh = Math.floor(sec / 3600)
    const pad = (n: number): string => n < 10 ? `0${n}` : `${n}`
    return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

// ------------------------------------------------------------------
// 1. 长时任务（= 鸿蒙的通话通知 + 后台保活）
// ------------------------------------------------------------------

export function startVoipBackgroundTask(context: common.UIAbilityContext): void {
    // 点通知拉起 ability 时带上这个标记，onAbilityForeground 据此判断要不要回通话页。
    // 不带标记的话，任何一次「切回 App」都会被误判成「用户想回到通话」。
    // 用先建后填而不是 { [KEY]: '1' }：ArkTS 的对象字面量不支持计算属性名。
    const wantParams: Record<string, Object> = {}
    wantParams[RESUME_WANT_KEY] = '1'
    const wantAgentInfo: wantAgent.WantAgentInfo = {
        wants: [
            {
                bundleName: context.abilityInfo.bundleName,
                abilityName: context.abilityInfo.name,
                parameters: wantParams,
            }
        ],
        actionType: wantAgent.OperationType.START_ABILITY,
        requestCode: 0,
        wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]
    }
    wantAgent.getWantAgent(wantAgentInfo).then((wantAgentObj: WantAgent) => {
        // VOIP 后台模式 API 13 才有，低版本退回录音模式
        const bgMode: backgroundTaskManager.BackgroundMode = deviceInfo.sdkApiVersion >= 13
            ? backgroundTaskManager.BackgroundMode.VOIP
            : backgroundTaskManager.BackgroundMode.AUDIO_RECORDING
        backgroundTaskManager.startBackgroundRunning(context, bgMode, wantAgentObj)
            .catch((err: BusinessError) => {
                // 9800002/201 基本都是 module.json5 里 EntryAbility 缺 backgroundModes 声明
                console.error(TAG, 'startBackgroundRunning failed', err.code, err.message)
            })
    }).catch((err: BusinessError) => {
        console.error(TAG, 'getWantAgent failed', err.code, err.message)
    })
}

export function stopVoipBackgroundTask(context: common.UIAbilityContext): void {
    backgroundTaskManager.stopBackgroundRunning(context)
        .catch((err: BusinessError) => {
            console.error(TAG, 'stopBackgroundRunning failed', err.code, err.message)
        })
}

// ------------------------------------------------------------------
// 2. 点通知回到通话页
// ------------------------------------------------------------------

let resumeCallback: (() => void) | undefined = undefined
let autoMinimizeCallback: (() => void) | undefined = undefined
let lifecycleId: number = -1

class VoipAbilityWatcher extends AbilityLifecycleCallback {
    onAbilityForeground(ability: UIAbility): void {
        // 先放宽成可空再判：lastRequestWant 的声明类型不可空，直接和 undefined 比 ArkTS 会报错
        const want: Want | undefined = ability.lastRequestWant
        if (want === undefined) {
            return
        }
        const params: Record<string, Object> | undefined = want.parameters
        if (params === undefined) {
            return
        }
        const marker: Object | undefined = params[RESUME_WANT_KEY]
        if (marker === undefined || `${marker}` !== '1') {
            return
        }
        // 消费掉标记，否则用户下次从后台切回来（不点通知）会被再次拽进通话页。
        // lastRequestWant 只在 onNewWant 时才被框架整体替换，这里改它是安全的。
        params[RESUME_WANT_KEY] = ''
        if (currentSession() === null) {
            return
        }
        // 画中画里点通知回来的情况：先把画中画收掉，再打开通话页，避免两份 UI 并存
        stopVoipPiP()
        resumeCallback?.()
    }
}

const abilityWatcher = new VoipAbilityWatcher()

/**
 * 「App 切到后台自动进了画中画」的回调：应用层据此把通话页收掉，
 * 结果和用户手动点最小化完全一致。见 onPiPStateChange 里 STARTED 分支的注释。
 */
export function setVoipAutoMinimizeCallback(onAutoMinimize: () => void): void {
    autoMinimizeCallback = onAutoMinimize
}

export function setupVoipResume(context: common.UIAbilityContext, onResume: () => void): void {
    resumeCallback = onResume
    if (lifecycleId >= 0) {
        return
    }
    try {
        lifecycleId = context.getApplicationContext().on('abilityLifecycle', abilityWatcher)
    } catch (e) {
        const err = e as BusinessError
        console.error(TAG, 'register abilityLifecycle failed', err.code, err.message)
    }
}

// ------------------------------------------------------------------
// 3. 画中画
// ------------------------------------------------------------------

class VoipPiPParams {
    title: string = ''
    duration: string = ''
    showVideo: boolean = false
    controller: WFCVideoRenderController | undefined = undefined

    constructor(title: string, duration: string, showVideo: boolean, controller: WFCVideoRenderController | undefined) {
        this.title = title
        this.duration = duration
        this.showVideo = showVideo
        this.controller = controller
    }
}

@Builder
function buildVoipPiPNode(params: VoipPiPParams) {
    Stack() {
        if (params.showVideo && params.controller !== undefined) {
            XComponent({
                id: 'wfc-voip-pip',
                type: XComponentType.SURFACE,
                controller: params.controller
            })
                .enableAnalyzer(false)
                .width('100%')
                .height('100%')
        } else {
            Column() {
                Text(params.title)
                    .fontSize(15)
                    .fontColor(Color.White)
                Text(params.duration)
                    .fontSize(13)
                    .fontColor(Color.White)
                    .margin({ top: 6 })
            }
            .justifyContent(FlexAlign.Center)
            .alignItems(HorizontalAlign.Center)
            .width('100%')
            .height('100%')
        }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#1A1A1A')
}

const voipPiPBuilder = wrapBuilder<[VoipPiPParams]>(buildVoipPiPNode)

class VoipPiPNodeController extends NodeController {
    private node: BuilderNode<[VoipPiPParams]> | null = null
    private controller: WFCVideoRenderController | undefined = undefined
    private tick: number = -1

    makeNode(uiContext: UIContext): FrameNode | null {
        // 画中画窗口里的 XComponent 是独立的一份（和通话页上的不是同一个），
        // 所以要自己 new 一个渲染控制器，再在 _update 里把当前该显示的轨道喂给它。
        this.controller = new WFCVideoRenderController('wfc-voip-pip')
        // 走局部变量再回填：ArkTS 对 this.xxx 的空值收窄很弱，直接 this.node!.build() 会被判可能为空
        const node = new BuilderNode<[VoipPiPParams]>(uiContext, { selfIdealSize: { width: 200, height: 300 } })
        node.build(voipPiPBuilder, this.params())
        this.node = node
        if (this.tick < 0) {
            this.tick = setInterval(() => {
                this._update()
            }, 1000)
        }
        return node.getFrameNode()
    }

    aboutToDisappear(): void {
        if (this.tick >= 0) {
            clearInterval(this.tick)
            this.tick = -1
        }
        this.controller?.setVideoTrack()
        this.node = null
    }

    private params(): VoipPiPParams {
        const session = currentSession()
        if (session === null) {
            return new VoipPiPParams(textOngoing, '', false, this.controller)
        }
        return new VoipPiPParams(stateText(session), durationText(session), this._pickVideoTrack(session), this.controller)
    }

    /** 挑一路还在推流的画面喂给画中画的 XComponent，返回是否真的有画面 */
    private _pickVideoTrack(session: CallSession): boolean {
        if (session.audioOnly || session.status !== CallState.STATUS_CONNECTED) {
            return false
        }
        const profiles = session.getParticipantProfiles()
        for (let i = 0; i < profiles.length; i++) {
            const p = profiles[i]
            if (p.audience || p.videoMuted) {
                continue
            }
            const track = session.getParticipantVideoTrack(p.userId, p.screenSharing)
            if (track !== null) {
                this.controller?.setVideoTrack(track)
                this.controller?.setScalingMode(ScalingMode.AspectFit)
                return true
            }
        }
        // 对方都关了摄像头，退回显示自己的画面
        if (!session.videoMuted) {
            const self = session.getSelfProfile()
            if (self !== null) {
                const track = session.getParticipantVideoTrack(self.userId, false)
                if (track !== null) {
                    this.controller?.setVideoTrack(track)
                    this.controller?.setScalingMode(ScalingMode.AspectFit)
                    return true
                }
            }
        }
        return false
    }

    private _update(): void {
        const node = this.node
        if (node === null) {
            return
        }
        node.update(this.params())
    }
}

let pipController: PiPWindow.PiPController | undefined = undefined
let pipCreating = false
/** 这一次画中画是用户手动点最小化起的（而不是切后台自动起的），见 onPiPStateChange */
let explicitMinimize = false
// 通话代次。PiPWindow.create 是异步的，如果通话在它 resolve 之前就结束了（比如对方秒挂），
// 回调里必须能认出「这个控制器已经过期了」，否则会留下一个属于上一通电话的画中画控制器。
let pipGeneration = 0

/**
 * 提前把画中画控制器建好。必须在通话建立时就做 —— PiPWindow.create 是异步的，
 * 而 minimize() 一返回，应用层立刻就把通话页 pop 了，那时再建来不及。
 */
export function prepareVoipPiP(context: common.UIAbilityContext): void {
    if (pipController !== undefined || pipCreating) {
        return
    }
    if (!PiPWindow.isPiPEnabled()) {
        console.info(TAG, '当前设备/系统不支持画中画，最小化将只保留后台通话+通知')
        return
    }
    pipCreating = true
    const generation = pipGeneration
    const config: PiPWindow.PiPConfiguration = {
        context: context,
        // customUIController 已经自带一个 XComponent，这里的 componentController 只是接口必填项，
        // 给一个空的即可（../hm-chat 的纯语音页是往页面上塞一个隐藏 XComponent 来凑，
        // 我们的通话页是 uvue，塞不了，所以走这条路；万一 create 报错，看这里）。
        componentController: new XComponentController(),
        customUIController: new VoipPiPNodeController(),
        templateType: PiPWindow.PiPTemplateType.VIDEO_CALL,
        contentWidth: 200,
        contentHeight: 300,
    }
    PiPWindow.create(config).then((controller: PiPWindow.PiPController) => {
        pipCreating = false
        if (generation !== pipGeneration) {
            // 通话已经结束了，建出来的控制器直接扔掉
            controller.off('stateChange')
            return
        }
        pipController = controller
        controller.on('stateChange', (state: PiPWindow.PiPState, reason: string) => {
            onPiPStateChange(state, reason)
        })
        // 开 autoStart：App 退到后台时由系统自动进画中画，这就是鸿蒙的「切后台自动最小化」。
        // 不能改成自己在生命周期回调里调 startPiP —— 那时窗口已经不可见，startPiP 会失败，
        // 系统给的自动启动就是为这个场景准备的（../hm-chat 的 pipHelper 也是 autoStart + 在
        // STARTED 里 pop 通话页）。
        // 通话页的 pop 交给 STARTED 分支去通知应用层做，两份 UI 不会并存。
        controller.setAutoStartEnabled(true)
    }).catch((err: BusinessError) => {
        pipCreating = false
        console.error(TAG, 'PiPWindow.create failed', err.code, err.message)
    })
}

function onPiPStateChange(state: PiPWindow.PiPState, reason: string): void {
    console.log(TAG, 'pip state', state, reason)
    if (state === PiPWindow.PiPState.STARTED) {
        // 画中画起来了。两种来路：
        //   1. 用户点了最小化（startVoipPiP）—— 应用层自己已经 navigateBack 了，这里不用再管；
        //   2. App 退到后台，系统按 autoStart 自动起的 —— 通话页还在栈里，得让应用层收掉，
        //      否则用户从画中画恢复/点通知回来时，会在通话页之上再 push 一个通话页。
        if (explicitMinimize) {
            explicitMinimize = false
            return
        }
        if (currentSession() === null) {
            return
        }
        autoMinimizeCallback?.()
        return
    }
    if (state === PiPWindow.PiPState.ABOUT_TO_RESTORE) {
        // 用户点了画中画上的「恢复」：把通话页推回来
        resumeCallback?.()
    }
}

/** 最小化：进入画中画。返回 false 表示画中画没起来，调用方只能靠后台通知回到通话 */
export function startVoipPiP(): boolean {
    const controller = pipController
    if (controller === undefined) {
        console.error(TAG, '画中画控制器未就绪，最小化只能退回后台通话')
        return false
    }
    explicitMinimize = true
    controller.startPiP().catch((err: BusinessError) => {
        // 没起来就把标记收回去，免得吞掉下一次「切后台自动最小化」的 STARTED
        explicitMinimize = false
        console.error(TAG, 'startPiP failed', err.code, err.message)
    })
    return true
}

export function stopVoipPiP(): void {
    pipController?.stopPiP().catch((err: BusinessError) => {
        console.error(TAG, 'stopPiP failed', err.code, err.message)
    })
}

export function destroyVoipPiP(): void {
    const controller = pipController
    pipController = undefined
    pipCreating = false
    explicitMinimize = false
    pipGeneration++
    if (controller === undefined) {
        return
    }
    controller.setAutoStartEnabled(false)
    controller.off('stateChange')
    controller.stopPiP().catch((err: BusinessError) => {
        console.error(TAG, 'stopPiP on destroy failed', err.code, err.message)
    })
}
