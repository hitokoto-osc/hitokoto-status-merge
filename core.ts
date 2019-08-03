// 注册依赖
import nconf from 'nconf'
import winston from 'winston'
import fs from 'fs'
// import path from 'path'
// import _ from 'lodash'

// 使用蓝鸟加速
// import bluebird from 'bluebird'
// global.Promise = bluebird

// 注册初始化环境
import { PreStart } from './src/preStart'

// 注册网络库
import net from './src/net'

// 注册加密库
import crypto from './src/crypto'

// CronJob
// import { CronJob } from 'cron'

import { applyMerge, StatusBody, NetworkError, ServerListMember } from './src/utils'

import Koa from 'koa'
import Router from 'koa-router'
import koaJson from 'koa-json'
import koaBodypaser from 'koa-bodyparser'
import koaJsonError from 'koa-json-error'
import koaCors from '@koa/cors'
import { AxiosResponse } from 'axios'
PreStart.load()

// ipv4 正则
const ipv4Reg = /(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5]):[a-zA-Z0-9]+\d/g

// 初始化失败次数 以及 默认重新尝试秒数
let failtureRequestTimes = 0
const defaultFailtrueInterval = nconf.get('default_failtrue_interval') || 1 // 默认失败重试间隔， 单位: 秒
const defaultRequestInterval = nconf.get('default_request_interval') || 8 // 默认的合并间隔， 单位： 秒

// 获取子节点列表
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchServerList (): Promise<ServerListMember[]> {
  winston.verbose('开始获取节点列表...')
  const tagetUri = nconf.get('target_uri')
  const decryptKey = nconf.get('decrypt_key')
  const decryptIv = nconf.get('decrypt_iv')
  winston.verbose(tagetUri)
  winston.verbose(decryptKey)
  // 请求接口， 获取列表
  const responseBody = await net.request(tagetUri + '?ts=' + Date.now(), 'GET')
  // console.log(responseBody)
  const data = responseBody.data.toString('utf8')
  winston.verbose(data)
  const list = JSON.parse(crypto.aesDecrypt(data, decryptKey, decryptIv))
  winston.verbose(list)
  return list
}

// 获取数据
async function fetch (list: ServerListMember[]): Promise<(StatusBody | NetworkError)[]> {
  async function fetchChild (input: ServerListMember): Promise<StatusBody | NetworkError> {
    // console.log(input)
    try {
      const responseBody = await net.getJSON(input.url + '/status')
      if ((responseBody as AxiosResponse).status) {
        const errorMsg: NetworkError = {
          isError: true,
          id: input.id,
          code: (responseBody as AxiosResponse).status,
          msg: (responseBody as AxiosResponse).statusText.replace(ipv4Reg, 'Hidden IPAddress'),
          stack: (new Error().stack || '').replace(ipv4Reg, 'Hidden IPAddress'),
          ts: Date.now()
        }
        return errorMsg
      } else {
        return responseBody as StatusBody
      }
    } catch (err) {
      // 网络错误 或者其他错误
      const errorMsg: NetworkError = {
        isError: true,
        id: input.id,
        code: -1, // 非网络错误
        msg: err.message.replace(ipv4Reg, 'Hidden IPAddress'),
        stack: (err.stack || '').replace(ipv4Reg, 'Hidden IPAddress'),
        ts: Date.now()
      }
      return errorMsg
    }
  }
  const events: Promise<StatusBody | NetworkError>[] = []
  for (const value of list) {
    // 进行纯异步请求
    events.push(fetchChild(value))
  }
  return Promise.all(events) // 并发一波请求
}

interface ChildList {
  lastUpdate: number;
  list: ServerListMember[];
}

const childList: ChildList = {
  lastUpdate: 0,
  list: []
}

async function saveStatus (): Promise<void | Error> {
  if (!childList.lastUpdate) {
    childList.list = await fetchServerList()
    childList.lastUpdate = Date.now()
  } else if ((Date.now() - childList.lastUpdate) > 60 * 60 * 2 * 1000) {
    fetchServerList()
      // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
      .then(list => {
        childList.list = list
        childList.lastUpdate = Date.now()
      })
  }
  const list = childList.list
  winston.verbose('开始获取子节点数据...')
  const fetchResult = await fetch(list)
  const children: StatusBody[] = []
  const downServer: NetworkError[] = []
  for (const child of fetchResult) {
    if ((child as NetworkError).isError) {
      // console.log(child)
      downServer.push(child as NetworkError)
    } else {
      children.push((child as StatusBody))
    }
  }
  winston.verbose('执行数据合并...')
  // console.log(children)
  // console.log(downServer)
  // console.log(downServerList)
  await applyMerge(children, downServer)
  // fs.existsSync(path.join('./data')) || fs.mkdirSync(path.join('./data'))
  // winston.info('写入状态数据...')
  // fs.writeFileSync(path.join('./data/status.json'), JSON.stringify(data))
  // fs.writeFileSync(path.join('./data/down.json'), JSON.stringify(downServerList))
}

function autoRestartSave (): void {
  saveStatus()
    .then((): void => {
      failtureRequestTimes = 0
      const t = defaultRequestInterval
      winston.verbose(`合并完成！ 将在 ${t} 秒后进行下一次合并。`)
      setTimeout(autoRestartSave, t * 1000)
    })
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type,@typescript-eslint/no-explicit-any
    .catch((err: any) => {
      const t = failtureRequestTimes + 1
      const i = defaultFailtrueInterval * (t * t)
      winston.error('在合并状态过程中发生错误， 错误信息如下所示：')
      console.error(err)
      winston.info(`自动重新尝试获取... 目前已失败 ${t} 次， 将在 ${i} 秒后重新尝试。`)
      failtureRequestTimes = t
      setTimeout(autoRestartSave, i * 1000);
    })
}

// 启动方法
autoRestartSave()

const app = new Koa()
const router = new Router()

router
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  .get('/', async ctx => {
    const file = JSON.parse(fs.readFileSync('./data/status.json').toString())
    const now = Date.now()
    Object.assign(file, {
      ts: now,
      now: new Date(now).toString()
    })
    ctx.body = file
  })

// 注册中间件
app
  .use(koaCors())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(koaBodypaser())
  .use(koaJson())
  .use(koaJsonError())
const port = nconf.get('port') || 6578
app.listen(port)
winston.info('Server is started. Listening on Port: ' + port)
