# 关于音视频 SDK 的说明

## 文件说明
1. avenginekit.aar-conference: 高级版音视频 SDK，依赖于专业版 im-server 和 wf-janus 服务
2. avenginekit.aar: 当前正在使用的音视频 SDK（默认是多人版）

## 音视频 SDK 切换
1. 默认使用的是多人版音视频 SDK
2. 如果需要切换到高级版音视频，使用 `avenginekit.aar-conference` 替换 `avenginekit.aar`
3. 换完要重新制作自定义基座 / 云打包才生效

两个版本对外的 Java 接口一致，会议相关接口在多人版上同样存在但不可用，
应用层用 `AVEngineKit.isSupportConference()`（uts 侧是 `avEngineKit.isSupportConference()`）判断。
详见项目根目录的 README-AV.md。
