var cv = require('opencv');
var http = require('http');
var assert = require('assert');
var querystring = require('querystring');
var cip = require('../lib/cip-natmus.js');
//var algorithm = require('./cropping-algorithm-simple-canny.js');
//var algorithm = require('./cropping-algorithm-advanced-canny.js');
//var algorithm = require('./cropping-algorithm-canny-with-solidity.js');
var algorithm = require('./cropping-algorithm-card-color-canny-with-solidity.js');
//var algorithm = require('./cropping-algorithm-hue-canny-with-solidity.js');

var ASSET_WIDTH_FIELD = "{af4b2e11-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_HEIGHT_FIELD = "{af4b2e12-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_RESOLUTIN_FEILD = "{af4b2e0f-5f6a-11d2-8f20-0000c0e166dc}";

exports.generate_cropping_details = function(asset, x, y, width, height, size) {
	// Preconditions
	assert(x >= 0.0, 'x parameter has to be >= 0.0');
	assert(x <= 1.0, 'x parameter has to be <= 1.0');
	assert(y >= 0.0, 'y parameter has to be >= 0.0');
	assert(y <= 1.0, 'y parameter has to be <= 1.0');
	assert(width >= 0.0, 'width parameter has to be >= 0.0');
	assert(height >= 0.0, 'height parameter has to be >= 0.0');
	assert(x+width <= 1.0, 'x+width parameter has to be <= 1.0');
	assert(y+height <= 1.0, 'y+height parameter has to be <= 1.0');
	assert(!size || size > 0, 'size parameter has to be missing or > 0');

	var resolution = asset.fields[ASSET_RESOLUTIN_FEILD];
	var original_width = Math.round(asset.fields[ASSET_WIDTH_FIELD] * resolution);
	var original_height = Math.round(asset.fields[ASSET_HEIGHT_FIELD] * resolution);

	var image_options = {
		left: Math.round(x * original_width),
		top: Math.round(y * original_height),
		width: Math.round(width * original_width),
		height: Math.round(height * original_height)
	};

	if(size) {
		image_options.maxsize = size;
	}

	var thumbnail_url = asset.get_image_url(image_options);

	return {
		original_width: original_width,
		original_height: original_height,
		crop_left: image_options.left,
		crop_top: image_options.top,
		crop_width: image_options.width,
		crop_height: image_options.height,
		thumbnail_url: thumbnail_url
	};
};

exports.thumbnail = function(client, catalog_alias, asset_id, x, y, width, height, size, success) {
	// Create a session with Canto Cumulus.
	client.get_asset(catalog_alias, asset_id, true, function(asset) {
		var cropping_details = exports.generate_cropping_details(asset, x, y, width, height, size);
		success( cropping_details, asset );
	});
};

exports.algorithm = algorithm;
exports.suggest = algorithm.suggest;
exports.SUGGESTION_ALGORITM_STATES = algorithm.SUGGESTION_ALGORITM_STATES;