"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyMerge = void 0;
const semver_compare_1 = __importDefault(require("semver-compare"));
const lowdb_1 = __importDefault(require("lowdb"));
const path_1 = __importDefault(require("path"));
const FileSync_1 = __importDefault(require("lowdb/adapters/FileSync"));
const lodash_1 = __importDefault(require("lodash"));
const winston_1 = __importDefault(require("winston"));
// import winston from 'winston'
const statusAdapter = new FileSync_1.default(path_1.default.join('./data/status.json'));
const downServerListAdapter = new FileSync_1.default(path_1.default.join('./data/down.json'));
const db = {
    status: lowdb_1.default(statusAdapter),
    down: lowdb_1.default(downServerListAdapter)
};
// 指定数据库的默认值
db
    .status
    .defaults({
    version: '0.0.0',
    children: [],
    downServer: [],
    status: {
        load: [0, 0, 0],
        memory: 0,
        hitokoto: {
            total: 0,
            categroy: []
        },
        childStatus: []
    },
    requests: {
        all: {
            total: 0,
            pastMinute: 0,
            pastHour: 0,
            pastDay: 0,
            dayMap: [],
            FiveMinuteMap: []
        },
        hosts: {
            'v1.hitokoto.cn': {
                total: 0,
                pastMinute: 0,
                pastHour: 0,
                pastDay: 0,
                dayMap: []
            },
            'international.v1.hitokoto.cn': {
                total: 0,
                pastMinute: 0,
                pastHour: 0,
                pastDay: 0,
                dayMap: []
            }
        }
    },
    lastUpdate: 0,
    now: '',
    ts: 0
})
    .write();
db
    .down
    .defaults({
    ids: [],
    data: []
})
    .write();
function handleDownServerList(list) {
    for (const child of list) {
        if (db.down.get('ids').indexOf(child.id).value() < 0) { // 数据库里不存在
            db.down.get('ids').push(child.id).value();
            db.down.get('data')
                .push({
                id: child.id,
                start: Date.now(),
                statusMsg: child
            })
                .value();
        }
        else { // 我们修改下信息
            db.down.get('data')
                .find({ id: child.id })
                .assign({ statusMsg: child });
        }
    }
    // 反向检测是否正常
    for (const id of db.down.get('ids').value()) {
        if (!lodash_1.default.find(list, { id: id })) { // 机器恢复了
            db.down.get('ids').pull(id).value();
            db.down.get('data').remove({ id: id }).value();
        }
    }
    db.down.write(); // 写入文件
    const r = {
        ids: db.down.get('ids').value(),
        data: db.down.get('data').value()
    };
    return r;
}
async function applyMerge(children, downServerList) {
    // 初始化一些数据
    let memory = 0;
    let hitokotoTotal = 0;
    let hitokotoCategroy = [];
    db.status.set('status.childStatus', []).value();
    db.status.set('children', []).value();
    db.status.set('downServer', []).value();
    db.status.set('requests.all.FiveMinuteMap', []).value();
    db.status.set('requests.all.dayMap', []).value();
    db.status.set('requests.all.total', 0).value();
    db.status.set('requests.all.pastMinute', 0).value();
    db.status.set('requests.all.pastHour', 0).value();
    db.status.set('requests.all.pastDay', 0).value();
    db.status
        .set('requests.hosts', {
        'v1.hitokoto.cn': {
            total: 0,
            pastMinute: 0,
            pastHour: 0,
            pastDay: 0,
            dayMap: []
        },
        'international.v1.hitokoto.cn': {
            total: 0,
            pastMinute: 0,
            pastHour: 0,
            pastDay: 0,
            dayMap: []
        }
    })
        .value();
    // 注册一波缓存， 最蠢的数据合并方法
    const loadBuffer = [0, 0, 0];
    // 迭代数据集
    for (const child of children) {
        // 汇总服务器标识
        db.status.get('children').push(child.server_id).value();
        // 版本号
        const semVer = db.status.get('version').value();
        if (semver_compare_1.default(semVer, child.version) < 0) {
            db.status.set('version', child.version).value();
        }
        // 缓存 status 统计, 以便结束迭代时计算平均值
        loadBuffer[0] += child.server_status.load[0];
        loadBuffer[1] += child.server_status.load[1];
        loadBuffer[2] += child.server_status.load[2];
        // 汇总总占用内存
        memory += child.server_status.memory.usage;
        // 检测是否缺少 hitokoto 字段
        if (!child.server_status.hitokto || !child.server_status.hitokto.total || !child.server_status.hitokto.categroy) {
            winston_1.default.error('在操作合并时出现错误，子节点缺少 hitokoto 相关统计字段，以下为子节点信息，合并中断。');
            winston_1.default.error(JSON.stringify(child));
            return;
        }
        // 一言总数统计汇总
        if (hitokotoTotal < child.server_status.hitokto.total)
            hitokotoTotal = child.server_status.hitokto.total;
        // 一言分类汇总
        if (hitokotoCategroy.length < child.server_status.hitokto.categroy.length)
            hitokotoCategroy = child.server_status.hitokto.categroy;
        // 推送 childStatus
        db.status.get('status.childStatus').push(child.server_status).value();
        // 合并请求总数
        db.status.set('requests.all', db.status.get('requests.all')
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            .mapValues((v, k) => {
            if (k !== 'dayMap' && k !== 'FiveMinuteMap') {
                return v + child.requests.all[k]; // TODO: 修复错误的类型推断
            }
            else {
                return v;
            }
        })
            .value()).value();
        if (db.status.get('requests.all.dayMap').size().value() === 0) { // 当日每小时请求数
            db.status.set('requests.all.dayMap', child.requests.all.dayMap).value();
        }
        else {
            db.status.set('requests.all.dayMap', db.status.get('requests.all.dayMap')
                // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
                .map((v, i) => {
                return v + child.requests.all.dayMap[i];
            })
                .value()).value();
        }
        if (db.status.get('requests.all.FiveMinuteMap').size().value() === 0) { // 过去 5 分钟每分钟请求数
            db.status.set('requests.all.FiveMinuteMap', child.requests.all.FiveMinuteMap).value();
        }
        else {
            db.status.set('requests.all.FiveMinuteMap', db.status.get('requests.all.FiveMinuteMap')
                // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
                .map((v, i) => {
                return v + child.requests.all.FiveMinuteMap[i];
            })
                .value()).value();
        }
        // 合并 hosts 统计
        db.status.set('requests.hosts', db.status.get('requests.hosts')
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            .mapValues((hostData, host) => {
            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
            return lodash_1.default.mapValues(hostData, (value, key) => {
                if (key === 'dayMap') {
                    if (value.length === 0) {
                        if (child.requests.hosts[host] && child.requests.hosts[host][key]) {
                            return child.requests.hosts[host][key];
                        }
                        else {
                            return value;
                        }
                    }
                    else {
                        if (child.requests.hosts[host] && child.requests.hosts[host][key]) {
                            // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
                            return value.map((v, i) => {
                                return v + child.requests.hosts[host][key][i];
                            });
                        }
                        else {
                            return value;
                        }
                    }
                }
                else {
                    if (child.requests.hosts[host] && child.requests.hosts[host][key]) {
                        return value + child.requests.hosts[host][key];
                    }
                    else {
                        return value;
                    }
                }
            });
        })
            .value()).value();
    }
    // 计算 load 平均值
    db.status.set('status.load', db.status.get('status.load')
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .map((v, i) => {
        return loadBuffer[i] / children.length;
    })
        .value()).value();
    // 合并宕机的服务器
    const downList = handleDownServerList(downServerList);
    if (downList.data.length > 0) {
        for (const child of downList.data) {
            db.status.get('children').push(child.id).value();
            db.status.get('downServer').push({
                id: child.id,
                startTs: child.start,
                last: Date.now() - child.start,
                statusMessage: child.statusMsg
            }).value();
        }
    }
    // 写入值
    const ts = Date.now();
    const date = new Date(ts);
    db.status.set('status.memory', memory).value();
    db.status.set('status.hitokoto.total', hitokotoTotal).value();
    db.status.set('status.hitokoto.categroy', hitokotoCategroy).value();
    db.status.set('lastUpdate', ts).value();
    db.status.set('now', date.toLocaleString()).value();
    db.status.set('ts', ts).value();
    // 写入数据库
    db.status.write();
    return true;
}
exports.applyMerge = applyMerge;
//# sourceMappingURL=utils.js.map