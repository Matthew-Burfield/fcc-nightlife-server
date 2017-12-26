const axios = require('axios')
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const mongodb = require('mongodb')
const nodeUrl = require('url')
const oauth = require('oauth').OAuth

const corsOptions = {
	origin: 'http://burfield-nightlife.surge.sh',
	optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

const mongoUri = process.env.MONGO_CONNECTION

const oa = new oauth(
	'https://api.twitter.com/oauth/request_token',
	'https://api.twitter.com/oauth/access_token',
	'g15QnzcwkricnTa1tmVoQfIMF', // Consumer key
	'mZ7ZxpggaTvYnE0J9d3oEoDeUv7Bnwolk5kKakEjdHELIqtlaW', // Consumer secret
	'1.0',
	null,
	'HMAC-SHA1'
)

const app = express()
app.use(bodyParser.json())
app.use(cors(corsOptions))

const connectToDatabase = (res, callback) => {
	const response = (db, err, responseValues) => {
		db.close()
		if (err) {
			returnError(res, err)
		} else {
			res.json(Object.assign({}, { success: true }, responseValues))
		}
	}
	mongodb.MongoClient.connect(mongoUri, function (err, db) {
		if (err) returnError(res, err)
		callback(db, response)
	})
}

axios.defaults.baseURL = 'https://api.yelp.com'
axios.defaults.headers.common['Authorization'] = `Bearer ${process.env.YELP_API_KEY}`
axios.defaults.headers.common['Accept-Language'] = 'en_US'
axios.defaults.headers.post['Content-Type'] = 'application/graphql'

app.get('/', (req, res) => res.send('Hello world!'))

app.post('/restaurants', (req, res) => {
	const location = req.body.location
	axios.post('/v3/graphql', `{
			search(location: "${location}") {
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
				const restaurantList = response.data.data.search.business.reduce((obj, item) => {
					obj[item.id] = Object.assign({}, item, { count: 0 })
					return obj
				}, {})
				const restaurantIds = Object.keys(restaurantList)
				connectToDatabase(res, (db) => {
					db.collection('restaurant')
						.aggregate([
							{
								$match: { id: { $in: restaurantIds } },
							},
							{
								$group: { _id: "$id", count: { $sum: 1 } }
							},
						])
						.toArray(function (err, result) {
							result.forEach(restaurant => {
								restaurantList[restaurant._id].count = restaurant.count
							})
							res.json(restaurantList)
							db.close()
						})
				})
				// res.json(response.data)
			} else {
				res.sendStatus(500)
			}
		})
})

app.get('/login', (req, res) => {
	oa.getOAuthRequestToken(function (error, oAuthToken, oAuthTokenSecret, results) {
		res.redirect(`https://api.twitter.com/oauth/authenticate?oauth_token=${oAuthToken}`);
	})
})

app.get('/authenticate', (req, res) => {
	console.log(req.query.oauth_token)
	console.log(req.query.oauth_verifier)
})

const port = process.env.PORT || 8000

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

module.exports = server
