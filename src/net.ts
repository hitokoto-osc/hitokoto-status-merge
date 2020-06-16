// 请求库
import axios, { AxiosStatic, AxiosResponse, AxiosRequestConfig } from 'axios'
import { StatusBody } from './utils'

class Net {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static axios: AxiosStatic = axios

  /**
   * 发起请求
   * @param {string} uri URL 地址
   * @param {string} method 请求方法
   * @param {object} qs QueryString
   * @param {object} data FormData
   * @param {object} headers headers
   * @returns {Promise<AxiosResponse>}
   */
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static request (
    uri: string,
    method: AxiosRequestConfig['method'],
    qs?: object,
    data?: object,
    headers?: object
  ): Promise<AxiosResponse> {
    const baseHeader = {
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; WOW64; rv:56.0) Gecko/20100101 Firefox/56.0`,
      Referer: '',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'X-Requested-With': 'Hitokoto Status Minixs Bot'
    }
    if (headers) {
      Object.assign(baseHeader, headers)
    }
    return this.axios.request({
      url: uri,
      method: method,
      headers: baseHeader,
      params: qs || {},
      data: data || {},
      responseType: 'arraybuffer'
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static async getStatusCode (
    uri: string,
    method: AxiosRequestConfig['method'] = 'GET'
  ): Promise<number> {
    const responseBody = await this.request(uri, method)
    return responseBody.status
  }

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static async getJSON (
    uri: string,
    method: AxiosRequestConfig['method'] = 'GET',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    qs?: object,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    data?: object,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    headers?: object
  ): Promise<AxiosResponse | StatusBody> {
    const responseBody = await this.request(uri, method)
    if (responseBody.status !== 200) {
      return responseBody
    }
    return JSON.parse(responseBody.data.toString())
  }
}

export default Net
