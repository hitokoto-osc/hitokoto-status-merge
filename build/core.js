"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 注册依赖
const nconf_1 = __importDefault(require("nconf"));
const winston_1 = __importDefault(require("winston"));
const fs_1 = __importDefault(require("fs"));
const events_1 = __importDefault(require("events"));
// import path from 'path'
// import _ from 'lodash'
// 使用蓝鸟加速
// import bluebird from 'bluebird'
// global.Promise = bluebird
// 注册初始化环境
const preStart_1 = require("./src/preStart");
// 注册网络库
const net_1 = __importDefault(require("./src/net"));
// 注册加密库
const crypto_1 = __importDefault(require("./src/crypto"));
// CronJob
// import { CronJob } from 'cron'
const utils_1 = require("./src/utils");
const koa_1 = __importDefault(require("koa"));
const koa_router_1 = __importDefault(require("koa-router"));
const koa_json_1 = __importDefault(require("koa-json"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const koa_json_error_1 = __importDefault(require("koa-json-error"));
const cors_1 = __importDefault(require("@koa/cors"));
preStart_1.PreStart.load();
// ipv4 正则
const ipv4Reg = /(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5]):[a-zA-Z0-9]+\d/g;
// 初始化失败次数 以及 默认重新尝试秒数
let failtureRequestTimes = 0;
const defaultFailtrueInterval = nconf_1.default.get('default_failtrue_interval') || 1; // 默认失败重试间隔， 单位: 秒
const defaultRequestInterval = nconf_1.default.get('default_request_interval') || 8; // 默认的合并间隔， 单位： 秒
// 获取子节点列表
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchServerList() {
    winston_1.default.verbose('开始获取节点列表...');
    const tagetUri = nconf_1.default.get('target_uri');
    const decryptKey = nconf_1.default.get('decrypt_key');
    const decryptIv = nconf_1.default.get('decrypt_iv');
    winston_1.default.verbose(tagetUri);
    winston_1.default.verbose(decryptKey);
    // 请求接口， 获取列表
    const responseBody = await net_1.default.request(tagetUri + '?ts=' + Date.now(), 'GET');
    // console.log(responseBody)
    const data = responseBody.data.toString('utf8');
    winston_1.default.verbose(data);
    const list = JSON.parse(crypto_1.default.aesDecrypt(data, decryptKey, decryptIv));
    winston_1.default.verbose(list);
    return list;
}
// 获取数据
async function fetch(list) {
    async function fetchChild(input) {
        // console.log(input)
        try {
            const responseBody = await net_1.default.getJSON(input.url + '/status');
            if (responseBody.status) {
                const errorMsg = {
                    isError: true,
                    id: input.id,
                    code: responseBody.status,
                    msg: responseBody.statusText.replace(ipv4Reg, 'Hidden IPAddress'),
                    stack: (new Error().stack || '').replace(ipv4Reg, 'Hidden IPAddress'),
                    ts: Date.now()
                };
                return errorMsg;
            }
            else {
                return responseBody;
            }
        }
        catch (err) {
            // 网络错误 或者其他错误
            const errorMsg = {
                isError: true,
                id: input.id,
                code: -1,
                msg: err.message.replace(ipv4Reg, 'Hidden IPAddress'),
                stack: (err.stack || '').replace(ipv4Reg, 'Hidden IPAddress'),
                ts: Date.now()
            };
            return errorMsg;
        }
    }
    const events = [];
    for (const value of list) {
        // 进行纯异步请求
        events.push(fetchChild(value));
    }
    return Promise.all(events); // 并发一波请求
}
const childList = {
    lastUpdate: 0,
    list: []
};
async function saveStatus() {
    if (!childList.lastUpdate) {
        childList.list = await fetchServerList();
        childList.lastUpdate = Date.now();
    }
    else if ((Date.now() - childList.lastUpdate) > 60 * 60 * 2 * 1000) {
        fetchServerList()
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            .then(list => {
            childList.list = list;
            childList.lastUpdate = Date.now();
        });
    }
    const list = childList.list;
    winston_1.default.verbose('开始获取子节点数据...');
    const fetchResult = await fetch(list);
    const children = [];
    const downServer = [];
    for (const child of fetchResult) {
        if (child.isError) {
            // console.log(child)
            downServer.push(child);
        }
        else {
            children.push(child);
        }
    }
    winston_1.default.verbose('执行数据合并...');
    // console.log(children)
    // console.log(downServer)
    // console.log(downServerList)
    try {
        return !!(await utils_1.applyMerge(children, downServer));
    }
    catch (e) {
        winston_1.default.error('合并过程发生错误，以下为错误信息：');
        winston_1.default.error(e.stack);
        return false;
    }
    // fs.existsSync(path.join('./data')) || fs.mkdirSync(path.join('./data'))
    // winston.info('写入状态数据...')
    // fs.writeFileSync(path.join('./data/status.json'), JSON.stringify(data))
    // fs.writeFileSync(path.join('./data/down.json'), JSON.stringify(downServerList))
}
// 利用 Node.js 事件监听机制解决定时器 GG 问题
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const coreEvent = new events_1.default.EventEmitter();
coreEvent.on('exec', async () => {
    try {
        const isSuccess = await saveStatus();
        if (!isSuccess) {
            throw new Error('无法合并, 合并中断');
        }
        failtureRequestTimes = 0;
        const t = defaultRequestInterval;
        winston_1.default.verbose(`合并完成！ 将在 ${t} 秒后进行下一次合并。`);
        await sleep(t * 1000);
        coreEvent.emit('exec');
    }
    catch (err) {
        const t = failtureRequestTimes + 1;
        const i = defaultFailtrueInterval * (t * t);
        winston_1.default.error('在合并状态过程中发生错误， 错误信息如下所示：');
        winston_1.default.error(err);
        winston_1.default.warn(`自动重新尝试获取... 目前已失败 ${t} 次， 将在 ${i} 秒后重新尝试。`);
        failtureRequestTimes = t;
        await sleep(i * 1000);
        coreEvent.emit('exec');
    }
});
coreEvent.emit('exec');
// 启动方法
const app = new koa_1.default();
const router = new koa_router_1.default();
router
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    .get('/', async (ctx) => {
    const file = JSON.parse(fs_1.default.readFileSync('./data/status.json').toString());
    const now = Date.now();
    Object.assign(file, {
        ts: now,
        now: new Date(now).toString()
    });
    ctx.status = 200;
    ctx.append('Access-Control-Allow-Origin', '*');
    ctx.append('Access-Control-Allow-Method', 'GET');
    ctx.body = file;
});
router
    .get('/check', ctx => { ctx.status = 200; ctx.body = 'OK'; });
// 注册中间件
app
    .use(cors_1.default({
    origin: '*'
}))
    .use(router.routes())
    .use(router.allowedMethods())
    .use(koa_bodyparser_1.default())
    .use(koa_json_1.default())
    .use(koa_json_error_1.default());
const port = nconf_1.default.get('port') || 6578;
app.listen(port);
winston_1.default.info('Server is started. Listening on Port: ' + port);
//# sourceMappingURL=core.js.map