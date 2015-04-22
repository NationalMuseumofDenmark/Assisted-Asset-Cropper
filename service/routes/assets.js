var express = require('express'),
		http = require('http'), // TODO: Consider using request instead.
		cropping = require('../lib/cropping.js'),
		cip = require('../lib/cip-natmus'),
		assert = require('assert'),
		request = require('request'),
		gm = require('gm'),
		temp = require('temp'),
		q = require('q'),
		router = express.Router();

/**
 * Helping function to determine if the type and value of a variable
 * is a nummeric integer or not.
 * @param  {number}  n
 * @return {Boolean} 
 */
function isInteger(n) {
   return typeof(n) == "number" && isFinite(n) && n%1===0;
}

// TODO: Consider cleaning up the code using var sequence = Futures.sequence();
// http://stackoverflow.com/questions/6048504/synchronous-request-in-nodejs

// Automatically track and cleanup files at exit
temp.track();

// The default thumbnail size used when requesting an asset.
var DEFAULT_THUMBNAIL_SIZE = 200;

// Defining constants from Cumulus, used when looking up
// values in the metadata returned from the CIP.
var TITLE_FIELD = "{6fb1f61b-14a3-4851-bba0-cf7e71ef59cb}";
var DESCRIPTION_FIELD = "{2ce9c8eb-b83d-4a91-9d09-2141cac7de12}";
var ORIGINAL_FIELD = "{aed8e1c4-7b24-41dc-a13d-f1e3bf3276b2}";
var CROPPING_STATUS_FIELD = "{bf7a30ac-e53b-4147-95e0-aea8c71340ca}";
var FILENAME_FIELD = "{af4b2e00-5f6a-11d2-8f20-0000c0e166dc}";
var CATEGORIES_FIELD = "{af4b2e0c-5f6a-11d2-8f20-0000c0e166dc}";
var FILENAME_FIELD = "{af4b2e00-5f6a-11d2-8f20-0000c0e166dc}";
var PUBLISHED_FIELD = "{a493be21-0f70-4cae-9394-703eca848bad}";
var LICENSE_FIELD = "{f5d1dcd8-c553-4346-8d4d-672c85bb59be}";
var PHOTOGRAPHER_FIELD = "{9b071045-118c-4f42-afa1-c3121783ac66}";

/**
 * Generate the filename for a cropping of an asset.
 * @param  {object} asset An asset as returned from the CIP.
 * @param  {number} cropping_index The index in a list of croppings.
 * @return {string} The new filename, with file extension.
 */
function generate_cropped_filename(asset, cropping_index) {
	assert("fields" in asset && FILENAME_FIELD in asset.fields, "The filename field is sat.");
	var original_filename = asset.fields[FILENAME_FIELD];
	var last_dot_index = original_filename.lastIndexOf(".");
	var new_filename;
	if(last_dot_index > 0) {
		new_filename = original_filename.substring(0, last_dot_index);
	} else {
		new_filename = original_filename;
	}
	new_filename += "_cropped";
	if(isInteger(cropping_index)) {
		assert(cropping_index >= 0, "The cropping index must be a non-negative integer.");
		assert(cropping_index <= 99, "The cropping index must be 99 or below.");
		new_filename += "_";
		if(cropping_index <= 9) {
			new_filename += "0";
		}
		new_filename += cropping_index;
	}
	new_filename += ".jpg";
	return new_filename;
}

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
router.get('/:catalog_alias/:id/crop/:left::top::width::height/:size/:type?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'), 10);
	var left = parseFloat(req.param('left'));
	var top = parseFloat(req.param('top'));
	var width = parseFloat(req.param('width'));
	var height = parseFloat(req.param('height'));
	var size = req.param('size');
	if(size === 'maximal') {
		size = undefined;
	} else {
		size = parseInt(size, 10);
	}
	var type = req.param('type');
	client = cip.client(req, next);
	cropping.thumbnail(client, catalog_alias, id, left, top, width, height, size, function(cropping_details, asset) {
		if(type === 'stream' || type === 'download') {
			if(type === 'download') {
				var download_filename = generate_cropped_filename(asset);
				res.attachment(download_filename);
			}
			// TODO: Consider saving this in a memory-cache.
			http.get(cropping_details.thumbnail_url, function(thumbnail_res) {
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
			res.send(cropping_details);
		}
	});
});

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

/*
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
*/

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

// Defining the mapping of field values from one asset to a cropping.
var CROPPING_FIELD_MAPPINGS = {};
var identity_mapping = function(original_value, fields) {
	return original_value;
};
var identity_enum_mapping = function(original_value, fields) {
	if(original_value) {
		return original_value.id;
	} else {
		return null;
	}
};

CROPPING_FIELD_MAPPINGS[PUBLISHED_FIELD] = identity_enum_mapping;
CROPPING_FIELD_MAPPINGS[LICENSE_FIELD] = identity_enum_mapping;
CROPPING_FIELD_MAPPINGS[PHOTOGRAPHER_FIELD] = identity_mapping;
CROPPING_FIELD_MAPPINGS[CROPPING_STATUS_FIELD] = 3; // Er en friskæring

function perform_field_mapping(mappings, fields) {
	var result = {};
	for(var field_key in mappings) {
		var mapping = mappings[field_key];
		if(typeof(mapping) === 'function') {
			var original_value = fields[field_key];
			value = mapping(original_value, fields);
		} else {
			// It's a constant.
			value = mapping;
		}
		if(value !== null) {
			result[field_key] = value;
		}
	}
	return result;
}

function import_asset_cropping(client, catalog_alias, asset, crop) {
	var deferred = q.defer();

	crop.center_x = parseFloat(crop.center_x);
	crop.center_y = parseFloat(crop.center_y);
	crop.width = parseFloat(crop.width);
	crop.height = parseFloat(crop.height);
	// Derive left and top coordinates.
	crop.left = crop.center_x-crop.width/2;
	crop.top = crop.center_y-crop.height/2;
	// TODO: Add the rotation and check for invalid croppings, i.e. negative
	// values and cropping outsid the original image.

	var cropping_fields = perform_field_mapping(CROPPING_FIELD_MAPPINGS, asset.fields);
	console.log(cropping_fields);
	var cropping_details = cropping.generate_cropping_details(asset, crop.left, crop.top, crop.width, crop.height);
	var cropping_url = cropping_details.thumbnail_url;

	console.log("URL for the cropping:", cropping_url);

	var cropping_buffer = request(cropping_url);

	cropping_buffer.on('response', function(response) {
    if(response.statusCode == 500) {
			var err = new Error( 'Error loading the cropped image from the CIP.' );
			err.status = response.statusCode;
			deferred.reject(err);
    }
  });

	var import_url = client.generate_url("asset/import/" + catalog_alias, false);

	// TODO: Consider using the ciprequest instead.
	var asset_import_request = request.post({
			url: import_url,
			method: 'POST',
		}, function(is_error, response, body) {
			if(is_error || response.statusCode != 200) {
				if(response) {
					var err = new Error( 'Cumulus responded with status code ' + response.statusCode);
					err.status = 503;
					deferred.reject(err);
				} else {
					var err = new Error( 'Error sending the request to CIP.' );
					err.status = 500;
					deferred.reject(err);
				}
			} else {
				deferred.resolve( JSON.parse(response.body) );
			}
		}
	);

	// See: https://github.com/mikeal/request#forms
	var form = asset_import_request.form();
	form.append('fields', JSON.stringify(cropping_fields));
	//form.append('fields', "{}");
	form.append('file', cropping_buffer, {
		filename: generate_cropped_filename(asset, crop.index),
		contentType: 'image/jpeg'
	});

	return deferred.promise;
}

function create_cropped_asset_relations(client, catalog_alias, asset_id, cropped_asset_id) {
	var deferred = q.defer();

	var variant_master_path = "metadata/linkrelatedasset/" +
		catalog_alias + "/" +
		asset_id + "/" +
		"isvariantmasterof/" +
		cropped_asset_id;

	var variant_path = "metadata/linkrelatedasset/" +
		catalog_alias + "/" +
		cropped_asset_id + "/" +
		"isvariantof/" +
		asset_id;
	
	console.log("Relating master to it's cropping.");
	client.ciprequest(variant_master_path, {}, function( response ) {
		// If this went well - let's link back.
		console.log("Relating cropping to it's master.");
		client.ciprequest(variant_path, {}, function( response ) {
			deferred.resolve( response );
		}, function( response ) {
			var err = new Error( 'Error linking the cropping to its original asset.' );
			console.error(response);
			err.status = 500;
			deferred.reject(err);
		});
	}, function( response ) {
		var err = new Error( 'Error linking the original asset to its cropping.' );
		console.log(response);
		err.status = 500;
		deferred.reject(err);
	});

	return deferred.promise;
}

function update_originals_cropping_status(client, catalog_alias, original_asset) {
	var deferred = q.defer();

	var request = client.ciprequest([
		"metadata",
		"setfieldvalues",
		catalog_alias
	], {}, function( response ) {
		deferred.resolve( response );
	}, function( response ) {
		var err = new Error( 'Error updating the original assets metadata.' );
		console.error(response);
		err.status = 500;
		deferred.reject(err);
	});
	var item = {
		id: original_asset.fields.id
	};
	// "Er blevet friskæret"
	item[CROPPING_STATUS_FIELD] = 2;
	var body = JSON.stringify({
		items: [ item ]
	});
	request.setHeader("Content-Length", body.length);
	request.setHeader("Content-Type", "application/json");
	// Append the new values in the body.
	request.end(body);

	return deferred.promise;
}

/*
function delete_existing_croppings(client, catalog_alias, asset, success, error) {
	asset.get_related_assets("isvariantmasterof", function(related) {
		for(i in related.ids) {
			var cropping_asset_id = related.ids[i];
			// Load each existing related asset with its metadata,
			// to see if it is indeed a cropping.
			client.get_asset(catalog_alias, cropping_asset_id, true, function(cropping_asset) {
				console.log(cropping_asset);
			});
		}
	});
}
*/

// Get the croppings 
router.post('/:catalog_alias/:id/croppings/save', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'), 10);
	assert("croppings" in req.body, "The request's body must be a json object with a croppings key with an array.");

	var croppings = req.body.croppings;

	client = cip.client(req, next);
	client.get_asset(catalog_alias, id, true, function(original_asset) {
		// Import the new croppings into the new ones
		for(var c in croppings) {
			var crop = croppings[c];
			// Save this index in the information about the crop, such that this can
			// be used in the crop's filename.
			crop.index = parseInt(c, 10);

			console.log("Importing cropping #", (1+crop.index), "of", croppings.length);
			import_asset_cropping(client, catalog_alias, original_asset, crop)
			.then(function(cropped_asset) {
				assert(cropped_asset && "id" in cropped_asset, "The cropped asset has to have an id.");
				console.log("Cropping #", (1+parseInt(c, 10)), "of", croppings.length, "successfully imported with id", cropped_asset.id, "Creating relations.");
				// Create the relations between the assets.
				return create_cropped_asset_relations(client, catalog_alias, original_asset.fields.id, cropped_asset.id)
				.then(function() {
					console.log("Updating the original asset's cropping status.");
					return update_originals_cropping_status(client, catalog_alias, original_asset).then(function() {
						res.send({
							cropped_asset_id: cropped_asset.id
						});
					});
				});
			}, next);
		}
	});
});

// Get the croppings
/*
router.post('/:catalog_alias/:id/croppings/delete', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'));
	assert("croppings" in req.body, "The request's body must be a json object with a croppings key with an array.");

	var croppings = req.body.croppings;

	client = cip.client(req, next);
	client.get_asset(catalog_alias, id, false, function(original_asset) {
		// Delete existing croppings.
		delete_existing_croppings(client, catalog_alias, original_asset, function(deleted_assets) {
			res.send(deleted_assets);
		}, function(error) {
			next(error);
		});
	});
});
*/

module.exports = router;
