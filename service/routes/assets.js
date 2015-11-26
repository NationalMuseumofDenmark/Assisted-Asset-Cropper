var express = require('express'),
		http = require('http'), // TODO: Consider using request instead.
		cropping = require('../lib/cropping'),
		state = require('../lib/state'),
		cip = require('../lib/cip'),
		assert = require('assert'),
		request = require('request'),
		gm = require('gm'),
		temp = require('temp').track(),
		Q = require('q'),
		router = express.Router();

// TODO: Consider cleaning up the code using var sequence = Futures.sequence();
// http://stackoverflow.com/questions/6048504/synchronous-request-in-nodejs

// Search in assets
router.get('/search/:catalog_alias', function(req, res, next) {
	var catalogAlias = req.params['catalog_alias'];
	var term = req.query['term'];

	return cip.search(catalogAlias, term)
	.then(function(response) {
		res.send({
			collection_id: response.collection,
			total_rows: response.totalcount
		});
	}, console.error);
});

router.get('/search-results/:collection_id/:count/:offset', function(req, res, next) {
	var collectionID = req.params['collection_id'];
	var count = req.params['count'];
	var offset = req.params['offset'];
	return cip.searchResults(collectionID, count, offset)
	.then(function(items) {
		res.send(items);
	}, console.error);
});

// The default thumbnail size used when requesting an asset.
var DEFAULT_THUMBNAIL_SIZE = 200;

function append_master(client, asset, catalog_alias, render_options, callback) {
	asset.get_related_assets("isvariantof", function(related) {
		if(related.ids.length > 0) {
			var master_asset_id = related.ids[0];
			client.get_asset(catalog_alias, master_asset_id, false, function(master_asset) {
				render_options.master_image = cip.wrap_proxy(master_asset.get_thumbnail_url());
				render_options.master_href = "/asset/"+catalog_alias+"/"+master_asset_id
				callback(render_options);
			});
		} else {
			callback(render_options);
		}
	});
}

function append_croppings(client, asset, catalog_alias, render_options, callback) {
	asset.get_related_assets("isvariantmasterof", function(related) {
		render_options.croppings = [];
		for(i in related.ids) {
			var cropping_asset_id = related.ids[i];
			client.get_asset(catalog_alias, cropping_asset_id, false, function(cropping_asset) {
				render_options.croppings.push({
					image: cip.wrap_proxy(cropping_asset.get_thumbnail_url()),
					href: "/asset/"+catalog_alias+"/"+cropping_asset_id
				});
			});
		}
		callback(render_options);
	});
}

router.get('/:catalog_alias/:id', function(req, res, next) {
	var catalogAlias = req.params['catalog_alias'];
	var id = parseInt(req.params['id'], 10);
	cip.getAsset(catalogAlias, id).then(function(asset) {
		// TODO: Consider checking if any fields suggests a violation of confidentiality.
		res.send(asset);
	}, function() {
		var err = new Error( 'No such asset in Cumulus!' );
		err.status = 404;
		next(err);
	});
});


router.get('/:catalog_alias/:id/thumbnail/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.params['catalog_alias'];
	var id = parseInt(req.params['id'], 10);
	var size = req.params['size'];
	if(size !== undefined) {
		size = parseInt(size, 10);
	}

	var params = {};
	if(size) {
		params.size = size;
	}

	var thumbnailURL = cip.buildURL([
		'preview',
		'thumbnail',
		catalog_alias,
		id
	].join('/'), params);

	http.get(thumbnailURL, function(thumbnail_res) {
		res.writeHead(thumbnail_res.statusCode, thumbnail_res.headers);
		thumbnail_res.on('data', function(chunk) {
			res.write(chunk);
		}).on('end', function() {
			res.end();
		});
	});
});

router.get('/:catalog_alias/:id/suggestions/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.params['catalog_alias'];
	var id = parseInt(req.params['id'], 10);
	var size = req.params['size'];
	if(size !== undefined) {
		size = parseInt(size, 10);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}

	cropping.suggest(catalog_alias, id, function(suggestions) {
		res.send(suggestions);
	}, function(response) {
		var err = new Error( 'Cumulus responded with status code ' + response.statusCode);
		err.status = 503;
		next(err);
	});
});

/*
router.get('/:catalog_alias/:id/suggestion-states/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.params['catalog_alias'];
	var id = parseInt(req.params['id'], 10);
	var size = req.params['size'];
	if(size !== undefined) {
		size = parseInt(size, 10);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	var state_images = [];
	
	cip.client().then(function (client) {
		cropping.suggest(client, catalog_alias, id, function(suggestions) {
			var result;
			for(var s in state_images) {
				if(result) {
					result = result.append(state_images[s]);
				} else {
					result = gm(state_images[s]);
				}
			}
			result.stream(function streamOut (err, stdout, stderr) {
				if (err) return next(err);
					stdout.pipe(res);
					// TODO: Delete all the images in state_images.
					stdout.on('error', next);
				});
				// temp.cleanupSync();
		}, function(response) {
			var err = new Error( 'Cumulus responded with status code ' + response.statusCode );
			console.error(response);
			err.status = 503;
			next(err);
		}, {}, function(state, data) {
			// Map every Open CV matrix to a temporary file.
			state_images[state] = temp.path({suffix: '.jpg'});
			data.save( state_images[state] );
		});
	});
});
*/

// Get the croppings 
router.post('/:catalog_alias/:id/croppings/save', function(req, res, next) {

	assert(	"croppings" in req.body,
					"The request's body must be a json object with a croppings key.");
	assert(	"catalog_alias" in req.params,
					"The request must specify a catalog alias.");
	assert(	"id" in req.params,
					"The request must specify a master asset id from which the cropping "+
					"should be performed.");

	var selections = req.body.croppings;
	var catalogAlias = req.params['catalog_alias'];
	var masterAssetId = parseInt(req.params['id'], 10);

	cropping.performCropping(req, res, next, catalogAlias, masterAssetId, selections)
	.then(function() {
		console.log('Done saving', selections.length, 'croppings.');
	}, function(msg) {
		var err = new Error( 'Failed to complete croppings: '+msg );
		err.status = 404;
		next(err);
	});
});

module.exports = router;
