import cmp from 'semver-compare'
import lowdb from 'lowdb'
import path from 'path'
import FileSync from 'lowdb/adapters/FileSync'
import _, { LoDashExplicitWrapper } from 'lodash'
import winston from 'winston'
import { Key } from 'readline'
// import winston from 'winston'

const statusAdapter = new FileSync<Status.RootObject>(path.join('./data/status.json'))
const downServerListAdapter = new FileSync<DownServerListInterface>(path.join('./data/down.json'))

declare module Status {

  export interface StatusMessage {
      isError: boolean;
      id: string;
      code: number;
      msg: string;
      stack: string;
      ts: any;
  }

  export interface DownServer {
      id: string;
      startTs: any;
      last: number;
      statusMessage: StatusMessage;
  }

  export interface Hitokoto {
      total: number;
      categroy: string[];
  }

  export interface Memory {
      totol: number;
      free: number;
      usage: number;
  }

  export interface Hitokto {
      total: number;
      categroy: string[];
      lastUpdate: number;
  }

  export interface ChildStatu {
      memory: Memory;
      load: number[];
      hitokto: Hitokto;
  }

  export interface Status {
      load: number[];
      memory: number;
      hitokoto: Hitokoto;
      childStatus: ChildStatu[];
  }

  export interface All {
      total: number;
      pastMinute: number;
      pastHour: number;
      pastDay: number;
      dayMap: number[];
      FiveMinuteMap: number[];
  }

  export interface V1HitokotoCn {
      total: number;
      pastMinute: number;
      pastHour: number;
      pastDay: number;
      dayMap: number[];
  }

  export interface InternationalV1HitokotoCn {
      total: number;
      pastMinute: number;
      pastHour: number;
      pastDay: number;
      dayMap: any[];
  }

  export interface Hosts {
      'v1.hitokoto.cn': V1HitokotoCn;
      'international.v1.hitokoto.cn': InternationalV1HitokotoCn;
  }

  export interface Requests {
      all: All;
      hosts: Hosts;
  }

  export interface RootObject {
      version: string;
      children: string[];
      downServer: DownServer[];
      status: Status;
      requests: Requests;
      lastUpdate: number;
      now: string;
      ts: number;
  }

}




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
    'international.v1.hitokoto.cn': HostChild;
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
      'international.v1.hitokoto.cn': HostChild;
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
): Promise<void | boolean> {
  // 初始化一些数据
  let memory = 0
  let hitokotoTotal = 0
  let hitokotoCategroy: string[] = []
  db.status.set('status.childStatus', []).value()
  db.status.set('children', []).value()
  db.status.set('downServer', []).value()
  db.status.set('requests.all.FiveMinuteMap', []).value()
  db.status.set('requests.all.dayMap', []).value()
  db.status.set('requests.all.total', 0).value()
  db.status.set('requests.all.pastMinute', 0).value()
  db.status.set('requests.all.pastHour', 0).value()
  db.status.set('requests.all.pastDay', 0).value()
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
    .value()

  // 注册一波缓存， 最蠢的数据合并方法
  const loadBuffer = [0, 0, 0]

  // 迭代数据集
  for (const child of children) {
    // 汇总服务器标识
    db.status.get('children').push(child.server_id).value()

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

    // 检测是否缺少 hitokoto 字段
    if (!child.server_status.hitokto || !child.server_status.hitokto.total || !child.server_status.hitokto.categroy) {
      console.log(!child.server_status.hitokto, !child.server_status.hitokto.total, !child.server_status.hitokto.categroy)
      winston.error('在操作合并时出现错误，子节点缺少 hitokoto 相关统计字段，以下为子节点信息，合并中断。')
      winston.error(JSON.stringify(child))
      return
    }

    // 一言总数统计汇总
    if (hitokotoTotal < child.server_status.hitokto.total) hitokotoTotal = child.server_status.hitokto.total

    // 一言分类汇总
    if (hitokotoCategroy.length < child.server_status.hitokto.categroy.length) hitokotoCategroy = child.server_status.hitokto.categroy;

    // 推送 childStatus
    (db.status.get('status.childStatus') as unknown as any).push(child.server_status).value()

    // 合并请求总数
    db.status.set('requests.all', (db.status.get('requests.all') as unknown as any)
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      .mapValues((v: any, k: any) => {
        if (k !== 'dayMap' && k !== 'FiveMinuteMap') {
          return v + child.requests.all[k as unknown as 'total'] // TODO: 修复错误的类型推断
        } else {
          return v
        }
      })
      .value()).value()
    if (db.status.get('requests.all.dayMap').size().value() === 0) { // 当日每小时请求数
      db.status.set('requests.all.dayMap', child.requests.all.dayMap).value()
    } else {
      db.status.set('requests.all.dayMap', (db.status.get('requests.all.dayMap') as unknown as any)
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .map((v: any, i: number) => {
          return v + child.requests.all.dayMap[i]
        })
        .value()).value()
    }
    if (db.status.get('requests.all.FiveMinuteMap').size().value() === 0) { // 过去 5 分钟每分钟请求数
      db.status.set('requests.all.FiveMinuteMap', child.requests.all.FiveMinuteMap).value()
    } else {
      db.status.set('requests.all.FiveMinuteMap', (db.status.get('requests.all.FiveMinuteMap') as unknown as any)
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        .map((v: any, i: number) => {
          return v + child.requests.all.FiveMinuteMap[i]
        })
        .value()).value()
    }

    // 合并 hosts 统计
    db.status.set('requests.hosts', (db.status.get('requests.hosts') as unknown as any)
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      .mapValues((hostData: HostChild[], host: any) => {
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        return _.mapValues(hostData, (value: any, key: any) => { // Todo: 修复错误
          if (key === 'dayMap') {
            if (value.length === 0) {
              if (child.requests.hosts[host as 'v1.hitokoto.cn'] && child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'total']) {
                return child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'total']
              } else {
                return value
              }
            } else {
              if (child.requests.hosts[host as 'v1.hitokoto.cn'] && child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'total']) {
                // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
                return value.map((v: any, i: number) => {
                  return v + child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'dayMap'][i]
                })
              } else {
                return value
              }
            }
          } else {
            if (child.requests.hosts[host as 'v1.hitokoto.cn'] && child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'total']) {
              return value + child.requests.hosts[host as 'v1.hitokoto.cn'][key as 'total']
            } else {
              return value
            }
          }
        })
      })
      .value()).value()
  }

  // 计算 load 平均值
  db.status.set('status.load', (db.status.get('status.load') as unknown as any)
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    .map((v: any, i: number) => {
      return loadBuffer[i] / children.length
    })
    .value()).value()

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
  db.status.set('status.memory', memory).value()
  db.status.set('status.hitokoto.total', hitokotoTotal).value()
  db.status.set('status.hitokoto.categroy', hitokotoCategroy).value()
  db.status.set('lastUpdate', ts).value()
  db.status.set('now', date.toLocaleString()).value()
  db.status.set('ts', ts).value()

  // 写入数据库
  db.status.write()
  return true
}
