const axios = require('axios')
const bodyParser = require('body-parser')
const cors = require('cors')
const express = require('express')
const mongodb = require('mongodb')
const nodeUrl = require('url')
const oauth = require('oauth').OAuth
const getBaseUrl = require('./utilities').getBaseUrl

axios.defaults.baseURL = 'https://api.yelp.com'
axios.defaults.headers.common['Authorization'] = `Bearer ${process.env.YELP_API_KEY}`
axios.defaults.headers.common['Accept-Language'] = 'en_US'
axios.defaults.headers.post['Content-Type'] = 'application/graphql'

const mongoUri = process.env.MONGO_CONNECTION
const port = process.env.PORT || 8000
const oa = new oauth(
	'https://api.twitter.com/oauth/request_token',
	'https://api.twitter.com/oauth/access_token',
	process.env.OAUTH_CONSUMER_KEY, // Consumer key
	process.env.OAUTH_CONSUMER_SECRET, // Consumer secret
	'1.0',
	null,
	'HMAC-SHA1'
)

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

const startServer = () => {
	const app = express()

	app.use(bodyParser.json())

	const baseUrl = getBaseUrl(app.get('env'))
	const corsOptions = {
		origin: baseUrl,
		optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
	}
	app.use(cors(corsOptions))

	const authenticateToken = (req, res, next) => {
		const [accessToken, accessSecret] = req.headers.authorization.split('.')
		oa.get(
			'https://api.twitter.com/1.1/account/verify_credentials.json',
			accessToken, //test user token
			accessSecret, //test user secret
			(error, data, res) => {
				if (error) {
					console.error(error)
					res.status(401).send('Fail!')
				}
				// console.log(require('util').inspect(data))
				req.user = JSON.parse(data)
				next()
			}
		)
	}

	app.post('/restaurants', async (req, res) => {
		const location = req.body.location
		const result = await axios
			.post(
				'/v3/graphql',
				`{
					search(location: "${location}") {
						total
						business {
								name
								id
								rating
								photos
							}
					}
				}`
			)
			.then(response => response.data)
			.catch(error => error)
		if (result) {
			if (result.errors && result.errors.length > 0) {
				res.status(204).send('Could not execute search, try specifying a more exact location.')
			} else if (result.data) {
				const restaurantList = result.data.search.business.reduce((obj, item) => {
					obj[item.id] = Object.assign({}, item, { count: 0 })
					return obj
				}, {})
				const restaurantIds = Object.keys(restaurantList)
				connectToDatabase(res, db => {
					db
						.collection('restaurant')
						.find({ id: { $in: restaurantIds } })
						.toArray(function(err, result) {
							result.forEach(restaurant => {
								if (restaurantList[restaurant.id] === undefined) {
									console.error('restaurant not found!')
								} else {
									restaurantList[restaurant.id].count = restaurant.users.length
								}
							})
							res.json(restaurantList)
							db.close()
						})
				})
			}
		} else {
			res.status(500).send('Server error: no response from Yelp')
		}
	})

	app.post('/register', authenticateToken, (req, res) => {
		const id = req.body.id
		const userId = req.user.id
		if (id && id.length > 0) {
			connectToDatabase(res, async db => {
				const restaurant = await db
					.collection('restaurant')
					.findOne({ id })
					.then(result => result)

				if (restaurant === null) {
					db
						.collection('restaurant')
						.insertOne({
							id,
							users: [userId],
						})
						.then(result => {
							console.log(result)
							res.send('increased')
							db.close()
						})
				} else {
					if (restaurant.users.includes(userId)) {
						db
							.collection('restaurant')
							.updateOne(
								{
									id,
								},
								{
									$pull: { users: userId },
								}
							)
							.then(result => {
								console.log(result)
								res.send('decreased')
								db.close()
							})
					} else {
						db
							.collection('restaurant')
							.updateOne(
								{
									id,
								},
								{
									$push: { users: userId },
								}
							)
							.then(result => {
								console.log(result)
								res.send('increased')
								db.close()
							})
					}
				}
			})
		} else {
			res.status(500).send('id is required')
		}
	})

	app.get('/login', (req, res) => {
		oa.getOAuthRequestToken((error, oauth_request_token, oauth_request_token_secret, results) => {
			if (error) {
				res.status(500).send('Server error: ', error)
			}
			if (results.oauth_callback_confirmed === 'true') {
				// send oauth_token and oauth_secret back to client and redirect from there
				res.redirect(
					`${baseUrl}/login#request_token=${oauth_request_token}&request_secret=${oauth_request_token_secret}`
				)
			} else {
				res.status(500).send('Server error: no callback')
			}
		})
	})

	app.get('/authenticate', (req, res) => {
		const { token, secret, verifier } = req.query
		const callback = (param1, oauth_access_token, oauth_access_token_secret, results) => {
			res.redirect(
				`${baseUrl}/access#access_token=${oauth_access_token}&access_secret=${oauth_access_token_secret}`
			)
		}
		oa.getOAuthAccessToken(token, secret, verifier, callback)
	})

	return new Promise(resolve => {
		const server = app.listen(port, () => {
			console.log(`Example app listening on port ${port}, in ${app.get('env')} mode!`)
			resolve(server)
		})
	})
}

module.exports = startServer
