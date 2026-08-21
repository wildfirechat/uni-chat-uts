//
//  AVDelegates.swift
//  音视频 UTS 插件的原生补充实现（与 utssdk/app-ios/index.uts 同属 unimoduleWfcAvClient target）。
//
//  为什么需要这个文件：
//  WFAVCallSessionDelegate 的必需方法 didError(_ error: any Error) 的参数类型是 Swift 的
//  any Error 协议，UTS 语言没有能映射到该类型的参数类型（UTS 的 Error 编译为 UTSError），
//  无法在 index.uts 里声明出与协议签名完全一致的方法。Swift 允许协议要求由同模块的
//  扩展方法满足，所以把 didError 放到这里用原生 Swift 精确实现，其余方法仍在 index.uts 中。
//
//  该文件会被 HBuilderX 复制到 uni_modules/wfc-av-client/utssdk/app-ios/src/ 下与生成的
//  index.swift 一起编译（copyPlatformFiles 会把 app-ios 目录下的 .swift 拷入 src/）。
//

import Foundation
import WFAVEngineKit
import DCloudUTSFoundation

extension NativeCallSessionDelegate {
    /// WFAVCallSessionDelegate.didError 的实现（协议签名要求 exactly `any Error`）。
    /// 事件名仍用 didError 透传给应用层，与 Android 侧保持一致。
    @objc(didError:)
    public func didError(_ error: any Error) {
        callSessionEventListener?("didError", jsonArrayString(["" + error]))
    }
}
