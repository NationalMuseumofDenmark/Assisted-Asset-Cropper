var express = require('express');
var http = require('http');
var cropSuggestions = require('../lib/crop-suggestions.js');
var router = express.Router();

var DEFAULT_THUMBNAIL_SIZE = 200;

/* GET users listing. */

router.get('/:catalog/:id/crop/:left::top::width::height/:size/:type?', function(req, res, next) {
	// Localizing parameters
	var catalog = req.param('catalog');
	var id = parseInt(req.param('id'));
	var left = parseFloat(req.param('left'));
	var top = parseFloat(req.param('top'));
	var width = parseFloat(req.param('width'));
	var height = parseFloat(req.param('height'));
	var size = req.param('size');
	if(size === 'maximal') {
		size = undefined;
	} else {
		size = parseInt(size);
	}
	var type = req.param('type');
	cropSuggestions.thumbnail(catalog, id, left, top, width, height, size, function(asset) {
		if(type === 'stream' || type === 'download') {
			if(type === 'download') {
				res.attachment(catalog + "-" + id + "-cropped");
			}
			http.get(asset.thumbnail_url, function(thumbnail_res) {
				delete thumbnail_res.headers['content-disposition'];
				res.writeHead(thumbnail_res.statusCode, thumbnail_res.headers);
				thumbnail_res.on('data', function(chunk) {
					res.write(chunk);
				}).on('end', function() {
					res.end();
				});
			});
		} else {
			// Simply return the json.
			res.send(asset);
		}
	});
});

/*
router.get('/:catalog/:id/crop/:left::top::width::height/:size/stream', function(req, res, next) {
	// Localizing parameters
	var catalog = req.param('catalog');
	var id = parseInt(req.param('id'));
	var left = parseFloat(req.param('left'));
	var top = parseFloat(req.param('top'));
	var width = parseFloat(req.param('width'));
	var height = parseFloat(req.param('height'));
	var size = parseInt(req.param('size'));
	cropSuggestions.thumbnail(catalog, id, left, top, width, height, size, function(asset) {
		http.get(asset.thumbnail_url, function(thumbnail_res) {
			res.writeHead(thumbnail_res.statusCode, thumbnail_res.headers);
			thumbnail_res.on('data', function(chunk) {
				res.write(chunk);
			}).on('end', function() {
				res.end();
			});
		});
	});
});
*/

router.get('/:catalog/:id/thumbnail/:size?/stream', function(req, res, next) {
	// Localizing parameters
	var catalog = req.param('catalog');
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	cropSuggestions.thumbnail(catalog, id, 0.0, 0.0, 1.0, 1.0, size, function(asset) {
		http.get(asset.thumbnail_url, function(thumbnail_res) {
			res.writeHead(thumbnail_res.statusCode, thumbnail_res.headers);
			thumbnail_res.on('data', function(chunk) {
				res.write(chunk);
			}).on('end', function() {
				res.end();
			});
		});
	});
});

function deriveSuggestionThumbnailURLs(catalog, id, size, suggestions) {
	for(var s in suggestions) {
		suggestions[s].thumbnail_url = '/asset/';
		suggestions[s].thumbnail_url += catalog + '/';
		suggestions[s].thumbnail_url += id + '/crop/';
		suggestions[s].thumbnail_url += suggestions[s].left + ':';
		suggestions[s].thumbnail_url += suggestions[s].top + ':';
		suggestions[s].thumbnail_url += suggestions[s].width + ':';
		suggestions[s].thumbnail_url += suggestions[s].height;
		suggestions[s].thumbnail_url += '/'+size+'/stream';
	}
	return suggestions;
}
/*
router.get('/:catalog/:id/suggestions', function(req, res, next) {
	// Localizing parameters
	var catalog = req.param('catalog');
	var id = parseInt(req.param('id'));
	cropSuggestions.suggest(catalog, id, function(suggestions) {
		suggestions = deriveSuggestionThumbnailURLs(catalog, id, undefined, suggestions);
		res.send(suggestions);
	});
});
*/

router.get('/:catalog/:id/suggestions/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog = req.param('catalog');
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
	} else {
		size = DEFAULT_SIZE;
	}
	cropSuggestions.suggest(catalog, id, function(suggestions) {
		suggestions = deriveSuggestionThumbnailURLs(catalog, id, size, suggestions);
		res.send(suggestions);
	}, function(response) {
		res.send({
			error: "Cumulus responded with status code " + response.statusCode
		});
	});
});

module.exports = router;
