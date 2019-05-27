'use strict'

const path = require('path')
const fs = require('fs')
const xml2js = require('xml2js')
const _ = require('lodash')

const req = require('./request')
const reqxml = require('./requestCodeXml')
const xmlParser = new xml2js.Parser();

// 需要更新的文件夹路径
const epsgcodesPath = path.resolve('./epsgcodes');

const updateFiles = (epsgcodesPath) =>{
	fs.readdir(epsgcodesPath, function(err, files){
		if(err){ console.warn(err)}
		else{
			// 遍历文件列表
			files.forEach((fileName) =>{
				let filePath = path.join(epsgcodesPath, fileName);

				// 获取文件类容
				let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
				parseResult(content, filePath);
			});
		}
	});
}

updateFiles(epsgcodesPath);



const AXIS_EAST = 'AXIS["Easting", EAST],';
const AXIS_NORTH = 'AXIS["Northing", NORTH],';
const parseResult = (res, filePath) => {
    // 部分wkt已经存在坐标轴信息
	if(res.wkt && res.wkt.indexOf("AXIS") < 0){
		console.log("ququest::" + res.code);
		//没有坐标轴信息的尝试请求{code}.xml信息获取坐标轴信息参数 进一步完善wkt
		getAxisInFo(res.code).then(axisInfos =>{
			if(_.isArray(axisInfos) && axisInfos.length > 1){
				let wktAxis = "";
				for(let i = 0; i< 2; i++){
					if(axisInfos[i] === "east"){
						wktAxis += AXIS_EAST; 
					}else if(axisInfos[i] === 'north'){
						wktAxis += AXIS_NORTH;
					}
				}
	
				let stArray = res.wkt.split("UNIT"), addIndex = stArray.length-1, newWkt = "";
				for(let index in stArray){
					if(index == addIndex){
						newWkt += wktAxis;
					}
					newWkt += "UNIT" + stArray[index];
				}
				res.wkt = newWkt;

				fs.writeFile(filePath, JSON.stringify(res), () =>{});
				console.log("更新文件：" + res.code + ".json");
			}else{
				console.log("异常情况！code:" + res.code);
			}
			
		}).catch(error =>{
			//  网络请求错误
			console.log(error);
			
		});
	}else{
		console.log("已经存在坐标信息::" + res.code);
	}
	
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



