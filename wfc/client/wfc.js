/*
 * Copyright (c) 2020 WildFireChat. All rights reserved.
 */

import {EventEmitter} from 'events';
import {atob, btoa} from '../util/base64.min.js';
import Long from 'long';

import impl from '../proto/proto.min';
import Config from "../../config";
import EventType from "./wfcEvent";
import ConnectionStatus from "./connectionStatus";
import NullUserInfo from "../model/nullUserInfo";

export class WfcManager {

    /**
     * 事件通知，{@link EventType}中定义的事件，都会采用本{@link eventEmitter} 通知
     * @type {module:events.internal.EventEmitter}
     */
    eventEmitter = new EventEmitter();

    constructor() {
        impl.eventEmitter = {
            emit: (ev, ...args) => {
                if (ev === EventType.ConnectionStatusChanged || ev === EventType.UserOnlineEvent) {
                    self.eventEmitter.emit(ev, ...args)
                } else {
                    if (impl.connectionStatus === ConnectionStatus.ConnectionStatusConnected) {
                        self.eventEmitter.emit(ev, ...args)
                    } else {
                        // ignore
                    }
                }
            }
        };
    }

    /**
     * 初始化，请参考本demo的用法
     * @param {[]} args，pc 时，传入[node实例]; web 时，可以传入Config配置对象，配置项，请参考{@link Config}
     */
    init(args = []) {
        console.log('wfc init');
        impl.init(args);
        //avenginekit.setup(self);
        //self.setProxyInfo("", "192.168.1.80", 1080, "", "");
        console.log('wfc init end')
    }

    /**
     * 注册新的自定义消息
     *
     * @param {string} name
     * @param {number} flag 用来标识本消息是否需要存储、计数等，{@link PersistFlag}
     * @param {number} type 消息类型，{@link MessageContentType}
     * @param {class} clazz 消息对应的class
     */
    registerMessageContent(name, flag, type, clazz) {
        impl.registerMessageContent(name, flag, type, clazz);
    }

    /**
     * 获取clientId，获取用户token时，一定要通过调用此方法获取clientId，否则会连接失败。
     * @returns {string} clientId
     */
    getClientId() {
        return impl.getClientId();
    }

    /*
     * 启用国密加密。注意需要服务器端同步开启国密配置
     */
    useSM4() {
        impl.useSM4();
    }

    /**
     * 连接服务器
     * @param {string} userId 用户id
     * @param {string} token 用户token，生成token时，所使用的clientId，一定要通过{@link getClientId}获取
     * @return {number} 返回上一次活动时间。如果间隔时间较长，可以加个第一次登录的等待提示界面，在等待时同步所有的用户信息/群组信息/频道信息等。
     */
    connect(userId, token) {
        return impl.connect(userId, token);
    }

    /**
     * 设置代理，只支持socks5代理
     *
     * @param {String} host       代理host，host和ip必须至少有一个。
     * @param {String} ip         代理IP，host和ip必须至少有一个。
     * @param {number} port       代理端口
     * @param {String} username   username
     * @param {String} password   password
     */
    setProxyInfo(host, ip, port, username, password) {
        impl.setProxyInfo(host, ip, port, username, password);
    }

    /**
     * 设置第三方推送设备token
     * @param {number} pushType 推送类型，0-5 移动端已经使用了。
     * @param {String} token 设备token
     */
    setDeviceToken(pushType, token) {
        impl.setDeviceToken(pushType, token);
    }


    /**
     * 断开连接
     * @param {boolean} disablePush 是否禁用推送，在cleanSession为true时无意义
     * @param {boolean} clearSession 是否清除会话 session，清除之后，所有之前的会话信息会被删除
     */
    disconnect(disablePush = false, clearSession = false) {
        impl.disconnect(disablePush, clearSession);
    }

    setPackageName(packageName) {
        impl.setPackageName(packageName);
    }


    /**
     * 获取当前用户的id
     * @returns {string} 当前用户的id
     */
    getUserId() {
        return impl.getUserId();
    }

    /**
     * 服务器时间和本地时间的差值
     * @returns {number} 服务器时间和本地时间的差值
     */
    getServerDeltaTime() {
        return impl.getServerDeltaTime();
    }

    /**
     * 截图，
     * @returns {string} 成功返回'done'，同时，图片保存到了系统剪贴板
     */
    screenShot() {
        return impl.screenShot();
    }

    /**
     * 是否成功登录
     * @returns {boolean}
     */
    isLogin() {
        return impl.isLogin();
    }

    /**
     * 获取连接状态
     * @returns {number} 连接状态，参考{@link ConnectionStatus}
     */
    getConnectionStatus() {
        return impl.getConnectionStatus();
    }

    /**
     * 设置网络策略，仅专业版支持
     * @param {int} strategy 网络策略。0 是自动选择；1 选择主网络；2选择备用网络
     *
     */
    setBackupAddressStrategy(strategy) {
        impl.setBackupAddressStrategy(strategy);
    }

    /**
     * 设置备选网络信息，仅专业版支持
     * @param {String} backupHost 备选网络主机地址
     * @param {int} backupPort 备选网络主机端口
     */
    setBackupAddress(backupHost, backupPort) {
        impl.setBackupAddress(backupHost, backupPort);
    }

    /**
     * 设置协议栈短连接UA。
     *
     * @param {string} userAgent 协议栈短连接使用的UA
     */
    setProtoUserAgent(userAgent) {
        impl.setProtoUserAgent(userAgent);
    }

    /**
     * 添加协议栈短连接自定义Header
     *
     * @param {string} header 协议栈短连接使用的UA
     * @param {string} value 协议栈短连接使用的UA
     */
    addHttpHeader(header, value) {
        impl.addHttpHeader(header, value)
    }

    /**
     * 设备从睡眠中恢复
     */
    onAppResume() {
        impl.onAppResume();
    }

    /**
     * 设备进入睡眠状态
     */
    onAppSuspend() {
        impl.onAppSuspend();
    }

    /**
     * 已废弃，请使用{@link getFavGroupList}
     * 获取我保存到通讯录的群组信息列表
     * @returns {[GroupInfo]} 参考{@link GroupInfo}
     */
    getMyGroupList() {
        return impl.getMyGroupList();
    }

    /**
     * 获取我保存到通讯录的群组信息列表
     * @returns {[GroupInfo]} 参考{@link GroupInfo}
     */
    getFavGroupList() {
        let groupInfos = impl.getMyGroupList();
        groupInfos.map(info => {
            if (!info.portrait) {
                info.portrait = this.defaultGroupPortrait(info);
            }
            return info;
        })
        return groupInfos;
    }

    /**
     * 获取用户的displayName
     * @param {string} userId 用户id
     * @returns {string} 用户displayName
     */
    getUserDisplayName(userId) {
        let userInfo = this.getUserInfo(userId, false);
        if (!userInfo) {
            return '<' + userId + '>';
        }
        return userInfo.friendAlias ? userInfo.friendAlias : (userInfo.displayName ? userInfo.displayName : '<' + userId + '>');
    }

    /**
     * 获取用户在群里面的displayName
     * @param {string} groupId 群id
     * @param {string} userId 用户id
     * @returns {string} 用户在群里面的displayName
     */
    getGroupMemberDisplayName(groupId, userId) {
        let userInfo = this.getUserInfo(userId, false, groupId);
        if (!userInfo) {
            return '<' + userId + '>';
        }

        return userInfo.groupAlias ? userInfo.groupAlias : (userInfo.friendAlias ? userInfo.friendAlias : (userInfo.displayName ? userInfo.displayName : '<' + userId + '>'))
    }

    getUserDisplayNameEx(userInfo) {
        return userInfo.friendAlias ? userInfo.friendAlias : (userInfo.displayName ? userInfo.displayName : '<' + userInfo.uid + '>');
    }

    getGroupMemberDisplayNameEx(userInfo) {
        return userInfo.groupAlias ? userInfo.groupAlias : (userInfo.friendAlias ? userInfo.friendAlias : (userInfo.displayName ? userInfo.displayName : '<' + userInfo.uid + '>'))
    }

    /**
     * 获取用户信息
     * @param {string} userId 用户id
     * @param {boolean} refresh 是否刷新用户信息，如果刷新的话，且用户信息有更新，会通过{@link eventEmitter}进行通知，事件的名字是{@link EventType.UserInfosUpdate }
     * @param {string} groupId
     * @returns {UserInfo}
     */
    getUserInfo(userId, refresh = false, groupId = '') {
        let userInfo = impl.getUserInfo(userId, refresh, groupId);
        if (!userInfo.portrait) {
            userInfo.portrait = this.defaultUserPortrait(userInfo);
        }
        return userInfo;
    }

    /**
     * 获取用户信息
     * @param {string} userId 用户ID
     * @param {boolean} refresh 是否强制从服务器更新，如果本地没有或者强制，会从服务器刷新
     * @param {function (UserInfo)} success 成功回调，如果本地有该用户信息，则通过回调返回本地的用户信息；如果本地没有，则从服务端拉取该用户信息，并通过回调返回
     * @param {function (number)} fail 失败回调
     */
    getUserInfoEx(userId, refresh, success, fail) {
        impl.getUserInfoEx(userId, refresh, success, fail);
    }

    /**
     * 批量从服务端拉取用户信息
     * @param {[string]} userIds 用户ids
     * @param {string} groupId 群id
     * @param {function ([UserInfo])} successCB 成功回调
     * @param {function (Number)} failCB 失败回调
     */
    getUserInfosEx(userIds, groupId,  successCB, failCB) {
        impl.getUserInfosEx(userIds, groupId, userInfos => {
            userInfos.forEach((u) => {
                if (!u.portrait) {
                    u.portrait = this.defaultUserPortrait(u);
                }
            });
            successCB && successCB(userInfos);
        }, err => {
            failCB && failCB(err);
        });
    }

    /**
     * 批量获取用户信息
     * @param {[string]} userIds 用户ids
     * @param {string} groupId 群组id
     * @returns {[UserInfo]}
     */
    getUserInfos(userIds, groupId) {
        let userInfos = impl.getUserInfos(userIds, groupId);
        userInfos.forEach((u) => {
            if (!u.portrait) {
                u.portrait = this.defaultUserPortrait(u)
            }
        });
        return userInfos;
    }

    /**
     * 服务端搜索用户
     * @param {string} keyword 搜索关键字
     * @param {number} searchType 搜索类型，可选值参考{@link SearchType}
     * @param {number} page 页数，如果searchType是0，每次搜索20个，可以指定page。如果searchType非0，只能搜索一个，page无意义
     * @param {function (keyword, [UserInfo])} successCB
     * @param {function (number)}failCB
     * @returns {Promise<void>}
     */
    async searchUser(keyword, searchType, page, successCB, failCB) {
        impl.searchUser(keyword, searchType, page, (keyword, userInfos) => {
            userInfos.forEach((u) => {
                if (!u.portrait) {
                    u.portrait = this.defaultUserPortrait(u)
                }
            });
            successCB && successCB(keyword, userInfos);
        }, failCB);
    }

    /**
     * 本地搜索好友
     * @param keyword 搜索关键字
     * @returns {[UserInfo]}
     */
    searchFriends(keyword) {
        let userInfos = impl.searchFriends(keyword);
        userInfos.forEach((u) => {
            if (!u.portrait) {
                u.portrait = this.defaultUserPortrait(u)
            }
        });
        return userInfos;
    }

    /**
     * 本地搜索群组
     * @param keyword 搜索关键字
     * @returns {[GroupSearchResult]}
     */
    searchGroups(keyword) {
        let results = impl.searchGroups(keyword);
        results.forEach(r => {
            let info = r.groupInfo;
            if (!info.portrait) {
                info.portrait = this.defaultGroupPortrait(info);
            }
        })
        return results;
    }

    /**
     * 获取收到的好友请求
     * @returns {[FriendRequest]}
     */
    getIncommingFriendRequest() {
        return impl.getIncommingFriendRequest();
    }

    /**
     * 获取发送出去的好友请求
     * @returns {[FriendRequest]}
     */
    getOutgoingFriendRequest() {
        return impl.getOutgoingFriendRequest();
    }

    /**
     * 获取单条好友请求
     * @param {string} userId 对方的用户id
     * @param {boolean} incoming 是否是收到的好友请求
     * @return {FriendRequest|null}
     */
    getFriendRequest(userId, incoming = true) {
        return impl.getFriendRequest(userId, incoming);
    }

    /**
     * 从服务端加载好友请求，如果有更新，会通过{@link eventEmitter}通知
     */
    loadFriendRequestFromRemote() {
        impl.loadFriendRequestFromRemote(Long.ZERO);
    }

    /**
     * 获取未读的好友请求数
     * @returns {number}
     */
    getUnreadFriendRequestCount() {
        return impl.getUnreadFriendRequestCount();
    }

    /**
     * 清除好友请求未读状态
     */
    clearUnreadFriendRequestStatus() {
        impl.clearUnreadFriendRequestStatus();
    }

    /**
     * 删除好友
     * @param {string} userId 好友id
     * @param {function ()} successCB
     * @param {function (number) }failCB
     * @returns {Promise<void>}
     */
    async deleteFriend(userId, successCB, failCB) {
        impl.deleteFriend(userId, successCB, failCB);
    }

    /**
     * 处理好友请求
     * @param {string} userId 发送好友请求的用户的id
     * @param {boolean} accept true，接受好友请求；false，拒绝好友请求
     * @param {string} extra 一些额外信息，可用来实现好友来源等，推荐使用json格式
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async handleFriendRequest(userId, accept, extra, successCB, failCB) {
        impl.handleFriendRequest(userId, accept, extra, successCB, failCB);
    }

    /**
     * 判断用户是否被加入了黑名单
     * @param userId
     * @returns {boolean}
     */
    isBlackListed(userId) {
        return impl.isBlackListed(userId);
    }

    /**
     * 获取黑名单
     * @returns {[string]}
     */
    getBlackList() {
        return impl.getBlackList();
    }

    /**
     * 设置黑名单
     * @param {string} userId 用户id
     * @param {boolean} block true，加入黑名单；false，移除黑名单
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    setBlackList(userId, block, successCB, failCB) {
        impl.setBlackList(userId, block, successCB, failCB);
    }

    /**
     * 获取好友列表，返回的时好友id数组
     * @param {boolean} fresh 是否刷新好友信息，如果刷新，且有更新的话，会通过{@link eventEmitter}通知
     * @returns {[string]}
     */
    getMyFriendList(fresh = false) {
        return impl.getMyFriendList(fresh);
    }

    /**
     * 好友列表
     * @returns {[Friend]}
     */
    getFriendList(fresh = false) {
        return impl.getFriendList(fresh);
    }

    /**
     * 获取好友别名
     * @param {string} userId
     * @returns {string}
     */
    getFriendAlias(userId) {
        return impl.getFriendAlias(userId);
    }

    getFriendExtra(userId) {
        return impl.getFriendExtra(userId);
    }

    /**
     * 设置好友别名
     * @param {string} userId 用户id
     * @param {string} alias 别名
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */

    async setFriendAlias(userId, alias, successCB, failCB) {
        impl.setFriendAlias(userId, alias, successCB, failCB);
    }

    /**
     * 创建群组
     * @param {string | null} groupId 群组id，一般情况下，传null；如果有自己的用户系统，自己维护群信息，那么可以传群id
     * @param {number} groupType 群类型，可参考 {@link GroupType }
     * @param {string} name 群名称
     * @param {string} portrait 群头像的链接
     * @param {string} groupExtra 群组扩展信息
     * @param {[string]} memberIds 群成员id列表
     * @param {string} memberExtra 群组成员扩展信息
     * @param {[number]} lines 会话线路，默认传[0]即可
     * @param {CreateGroupNotification} notifyContent 通知信息，默认传null，服务端会生成默认通知
     * @param {function (string)} successCB 回调通知群id
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async createGroup(groupId, groupType, name, portrait, groupExtra, memberIds = [], memberExtra = '', lines = [0], notifyContent, successCB, failCB) {
        impl.createGroup(groupId, groupType, name, portrait == null ? "" : portrait, groupExtra, memberIds, memberExtra, lines, notifyContent, successCB, failCB);
    }

    /**
     * 设置群管理员
     * @param {string} groupId 群id
     * @param {boolean} isSet true，设置；false，取消设置
     * @param {[string]} memberIds 将被设置为管理或取消管理远的群成员的用户id
     * @param {[number]} lines 默认传[0]即可
     * @param {Object} notifyContent 默认传null即可
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async setGroupManager(groupId, isSet, memberIds, lines, notifyContent, successCB, failCB) {
        impl.setGroupManager(groupId, isSet, memberIds, lines, notifyContent, successCB, failCB);
    }

    /**
     * 获取群信息
     * @param {string} groupId 群id
     * @param {boolean} refresh 是否刷新，如果刷新，且有更新的话，会通过{@link eventEmitter}通知
     * @returns {GroupInfo}
     */
    getGroupInfo(groupId, refresh = false) {
        let info = impl.getGroupInfo(groupId, refresh);
        if (!info.portrait) {
            info.portrait = this.defaultGroupPortrait(info);
        }
        return info;
    }

    /**
     * 批量获取群信息
     * @param {[string]} groupIds 群id
     * @param {boolean} refresh 是否刷新，如果刷新，且有更新的话，会通过{@link eventEmitter}通知
     * @returns {[GroupInfo]}
     */
    getGroupInfos(groupIds, refresh = false) {
        let infos = impl.getGroupInfos(groupIds, refresh);
        infos.forEach(info => {
            if (!info.portrait) {
                info.portrait = this.defaultGroupPortrait(info);
            }
        })
        return infos;
    }

    /**
     * 获取群信息
     * @param {string} groupId 群id
     * @param {boolean} refresh 是否刷新，如果刷新，且有更新的话，会通过{@link eventEmitter}通知
     * @param {function (GroupInfo)} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getGroupInfoEx(groupId, refresh = false, successCB, failCB) {
        impl.getGroupInfoEx(groupId, refresh, info => {
            if (!info.portrait) {
                info.portrait = this.defaultGroupPortrait(info);
            }
            successCB && successCB(info);
        }, failCB);
    }

    /**
     * 添加群成员
     * @param  {string} groupId 群组id
     * @param {[string]} memberIds 新添加的群成员id
     * @param  {string} extra 群成员扩展信息
     * @param {[number]} notifyLines
     * @param {AddGroupMemberNotification} notifyMessageContent
     * @param successCB
     * @param failCB
     */
    addGroupMembers(groupId, memberIds, extra, notifyLines, notifyMessageContent, successCB, failCB) {
        impl.addGroupMembers(groupId, memberIds, extra, notifyLines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 获取群成员id列表
     * @param {string} groupId 群id
     * @param {boolean} fresh 是否刷新，刷新时，如果有更新，会通过{@link eventEmitter}通知
     * @returns {[string]} 群成员用户id列表
     */
    getGroupMemberIds(groupId, fresh = false) {
        return impl.getGroupMemberIds(groupId, fresh);
    }

    /**
     * 获取群成员信息
     * @param {string} groupId 群id
     * @param {boolean} fresh 是否刷新
     * @returns {[GroupMember]} 群成员信息
     */
    getGroupMembers(groupId, fresh = false) {
        return impl.getGroupMembers(groupId, fresh);
    }

    /**
     * 根据群成员类型获取群成员列表
     * @param {string} groupId
     * @param {number} memberType，可选值参考{@link GroupMemberType}
     * @return {[GroupMember]} 群成员列表
     */
    getGroupMembersByType(groupId, memberType) {
        return impl.getGroupMembersByType(groupId, memberType);
    }

    /**
     * 获取群成员信息
     * @param {string} groupId 群id
     * @param {boolean} fresh 是否强制从服务器更新，如果不刷新则从本地缓存中读取
     * @param {function ([GroupMember])} successCB
     * @param {function (number)} failCB
     */
    getGroupMembersEx(groupId, fresh = false, successCB, failCB) {
        impl.getGroupMembersEx(groupId, fresh, successCB, failCB);
    }

    /**
     * 获取单个群成员信息
     * @param {string} groupId 群id
     * @param {string} memberId 群成员id
     * @returns {GroupMember} 群成员信息
     */
    getGroupMember(groupId, memberId) {
        return impl.getGroupMember(groupId, memberId);
    }

    /**
     * 将用户从群里移除
     * @param {string} groupId 群id
     * @param {[string]} memberIds 将要被移除的群成员id列表
     * @param {[]} notifyLines 默认传[0]即可
     * @param {KickoffGroupMemberNotification} notifyMsg 默认传null即可
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    kickoffGroupMembers(groupId, memberIds, notifyLines, notifyMsg, successCB, failCB) {
        impl.kickoffGroupMembers(groupId, memberIds, notifyLines, notifyMsg, successCB, failCB);
    }

    /**
     * 对群成员禁言
     * @param {string} groupId 群id
     * @param {boolean} isSet true，禁言；false，取消禁言
     * @param {[string]} memberIds 群成员id列表
     * @param {[number]} notifyLines 默认传[0]即可
     * @param {MessageContent} notifyMsg 默认传null即可
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    muteGroupMembers(groupId, isSet, memberIds = [], notifyLines = [], notifyMsg, successCB, failCB) {
        impl.muteOrAllowGroupMembers(groupId, isSet, false, memberIds, notifyLines, notifyMsg, successCB, failCB);
    }

    /**
     * 群全局禁言之后，允许白名单成员发言
     * @param {string} groupId 群id
     * @param {boolean} isSet true，加入白名单，允许发言；false，移除白名单，禁止发言
     * @param {[string]} memberIds 群成员id列表
     * @param {[number]} notifyLines 默认传[0]即可
     * @param {MessageContent} notifyMsg 默认传null即可
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    allowGroupMembers(groupId, isSet, memberIds = [], notifyLines = [], notifyMsg, successCB, failCB) {
        impl.muteOrAllowGroupMembers(groupId, isSet, true, memberIds, notifyLines, notifyMsg, successCB, failCB);
    }

    /**
     * 退出群组
     * @param groupId 群id
     * @param {[]} lines 默认传[0]即可
     * @param {KickoffGroupMemberNotification} notifyMessageContent 默认传null即可
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async quitGroup(groupId, lines, notifyMessageContent, successCB, failCB) {
        impl.quitGroup(groupId, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 退出群组
     * @param groupId 群id
     * @param keepMessage 是否保留消息
     * @param {[]} lines 默认传[0]即可
     * @param {KickoffGroupMemberNotification} notifyMessageContent 默认传null即可
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async quitGroupEx(groupId, keepMessage, lines, notifyMessageContent, successCB, failCB) {
        impl.quitGroupEx(groupId, keepMessage, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 解散群组
     * @param {string} groupId 群组id
     * @param {[]} lines 默认传[0]即可
     * @param {KickoffGroupMemberNotification} notifyMessageContent 默认传null即可
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async dismissGroup(groupId, lines, notifyMessageContent, successCB, failCB) {
        impl.dismissGroup(groupId, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 修改群信息
     * @param {string} groupId 群id
     * @param {number} type 修改信息所属类型，可选值参考{@link ModifyGroupInfoType}
     * @param {string} newValue 准备修改成什么
     * @param {[number]} lines
     * @param {GroupNotificationContent} notifyMessageContent
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async modifyGroupInfo(groupId, type, newValue, lines, notifyMessageContent, successCB, failCB) {
        impl.modifyGroupInfo(groupId, type, newValue, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 修改我在群组的别名
     * @param {string} groupId 群id
     * @param {string} alias 别名
     * @param lines
     * @param notifyMessageContent
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async modifyGroupAlias(groupId, alias, lines, notifyMessageContent, successCB, failCB) {
        impl.modifyGroupAlias(groupId, alias, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 修改群成员在群组的别名
     * @param {string} groupId 群id
     * @param {string} memberId 群成员id
     * @param {string} alias 别名
     * @param lines
     * @param notifyMessageContent
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async modifyGroupMemberAlias(groupId, memberId, alias, lines, notifyMessageContent, successCB, failCB) {
        impl.modifyGroupMemberAlias(groupId, memberId, alias, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 修改群成员在群组的附加信息
     * @param {string} groupId 群id
     * @param {string} memberId 群成员id
     * @param {string} extra 群成员附加信息
     * @param lines
     * @param notifyMessageContent
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async modifyGroupMemberExtra(groupId, memberId, extra, lines, notifyMessageContent, successCB, failCB) {
        impl.modifyGroupMemberExtra(groupId, memberId, extra, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 转移群主
     * @param {string} groupId 群id
     * @param {string} newOwner 新群主的id
     * @param lines
     * @param notifyMessageContent
     * @param successCB
     * @param failCB
     */
    transferGroup(groupId, newOwner, lines, notifyMessageContent, successCB, failCB) {
        impl.transferGroup(groupId, newOwner, lines, notifyMessageContent, successCB, failCB);
    }

    /**
     * 获取保存到通讯录的群id列表
     * @returns {[string]}
     */
    getFavGroups() {
        return impl.getFavGroups();
    }

    /**
     *  判断群是否保存到了通讯录
     * @param {string} groupId
     * @returns {boolean}
     */
    isFavGroup(groupId) {
        return impl.isFavGroup(groupId);
    }

    /**
     * 将群保存到通讯录或移除通讯录
     * @param {string} groupId 群id
     * @param {boolean} fav true，保存到通讯录；false，从通讯录移除
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async setFavGroup(groupId, fav, successCB, failCB) {
        impl.setFavGroup(groupId, fav, successCB, failCB);
    }

    /**
     * 获取用户设置，保存格式可以理解为：scope + key => value
     * @param {number} scope 命名空间，可选值参考{@link UserSettingScope}
     * @param {string} key key
     * @returns {string} 设置的key对应的value
     */
    getUserSetting(scope, key) {
        return impl.getUserSetting(scope, key);
    }

    /**
     * 获取某个命名空间下的所有设置
     * @param scope 命名空间，可选值参考{@link UserSettingScope}
     * @returns {Map} key-value
     */
    getUserSettings(scope) {
        return impl.getUserSettings(scope);
    }

    /**
     * 设置或更新用户设置
     * @param {number} scope 命名空间
     * @param {string} key 设置的key
     * @param {string} value 设置的value
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     * @returns {Promise<void>}
     */
    async setUserSetting(scope, key, value, successCB, failCB) {
        impl.setUserSetting(scope, key, value, successCB, failCB);
    }

    /**
     * 修改个人信息
     * @param {[ModifyMyInfoEntry]} modifyMyInfoEntries 需要修改的信息列表，pc端，一次只允许修改一个项。
     * @param successCB
     * @param failCB
     */
    modifyMyInfo(modifyMyInfoEntries, successCB, failCB) {
        impl.modifyMyInfo(modifyMyInfoEntries, successCB, failCB);
    }

    /**
     * 是否全局免打扰
     * @returns {boolean}
     */
    isGlobalSlient() {
        return impl.isGlobalSlient();
    }

    /**
     * 设置全局免打扰
     * @param {boolean} silent
     * @param {function ()} successCB
     * @param failCB
     */
    setGlobalSlient(silent, successCB, failCB) {
        impl.setGlobalSlient(silent, successCB, failCB);
    }

    /**
     * 是否隐藏通知详情
     * @returns {boolean}
     */
    isHiddenNotificationDetail() {
        return impl.isHiddenNotificationDetail();
    }

    /**
     * 设置或取消设置隐藏通知详情
     * @param {boolean} hide 是否隐藏通知详情
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async setHiddenNotificationDetail(hide, successCB, failCB) {
        impl.setHiddenNotificationDetail(hide, successCB, failCB);
    }

    /**
     * 是否隐藏群成员昵称
     * @param {string} groupId 群id
     * @returns {boolean}
     */
    isHiddenGroupMemberName(groupId) {
        return impl.isHiddenGroupMemberName(groupId);
    }

    /**
     * 设置或取消设置隐藏群成员昵称
     * @param {string} groupId 群id
     * @param {boolean} hide 是否隐藏
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async setHiddenGroupMemberName(groupId, hide, successCB, failCB) {
        impl.setHiddenGroupMemberName(groupId, hide, successCB, failCB);
    }

    /**
     * 加入聊天室
     * @param {string} chatroomId 聊天室id
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async joinChatroom(chatroomId, successCB, failCB) {
        impl.joinChatroom(chatroomId, successCB, failCB);
    }

    /**
     * 退出聊天室
     * @param {string} chatroomId 聊天室id
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async quitChatroom(chatroomId, successCB, failCB) {
        impl.quitChatroom(chatroomId, successCB, failCB);
    }

    /**
     * 获取聊天室信息
     * @param {string} chatroomId 聊天是id
     * @param {number} updateDt 传当前时间对应的毫秒数
     * @param {function (ChatRoomInfo)} successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async getChatroomInfo(chatroomId, updateDt, successCB, failCB) {
        return impl.getChatroomInfo(chatroomId, updateDt, successCB, failCB);
    }

    /**
     * 获取聊天室成员信息
     * @param {string} chatroomId 聊天室id
     * @param {number} maxCount 最多获取多少个聊天室成员信息
     * @param {function (ChatRoomMemberInfo)} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async getChatroomMemberInfo(chatroomId, maxCount, successCB, failCB) {
        impl.getChatroomMemberInfo(chatroomId, maxCount, successCB, failCB);
    }

    /**
     * 创建频道
     * @param {string} name 频道名称
     * @param {string} portrait 频道头像的链接地址
     * @param {string} desc 描述
     * @param {string} extra 额外信息
     * @param {function (string)} successCB 创建成功，会回调通知channelId
     * @param {function (number)} failCB
     */
    createChannel(name, portrait, desc, extra, successCB, failCB) {
        impl.createChannel(name, portrait, desc, extra, successCB, failCB);
    }

    /**
     * 获取频道信息
     * @param {string} channelId 频道id
     * @param {boolean} refresh 是否强制刷新
     * @returns {ChannelInfo|NullChannelInfo}
     */
    getChannelInfo(channelId, refresh) {
        return impl.getChannelInfo(channelId, refresh);
    }

    /**
     * 修改频道信息
     * @param {string} channelId 频道id
     * @param {number} type 修改什么，可选值参考{@link ModifyChannelInfoType}
     * @param {string} newValue 修改后的值
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async modifyChannelInfo(channelId, type, newValue, successCB, failCB) {
        impl.modifyChannelInfo(channelId, type, newValue, successCB, failCB);
    }

    /**
     * 搜索频道
     * @param {string} keyword 关键字
     * @param {boolean} fuzzy 是否模糊搜索
     * @param {function (keyword, [ChannelInfo])} successCB
     * @param {function (number)} failCB
     */
    searchChannel(keyword, fuzzy, successCB, failCB) {
        impl.searchChannel(keyword, successCB, failCB);
    }

    /**
     * 是否已收听/关注某个频道
     * @param {string} channelId 频道id
     * @returns {boolean}
     */
    isListenedChannel(channelId) {
        return impl.isListenedChannel(channelId);
    }

    /**
     * 收听或取消收听频道
     * @param {string} channelId 频道id
     * @param {boolean} listen true，收听；false，取消收听
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async listenChannel(channelId, listen, successCB, failCB) {
        impl.listenChannel(channelId, listen, successCB, failCB);
    }

    /**
     * 获取自己创建的频道id列表
     * @returns {[string]}
     */
    getMyChannels() {
        return impl.getMyChannels();
    }

    /**
     * 获取所收听的频道id列表
     * @returns {[string]}
     */
    getListenedChannels() {
        return impl.getListenedChannels();
    }

    /**
     * 销毁频道
     * @param {string} channelId 频道id
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async destoryChannel(channelId, successCB, failCB) {
        impl.destoryChannel(channelId, successCB, failCB);
    }

    /**
     * 获取会话列表
     * @param {[number]} types 想获取的会话类型，可选值参考{@link ConversationType}
     * @param {[0]} lines 想获取哪些会话线路的会话，默认传[0]即可
     * @returns {[ConversationInfo]}
     */
    getConversationList(types, lines) {
        return impl.getConversationList(types, lines);
    }

    /**
     * 获取会话详情
     * @param {Conversation} conversation
     * @returns {ConversationInfo}
     */
    getConversationInfo(conversation) {
        return impl.getConversationInfo(conversation);
    }

    /**
     * 搜索会话
     * @param {string} keyword 关键字
     * @param {[number]} types 从哪些类型的会话中进行搜索，可选值可参考{@link ConversationType}
     * @param {[number]} lines 从哪些会话线路进行搜索，默认传[0]即可
     * @returns {[ConversationSearchResult]}
     */
    searchConversation(keyword, types = [0, 1, 2], lines = [0, 1, 2]) {
        return impl.searchConversation(keyword, types, lines);
    }

    /**
     * 删除会话
     * @param {Conversation} conversation 想删除的目标会话
     * @param {boolean} clearMsg 是否已删除的会话的消息
     * @returns {Promise<void>}
     */
    async removeConversation(conversation, clearMsg) {
        impl.removeConversation(conversation, clearMsg);
    }

    /**
     * 会话置顶或取消置顶
     * @param {Conversation} conversation 需要置顶或取消置顶的会话
     * @param {number} top > 0, 置顶，可以根据这个值进行置顶排序；0，取消置顶
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    setConversationTop(conversation, top, successCB, failCB) {
        impl.setConversationTop(conversation, top, successCB, failCB);
    }

    /**
     * 会话免打扰或取消免打扰
     * @param {Conversation} conversation 目标会话
     * @param {boolean} silent true，设置为免打扰；false，取消免打扰
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    setConversationSlient(conversation, silent, successCB, failCB) {
        impl.setConversationSlient(conversation, silent, successCB, failCB);
    }

    /**
     * 保存会话草稿
     * @param {Conversation} conversation 目标会话
     * @param {string} draft 草稿，传''时，相当于清楚会话草稿
     */
    setConversationDraft(conversation, draft = '') {
        impl.setConversationDraft(conversation, draft);
    }

    /**
     * 设置会话时间错，当会话不存在时，会创建一个新的会话。
     * @param {Conversation} conversation
     * @param {number} timestamp
     */
    setConversationTimestamp(conversation, timestamp) {
        impl.setConversationTimestamp(conversation, timestamp);
    }

    /**
     * 获取未读消息数
     * @param {[number]} types 获取未读数时，包含哪些类型的会话，可选值参考{@link ConversationType}
     * @param {[number]} lines 获取未读数时，包含哪些会话线路，默认传[0]即可
     * @returns {UnreadCount}
     */
    getUnreadCount(types = [0, 1, 2], lines = [0]) {
        return impl.getUnreadCount(types, lines);
    }

    /**
     * 获取某个会话的未读消息数
     * @param {Conversation} conversation 目标会话
     * @returns {UnreadCount}
     */
    getConversationUnreadCount(conversation) {
        return impl.getConversationUnreadCount(conversation);
    }

    /**
     * 清楚会话消息未读状态
     * @param {Conversation} conversation 目标会话
     */
    clearConversationUnreadStatus(conversation) {
        impl.clearConversationUnreadStatus(conversation);
    }

    /**
     * 将会话最后一条消息置为未读
     * @param {Conversation} conversation 会话
     * @param {boolean} syncToOtherClient 是否同步给其他端
     * @return {boolean} 是否操作成功
     */
    markConversationAsUnread(conversation, syncToOtherClient) {
        return impl.markConversationAsUnread(conversation, syncToOtherClient);
    }

    /**
     * 清除单条消息的未读状态
     * @param messageId
     */
    clearMessageUnreadStatus(messageId) {
        impl.clearMessageUnreadStatus(messageId);
    }

    /**
     * 清除所有消息的未读状态
     *
     * 特别注意1：本方法只清除了底层数据库中的未读状态，并未清理 UI 层会话列表中的未读状态，UI 层会话列表中的未读状态，需要手动重置。
     * 特别注意2：本方法不会触发{@link ConversationInfoUpdate} 事件
     */
    clearAllUnreadStatus() {
        impl.clearAllUnreadStatus();
    }

    /**
     * 设置媒体消息的状态为已播放
     * @param {number} messageId 消息id，不是消息uid!
     */
    setMediaMessagePlayed(messageId) {
        impl.setMediaMessagePlayed(messageId);
    }

    /**
     * 设置消息本地扩展信息
     * @param {number} messageId 消息id，不是消息uid!
     * @param {string} extra 扩展信息
     */
    setMessageLocalExtra(messageId, extra) {
        impl.setMessageLocalExtra(messageId, extra);
    }

    /**
     * 判断是否是好友
     * @param {string} userId 用户id
     * @returns {boolean}
     */
    isMyFriend(userId) {
        return impl.isMyFriend(userId);
    }

    /**
     * 获取星标用户id列表
     * @returns {[string]}
     */
    getFavUsers() {
        return impl.getFavUsers();
    }

    /**
     *  判断用户是否是星标用户
     * @param {string} userId
     * @returns {boolean}
     */
    isFavUser(userId) {
        return impl.isFavUser(userId);
    }

    /**
     * 设置或取消星标用户
     * @param {string} userId 用户id
     * @param {boolean} fav true，保存到通讯录；false，从通讯录移除
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async setFavUser(userId, fav, successCB, failCB) {
        impl.setFavUser(userId, fav, successCB, failCB);
    }

    /**
     * 发送好友请求
     * @param {string} userId 目标用户id
     * @param {string} reason 发送好友请求的原因
     * @param {string} extra 请求的扩展信息
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async sendFriendRequest(userId, reason, extra, successCB, failCB) {
        impl.sendFriendRequest(userId, reason, extra, successCB, failCB);
    }

    /**
     * 获取会话消息
     * @deprecated 请使用{@link getMessagesV2}
     * @param {Conversation} conversation 目标会话
     * @param {number} fromIndex messageId，表示从那一条消息开始获取
     * @param {boolean} before true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @return {[Message]} 会话消息列表，参考{@link Message}
     */
    getMessages(conversation, fromIndex = 0, before = true, count = 20, withUser = '') {
        return impl.getMessages(conversation, fromIndex, before, count, withUser);
    }

    /**
     * 获取消息
     * @deprecated 请使用{@link getMessagesExV2}
     * @param {[number]} conversationTypes 会话类型列表，可选值参考{@link  ConversationType}
     * @param {[number]} lines 会话线路列表
     * @param {number} fromIndex 本参数暂时无效! messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效! true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @return {[Message]} 会话消息列表，参考{@link Message}
     */
    getMessagesEx(conversationTypes, lines, fromIndex = 0, before = true, count = 20, withUser = '', contentTypes = []) {
        return impl.getMessagesEx(conversationTypes, lines, contentTypes, fromIndex, before, count, withUser);
    }

    /**
     * 获取消息
     * @deprecated 请使用{@link getMessagesEx2V2}
     * @param {[number]} conversationTypes 会话类型列表，可选值参考{@link  ConversationType}
     * @param {[number]} lines 会话线路列表
     * @param {[number]} messageStatus 消息状态，可选值参考{@link MessageStatus}
     * @param {number} fromIndex 本参数暂时无效! messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效! true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @return {[Message]} 会话消息列表，参考{@link Message}
     */
    getMessagesEx2(conversationTypes, lines, messageStatus, fromIndex = 0, before = true, count = 20, withUser = '') {
        return impl.getMessagesEx2(conversationTypes, lines, messageStatus, fromIndex, before, count, withUser);
    }

    /**
     * 获取会话消息
     * @deprecated 请使用{@link getMessagesByTimestampV2}
     * @param {Conversation} conversation 目标会话
     * @param {[number]} contentTypes 消息类型，可选值参考{@link MessageContentType}
     * @param {number} timestamp 时间戳
     * @param {boolean} before true, 获取timestamp之前的消息，即更旧的消息；false，获取timestamp之后的消息，即更新的消息。都不包含timestamp对应的消息
     * @param {number} count 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @return {[Message]} 会话消息列表，参考{@link Message}
     */
    getMessagesByTimestamp(conversation, contentTypes, timestamp, before = true, count = 20, withUser = '') {
        return impl.getMessagesByTimestamp(conversation, contentTypes, timestamp, before, count, withUser);
    }

    /**
     * 获取用户会话消息
     * @deprecated 请使用{@link getUserMessagesV2}
     * @param {string} userId 用户id
     * @param {Conversation} conversation 目标会话
     * @param {number} fromIndex 本参数暂时无效！ messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效！ true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @return
     */
    getUserMessages(userId, conversation, fromIndex, before = true, count = 20) {
        return impl.getUserMessages(userId, conversation, fromIndex, before, count);
    }

    /**
     * 获取用户消息
     * @deprecated 请使用{@link getUserMessagesExV2}
     * @param {string} userId 用户id
     * @param {[number]} conversationTypes 想获取的会话类型，可选值参考{@link ConversationType}
     * @param {[0]} lines 想获取哪些会话线路的会话，默认传[0]即可
     * @param {number} fromIndex 本参数暂时无效！ messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效！ true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效！ 获取多少条消息
     * @param {[number]} contentTypes 消息类型，可选值参考{@link MessageContentType}
     * @return
     */
    getUserMessagesEx(userId, conversationTypes, lines, fromIndex, before = true, count = 20, contentTypes = []) {
        return impl.getUserMessagesEx(userId, conversationTypes, lines, fromIndex, before, count, contentTypes);
    }

    /**
     * 获取会话消息
     * @param {Conversation} conversation 目标会话
     * @param {number} fromIndex messageId，表示从那一条消息开始获取
     * @param {boolean} before true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @param {function (Message)} successCB
     * @param failCB
     */
    getMessagesV2(conversation, fromIndex, before, count, withUser, successCB, failCB) {
        impl.getMessagesV2(conversation, fromIndex, before, count, withUser, successCB, failCB);
    }

    /**
     * 获取消息
     * @param {[number]} conversationTypes 会话类型列表，可选值参考{@link  ConversationType}
     * @param {[number]} lines 会话线路列表
     * @param {number} fromIndex 本参数暂时无效! messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效! true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {function (Message)} successCB
     * @param failCB
     */
    getMessagesExV2(conversationTypes, lines, fromIndex, before, count, withUser, contentTypes, successCB, failCB) {
        impl.getMessagesExV2(conversationTypes, lines, contentTypes, fromIndex, before, count, withUser, successCB, failCB);
    }

    /**
     *
     * @param {[number]} conversationTypes 会话类型列表，可选值参考{@link  ConversationType}
     * @param {[number]} lines 会话线路列表
     * @param {[number]} messageStatuses 消息状态，可选值参考{@link MessageStatus}
     * @param {number} fromIndex 本参数暂时无效! messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效! true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @param {function (Message)} successCB
     * @param failCB
     */
    getMessagesEx2V2(conversationTypes, lines, messageStatuses, fromIndex, before, count, withUser, successCB, failCB) {
        impl.getMessagesEx2V2(conversationTypes, lines, messageStatuses, fromIndex, before, count, withUser, successCB, failCB);
    }

    /**
     * 获取会话消息
     * @param {Conversation} conversation 目标会话
     * @param {[number]} contentTypes 消息类型，可选值参考{@link MessageContentType}
     * @param {number} timestamp 时间戳
     * @param {boolean} before true, 获取timestamp之前的消息，即更旧的消息；false，获取timestamp之后的消息，即更新的消息。都不包含timestamp对应的消息
     * @param {number} count 获取多少条消息
     * @param {string} withUser 只有会话类型为{@link ConversationType#Channel}时生效, channel主用来查询和某个用户的所有消息
     * @param {function (Message)} successCB
     * @param failCB
     */
    getMessagesByTimestampV2(conversation, contentTypes, timestamp, before, count, withUser, successCB, failCB) {
        impl.getMessagesByTimestampV2(conversation, contentTypes, timestamp, before, count, withUser, successCB, failCB);
    }

    /**
     * 获取用户会话消息
     * @param {string} userId 用户id
     * @param {Conversation} conversation 目标会话
     * @param {number} fromIndex 本参数暂时无效！ messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效！ true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效! 获取多少条消息
     * @param {function (Message)} successCB
     * @param failCB
     */
    getUserMessagesV2(userId, conversation, fromIndex, before, count, successCB, failCB) {
        impl.getUserMessagesV2(userId, conversation, fromIndex, before, count, successCB, failCB);
    }

    /**
     * 获取用户消息
     * @param {string} userId 用户id
     * @param {[number]} conversationTypes 想获取的会话类型，可选值参考{@link ConversationType}
     * @param {[0]} lines 想获取哪些会话线路的会话，默认传[0]即可
     * @param {number} fromIndex 本参数暂时无效！ messageId，表示从那一条消息开始获取
     * @param {boolean} before 本参数暂时无效！ true, 获取fromIndex之前的消息，即更旧的消息；false，获取fromIndex之后的消息，即更新的消息。都不包含fromIndex对应的消息
     * @param {number} count 本参数暂时无效！ 获取多少条消息
     * @param {[number]} contentTypes 消息类型，可选值参考{@link MessageContentType}
     * @param {function (Message)} successCB
     * @param failCB
     */
    getUserMessagesExV2(userId, conversationTypes, lines, fromIndex, before, count, contentTypes, successCB, failCB) {
        impl.getUserMessagesExV2(userId, conversationTypes, lines, fromIndex, before, count, contentTypes, successCB, failCB);
    }


    /**
     * 获取会话第一条未读消息的消息id
     * @param {Conversation} conversation
     * @return {number}
     */
    getFirstUnreadMessageId(conversation) {
        return impl.getFirstUnreadMessageId(conversation);
    }

    /**
     * 已废弃，请使用{@link loadRemoteConversationMessages}
     * 获取会还的远程历史消息
     * @param {Conversation} conversation 目标会话
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {number | Long} beforeUid 消息uid，表示拉取本条消息之前的消息
     * @param {number} count
     * @param {function (Message)} successCB
     * @param failCB
     */
    loadRemoteMessages(conversation, contentTypes, beforeUid, count, successCB, failCB) {
        impl.loadRemoteMessages(conversation, contentTypes, beforeUid, count, successCB, failCB);
    }

    /**
     * 获取会话的远程历史消息
     * @param {Conversation} conversation 目标会话
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {number | Long} beforeUid 消息uid，表示拉取本条消息之前的消息
     * @param {number} count
     * @param {function ([Message])} successCB
     * @param failCB
     */
    loadRemoteConversationMessages(conversation, contentTypes, beforeUid, count, successCB, failCB) {
        impl.loadRemoteMessages(conversation, contentTypes, beforeUid, count, successCB, failCB);
    }

    /**
     * 获取会话的远程历史消息，仅 web 有效
     * @param {Conversation} conversation 目标会话
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {number | Long} beforeUid 消息uid，表示拉取本条消息之前的消息
     * @param {number} count
     * @param {boolean} filterLocalMessage 是否过滤本地已经存在的消息
     * @param {function ([Message])} successCB
     * @param failCB
     */
    loadRemoteConversationMessagesEx(conversation, contentTypes, beforeUid, count, filterLocalMessage, successCB, failCB) {
        impl.loadRemoteMessages(conversation, contentTypes, beforeUid, count, successCB, failCB, filterLocalMessage);
    }

    /**
     * 根据会话线路，获取远程历史消息
     * @param {number} line 会话线路
     * @param {number | Long} beforeUid 消息uid，表示拉取本条消息之前的消息
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {number} count
     * @param {function ([Message])} successCB
     * @param failCB
     */
    loadRemoteLineMessages(line, contentTypes, beforeUid, count, successCB, failCB) {
        impl.loadRemoteLineMessages(line, contentTypes, beforeUid, count, successCB, failCB)
    }

    /**
     * 根据消息 uid，获取远程消息
     * @param {Long} messageUid 消息uid
     * @param {function ([Message])} successCB
     * @param failCB
     */
    loadRemoteMessage(messageUid, successCB, failCB) {
        impl.loadRemoteMessage(messageUid, successCB, failCB);
    }

    /**
     * 获取消息
     * @param {number} messageId 消息id
     * @returns {null|Message}
     */
    getMessageById(messageId) {
        return impl.getMessageById(messageId);
    }

    /**
     * 获取消息
     * @param {Long|string|number} messageUid
     * @returns {null|Message}
     */
    getMessageByUid(messageUid) {
        return impl.getMessageByUid(messageUid);
    }

    /**
     * 搜索消息
     * @param {Conversation} conversation 目标会话
     * @param {string} keyword 关键字
     * @param {string} withUser 目标用户
     * @returns {[Message]}
     */
    searchMessage(conversation, keyword, withUser = '') {
        return impl.searchMessage(conversation, keyword, withUser);
    }

    /**
     * 搜索消息
     * @param {Conversation} conversation 目标会话，如果为空搜索所有会话
     * @param {string} keyword 关键字
     * @param {boolean} desc 逆序排列
     * @param {int} limit 返回数量
     * @param {int} offset 偏移
     * @param {string} withUser 目标用户
     * @returns {Message[]}
     */
    searchMessageEx(conversation, keyword, desc, limit, offset, withUser = '') {
        return impl.searchMessageEx(conversation, keyword, desc, limit, offset, withUser);
    }

    /**
     * 搜索消息
     * @param {Conversation} conversation 目标会话，如果为空搜索所有会话
     * @param {string} keyword 关键字
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {boolean} desc 逆序排列
     * @param {int} limit 返回数量
     * @param {int} offset 偏移
     * @param {string} withUser 目标用户
     * @returns {Message[]}
     */
    searchMessageByTypes(conversation, keyword, contentTypes, desc, limit, offset, withUser = '') {
        return impl.searchMessageByTypes(conversation, keyword, contentTypes, desc, limit, offset, withUser);
    }

    /**
     * 搜索消息
     * @param {Conversation} conversation 目标会话，如果为空搜索所有会话
     * @param {string} keyword 关键字
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {Long} 消息起始时间，如果为0，则忽略起始时间。
     * @param {Long} 消息结束时间，如果为0，测忽略结束时间。
     * @param {boolean} desc 逆序排列
     * @param {int} limit 返回数量
     * @param {int} offset 偏移
     * @param {string} withUser 目标用户
     * @returns {Message[]}
     */
    searchMessageByTypesAndTimes(conversation, keyword, contentTypes, startTime, endTime, desc, limit, offset, withUser = '') {
        return impl.searchMessageByTypesAndTimes(conversation, keyword, contentTypes, startTime, endTime, desc, limit, offset, withUser);
    }

    /**
     * 搜索消息
     * @param {[number]} conversationTypes 会话类型列表，可选值参考{@link  ConversationType}
     * @param {[number]} lines 会话线路列表
     * @param {[number]} contentTypes 消息类型列表，可选值参考{@link MessageContentType}
     * @param {string} keyword 关键字
     * @param {number} fromIndex messageId，表示从那一条消息开始获取
     * @param {boolean} desc 逆序排列
     * @param {number} count 最大数量
     * @param {string} withUser 目标用户
     * @returns {[Message]}
     */
    searchMessageEx2(conversationTypes, lines, contentTypes, keyword, fromIndex, desc, count, withUser = '') {
        return impl.searchMessageEx2(conversationTypes, lines, contentTypes, keyword, fromIndex, desc, count, withUser);
    }

    /**
     * 发送消息
     * @param {Conversation} conversation 目标会话
     * @param {MessageContent} messageContent 具体的消息内容，一定要求是{@link MessageContent} 的子类，不能是普通的object
     * @param {[string]} toUsers 定向发送给会话中的某些用户；为空，则发给所有人；另外对单聊会话，本参数无效
     * @param {function (number, number)} preparedCB 消息已插入本地数据的回调，回调的两个参数表示：messageId, timestamp
     * @param {function (number, number)} progressCB 媒体上传进度回调，针对媒体消息，且媒体大于100K时有效，回调参数表示：uploaded, total
     * @param {function (number, number)} successCB 发送成功回调，回调参数表示：messageUid, timestamp
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async sendConversationMessage(conversation, messageContent, toUsers = [], preparedCB = null, progressCB = null, successCB = null, failCB = null) {
        impl.sendConversationMessage(conversation, messageContent, toUsers, preparedCB, progressCB, successCB, failCB);
    }

    /**
     * 发送消息，参考{@link sendConversationMessage}
     * @param {Message} message 一定要求是{@link Message}类型
     * @param preparedCB
     * @param progressCB 由于 uniapp 限制，这个方法目前只会回调一次，无法持续回调。https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin.html#keepalive     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async sendMessage(message, preparedCB, progressCB, successCB, failCB) {
        impl.sendMessage(message, preparedCB, progressCB, successCB, failCB);
    }

    /**
     * 发送消息，参考{@link sendMessage}
     * @param message
     * @param toUsers
     * @param preparedCB
     * @param progressCB 由于 uniapp 限制，这个方法目前只会回调一次，无法持续回调。https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin.html#keepalive     * @param successCB
     * @param successCB
     * @param failCB
     * @returns {Promise<void>}
     */
    async sendMessageEx(message, toUsers = [], preparedCB, progressCB, successCB, failCB) {
        impl.sendMessageEx(message, toUsers, preparedCB, progressCB, successCB, failCB);
    }

    // 更新了原始消息的内容
    /**
     * 撤回消息
     * @param {Long} messageUid
     * @param {function ()} successCB
     * @param {function (number)} failCB
     * @returns {Promise<void>}
     */
    async recallMessage(messageUid, successCB, failCB) {
        impl.recallMessage(messageUid, successCB, failCB);
    }

    /**
     * 删除消息
     * @param {number} messageId 消息id
     * @returns {*}
     */
    deleteMessage(messageId) {
        return impl.deleteMessageById(messageId);
    }

    /**
     * 删除远程消息
     * @param {Long | string} msgUid 消息uid
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    deleteRemoteMessageByUid(msgUid, successCB, failCB) {
        impl.deleteRemoteMessage(msgUid, successCB, failCB);
    }

    /**
     * 更新远程消息消息内容，只有专业版支持。客户端仅能更新自己发送的消息，更新的消息类型不能变，更新的消息类型是服务配置允许更新的内容。Server API更新则没有限制。
     * @param {Long | string} msgUid 消息uid
     * @param {MessageContent} messageContent 具体的消息内容，一定要求是{@link MessageContent} 的子类，不能是普通的object
     * @param {boolean} distribute 是否重新分发给其他客户端
     * @param {boolean} updateLocal 是否更新本地消息内容
     * @param {function ()} successCB
     * @param {function (number)} failCB
     */
    updateRemoteMessageContent(msgUid, messageContent, distribute, updateLocal, successCB, failCB) {
        impl.updateRemoteMessageContent(msgUid, messageContent, distribute, updateLocal, successCB, failCB);
    }

    /**
     * 清除会话消息
     * @param {Conversation} conversation 目标会话
     * @returns {Promise<void>}
     */
    async clearMessages(conversation) {
        impl.clearMessages(conversation);
    }

    /**
     * 清除远程会话消息
     * @param {Conversation} conversation
     * @param {function ()} successCB
     * @param {function (error)} failCB
     * @return {Promise<void>}
     */
    async clearRemoteConversationMessages(conversation, successCB, failCB) {
        impl.clearRemoteConversationMessages(conversation, successCB, failCB);
    }

    /**
     * 插入消息
     * @param {Conversation} conversation 目标会话
     * @param {MessageContent} messageContent 具体的消息内容，一定要求是{@link MessageContent} 的子类，不能是普通的object
     * @param {number} status 消息状态，可选值参考{@link MessageStatus}
     * @param {boolean} notify 是否触发onReceiveMessage
     * @param {[string]} toUsers 群会话时有效，定向发送给会话中的某些用户；为空，则发给所有人
     * @param {Number} serverTime 服务器时间，精度到毫秒
     *
     * @return {Message} 插入的消息
     */
    insertMessage(conversation, messageContent, status, notify = false, toUsers = [], serverTime = 0) {
        impl.insertMessage(conversation, messageContent, status, notify, toUsers, serverTime);
    }

    /**
     * 更新消息
     * @param {number} messageId 消息id
     * @param {MessageContent} messageContent 具体的消息内容，一定要求是{@link MessageContent} 的子类，不能是普通的object
     * @returns {Promise<void>}
     */
    async updateMessageContent(messageId, messageContent) {
        impl.updateMessageContent(messageId, messageContent);
    }

    /**
     * 更新消息状态
     * @param {number} messageId 消息id
     * @param {MessageStatus} status 消息状态，可选值参考{@link MessageStatus}
     */
    async updateMessageStatus(messageId, status) {
        impl.updateMessageStatus(messageId, status);
    }

    /**
     * 上传媒体文件，由于 uniapp 限制，不支持上传稍大的数据，稍大的文件，请使用 uploadMediaFile
     * @param {string} fileName
     * @param {string} fileOrData base64格式的dataUri
     * @param {number} mediaType 媒体类型，可选值参考{@link MessageContentMediaType}
     * @param {function (string)} successCB 回调通知上传成功之后的url
     * @param {function (number)} failCB
     * @param {function (number, number)} progressCB
     * @returns {Promise<void>}
     */
    async uploadMedia(fileName, fileOrData, mediaType, successCB, failCB, progressCB) {
        impl.uploadMedia(fileName, fileOrData, mediaType, successCB, failCB, progressCB);
    }

    /**
     * 上传媒体文件
     * @param {string} filePath
     * @param {number} mediaType 媒体类型，可选值参考{@link MessageContentMediaType}
     * @param {function (string)} successCB 回调通知上传成功之后的url
     * @param {function (number)} failCB
     * @param {function (number, number)} progressCB 由于 uniapp 限制，这个方法目前只会回调一次，无法持续回调。https://doc.dcloud.net.cn/uni-app-x/plugin/uts-plugin.html#keepalive
     * @returns {Promise<void>}
     */
    async uploadMediaFile(filePath,  mediaType, successCB, failCB, progressCB) {
        impl.uploadMediaFile(filePath,  mediaType, successCB, failCB, progressCB);
    }



    getVersion() {
        return impl.getVersion();
    }

    /**
     * 获取经过认证的下载地址。
     */
    getAuthorizedMediaUrl(messageUid, mediaType, mediaPath, successCB, failCB) {
        impl.getAuthorizedMediaUrl(messageUid, mediaType, mediaPath, successCB, failCB)
    }

    /**
     * 是否支持上传大文件上传。只有专业版才支持此功能。当支持大文件上传时，调用getUploadMediaUrl获取上传url，然后在应用层上传
     */
    isSupportBigFilesUpload() {
        return impl.isSupportBigFilesUpload();
    }

    /**
     * 获取上传链接。一般用户大文件上传。
     * @param {string} fileName
     * @param {number} mediaType 媒体类型，可选值参考{@link MessageContentMediaType}
     * @param {string} contentType HTTP请求的ContentType header，为空时默认为"application/octet-stream"
     * @param {function (string, string)} successCB 回调通知上传成功之后的url
     * @param {function (number)} failCB
     */
    getUploadMediaUrl(fileName, mediaType, contentType, successCB, failCB) {
        impl.getUploadMediaUrl(fileName, mediaType, contentType, successCB, failCB);
    }

    /**
     * 微信小程序切到前台时调用应用切到了前台
     *
     */
    onForeground() {
        impl.onForeground();
    }

    /**
     *
     * 是否开启了已送达报告和已读报告功能
     * @return {boolean}
     */
    isReceiptEnabled() {
        return impl.isReceiptEnabled();
    }

    /**
     * 当前用户是否开启消息回执
     * @return {boolean}
     */
    isUserReceiptEnabled() {
        return impl.isUserReceiptEnabled();
    }

    /**
     * 判断是否是专业版IM服务
     * @return {boolean}
     */
    isCommercialServer() {
        return impl.isCommercialServer();
    }

    /**
     * 判断是否应用禁止草稿同步
     * @return {boolean}
     */
    isGlobalDisableSyncDraft() {
        return impl.isGlobalDisableSyncDraft();
    }


    /**
     *
     * @param disable
     * @param successCB
     * @param failCB
     */
    setDisableSyncDraft(disable, successCB, failCB) {
        impl.setDisableSyncDraft(disable, successCB, failCB)
    }

    isDisableSyncDraft() {
        return impl.isDisableSyncDraft();
    }

    /**
     * 设置当前用户是否开启消息回执
     * @param enable
     * @param successCB
     * @param failCB
     */
    setUserEnableReceipt(enable, successCB, failCB) {
        impl.setUserEnableReceipt(enable, successCB, failCB);
    }

    /**
     *
     * @param conversation
     * @return {Map<string, Long>}
     */
    getConversationRead(conversation) {
        return impl.getConversationRead(conversation);
    }

    /**
     * 获取会话中的文件记录
     * @param {Conversation} conversation 会话
     * @param {String} fromUser 来源用户
     * @param {Long} beforeMessageUid 消息uid，表示获取此消息uid之前的文件记录
     * @param {number} count 数量
     * @param {function (FileRecord[])} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getConversationFileRecords(conversation, fromUser, beforeMessageUid, count, successCB, failCB) {
        impl.getConversationFileRecords(conversation, fromUser, beforeMessageUid, count, successCB, failCB);
    }

    /**
     * 获取我发送的文件记录
     * @param {Long} beforeMessageUid 消息uid，表示获取此消息uid之前的文件记录
     * @param {number} count 数量
     * @param {function (FileRecord[])} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    getMyFileRecords(beforeMessageUid, count, successCB, failCB) {
        impl.getMyFileRecords(beforeMessageUid, count, successCB, failCB);
    }

    /**
     * 删除文件记录
     * @param {Long} messageUid 文件对应的消息的uid
     * @param {function ()} successCB 成功回调
     * @param {function (number)} failCB 失败回调
     */
    deleteFileRecord(messageUid, successCB, failCB) {
        impl.deleteFileRecord(messageUid, successCB, failCB);
    }

    /**
     * 搜索远程文件记录
     * @param {string} keyword
     * @param {Conversation} conversation 会话，如果为空则获取当前用户所有收到和发出的文件记录
     * @param {string} fromUser 文件发送用户，如果为空则获取该用户发出的文件记录
     * @param {Long | string} beforeMessageId 起始消息的消息id
     * @param {number} count
     * @param {function (FileRecord[])} successCB
     * @param {function (number)} failCB
     */
    searchFiles(keyword, conversation, fromUser, beforeMessageId, count, successCB, failCB) {
        impl.searchFiles(keyword, conversation, fromUser, beforeMessageId, count, successCB, failCB)
    }

    /**
     * 搜索我自己的远程文件记录
     * @param keyword
     * @param beforeMessageUid
     * @param count
     * @param successCB
     * @param failCB
     */
    searchMyFiles(keyword, beforeMessageUid, count, successCB, failCB) {
        impl.searchMyFiles(keyword, beforeMessageUid, count, successCB, failCB);
    }

    /**
     * 获取host
     */
    getHost() {
        return impl.getHost();
    }


    getEncodedClientId() {
        return impl.getEncodedClientId();
    }

    /**
     *
     * @param {string} data 将要编码的数据
     * @returns {string} 编码结果，base64格式
     */
    encodeData(data) {
        return impl.encodeData(data);
    }

    /**
     *
     * @param {string} encodedData 将要解码的数据，base64格式
     * @returns {null | string} 解码之后的数据
     */
    decodeData(encodedData) {
        return impl.decodeData(encodedData);
    }

    /**
     * 发送会议相关请求
     * @param sessionId
     * @param roomId
     * @param request
     * @param data
     * @param callback
     */
    sendConferenceRequest(sessionId, roomId, request, data, callback) {
        this.sendConferenceRequestEx(sessionId, roomId, request, data, false, callback)
    }

    sendConferenceRequestEx(sessionId, roomId, request, data, advance, callback) {
        impl.sendConferenceRequest(sessionId, roomId, request, data, advance, callback);
    }

    isUserOnlineStateEnabled() {
        return impl.isUserOnlineStateEnabled();
    }

    /**
     *
     * @param {number} type 会话类型， 支持{@link ConversationType.Single}和{@link ConversationType.Group}
     * @param {string[]} targets 会话类型为单聊时，是用户 id列表；会话类型为群组时，是群组 id 列表
     * @param {number} duration 关注时间长度，单位是秒
     * @param {function(UserOnlineState[])} successCB
     * @param {function(number)} failCB
     */
    watchOnlineState(type, targets, duration, successCB, failCB) {
        impl.watchOnlineState(type, targets, duration, successCB, failCB);
    }

    unwatchOnlineState(type, targets, successCB, failCB) {
        impl.unwatchOnlineState(type, targets, successCB, failCB);
    }

    setMyCustomState(customState, customText, successCB, failCB) {
        impl.setMyCustomState(customState, customText, successCB, failCB)
    }

    getAuthCode(appId, appType, host, successCB, failCB) {
        impl.getAuthCode(appId, appType, host, successCB, failCB);
    }

    configApplication(appId, appType, timestamp, nonceStr, signature, successCB, failCB) {
        impl.configApplication(appId, appType, timestamp, nonceStr, signature, successCB, failCB)
    }

    notify(title, content) {
        impl.notify(title, content)
    }

    clearAllNotification() {
        impl.clearAllNotification();
    }

    /**
     * 当前用户是否开启添加好友需要验证，默认为开启
     *
     * @return true，需要验证；false，不需要验证
     */
    isAddFriendNeedVerify() {
        return impl.isAddFriendNeedVerify();
    }

    /**
     * 修改当前用户是否开启添加好友需要验证功能
     *
     * @param enable {boolean}  是否需要验证
     * @param successCB {() => void } 结果回调
     * @param failCB { (err) => void} 结果回调
     */
    setAddFriendNeedVerify(enable, successCB, failCB) {
        impl.setAddFriendNeedVerify(enable, successCB, failCB);
    }

    chooseFile(type, successCB, failCB) {
        impl.chooseFile(type, successCB, failCB)
    }

    _getStore() {
        return impl._getStore();
    }

    /**
     * 内部使用，electron主窗口之外的，其他窗口，attach到主窗口初始化的proto上，可以调用get相关方法，但没有通知
     * @param protoObj
     */
    attach(protoObj) {
        impl.attach(protoObj);
    }

    /**
     * utf8转base64
     * @param {string} str
     * @returns {string}
     */
    utf8_to_b64(str) {
        return btoa(unescape(encodeURIComponent(str)));
    }

    /**
     * base64转utf8
     * @param {string} str
     * @returns {string}
     */
    b64_to_utf8(str) {
        return decodeURIComponent(escape(atob(str)));
    }

    unescape(str) {
        return (str + '==='.slice((str.length + 3) % 4))
            .replace(/-/g, '+')
            .replace(/_/g, '/')
    }

    escape(str) {
        return str.replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '')
    }

    defaultUserPortrait(userInfo) {
        if (!userInfo.updateDt) {
            return Config.DEFAULT_PORTRAIT_URL
        }
        return `${Config.APP_SERVER}/avatar?name=${encodeURIComponent(userInfo.displayName)}`
        // return `http://localhost:8888/avatar?name=${encodeURIComponent(userInfo.displayName)}`
    }

    defaultGroupPortrait(groupInfo) {
        let memberIds = this.getGroupMemberIds(groupInfo.target)
        memberIds = memberIds.slice(0, 9);
        // let members = this.getUserInfos(memberIds, groupInfo.target);
        let members = impl.getUserInfos(memberIds, groupInfo.target);
        let req = {
            members: []
        }
        let pending = false;
        for (const m of members) {
            if (m.portrait && !m.portrait.startsWith(`${Config.APP_SERVER}`)) {
                req.members.push({
                    avatarUrl: m.portrait
                })
            } else {
                req.members.push({
                    name: m.displayName
                })
            }
            if (m instanceof NullUserInfo) {
                pending = true;
                break
            }
        }
        if (members.length === 0 || pending) {
            return Config.DEFAULT_GROUP_PORTRAIT_URL;
        }

        req = JSON.stringify(req, null, '');

        return `${Config.APP_SERVER}/avatar/group?request=${encodeURIComponent(req)}`
        //return `http://localhost:8888/avatar/group?request=${encodeURIComponent(req)}`
    }
}

const self = new WfcManager();
export default self;
