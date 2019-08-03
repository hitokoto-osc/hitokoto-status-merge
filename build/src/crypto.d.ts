export default class Crypto implements Crypto {
    static aesEncrypt(data: string, key: string, iv?: string): string;
    static aesDecrypt(data: string, key: string, iv?: string): string;
}
