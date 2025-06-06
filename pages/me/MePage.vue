<template>
    <div class="me-container">
        <div class="user-info" @click="showUserInfo">
            <image class="portrait" :src="user.portrait" @click.stop="updatePortrait"></image>
            <text class="name">{{ user.displayName }}</text>
        </div>
        <div class="about" @click="showAbout">
            <text>关于</text>
        </div>
        <div class="about" @click="showApiTest">
            <text>API测试</text>
        </div>
        <div>
            <text>
                {{ info }}
            </text>
        </div>
        <button class="logout-button" @click="logout">退出登录</button>
    </div>

</template>

<script>
import wfc from "../../wfc/client/wfc";
import {clear} from "../util/storageHelper";
import store from "../../store";
import avengineKit from "../../wfc/av/engine/avengineKit";
import Config from "../../config";
import MessageContentMediaType from "../../wfc/messages/messageContentMediaType";
import ModifyMyInfoType from "../../wfc/model/modifyMyInfoType";

export default {
    name: "MePage",
    data() {
        return {
            user: store.state.contact.selfUserInfo,
            info: ''
        }
    },
    mounted() {
        if (avengineKit.isAVEngineKitEnable()) {
            if (avengineKit.isSupportConference()) {
                this.info += '高级版音视频\n'
            } else {
                this.info += '多人版音视频\n'
                Config.ICE_SERVERS.forEach(obj => {
                    this.info += obj.uri + ' ' + obj.userName + ' ' + obj.password;
                })
            }
        }
    },
    methods: {
        showUserInfo() {
            store.setCurrentFriend(this.user)
            uni.navigateTo({
                url: '/pages/contact/UserDetailPage',
                success: () => {
                    console.log('nav to UserDetailPage success');

                },
                fail: (err) => {
                    console.log('nav to UserDetailPage err', err);
                }
            })

        },
        logout() {
            wfc.disconnect(true, false);
            clear();
            uni.reLaunch(
                {
                    url: '/pages/login/login'
                }
            );
        },
        showAbout() {
            uni.navigateTo({
                url: '/pages/misc/WebViewPage?url=https://wildfirechat.cn/',
                fail: (e) => {
                    console.log(e)
                }
            });
        },
        showApiTest() {
            uni.navigateTo({
                url: '/pages/misc/ApiTestPage',
                fail: (e) => {
                    console.log(e)
                }
            });

        },

        updatePortrait() {
            console.log('updatePortrait 0')
            // 使用 chooseMedia，同时选取图片和视频
            // https://uniapp.dcloud.net.cn/api/media/video.html#choosemedia
            uni.chooseImage({
                count: 1,
                mediaType: ['image'],
                sourceType: ['album', 'camera'],
                sizeType: ['original', 'compressed'],
                success: (e) => {
                    console.log('choose image', e.tempFilePaths);
                    e.tempFilePaths.forEach(async path => {
                        let filePath;
                        // #ifdef APP-HARMONY
                        filePath = path;
                        //#else
                        if (path.startsWith('file:///')) {
                            filePath = path.substring('file://'.length);
                        } else {
                            filePath = plus.io.convertLocalFileSystemURL(path)
                        }
                        //#endif
                        wfc.uploadMediaFile(filePath, MessageContentMediaType.Portrait, (remoteUrl) => {
                            console.log('upload success', remoteUrl);
                            wfc.modifyMyInfo([{
                                type: ModifyMyInfoType.Modify_Portrait,
                                value: remoteUrl
                            }], () => {
                                console.log('modifyMyInfo success', remoteUrl);
                                this.user.portrait = remoteUrl;
                                uni.showToast({
                                    title: '头像更新成功',
                                    icon: 'none'
                                });
                            }, (error) => {
                                console.error('modifyMyInfo error', error);
                                uni.showToast({
                                    title: '头像更新失败: ' + error,
                                    icon: 'none'
                                });
                            });
                        }, (error) => {
                            console.error('upload error', error);
                            // uni.showToast({
                            //     title: '上传失败: ' + error,
                            //     icon: 'none'
                            // });
                        }, (progress) => {
                            console.log('upload progress', progress);
                        });
                    })
                }
            });
        }
    }
}
</script>

<style scoped>

.me-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    height: var(--page-full-height-without-header-and-tabbar);
    background: #fafafa;
}

.user-info {
    width: 100%;
    padding: 10px;
    height: 80px;
    display: flex;
    background: white;
    align-items: center;
    flex-direction: row;
    margin-bottom: 10px;
}

.user-info:active {
    background: #d6d6d6;
}

.user-info .portrait {
    width: 60px;
    height: 60px;
    border-radius: 5px;
}

.user-info .name {
    margin-left: 10px;
}

.about {
    width: 100%;
    padding: 15px 10px;
    background: white;
}

.about:active {
    background: #d6d6d6;
}

.logout-button {
    margin-top: 20px;
}

</style>
