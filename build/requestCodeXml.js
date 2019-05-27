'use strict'

const {stringify} = require('qs')
const Promise = require('pinkie-promise')
const {fetch} = require('fetch-ponyfill')({Promise})

const endpoint = 'https://epsg.io/'
const userAgent = 'https://github.com/derhuerst/epsg-index'

const requestCodeXml = (code) => {
	//query = Object.assign({format: 'json'}, query)
	return fetch(endpoint+code+".xml", {
		mode: 'cors', 
		redirect: 'follow',
		headers: {'User-Agent': userAgent}
	})
	.then((res) => {
		if (!res.ok) {
			const err = new Error(res.statusText)
			err.epsgCode = code;
			err.statusCode = res.status
			throw err
		}
		return res.text()
	})
}

module.exports = requestCodeXml
