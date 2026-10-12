/** @typedef {import("@tuya-sat/micro-script").DebuggerConfig} DebuggerConfig */
/** @typedef {import("@tuya-sat/micro-script").WebpackCombineFunction} WebpackCombineFunction */
/** @typedef {import("@tuya-sat/micro-script").CustomDevServer} CustomDevServer */

module.exports = {
  /**@type {DebuggerConfig} */
  debuggerConfig: {
    target: 'xxx', // 需要代理的协议+host
    username: 'xxxx', // 对应域名的超级管理员账户名
    password: 'xxx', //  超级管理员密码
    logSign: true, // 打印请求头
    mockPermissions: ['REGISTER', 'EDIT', 'DELETE'],
    additionHeaders: {},
  },
  /**@type {WebpackCombineFunction} */
  webpack(config, { isDev, isBuild }) {
    config.output.publicPath = isDev ? '/' : './';
    return config;
  },
  /**@type {CustomDevServer} */
  devServer(config) {
    return config;
  },
};
