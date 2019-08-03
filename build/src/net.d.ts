import { AxiosStatic, AxiosResponse } from 'axios';
import { StatusBody } from './utils';
declare class Net {
    static axios: AxiosStatic;
    /**
     * 发起请求
     * @param {string} uri URL 地址
     * @param {string} method 请求方法
     * @param {object} qs QueryString
     * @param {object} data FormData
     * @param {object} headers headers
     * @returns {Promise<AxiosResponse>}
     */
    static request(uri: string, method: string, qs?: object, data?: object, headers?: object): Promise<AxiosResponse>;
    static getStatusCode(uri: string, method?: string): Promise<number>;
    static getJSON(uri: string, method?: string, qs?: object, data?: object, headers?: object): Promise<AxiosResponse | StatusBody>;
}
export default Net;
