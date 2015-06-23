var cv = require('opencv'),
		http = require('http'),
		assert = require('assert'),
		querystring = require('querystring'),
		cip = require('../lib/cip-natmus.js'),
		state = require('../lib/state'),
		Q = require('q'),
    fs   = require('fs'),
    im = require('imagemagick'),
		temp = require('temp').track();
//var algorithm = require('./cropping-algorithm-simple-canny.js');
//var algorithm = require('./cropping-algorithm-advanced-canny.js');
//var algorithm = require('./cropping-algorithm-canny-with-solidity.js');
var algorithm = require('./cropping-algorithm-card-color-with-solidity.js');
//var algorithm = require('./cropping-algorithm-hue-canny-with-solidity.js');

var ASSET_WIDTH_FIELD = "{af4b2e11-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_HEIGHT_FIELD = "{af4b2e12-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_WIDTH_PX_FIELD = "{05f6f3f0-833a-45a0-ade4-8e48542f37ef}";
var ASSET_HEIGHT_PX_FIELD = "{a89e881e-df7a-4c7c-9bf7-840bf3df707e}";
var ASSET_RESOLUTION_FEILD = "{af4b2e0f-5f6a-11d2-8f20-0000c0e166dc}";

// Defining constants from Cumulus, used when looking up
// values in the metadata returned from the CIP.
var TITLE_FIELD = "{6fb1f61b-14a3-4851-bba0-cf7e71ef59cb}";
var DESCRIPTION_FIELD = "{2ce9c8eb-b83d-4a91-9d09-2141cac7de12}";
var ORIGINAL_FIELD = "{aed8e1c4-7b24-41dc-a13d-f1e3bf3276b2}";
var CROPPING_STATUS_FIELD = "{bf7a30ac-e53b-4147-95e0-aea8c71340ca}";
var CATEGORIES_FIELD = "{af4b2e0c-5f6a-11d2-8f20-0000c0e166dc}";
var FILENAME_FIELD = "name"; // This has changed from {af4b2e00-5f6a-11d2-8f20-0000c0e166dc}
var PUBLISHED_FIELD = "{a493be21-0f70-4cae-9394-703eca848bad}";
var LICENSE_FIELD = "{f5d1dcd8-c553-4346-8d4d-672c85bb59be}";
var PHOTOGRAPHER_FIELD = "{9b071045-118c-4f42-afa1-c3121783ac66}";

/**
 * Helping function to determine if the type and value of a variable
 * is a nummeric integer or not.
 * @param  {number}  n
 * @return {Boolean} 
 */
function isInteger(n) {
   return typeof(n) == "number" && isFinite(n) && n%1===0;
}

/**
 * Generate the filename for a cropping of an asset.
 * @param  {object} asset An asset as returned from the CIP.
 * @param  {number} cropping_index The index in a list of croppings.
 * @return {string} The new filename, with file extension.
 */
function generateCroppedFilename(asset, cropping_index) {
	assert("fields" in asset && FILENAME_FIELD in asset.fields, "The filename field is sat.");
	var original_filename = asset.fields[FILENAME_FIELD];
	var last_dot_index = original_filename.lastIndexOf(".");
	var new_filename, file_extension;
	if(last_dot_index > 0) {
		new_filename = original_filename.substring(0, last_dot_index);
		file_extension = original_filename.substring(last_dot_index);
	} else {
		new_filename = original_filename;
		file_extension = '';
	}
	new_filename += "_cropped";
	if(isInteger(cropping_index)) {
		assert(cropping_index >= 0, "The cropping index must be a non-negative integer.");
		assert(cropping_index <= 99, "The cropping index must be 99 or below.");
		new_filename += "_";
		cropping_index++; // Let's start from 1.
		if(cropping_index <= 9) {
			new_filename += "0";
		}
		new_filename += cropping_index;
	}
	new_filename += file_extension;
	return new_filename;
}


exports.algorithm = algorithm;
exports.suggest = algorithm.suggest;
exports.SUGGESTION_ALGORITM_STATES = algorithm.SUGGESTION_ALGORITM_STATES;

exports.performCropping = function(req, res, next, catalogAlias, masterAssetId, selections) {
	cip.client().then(function (client) {
		console.log('Saving', selections.length, 'of asset', catalogAlias, masterAssetId);

		function downloadMasterAsset(jobOptions) {
			var deferred = Q.defer();

			var jobId = jobOptions.id;
			var catalogAlias = jobOptions.catalogAlias;
			var masterAsset = jobOptions.masterAsset;

			var taskDescription = 'Downloading master asset.';
			state.updateJobTask(req, jobId, taskDescription);

			var downloadUrl = client.generate_url([
				'asset', 'download', catalogAlias, masterAsset.fields.id
			].join('/'));

			var tempMasterAssetFilePath = temp.path({ suffix: masterAsset.fields.name });
			console.log('Downloading master asset into', tempMasterAssetFilePath);
			var tempMasterAssetFile = fs.createWriteStream(tempMasterAssetFilePath);

			request(downloadUrl).on('response', function(response) {
				// Keep a body string to buffer the response.
				var responseLength = parseInt(response.headers['content-length'], 10);
				var progress = 0;

				// To be reused when uploading the cropped assets.
				jobOptions.masterAssetContentType = response.headers['content-type'];

				response.on('data', function (chunk) {
					progress += chunk.length;

					// TODO: Make sure that the file is actually written.
					tempMasterAssetFile.write(chunk);

					// Update the state.
					state.updateJobTask(
						req,
						jobId,
						taskDescription,
						progress,
						responseLength
					);
				});
				// When the response has ended - let's react.
				response.on('end', function () {
					// We're all done.
					state.updateJobTask(
						req,
						jobId,
						taskDescription,
						responseLength,
						responseLength
					);

					tempMasterAssetFile.on('finish', function() {
						jobOptions.masterAssetFilePath = tempMasterAssetFilePath;
						deferred.resolve(jobOptions);
					});

					tempMasterAssetFile.end();
				});
			}).on('error', deferred.reject);

			return deferred.promise;
		}


		function performAssetCropping(options) {
			var deferred = Q.defer();

			var tempCroppedAssetFilePath = temp.path({
				prefix: 'cropping-' + options.selectionIndex +'-',
				suffix: options.masterAsset.fields.name
			});

			console.log('Cropping to', tempCroppedAssetFilePath);
			state.updateJobTask(req,
													options.jobId,
													options.taskDescriptions.cropping,
													15,
													100);

			var masterAssetSize = {
				width: options.masterAsset.fields[ASSET_WIDTH_PX_FIELD],
				height: options.masterAsset.fields[ASSET_HEIGHT_PX_FIELD]
			};

			// Scale the center x and y coornidates.
			var centerX = parseInt(options.selection.center_x * masterAssetSize.width, 10);
			var centerY = parseInt(options.selection.center_y * masterAssetSize.height, 10);

			var left = options.selection.center_x - options.selection.width/2;
			var top = options.selection.center_y - options.selection.height/2;

			left = parseInt(left * masterAssetSize.width, 10);
			top = parseInt(top * masterAssetSize.height, 10);

			var width = parseInt(options.selection.width * masterAssetSize.width, 10);
			var height = parseInt(options.selection.height * masterAssetSize.height, 10);

			var rotationAngle =options.selection.rotation / Math.PI / 2 * 360;

			var command = [
				options.masterAssetFilePath,
				'-compress', // No compression
				'none',
				'-virtual-pixel',
				'black',
				'+distort', // + is important, if using a -, the canvas is not extended.
					'ScaleRotateTranslate',
					[
						centerX+','+centerY, // X,Y
						1, // Scale
						rotationAngle, // Angle
						centerX+','+centerY // NewX,NewY
					].join(' '),
				'-crop',
				width +'x'+ height +'!+'+ left +'+'+ top,
				tempCroppedAssetFilePath
			];

			console.log('Executing command: '+command.join(' '));

			im.convert(command, function(err, stdout) {
				if(err) {
					deferred.reject(err);
				} else {
					state.updateJobTask(req,
															options.jobId,
															options.taskDescriptions.cropping,
															100,
															100);
					options.croppedAssetPath = tempCroppedAssetFilePath;
					deferred.resolve(options);
				}
			});

			return deferred.promise;
		}


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
		CROPPING_FIELD_MAPPINGS[ASSET_RESOLUTION_FEILD] = identity_mapping;
		CROPPING_FIELD_MAPPINGS[CROPPING_STATUS_FIELD] = 3; // Er en friskæring

		function performFieldMapping(mappings, fields) {
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


		function importAssetCropping(options) {
			var deferred = Q.defer();

			// client, catalog_alias, asset, crop
			var client = options.client;
			var catalogAlias = options.catalogAlias;
			var masterAsset = options.masterAsset;

			var croppingFields = performFieldMapping(CROPPING_FIELD_MAPPINGS, masterAsset.fields);

			var importUrl = client.generate_url("asset/import/" + catalogAlias, false);

			// TODO: Consider using the ciprequest instead.
			var assetImportRequest = request.post({
				url: importUrl,
				method: 'POST',
			}, function(is_error, response, body) {
				if(is_error || response.statusCode != 200) {
					deferred.reject(new Error( 'Error sending the request to CIP.'));
				} else {
					var newAsset = JSON.parse(response.body);
					options.newAssetId = newAsset.id;
					deferred.resolve( options );
				}
			}).on('error', deferred.reject);

			var croppedAssetStat = fs.statSync(options.croppedAssetPath);
			var croppedAssetStream = fs.createReadStream(options.croppedAssetPath);

			var totalBytes = croppedAssetStat.size;
			var uploadedBytes = 0;
			croppedAssetStream.on('data', function(chunk) {
				uploadedBytes += chunk.length;
				state.updateJobTask(
					options.req,
					options.jobId,
					options.taskDescriptions.uploading,
					uploadedBytes,
					totalBytes
				);
			}).on('end', function() {
				state.updateJobTask(
					options.req,
					options.jobId,
					options.taskDescriptions.uploading,
					totalBytes,
					totalBytes
				);
			}).on('error', deferred.reject);

			// See: https://github.com/mikeal/request#forms
			var form = assetImportRequest.form();
			form.append('fields', JSON.stringify(croppingFields));
			//form.append('fields', "{}");
			form.append('file', croppedAssetStream, {
				filename: generateCroppedFilename(masterAsset, options.selectionIndex),
				contentType: options.masterAssetContentType
			});

			return deferred.promise;
		}


		function createCroppedAssetRelations(options) {
			var deferred = Q.defer();

			var client = options.client;
			var catalogAlias = options.catalogAlias;
			var masterAssetId = options.masterAsset.fields.id;
			var newAssetId =  options.newAssetId;

			var variant_master_path = "metadata/linkrelatedasset/" +
				catalogAlias + "/" +
				masterAssetId + "/" +
				"isvariantmasterof/" +
				newAssetId;

			var variant_path = "metadata/linkrelatedasset/" +
				catalogAlias + "/" +
				newAssetId + "/" +
				"isvariantof/" +
				masterAssetId;
			
			console.log("Relating master to it's cropping.");
			client.ciprequest(variant_master_path, {}, function( response ) {
				// If this went well - let's link back.
				console.log("Relating cropping to it's master.");
				client.ciprequest(variant_path, {}, function( response ) {
					deferred.resolve( options );
				}, function( response ) {
					var err = new Error( 'Error linking the cropping to its original asset.' );
					deferred.reject(err);
				});
			}, function( response ) {
				var err = new Error( 'Error linking the original asset to its cropping.' );
				deferred.reject(err);
			});

			return deferred.promise;
		}


		function updateOriginalsCroppingStatus(options) {
			var deferred = Q.defer();

			var client = options.client;
			var catalogAlias = options.catalogAlias;
			var masterAsset = options.masterAsset;

			console.log('Updating the master asset´s cropping status.');

			var item = {
				id: masterAsset.fields.id
			};
			item[CROPPING_STATUS_FIELD] = 2; // "Er blevet friskæret"

			var body = JSON.stringify({
				items: [ item ]
			});

			var request = client.ciprequest([
				"metadata",
				"setfieldvalues",
				catalogAlias
			], {}, function( response ) {
				deferred.resolve( options );
			}, function( err ) {
				err = new Error( 'Error updating the master asset´s metadata: ' + err.message );
				deferred.reject(err);
			});

			request.setHeader("Content-Length", body.length);
			request.setHeader("Content-Type", "application/json");
			request.write(body);

			return deferred.promise;
		}


		function updateCroppedAssetRelations(options) {
			assert(	options.newAssetId,
							"The cropped asset has to have an id.");

			// Create the relations between the assets.
			return createCroppedAssetRelations(options)
				.then(updateOriginalsCroppingStatus);
		}


		// Communicate that an asset has been successfully imported.
		function assetSucessImported(options) {
			var catalogAlias = options.catalogAlias;
			var newAssetId = options.newAssetId;
			var selectionIndex = options.selectionIndex;
			var selectionCount = options.selectionCount;

			console.log("Done uploading the cropped asset:",
									catalogAlias +'-'+ newAssetId,
									'cropping',
									selectionIndex + 1,
									'of',
									selectionCount);

			return options;
		}

		// Send the final response to the client.
		function respond(assets) {
			assets = assets.map(function(asset) {
				return asset.catalogAlias +'-'+ asset.newAssetId;
			});
			res.send({
				assets: assets
			});
		}

		function deleteAssetCroppingFile(options) {
			console.log('Deleting', options.croppedAssetPath);
			fs.unlinkSync(options.croppedAssetPath);
			return options;
		}

		function deleteMasterAssetFile(jobOptions) {
			console.log('Deleting', jobOptions.masterAssetFilePath);
			fs.unlinkSync(jobOptions.masterAssetFilePath);
			return jobOptions;
		}

		function createSubAssets(jobOptions) {
			var jobId = jobOptions.id;
			var masterAsset = jobOptions.masterAsset;

			console.log('createSubAssetsfunction called');
			return state.get(req).then(function(currentState) {
				var newAssetPromises = [];
				// Import the new selection into the new ones
				for(var s in selections) {
					var selection = selections[s];

					// TODO: Consider that we might want to parseFloat the object's value.
					// console.log(selection);

					// Save this index in the information about the crop, such that this can
					// be used in the crop's filename.
					var options = {
						req: req,
						client: client,
						catalogAlias: catalogAlias,
						masterAsset: masterAsset,
						selection: selection,
						selectionIndex: parseInt(s, 10),
						selectionCount: selections.length,
						masterAssetFilePath: jobOptions.masterAssetFilePath,
						masterAssetContentType: jobOptions.masterAssetContentType,
						jobId: jobId
					};

					options.taskDescriptions = {
						cropping: 'Cropping selection #' +(options.selectionIndex+1),
						uploading: 'Uploading selection #' +(options.selectionIndex+1)
					};

					for(var t in options.taskDescriptions) {
						var taskDescription = options.taskDescriptions[t];
						// Touch the job task.
						currentState.updateJobTask(jobId, taskDescription);
					}
					currentState.save();

					console.log('Importing cropping #',
											options.selectionIndex + 1,
											'of',
											options.selectionCount);

					var newAssetPromise = Q(options)
						.then(performAssetCropping)
						.then(importAssetCropping)
						.then(assetSucessImported)
						.then(updateCroppedAssetRelations)
						.finally(function() {
							deleteAssetCroppingFile(options);
						});

					newAssetPromises.push(newAssetPromise);
				}

				return Q.all(newAssetPromises)
				.then(function(assets) {
					state.changeJobStatus(req, jobId, 'success');
					respond(assets);
				})
				.finally(function() {
					return deleteMasterAssetFile(jobOptions);
				});
			});
		}

		function handleMasterAsset(masterAsset) {
			var jobDescription = [
				'Cropping ',
				catalogAlias,
				'-',
				masterAsset.fields.id
			].join('');

			return state.createJob(req, jobDescription)
			.then(function(jobId) {
				state.changeJobStatus(req, jobId, 'started');

				return Q({
					id: jobId,
					masterAsset: masterAsset,
					catalogAlias: catalogAlias
				}).then(downloadMasterAsset)
					.then(createSubAssets) // TODO: Then clean up the master asset
					.catch(function(err) {
						// Change the status of the job.
						state.changeJobStatus(req, jobId, 'failed');

						// Print the error to the console.
						console.error(err.stack || err || 'Error: No details available');
						err.status = 500;
						next(err);
					}).done();
			});
		}

		// Use the CIP to get the master asset and handle it.
		client.get_asset(catalogAlias, masterAssetId, true, handleMasterAsset);
	});
};