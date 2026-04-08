'use strict';
const uniPush = uniCloud.getPushManager({appId:"__UNI__2077CCF"}) //注意这里需要传入你的应用appId，用于指定接收消息的客户端
exports.main = async (event, context) => {
	//event为客户端上传的参数
	
	// 云函数接收到的event.body为请求发送的数据，https://doc.dcloud.net.cn/uniCloud/http.html
	
	console.log('event : ', event)
	
	// 优先云函数 URL 化的 body
	let data = event.body ? event.body : event;
	
	if(typeof data === 'string'){
		data = JSON.parse(data);
	}
	
	const cid = data.clientId ? data.clientId : data.push_clientid;
	const title = data.title;
	const content = data.content;
	const payload = data.payload;
	const category = data.category;
	const forceNotification = data.forceNotification ? data.forceNotification : data.force_notification;
	
	return await uniPush.sendMessage({
		"push_clientid": cid, 	//填写上一步在uni-app客户端获取到的客户端推送标识push_clientid
		"title": title,	
		"content": content,
		"payload": payload,
		"category": category,
		"force_notification": !!forceNotification
	})
};
