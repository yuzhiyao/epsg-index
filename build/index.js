'use strict'

const createQueue = require('queue')
const pick = require('lodash.pick')
const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')
const _ = require('lodash')

const req = require('./request')
const reqxml = require('./requestCodeXml')
const xmlParser = new xml2js.Parser();



const showError = (err) => {
	console.error(err)
	process.exit(1)
}

// https://epsg.io/?format=json&q=
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

const AXIS_EAST = 'AXIS["Easting", "EAST"],';
const AXIS_NORTH = 'AXIS["Northing", "NORTH"],';
const parseResult = (res) => {
	return new Promise((yay, nay) =>{
	
		parseResultInfo(res, yay);
		// 部分wkt已经存在坐标轴信息
	// if(res.wkt && res.wkt.indexOf("AXIS") > 0){
	// 	console.log("index: " + res.wkt.indexOf("AXIS"));
	// 	console.log("has axis info::" + res.code);
	// 	parseResultInfo(res, yay);
	// }else if(res.wkt){
	// 	console.log("ququest::" + res.code);
	// 	//没有坐标轴信息的尝试请求{code}.xml信息获取坐标轴信息参数 进一步完善wkt
	// 	getAxisInFo(res.code).then(axisInfos =>{
	// 		if(_.isArray(axisInfos) && axisInfos.length > 1){
	// 			let wktAxis = "";
	// 			for(let i = 0; i< 2; i++){
	// 				if(axisInfos[i] === "east"){
	// 					wktAxis += AXIS_EAST; 
	// 				}else if(axisInfos[i] === 'north'){
	// 					wktAxis += AXIS_NORTH;
	// 				}
	// 			}
	
	// 			let stArray = res.wkt.split("UNIT"), addIndex = stArray.length-1, newWkt = "";
	// 			for(let index in stArray){
	// 				if(index == addIndex){
	// 					newWkt += wktAxis;
	// 				}
	// 				else if(index > 0){
	// 					newWkt += "UNIT" + stArray[index];
	// 				}
	// 			}
	// 			res.wkt = newWkt;
	// 		}else{
	// 			console.log("异常情况！code:" + res.code);
	// 		}
	// 		parseResultInfo(res, yay);
	// 	}).catch(error =>{
	// 		// 不存在 或者 网络请求错误
	// 		console.log(error);
	// 		console.log("请求失败！code：" + res.code);
	// 		requestErrorInfo.push("请求失败！code：" + res.code + "/n");
	// 		parseResultInfo(res, yay);
	// 	});
	// }else{
	// 	parseResultInfo(res, yay);
	// }
	});
}
const parseResultInfo = (res,yay) => {
	let info = Object.assign(pick(res, [
		'code'/* , 'kind', 'name' */
	]), {
		wkt: res.wkt ||"",
		// proj4: res.proj4 || null,
		// bbox: res.bbox || null,
		// unit: res.unit || null,
		// area: res.area || null,
		// accuracy: res.accuracy !== 'unknown' ? (res.accuracy || null) : null
	})
	yay(info);
}



let requestErrorInfo = [];

const dir = path.join(__dirname, '..', 's')

const storeIndividuals = (index) => {
	return new Promise((yay, nay) => {
		const queue = createQueue({concurrency: 8, autostart: true})

		const store = (result) => {
			const job = (cb) => {
				const dest = path.join(dir, result.code + '.json')
				fs.writeFile(dest, JSON.stringify(result), cb)
				console.log(`Save ${result.code} !`);
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

const storeAll = (index) => {
	return new Promise((yay, nay) => {
		const all = index.reduce((all, result) => {
			all[result.code] = result
			return all
		}, {})

		const dest = path.join(dir, '..', 'all.json')
		fs.writeFile(dest, JSON.stringify(all), (err) => {
			if (err) nay(err)
			else {
				console.log("save all !");
				yay()
			}
		})
	})
}

/**
 * 获取当前坐标系 坐标轴信息
 */
const getAxisInFo = (code) =>{
	return new Promise((yay, nay) =>{
		reqxml(code).then(xml =>{
			// xml解析成Object
			xmlParser.parseString(xml, (err, result) =>{
				let axisInfos = [];
				getKeyFromObject(result, "gml:axisDirection", axisInfos);
				yay(axisInfos);
			});
		}).catch(error => {
			error.code = `error${code}`;
			nay(error);
		});
	});
}
const getKeyFromObject = (object, key, axisInfos) =>{
	if(_.isObject(object)){
		_.findKey(object, o =>{
			if(o[key]){
				axisInfos.push(o[key][0]);
			}
			else{
				if(_.isObject(o)){
					getKeyFromObject(o, key, axisInfos);
				}
			}
		})
	}
}

////test
// getAxisInFo(102757);
const getFile = () =>{
	getNrOfPages()
	.then(fetchAll)
	.then((results) => {
		const getResultPromise = results.map(parseResult);
	
		// const dest = path.join(dir, 'error.json');
		// fs.writeFile(dest, JSON.stringify(requestErrorInfo), () =>{})
	
		Promise.all(getResultPromise).then((values) =>{
			return Promise.all([
				storeAll(values),
				storeIndividuals(values)
			])
		}).then((error) => console.log(error));
		
	})
	.catch((error) => {
		console.log(error);

		// 异常继续 网络总是中断 跑不完不许停
		// 通过请求xml信息这步异常没处理（1、没有xml 2、网络没响应）
		getFile();
	})
}

getFile();


