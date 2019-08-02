import crypto from 'crypto'

export default class Crypto implements Crypto {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static aesEncrypt (data: string, key: string, iv?: string): string {
    const cipher =
      typeof iv !== 'undefined'
        ? crypto.createCipheriv('aes-128-cbc', key, iv)
        // eslint-disable-next-line node/no-deprecated-api
        : crypto.createCipher('aes-128-cbc', key)
    cipher.setAutoPadding(true)
    return cipher.update(data, 'utf8', 'base64') + cipher.final('base64')
  }

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  static aesDecrypt (data: string, key: string, iv?: string): string {
    const cipher =
      typeof iv !== 'undefined'
        ? crypto.createDecipheriv('aes-128-cbc', key, iv)
        // eslint-disable-next-line node/no-deprecated-api
        : crypto.createDecipher('aes-128-cbc', key)
    cipher.setAutoPadding(true)
    return cipher.update(data, 'base64', 'utf8') + cipher.final('utf8')
  }
}
