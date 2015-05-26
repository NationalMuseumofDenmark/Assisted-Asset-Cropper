var express = require('express'),
		http = require('http'), // TODO: Consider using request instead.
		cropping = require('../lib/cropping'),
		state = require('../lib/state'),
		cip = require('../lib/cip-natmus'),
		assert = require('assert'),
		request = require('request'),
		gm = require('gm'),
		temp = require('temp'),
		Q = require('q'),
		router = express.Router();

// TODO: Consider cleaning up the code using var sequence = Futures.sequence();
// http://stackoverflow.com/questions/6048504/synchronous-request-in-nodejs

// Automatically track and cleanup files at exit
temp.track();

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
	var catalog_alias = req.param('catalog_alias');
	var id = parseFloat(req.param('id'));
	client = cip.client(req, next);
	client.get_asset(catalog_alias, id, true, function(asset) {
		var asset_title = asset.fields[TITLE_FIELD];
		asset_title = asset_title ? asset_title : 'Asset without a titel';
		
		var image_size = cropping.algorithm.DEFAULT_PARAMETERS.image_size;
		var asset_filename = asset.fields[FILENAME_FIELD];
		//var asset_image_url = asset.get_image_url({ maxsize: image_size });
		var asset_image_url = cip.wrap_proxy(asset.get_thumbnail_url());
		var asset_algoritm_states_url = "/asset/" + catalog_alias + "/"
			+ id + "/suggestion-states";
		var cropping_status = asset.fields[CROPPING_STATUS_FIELD].id;
		var cropping_status_text = asset.fields[CROPPING_STATUS_FIELD].displaystring;

		var render_options = {
			jsessionid: client.jsessionid,
			title: asset_title + " - "+ 'Assisted asset cropper',
			catalog_alias: catalog_alias,
			asset_title: asset_title,
			asset_id: id,
			asset_filename: asset_filename,
			asset_image_url: asset_image_url,
			asset_algoritm_states_url: asset_algoritm_states_url,
			cropping_status: cropping_status ? cropping_status : 0,
			cropping_status_text: cropping_status_text ? cropping_status_text : "",
		};

		append_master(client, asset, catalog_alias, render_options, function(render_options) {
			append_croppings(client, asset, catalog_alias, render_options, function(render_options) {
				res.render('asset', render_options);
			});
		});
	}, function() {
		var err = new Error( 'No such asset in Cumulus!' );
		err.status = 404;
		next(err);
	});

	/*
	var table = client.get_table(catalog_alias);
	table.get_layout(function(layout) {
		console.log(layout);
	});
	*/
});

/*
router.get('/:catalog_alias/:id/thumbnail/:size?/stream', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'), 10);
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size, 10);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	client = cip.client(req, next);
	cropping.thumbnail(client, catalog_alias, id, 0.0, 0.0, 1.0, 1.0, size, function(asset) {
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
	client = cip.client(req, next);
	cropping.suggest(client, catalog_alias, id,
		function(suggestions) {
			res.send(suggestions);
		},
		function(response) {
			var err = new Error( 'Cumulus responded with status code ' + response.statusCode);
			err.status = 503;
			next(err);
		}
	);
});


router.get('/:catalog_alias/:id/suggestion-states/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'), 10);
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size, 10);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	var state_images = [];
	client = cip.client(req, next);
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


// Get the croppings 
router.get('/:catalog_alias/:id/croppings/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'), 10);
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size, 10);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}

	client = cip.client(req, next);
	client.ciprequest(
		"metadata/getrelatedassets/" +
		catalog_alias + "/" +
		id + "/isvariantof", {}, function(response) {
		//console.log( response );
		res.send( response );
	});
});

// Get the croppings 
router.post('/:catalog_alias/:id/croppings/save', function(req, res, next) {

	assert(	"croppings" in req.body,
					"The request's body must be a json object with a croppings key.");
	assert(	"catalog_alias" in req.params,
					"The request must specify a catalog alias.");
	assert(	"id" in req.params,
					"The request must specify a master asset id from which the cropping "+
					"should be performed.");

	var client = cip.client(req, next);

	var selections = req.body.croppings;
	var catalogAlias = req.params['catalog_alias'];
	var masterAssetId = parseInt(req.params['id'], 10);

	cropping.performCropping(req, res, next, catalogAlias, masterAssetId, selections);
});

module.exports = router;
