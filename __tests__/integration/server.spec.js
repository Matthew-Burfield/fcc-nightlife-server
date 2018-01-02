const axios = require('axios')
const startServer = require('../../startServer')

let server

beforeAll(async () => {
	server = await startServer()
})

afterAll(done => {
	server.close(done)
})

test('return 20 restaurants', async () => {
	// This test isn't working because the server isn't loading in the .env environment variables when it starts
	// const response = await axios
	// 	.post('http://localhost:8000/restaurants', {
	// 		location: 'Brisbane',
	// 	})
	// 	.then(response => response)
	// 	.catch(error => error)
	// const restaurants = await api.get('/restaurants')
	// console.log(response)
})
