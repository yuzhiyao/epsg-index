'use strict'

const createQueue = require('queue')
const pick = require('lodash.pick')
const path = require('path')
const fs = require('fs')

const req = require('./request')

const showError = (err) => {
	console.error(err)
	process.exit(1)
}

const getNrOfPages = () => {
	return req({q: ''})
	.then(data => Math.ceil(data.number_result / data.results.length))
}

const fetchAll = (nrOfPages) => {
	return new Promise((yay, nay) => {
		const queue = createQueue({concurrency: 8, autostart: true})
		let results = []

		const fetch = (i) => {
			const job = (cb) => {
				req({q: '', page: i})
				.then((data) => {
					results = results.concat(data.results)
					cb()
				})
				.catch(cb)
			}

			job.title = i + ''
			return job
		}

		queue.once('error', (err) => {
			queue.stop()
			nay(err)
		})
		queue.once('end', (err) => {
			if (!err) yay(results)
		})
		queue.on('success', (_, job) => {
			console.error(job.title + '/' + nrOfPages)
		})

		for (let i = 0; i <= nrOfPages; i++) {
		// for (let i = 0; i <= 10; i++) { // todo
			queue.push(fetch(i))
		}
	})
}

const parseResult = (res) => {
	return Object.assign(pick(res, [
		'code', 'kind', 'name',
		'wkt', 'proj4'
	]), {
		bbox: res.bbox || null,
		unit: res.unit || null,
		area: res.area || null,
		accuracy: res.accuracy || null
	})
}

const dir = path.join(__dirname, '..', '_')

const storeAll = (index) => {
	return new Promise((yay, nay) => {
		const queue = createQueue({concurrency: 8, autostart: true})

		const store = (result) => {
			const job = (cb) => {
				const dest = path.join(dir, result.code + '.json')
				fs.writeFile(dest, JSON.stringify(result), cb)
			}

			job.title = result.code
			return job
		}

		queue.once('error', (err) => {
			queue.stop()
			nay(err)
		})
		queue.once('end', (err) => {
			if (!err) yay()
		})

		for (let result of index) {
			queue.push(store(result))
		}
	})
}

getNrOfPages()
.then(fetchAll)
.then(results => results.map(parseResult))
.then(storeAll)
.catch(console.error)