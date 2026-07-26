/**
 * 页面里的 <native-view> 通过 bindHarmonyWrappedBuilder 挂载这个 builder，
 * 由 WFCVideoRenderController（继承 XComponentController，来自 @wfc/avenginekit）
 * 把 webrtc 的 VideoTrack 渲染到 XComponent 的 surface 上。
 *
 * ArkUI 的 @Builder 只能写在 .ets 里（uts 文件不支持声明式 UI），所以视频视图单独放在本文件，
 * 由 index.uts 用 wrapBuilder 包一层后绑定到 native-view 上。参数按 uts 插件惯例用 ESObject，
 * 实际字段见 index.uts 里的 VideoViewParams。
 */
@Builder
export function buildVideoView(params: ESObject) {
    XComponent({
        id: params.id as string,
        type: XComponentType.SURFACE,
        controller: params.controller
    })
        .enableAnalyzer(false)
        .width('100%')
        .height('100%')
}
