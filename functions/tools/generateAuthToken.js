
const crypto = require('crypto')

const authData = process.env.AUTH_DATA || process.argv[2]
const SECRET = process.env.SECRET

const data = JSON.stringify(authData)

console.log(crypto.createHmac('sha256', SECRET).update(data).digest('hex'))
