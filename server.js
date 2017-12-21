const express = require('express')

const app = express()

app.get('/', (req, res) => res.send('Hello world!'))

const port = process.env.PORT || 8000

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

module.exports = server
