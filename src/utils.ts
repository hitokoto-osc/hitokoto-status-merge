import cmp from 'semver-compare'
import lowdb from 'lowdb'
import path from 'path'
import FileSync from 'lowdb/adapters/FileSync'
import _ from 'lodash'
// import winston from 'winston'

const statusAdapter = new FileSync(path.join('./', '../data/status.json'))
const downServerListAdapter = new FileSync(path.join('./', '../data/down.json'))
const db = {
  status: lowdb(statusAdapter),
  down: lowdb(downServerListAdapter)
}

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
        'api.hitokoto.cn': {
          total: 0,
          pastMinute: 0,
          pastHour: 0,
          pastDay: 0,
          dayMap: []
        },
        'sslapi.hitokoto.cn': {
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
  .write()

db
  .down
  .defaults({
    ids: [],
    data: []
  })
  .write()
export interface ServerListMember {
  url: string;
  id: string;
  active: boolean;
  updated_time: number;
  created_time: number;
}

// status interface
export interface StatusBody {
  name: string;
  version: string;
  message: string;
  website: string;
  server_id: string;
  server_status: ChildServerStatus;
  requests: ChildRequests;
  feedback: {
    Kuertianshi: string;
    freejishu: string;
    a632079: string;
  };
  copyright: string;
  now: string;
  ts: number;
}

export interface ChildRequests {
  all: RequestsAll;
  hosts: {
    'v1.hitokoto.cn': HostChild;
    'sslapi.hitokoto.cn': HostChild;
    'api.hitokoto.cn': HostChild;
    'api.a632079.me': HostChild;
  };
}

export interface ChildServerStatus {
  memory: MemoryStatus;
  load: number[];
  hitokto: HitokotoStatus;
}

export interface HitokotoStatus {
  total: number;
  categroy: string[];
  lastUpdate?: number;
}

export interface MemoryStatus {
  totol: number;
  free: number;
  usage: number;
}

export interface RequestsAll {
  total: number;
  pastMinute: number;
  pastHour: number;
  pastDay: number;
  dayMap: number[];
  FiveMinuteMap: number[];
}
export interface HostChild {
  total: number;
  pastMinute: number;
  pastHour: number;
  pastDay: number;
  dayMap: number[];
}
export interface DownServerData {
  id: string;
  startTs: number;
  last: number;
  statusMessage: NetworkError;
}

export interface ExportData {
  version: string; // Hitokoto Version
  children: string[];
  downServer: DownServerData[];
  status: {
    load: number[];
    memory: number;
    hitokoto: HitokotoStatus;
    childStatus: ChildServerStatus[];
  };
  requests: {
    all: RequestsAll;
    hosts: {
      'v1.hitokoto.cn': HostChild;
      'api.hitokoto.cn': HostChild;
      'sslapi.hitokoto.cn': HostChild;
    };
  };
  lastUpdate: number;
  now: string;
  ts: number;
}

export interface NetworkError {
  isError: boolean; // is Error
  id: string; // Server_id
  code: number; // StatusCode
  msg: string; // error msg
  stack: string; // error stack
  ts: number; // current timestamp
}

export interface DownServerListInterface {
  ids: string[];
  data: DownServer[];
}

export interface DownServer {
  id: string;
  start: number;
  statusMsg: NetworkError;
}


function handleDownServerList (list: NetworkError[]): DownServerListInterface {
  for (const child of list) {
    if (db.down.get('ids').indexOf(child.id).value() < 0) { // 数据库里不存在
      db.down.get('ids').push(child.id).value()
      db.down.get('data')
        .push({
          id: child.id,
          start: Date.now(),
          statusMsg: child
        })
        .value()
    } else { // 我们修改下信息
      db.down.get('data')
        .find({ id: child.id })
        .assign({ statusMsg: child })
    }
  }
  // 反向检测是否正常
  for (const id of db.down.get('ids').value()) {
    if (!_.find(list, { id: id })) { // 机器恢复了
      db.down.get('ids').pull(id).value()
      db.down.get('data').remove({ id: id }).value()
    }
  }

  db.down.write() // 写入文件
  const r: DownServerListInterface = {
    ids: db.down.get('ids').value(),
    data: db.down.get('data').value()
  }
  return r
}

export async function applyMerge (
  children: StatusBody[],
  downServerList: NetworkError[]
): Promise<void> {
  // 初始化一些数据
  let memory = 0
  let hitokotoTotal = 0
  let hitokotoCategroy: string[] = []
  db.status.set('status.childStatus', []).value()

  // 注册一波缓存， 最蠢的数据合并方法
  const loadBuffer = [0, 0, 0]

  // 迭代数据集
  for (const child of children) {
    // 汇总服务器标识
    const hasId = db.status.get('children').indexOf(child.server_id).value() // TODO: 追踪 Types: LowDB 的解决进度
    if (!hasId) {
      db.status.get('children').push(child.server_id).value()
    }

    // 版本号
    const semVer = db.status.get('version').value()
    if (cmp(semVer, child.version) < 0) {
      db.status.set('version', child.version).value()
    }

    // 缓存 status 统计, 以便结束迭代时计算平均值
    loadBuffer[0] += child.server_status.load[0]
    loadBuffer[1] += child.server_status.load[1]
    loadBuffer[2] += child.server_status.load[2]

    // 汇总总占用内存
    memory += child.server_status.memory.usage

    // 一言总数统计汇总
    if (hitokotoTotal < child.server_status.hitokto.total) hitokotoTotal = child.server_status.hitokto.total

    // 一言分类汇总
    if (hitokotoCategroy.length < child.server_status.hitokto.categroy.length) hitokotoCategroy = child.server_status.hitokto.categroy

    // 推送 childStatus
    db.status.get('status.childStatus').push(child.server_status).value()

    // 合并请求总数
    db.status.get('status.requests.all')
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      .mapValues((v, k) => {
        return v + child.requests.all[k] // Todo: 修复错误
      })
      .value()
    if (db.status.get('requests.all.dayMap').size().value() === 0) { // 当日每小时请求数
      db.status.set('requests.all.dayMap', child.requests.all.dayMap).value()
    } else {
      db.status.get('requests.all.dayMap')
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .map((v, i) => {
          return v + child.requests.all.dayMap[i]
        })
        .value()
    }
    if (db.status.get('requests.all.FiveMinuteMap').size().value() === 0) { // 过去 5 分钟每分钟请求数
      db.status.set('requests.all.FiveMinuteMap', child.requests.all.dayMap).value()
    } else {
      db.status.get('requests.all.FiveMinuteMap')
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .map((v, i) => {
          return v + child.requests.all.dayMap[i]
        })
        .value()
    }

    // 合并 hosts 统计
    db.status.get('status.requests.hosts')
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      .mapValues((hostData, host) => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        _.mapValues(hostData, (value, key) => { // Todo: 修复错误
          if (key === 'dayMap') {
            if (value.length === 0) {
              return child.requests.hosts[host][key]
            } else {
              // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
              return value.map((v, i) => {
                return v + child.requests.hosts[host][key][i]
              })
            }
          } else {
            return value + child.requests.hosts[host][key]
          }
        })
      })
      .value()
  }

  // 计算 load 平均值
  db.status.get('status.load')
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    .map((v,i) => {
      return loadBuffer[i] / result.children.length
    })

  // 合并宕机的服务器
  const downList = handleDownServerList(downServerList)
  if (downList.data.length > 0) {
    for (const child of downList.data) {
      db.status.get('children').push(child.id).value()
      db.status.get('downServer').push({
        id: child.id,
        startTs: child.start,
        last: Date.now() - child.start,
        statusMessage: child.statusMsg
      }).value()
    }
  }

  // 写入值
  const ts = Date.now()
  const date = new Date(ts)
  db.status.set('lastUpdate', ts)
  db.status.set('now', date.toLocaleString())
  db.status.set('ts', ts)

  // 写入数据库
  db.status.write()
}
