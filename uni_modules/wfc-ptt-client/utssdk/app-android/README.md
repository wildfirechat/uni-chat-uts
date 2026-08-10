`HBuilderX` 有 bug，本地运行时，不能正常解析 `compileOnly`依赖；而制作自定义调试基座或云打包时，需要使用`compileOnly`进行依赖，否则出现`dulicate class`导致编译失败

解决
1. 制作自定义调试基座或云打包
   用`config-package.json` 替换 `config.json`
2. 制作自定义调试基座后，本地运行
   用`config-local.json` 替换 `config.json`
3. `config.json`默认为云打包版本
4.  `wfc-av-client`和 `wfc-ptt-client` 都是一样的处理