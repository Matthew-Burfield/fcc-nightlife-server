const getBaseUrl = env => {
	return env === 'production' ? 'https://burfield-nightlife.surge.sh' : 'http://localhost:3000'
}

module.exports = {
	getBaseUrl,
}
