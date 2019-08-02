import cmp from 'semver-compare'
// import winston from 'winston'

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

export async function applyMinxin (
  children: StatusBody[],
  downServerList: DownServerListInterface
): Promise<ExportData> {
  // 首先初始化返回类
  const result: ExportData = {
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
  }

  // 注册一波缓存， 最蠢的数据合并方法
  const loadBuffer = [0, 0, 0]
  let allDayMapBuffer: number[] = []
  let allFiveMinuteBuffer: number[] = []
  let v1DayMapBuffer: number[] = []
  let apiDayMapBuffer: number[] = []
  let sslapiDayMapBuffer: number[] = []

  // 迭代数据集， 合并数据
  for (const child of children) {
    // 汇总子节点名称
    result.children.push(child.server_id)

    // 版本号
    result.version =
      cmp(result.version, child.version) < 0 ? child.version : result.version

    // 缓存 status 统计, 以便结束迭代时计算平均值
    loadBuffer[0] += child.server_status.load[0]
    loadBuffer[1] += child.server_status.load[1]
    loadBuffer[2] += child.server_status.load[2]

    // 汇总总使用内存
    result.status.memory += child.server_status.memory.usage

    // 一言总数统计汇总
    result.status.hitokoto.total =
      result.status.hitokoto.total < child.server_status.hitokto.total
        ? child.server_status.hitokto.total
        : result.status.hitokoto.total
    result.status.hitokoto.categroy =
      result.status.hitokoto.categroy.length <
      child.server_status.hitokto.categroy.length
        ? child.server_status.hitokto.categroy
        : result.status.hitokoto.categroy

    // 推送子状态
    const childStatus = {
      id: child.server_id
    }
    result.status.childStatus.push(
      Object.assign(childStatus, child.server_status)
    )

    // 合并 all 统计
    result.requests.all.total += child.requests.all.total // 合并总请求数
    result.requests.all.pastMinute += child.requests.all.pastMinute // 合并每分钟请求数
    result.requests.all.pastHour += child.requests.all.pastHour // 合并每小时请求数
    result.requests.all.pastDay += child.requests.all.pastDay // 合并每日请求数
    if (allDayMapBuffer.length === 0) {
      // 汇总 DayMap 统计
      // 缓存为空
      allDayMapBuffer = child.requests.all.dayMap
    } else {
      // 缓存存在值
      for (const index in child.requests.all.dayMap) {
        allDayMapBuffer[index] += child.requests.all.dayMap[index]
      }
    }
    if (allFiveMinuteBuffer.length === 0) {
      // 汇总 FiveMinuteMap 统计
      // 缓存为空
      allFiveMinuteBuffer = child.requests.all.FiveMinuteMap
    } else {
      // 缓存存在值
      for (const index in child.requests.all.FiveMinuteMap) {
        allFiveMinuteBuffer[index] += child.requests.all.FiveMinuteMap[index]
      }
    }

    // 汇总 hosts 统计
    result.requests.hosts['v1.hitokoto.cn'].total +=
      child.requests.hosts['v1.hitokoto.cn'].total
    result.requests.hosts['v1.hitokoto.cn'].pastMinute +=
      child.requests.hosts['v1.hitokoto.cn'].pastMinute
    result.requests.hosts['v1.hitokoto.cn'].pastHour +=
      child.requests.hosts['v1.hitokoto.cn'].pastHour
    result.requests.hosts['v1.hitokoto.cn'].pastDay +=
      child.requests.hosts['v1.hitokoto.cn'].pastDay
    if (v1DayMapBuffer.length === 0) {
      // 汇总 FiveMinuteMap 统计
      // 缓存为空
      v1DayMapBuffer = child.requests.hosts['v1.hitokoto.cn'].dayMap
    } else {
      // 汇总
      for (const index in child.requests.hosts['v1.hitokoto.cn'].dayMap) {
        v1DayMapBuffer[index] +=
          child.requests.hosts['v1.hitokoto.cn'].dayMap[index]
      }
    }

    if (typeof child.requests.hosts['api.hitokoto.cn'] !== 'undefined') {
      result.requests.hosts['api.hitokoto.cn'].total +=
        child.requests.hosts['api.hitokoto.cn'].total
      result.requests.hosts['api.hitokoto.cn'].pastMinute +=
        child.requests.hosts['api.hitokoto.cn'].pastMinute
      result.requests.hosts['api.hitokoto.cn'].pastHour +=
        child.requests.hosts['api.hitokoto.cn'].pastHour
      result.requests.hosts['api.hitokoto.cn'].pastDay +=
        child.requests.hosts['api.hitokoto.cn'].pastDay
      if (apiDayMapBuffer.length === 0) {
        // 汇总 FiveMinuteMap 统计
        // 缓存为空
        apiDayMapBuffer = child.requests.hosts['api.hitokoto.cn'].dayMap
      } else {
        // 汇总
        for (const index in child.requests.hosts['api.hitokoto.cn'].dayMap) {
          apiDayMapBuffer[index] +=
            child.requests.hosts['api.hitokoto.cn'].dayMap[index]
        }
      }
    }

    if (typeof child.requests.hosts['sslapi.hitokoto.cn'] !== 'undefined') {
      result.requests.hosts['sslapi.hitokoto.cn'].total +=
        child.requests.hosts['sslapi.hitokoto.cn'].total
      result.requests.hosts['sslapi.hitokoto.cn'].pastMinute +=
        child.requests.hosts['sslapi.hitokoto.cn'].pastMinute
      result.requests.hosts['sslapi.hitokoto.cn'].pastHour +=
        child.requests.hosts['sslapi.hitokoto.cn'].pastHour
      result.requests.hosts['sslapi.hitokoto.cn'].pastDay +=
        child.requests.hosts['sslapi.hitokoto.cn'].pastDay
      if (sslapiDayMapBuffer.length === 0) {
        // 汇总 FiveMinuteMap 统计
        // 缓存为空
        sslapiDayMapBuffer = child.requests.hosts['sslapi.hitokoto.cn'].dayMap
      } else {
        // 汇总
        for (const index in child.requests.hosts['sslapi.hitokoto.cn'].dayMap) {
          sslapiDayMapBuffer[index] +=
            child.requests.hosts['sslapi.hitokoto.cn'].dayMap[index]
        }
      }
    }
  }

  // 计算 load 平均值
  for (const index in loadBuffer) {
    result.status.load[index] = loadBuffer[index] / result.children.length
  }

  // 合并 Map
  result.requests.all.dayMap = allDayMapBuffer
  result.requests.all.FiveMinuteMap = allFiveMinuteBuffer
  result.requests.hosts['v1.hitokoto.cn'].dayMap = v1DayMapBuffer
  result.requests.hosts['api.hitokoto.cn'].dayMap = apiDayMapBuffer
  result.requests.hosts['sslapi.hitokoto.cn'].dayMap = sslapiDayMapBuffer

  // 合并 宕机服务
  if (downServerList.data.length > 0) {
    for (const child of downServerList.data) {
      result.children.push(child.id)
      result.downServer.push({
        id: child.id,
        startTs: child.start,
        last: Date.now() - child.start,
        statusMessage: child.statusMsg
      })
    }
  }

  // 写入值
  const ts = Date.now()
  const date = new Date(ts)
  result.lastUpdate = ts
  result.now = date.toLocaleString()
  result.ts = ts

  return result
}
