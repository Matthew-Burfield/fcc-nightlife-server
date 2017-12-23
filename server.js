const axios = require('axios')
const cors = require('cors')
const express = require('express')
const mongodb = require('mongodb')

const app = express()

const corsOptions = {
  origin: 'http://burfield-nightlife.surge.sh',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}
app.use(cors(corsOptions))

const mongoUri = process.env.MONGO_CONNECTION
const connectToDatabase = (res, callback) => {
	const response = (db, err, responseValues) => {
		db.close()
		if (err) {
			returnError(res, err)
		} else {
			res.json(Object.assign({}, { success: true }, responseValues))	
		}
	}
	mongodb.MongoClient.connect(mongoUri, function(err, db) {
		if (err) returnError(res, err)
		callback(db, response)
	})
}

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
			const listOfRestaurantIds = response.data.data.search.business.map(biz => biz.id)
			connectToDatabase(res, (db) => {
				db.collection('restaurant')
				.aggregate([ 
					{
						$match: { id: { $in: listOfRestaurantIds } },
					},
					{
						$group: { _id: "$id", count: { $sum: 1 } }
					},
				])
				.toArray(function(err, result) {
					res.json(result)
					db.close()
				})
			})
			// res.json(response.data)
		} else {
			res.sendStatus(500)
		}
	})
})

const port = process.env.PORT || 8000

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

module.exports = server
