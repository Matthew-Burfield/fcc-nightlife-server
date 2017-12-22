const express = require('express')
const axios = require('axios')

const app = express()

// comment

axios.defaults.baseURL = 'https://api.yelp.com'
axios.defaults.headers.common['Authorization'] = `Bearer ${process.env.YELP_API_KEY}`
axios.defaults.headers.common['Accept-Language'] = 'en_US'
axios.defaults.headers.post['Content-Type'] = 'application/graphql'

app.get('/', (req, res) => res.send('Hello world!'))

app.get('/getRestaurants', (req, res) => {
	axios.post('/v3/graphql',`{
			search(location: "brisbane australia") {
				total
				business {
						name
						id
						rating
						photos
					}
			}
	}`)
	.then((response) => {
		if (response && response.data) {
			res.json(response.data)
		} else {
			res.sendStatus(500)
		}
	})
})

const port = process.env.PORT || 8000

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

module.exports = server
