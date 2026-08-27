//
//  VoipFloatingWindow.swift
//  音视频 UTS 插件的原生补充实现（与 utssdk/app-ios/index.uts 同属 unimoduleWfcAvClient target）。
//
//  ---- 这是 iOS 的「最小化」 ----
//  Android 最小化后靠前台服务的常驻通知回到通话页；iOS **没有常驻通知这种东西**
//  （UNNotification 不能常驻、划得掉、也不带计时器），系统级的通话挂起 UI 只有 CallKit 一条路，
//  那是另一个量级的工程。iOS 上通行的做法（微信/FaceTime/本项目 ios-chat 的 WFCUFloatingWindow）
//  是在 App 内部挂一个 UIWindow 悬浮窗 —— iOS 不允许应用画到其它 App 之上，所以「App 内悬浮」
//  就是 iOS 能做到的最小化上限。
//
//  用 UIWindow 而不是往当前页面上 addSubview：uni-app x 的页面会随导航销毁，
//  最小化正是要把通话页 pop 掉，挂在页面上的浮层会跟着一起没。UIWindow 独立于页面栈，
//  切页面、弹 modal 都盖得住，也不用像应用层浮层那样每个页面各挂一份。
//
//  ---- 为什么写在 .swift 而不是 .uts ----
//  手势/定时器要 @objc selector（UIPanGestureRecognizer(target:action:)），UTS 里没法声明；
//  UIWindowScene、UserDefaults、CGAffineTransform 这类 UIKit 细活也是原生写着顺。
//  UTS 可以直接调用同目录 .swift 里的类，不需要 import（见 DCloud「UTS原生混编」文档）。
//
//  ---- 委托 ----
//  参考实现 ../uni-wfc-client 的 WFAVFloatingWindow 会把 callSession.delegate 抢过去，
//  那样 index.uts 的 NativeCallSessionDelegate 就收不到回调了，事件桥直接断掉。
//  这里**不碰 delegate**：状态刷新由 index.uts 在 didChangeState / didCallEnded 里
//  主动调 refresh()/hide()，加上自身 1 秒一次的计时器。
//

import Foundation
import UIKit
import WFAVEngineKit
import DCloudUTSFoundation

public class VoipFloatingWindow: NSObject {
    private static let shared = VoipFloatingWindow()

    private static let posXKey = "wfc_voip_floating_x"
    private static let posYKey = "wfc_voip_floating_y"
    private static let winWidth: CGFloat = 88
    private static let winHeight: CGFloat = 118

    private var window: UIWindow?
    private var contentView: UIView?
    private var videoView: UIView?
    private var titleLabel: UILabel?
    private var timer: Timer?
    private var onTap: (() -> Void)?
    private var focusUserId: String = ""
    private var panStartOrigin: CGPoint = .zero

    /// 切后台通知的观察者句柄。非空即表示已经注册过，见 observeAppBackground
    private static var backgroundObserver: NSObjectProtocol?

    // 文案由应用层送进来（i18n），插件读不到 App 的词条，不送就是默认中文
    fileprivate static var textOngoing = "通话中"
    fileprivate static var textWaitingAnswer = "等待接听"
    fileprivate static var textConnecting = "接听中"

    // MARK: - 对 UTS 暴露的接口

    public static func setTexts(_ ongoing: String, _ waitingAnswer: String, _ connecting: String) {
        textOngoing = ongoing
        textWaitingAnswer = waitingAnswer
        textConnecting = connecting
    }

    /// 显示悬浮窗。focusUser 为空表示显示自己的画面（或纯语音）
    public static func show(_ focusUser: String, _ onTap: @escaping () -> Void) {
        onMain { shared.doShow(focusUser, onTap) }
    }

    /// 隐藏并销毁悬浮窗
    public static func hide() {
        onMain { shared.doHide() }
    }

    /// 通话状态变了，刷新一次（标题、画面挂载）
    public static func refresh() {
        onMain { shared.doRefresh() }
    }

    public static func isShowing() -> Bool {
        return shared.window != nil
    }

    /// 注册「App 切到后台」的回调，用于自动最小化。只注册一次，不提供反注册 ——
    /// 插件的生命周期和 App 一样长，index.uts 里 initAVEngineKit() 调一次就够。
    ///
    /// 用 UIApplication.didEnterBackgroundNotification 而不是 willResignActive：
    /// 后者在来电、下拉通知中心、系统权限弹框时也会触发，那些场景 App 并没有真的切到后台，
    /// 最小化了反而是 bug（Android 侧不用 onPause 判断也是同一个原因）。
    public static func observeAppBackground(_ handler: @escaping () -> Void) {
        if backgroundObserver != nil {
            return
        }
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil,
            queue: OperationQueue.main
        ) { _ in
            handler()
        }
    }

    /// 切后台自动最小化：通话还在、悬浮窗还没挂起来，才挂上；返回值表示这一下有没有真的最小化，
    /// 调用方据此决定要不要通知应用层把通话页收掉。
    /// 判断写在 Swift 侧是因为 currentSession() 的 idle 过滤本来就在这边，UTS 里再判一次
    /// 还要把 WFAVEngineState 枚举对上，没必要。
    public static func showOnAppBackground(_ onTap: @escaping () -> Void) -> Bool {
        // 已经是最小化状态（用户手动最小化过）：通话页早就不在栈里了，什么都不用做
        if shared.window != nil {
            return false
        }
        if shared.currentSession() == nil {
            return false
        }
        // 空字符串 = 悬浮窗自己挑一路画面。自动最小化拿不到通话页当前聚焦的是谁。
        show("", onTap)
        return true
    }

    private static func onMain(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }

    // MARK: - 实现

    private func currentSession() -> WFAVCallSession? {
        let session = WFAVEngineKit.shared().currentSession
        if session == nil || session!.state == .idle {
            return nil
        }
        return session
    }

    private func doShow(_ focusUser: String, _ tapped: @escaping () -> Void) {
        focusUserId = focusUser
        onTap = tapped
        if currentSession() == nil {
            // 通话已经结束了，没什么好挂的
            return
        }
        if window == nil {
            buildWindow()
        }
        window?.isHidden = false
        doRefresh()
        startTimer()
    }

    private func buildWindow() {
        let origin = savedOrigin()
        let frame = CGRect(x: origin.x, y: origin.y,
                           width: VoipFloatingWindow.winWidth, height: VoipFloatingWindow.winHeight)
        let win: UIWindow
        if #available(iOS 13.0, *), let scene = activeWindowScene() {
            win = UIWindow(windowScene: scene)
            win.frame = frame
        } else {
            win = UIWindow(frame: frame)
        }
        // 盖住 App 自己的所有页面和系统 alert。UIWindow.Level 没有 + 运算符（不像 ObjC 的
        // UIWindowLevelAlert + 1），只能拿 rawValue 自己加。
        win.windowLevel = UIWindow.Level(rawValue: UIWindow.Level.alert.rawValue + 1)
        win.backgroundColor = UIColor.black
        win.layer.cornerRadius = 8
        win.layer.masksToBounds = true
        win.isUserInteractionEnabled = true
        win.isHidden = true
        // 故意**不调 makeKeyAndVisible** —— 抢走 key window 会让当前页面的输入框失焦、键盘收起，
        // 甚至影响 uni 页面的事件分发。非 key 的 window 一样参与 hitTest，手势照收。
        // 但 rootViewController 得给一个：没有的话 UIKit 会告警，转屏和 hitTest 也容易出怪。
        let rootVC = UIViewController()
        rootVC.view.backgroundColor = UIColor.clear
        // 新建的 UIViewController 的 view 默认是**整屏**大小，而窗口只有 88x118。
        // 子视图靠 autoresizingMask 跟随缩放，起始尺寸不对的话缩放出来就是错的，所以先摆正。
        rootVC.view.frame = CGRect(origin: .zero, size: frame.size)
        win.rootViewController = rootVC

        let content = UIView(frame: CGRect(origin: .zero, size: frame.size))
        content.backgroundColor = UIColor(red: 0.05, green: 0.05, blue: 0.05, alpha: 1)
        content.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        rootVC.view.addSubview(content)

        let video = UIView(frame: content.bounds)
        video.backgroundColor = UIColor.black
        video.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        video.isHidden = true
        content.addSubview(video)

        let label = UILabel(frame: content.bounds)
        label.textAlignment = .center
        label.textColor = UIColor.white
        label.font = UIFont.systemFont(ofSize: 13)
        label.numberOfLines = 2
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        content.addSubview(label)

        content.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(handleTap)))
        content.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:))))

        window = win
        contentView = content
        videoView = video
        titleLabel = label
    }

    @available(iOS 13.0, *)
    private func activeWindowScene() -> UIWindowScene? {
        let scenes = UIApplication.shared.connectedScenes
        for scene in scenes {
            if let windowScene = scene as? UIWindowScene, windowScene.activationState == .foregroundActive {
                return windowScene
            }
        }
        for scene in scenes {
            if let windowScene = scene as? UIWindowScene {
                return windowScene
            }
        }
        return nil
    }

    private func savedOrigin() -> CGPoint {
        let bounds = UIScreen.main.bounds
        let defaults = UserDefaults.standard
        var x = CGFloat(defaults.double(forKey: VoipFloatingWindow.posXKey))
        var y = CGFloat(defaults.double(forKey: VoipFloatingWindow.posYKey))
        if x <= 0 && y <= 0 {
            // 默认停在右上角，避开状态栏/刘海
            x = bounds.width - VoipFloatingWindow.winWidth - 12
            y = 88
        }
        x = min(max(x, 0), max(bounds.width - VoipFloatingWindow.winWidth, 0))
        y = min(max(y, 0), max(bounds.height - VoipFloatingWindow.winHeight, 0))
        return CGPoint(x: x, y: y)
    }

    private func doRefresh() {
        guard let session = currentSession(), let label = titleLabel, let video = videoView else {
            return
        }
        let title: String
        switch session.state {
        case .outgoing, .incomming:
            title = VoipFloatingWindow.textWaitingAnswer
        case .connecting:
            title = VoipFloatingWindow.textConnecting
        default:
            title = VoipFloatingWindow.textOngoing
        }

        // 只有「已接通的视频通话」才挂画面：呼叫中挂上去是一片黑，纯语音根本没有轨道
        let showVideo = !session.isAudioOnly && session.state == .connected && !session.isVideoMuted
        if showVideo {
            video.isHidden = false
            label.frame = CGRect(x: 0, y: contentSize().height - 22, width: contentSize().width, height: 20)
            label.font = UIFont.systemFont(ofSize: 11)
            if focusUserId.isEmpty {
                session.setupLocalVideoView(video, scalingType: .aspectFill)
            } else {
                session.setupRemoteVideoView(video, scalingType: .aspectFill,
                                             forUser: focusUserId, screenSharing: false)
            }
        } else {
            video.isHidden = true
            label.frame = CGRect(origin: .zero, size: contentSize())
            label.font = UIFont.systemFont(ofSize: 13)
        }

        if session.state == .connected && session.connectedTime > 0 {
            label.text = title + "\n" + durationText(session.connectedTime)
        } else {
            label.text = title
        }
    }

    private func contentSize() -> CGSize {
        return contentView?.bounds.size ?? CGSize(width: VoipFloatingWindow.winWidth,
                                                  height: VoipFloatingWindow.winHeight)
    }

    private func durationText(_ connectedTimeMs: Int64) -> String {
        var sec = Int(Date().timeIntervalSince1970) - Int(connectedTimeMs / 1000)
        if sec < 0 {
            sec = 0
        }
        if sec < 3600 {
            return String(format: "%02d:%02d", sec / 60, sec % 60)
        }
        return String(format: "%02d:%02d:%02d", sec / 3600, (sec / 60) % 60, sec % 60)
    }

    private func startTimer() {
        stopTimer()
        let t = Timer.scheduledTimer(timeInterval: 1, target: self, selector: #selector(onTick),
                                     userInfo: nil, repeats: true)
        // .common：列表滚动（tracking runloop）时定时器不会被挂起，否则计时会卡住
        RunLoop.main.add(t, forMode: .common)
        timer = t
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    @objc private func onTick() {
        if currentSession() == nil {
            // 兜底：万一没收到 didCallEnded，也不能让悬浮窗一直挂着
            doHide()
            return
        }
        doRefresh()
    }

    @objc private func handleTap() {
        let callback = onTap
        doHide()
        callback?()
    }

    @objc private func handlePan(_ sender: UIPanGestureRecognizer) {
        guard let win = window else {
            return
        }
        let bounds = UIScreen.main.bounds
        switch sender.state {
        case .began:
            panStartOrigin = win.frame.origin
        case .changed, .ended:
            let translation = sender.translation(in: win)
            var x = panStartOrigin.x + translation.x
            var y = panStartOrigin.y + translation.y
            x = min(max(x, 0), max(bounds.width - win.frame.width, 0))
            y = min(max(y, 0), max(bounds.height - win.frame.height, 0))
            win.frame = CGRect(x: x, y: y, width: win.frame.width, height: win.frame.height)
            if sender.state == .ended {
                let defaults = UserDefaults.standard
                defaults.set(Double(x), forKey: VoipFloatingWindow.posXKey)
                defaults.set(Double(y), forKey: VoipFloatingWindow.posYKey)
            }
        default:
            break
        }
    }

    private func doHide() {
        stopTimer()
        // 画面从悬浮窗上摘掉，否则回到通话页重新 setup 时 SDK 里还挂着这个已销毁的 view。
        // 只处理远端流：本地预览在页面重新 setupLocalVideoView 时会被 SDK 自己改挂过去。
        if !focusUserId.isEmpty, let session = WFAVEngineKit.shared().currentSession,
           session.state != .idle, !session.isAudioOnly {
            session.setupRemoteVideoView(nil, scalingType: .aspectFill,
                                         forUser: focusUserId, screenSharing: false)
        }
        videoView?.removeFromSuperview()
        contentView?.removeFromSuperview()
        window?.isHidden = true
        videoView = nil
        titleLabel = nil
        contentView = nil
        window = nil
        onTap = nil
        focusUserId = ""
    }
}
