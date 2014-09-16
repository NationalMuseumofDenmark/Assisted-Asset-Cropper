var express = require('express');
var http = require('http'); // TODO: Consider using request instead.
var cropping = require('../lib/cropping.js');
var router = express.Router();
var cip = require('../lib/cip-natmus');
var assert = require('assert');
var request = require('request');
var gm = require('gm');
var temp = require('temp');

// TODO: Consider cleaning up the code using var sequence = Futures.sequence();
// http://stackoverflow.com/questions/6048504/synchronous-request-in-nodejs

// Automatically track and cleanup files at exit
temp.track();

var DEFAULT_THUMBNAIL_SIZE = 200;

var TITLE_FIELD = "{6fb1f61b-14a3-4851-bba0-cf7e71ef59cb}";
var DESCRIPTION_FIELD = "{2ce9c8eb-b83d-4a91-9d09-2141cac7de12}";
var ORIGINAL_FIELD = "{aed8e1c4-7b24-41dc-a13d-f1e3bf3276b2}";
var CROPPING_STATUS_FIELD = "{bf7a30ac-e53b-4147-95e0-aea8c71340ca}";

function generate_cropped_filename(catalog_alias, asset_id) {
	return catalog_alias + "-" + asset_id + "-cropped";
}

function append_master(client, asset, catalog_alias, render_options, callback) {
	asset.get_related_assets("isvariantof", function(related) {
		if(related.ids.length > 0) {
			var master_asset_id = related.ids[0];
			client.get_asset(catalog_alias, master_asset_id, false, function(master_asset) {
				render_options.master_image = master_asset.get_thumbnail_url();
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
					image: cropping_asset.get_thumbnail_url(),
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
		var image_size = cropping.algorithm.DEFAULT_PARAMETERS.image_size;
		//var asset_image_url = asset.get_image_url({ maxsize: image_size });
		var asset_image_url = asset.get_thumbnail_url();
		var asset_algoritm_states_url = "/asset/" + catalog_alias + "/"
			+ id + "/suggestion-states";
		var cropping_status = asset.fields[CROPPING_STATUS_FIELD].id;
		var cropping_status_text = asset.fields[CROPPING_STATUS_FIELD].displaystring;

		var render_options = {
			jsessionid: client.jsessionid,
			catalog_alias: catalog_alias,
			asset_title: asset_title ? asset_title : "Asset uden titel",
			asset_id: id,
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
		var err = new Error("No such asset in Cumulus!");
		err.status = 404;
		next(err);
	});
});

router.get('/:catalog_alias/:id/crop/:left::top::width::height/:size/:type?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
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
	client = cip.client(req, next);
	cropping.thumbnail(client, catalog_alias, id, left, top, width, height, size, function(asset) {
		if(type === 'stream' || type === 'download') {
			if(type === 'download') {
				var download_filename = generate_cropped_filename(catalog_alias, id);
				res.attachment(download_filename);
			}
			// TODO: Consider saving this in a memory-cache.
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

router.get('/:catalog_alias/:id/thumbnail/:size?/stream', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
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

function deriveSuggestionThumbnailURLs(catalog_alias, id, size, suggestions) {
	for(var s in suggestions) {
		var url = "/" + [
			"asset",
			catalog_alias,
			id,
			"crop",
			[
				suggestions[s].left,
				suggestions[s].top,
				suggestions[s].width,
				suggestions[s].height
			].join(":"),
			size,
			"stream"
		].join("/");

		/*
		var url = '/asset/';
		url += catalog_alias + '/';
		url += id + '/crop/';
		url += suggestions[s].left + ':';
		url += suggestions[s].top + ':';
		url += suggestions[s].width + ':';
		url += suggestions[s].height;
		url += '/'+size+'/stream';
		*/
		suggestions[s].thumbnail_url = url;
	}
	return suggestions;
}

router.get('/:catalog_alias/:id/suggestions/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	client = cip.client(req, next);
	cropping.suggest(client, catalog_alias, id, function(suggestions) {
		suggestions = deriveSuggestionThumbnailURLs(catalog_alias, id, size, suggestions);
		res.send(suggestions);
	}, function(response) {
		var err = new Error("Cumulus responded with status code " + response.statusCode);
		err.status = 503;
		next(err);
	});
});

router.get('/:catalog_alias/:id/suggestion-states/:size?', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
	} else {
		size = DEFAULT_THUMBNAIL_SIZE;
	}
	var state_images = [];
	client = cip.client(req, next);
	cropping.suggest(client, catalog_alias, id, function(suggestions) {
		var result;
		for(s in state_images) {
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
		var err = new Error("Cumulus responded with status code " + response.statusCode);
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
	var id = parseInt(req.param('id'));
	var size = req.param('size');
	if(size !== undefined) {
		size = parseInt(size);
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
CROPPING_FIELD_MAPPINGS[TITLE_FIELD] = identity_mapping;
CROPPING_FIELD_MAPPINGS[DESCRIPTION_FIELD] = function(original_value, fields) {
	// TODO: Fix if asset_title
	var asset_title = fields[TITLE_FIELD];
	return "Friskæring af " + asset_title + ".\n" + original_value;
};
CROPPING_FIELD_MAPPINGS[ORIGINAL_FIELD] = function(original_value, fields) {
	if(original_value) {
		return original_value.id;
	} else {
		return null;
	}
};
CROPPING_FIELD_MAPPINGS[CROPPING_STATUS_FIELD] = 3; // Er en friskæring
// TODO: Use identity_mapping by default.
// TODO: Make sure the filename is mirrored.
// TODO: Set "billedebehandlet" til true.

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

function import_asset_cropping(client, catalog_alias, asset, crop, callback, error) {
	crop.left = parseFloat(crop.left);
	crop.top = parseFloat(crop.top);
	crop.width = parseFloat(crop.width);
	crop.height = parseFloat(crop.height);

	var cropping_fields = perform_field_mapping(CROPPING_FIELD_MAPPINGS, asset.fields);
	var cropping_details = cropping.generate_cropping_details(asset, crop.left, crop.top, crop.width, crop.height);
	var cropping_url = cropping_details.thumbnail_url;

	var cropping_buffer = request(cropping_url);

	var import_url = client.generate_url("asset/import/" + catalog_alias, false);

	// TODO: Consider using the ciprequest instead.
	var asset_import_request = request.post({
			url: import_url,
			method: 'POST',
		}, function(is_error, response, body) {
			if(is_error || response.statusCode != 200) {
				if(response) {
					var err = new Error("Cumulus responded with status code " + response.statusCode);
					console.error(response);
					err.status = 503;
					error(err);
				} else {
					var err = new Error("Error sending the request to CIP." + is_error);
					console.error(is_error);
					err.status = 500;
					error(err);
				}
			} else {
				callback( JSON.parse(response.body) );
			}
		}
	);

	// See: https://github.com/mikeal/request#forms
	var form = asset_import_request.form();
	form.append('fields', JSON.stringify(cropping_fields));
	//form.append('fields', "{}");
	form.append('file', cropping_buffer, {
		filename: generate_cropped_filename(catalog_alias, asset.fields.id) + ".jpg",
		contentType: 'image/jpeg'
	});
}

function create_cropped_asset_relations(client, catalog_alias, asset_id, cropped_asset_id, success, error) {
	var variant_master_path = "metadata/linkrelatedasset/"
		+ catalog_alias + "/"
		+ asset_id + "/"
		+ "isvariantmasterof/"
		+ cropped_asset_id;

	var variant_path = "metadata/linkrelatedasset/"
		+ catalog_alias + "/"
		+ cropped_asset_id + "/"
		+ "isvariantof/"
		+ asset_id;
	
	console.log("Relating master to it's cropping.");
	client.ciprequest(variant_master_path, {}, function( response ) {
		// If this went well - let's link back.
		console.log("Relating cropping to it's master.");
		client.ciprequest(variant_path, {}, function( response ) {
			success( response );
		}, function( response ) {
			var err = new Error("Error linking the cropping to its original asset.");
			console.error(response);
			err.status = 500;
			error(err);
		});
	}, function( response ) {
		var err = new Error("Error linking the original asset to its cropping.");
		console.log(response);
		err.status = 500;
		error(err);
	});
}

function update_originals_cropping_status(client, catalog_alias, original_asset, success, error) {
	var request = client.ciprequest([
		"metadata",
		"setfieldvalues",
		catalog_alias
	], {}, function( response ) {
		success( response );
	}, function( response ) {
		var err = new Error("Error updating the original assets metadata.");
		console.error(response);
		err.status = 500;
		error(err);
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
}

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

// Get the croppings 
router.post('/:catalog_alias/:id/croppings/save', function(req, res, next) {
	// Localizing parameters
	var catalog_alias = req.param('catalog_alias');
	var id = parseInt(req.param('id'));
	assert("croppings" in req.body, "The request's body must be a json object with a croppings key with an array.");

	var croppings = req.body.croppings;

	client = cip.client(req, next);
	client.get_asset(catalog_alias, id, true, function(original_asset) {
		// Import the new croppings into the new ones
		for(var c in croppings) {
			console.log("Importing cropping #", (1+parseInt(c)), "of", croppings.length);
			var crop = croppings[c];
			import_asset_cropping(client, catalog_alias, original_asset, crop, function(cropped_asset) {
				assert(cropped_asset && "id" in cropped_asset, "The cropped asset has to have an id.");
				console.log("Cropping #", (1+parseInt(c)), "of", croppings.length, "successfully imported with id", cropped_asset.id, "Creating relations.");
				// Create the relations between the assets.
				create_cropped_asset_relations(client, catalog_alias, original_asset.fields.id, cropped_asset.id, function() {
					console.log("Updating the original asset's cropping status.");
					update_originals_cropping_status(client, catalog_alias, original_asset, function() {
						res.send({
							cropped_asset_id: cropped_asset.id
						});
					}, function(error) {
						next(error);
					});
				}, function(error) {
					next(error);
				});
			}, function(error) {
				next(error);
			});
		}
	});
});

// Get the croppings 
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

module.exports = router;
