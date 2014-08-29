var cv = require('opencv');
var http = require('http');
var assert = require('assert');
var querystring = require('querystring');
var cip = require('../lib/cip-natmus.js');

var ASSET_WIDTH_FIELD = "{af4b2e11-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_HEIGHT_FIELD = "{af4b2e12-5f6a-11d2-8f20-0000c0e166dc}";
var ASSET_RESOLUTIN_FEILD = "{af4b2e0f-5f6a-11d2-8f20-0000c0e166dc}";

exports.thumbnail = function(catalog, id, x, y, width, height, size, success) {
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

	// Create a session with Canto Cumulus.
	cip.session(function(client) {
		var asset = client.criteriasearch(
			{ name: 'AssetRecords', catalog: { alias: catalog } },
			'id == '+id,
			function(result) {
				// Found a result - get the actual asset.
				result.get(1, 0, function(assets) {
					var a = assets[0];
					var resolution = a.fields[ASSET_RESOLUTIN_FEILD];
					var original_width = Math.round(a.fields[ASSET_WIDTH_FIELD] * resolution);
					var original_height = Math.round(a.fields[ASSET_HEIGHT_FIELD] * resolution);

					console.log(a);
					// var thumbnail_url = client.config.endpoint + "preview/image/"+ catalog +"/" + id;
					var thumbnail_url = a.get_thumbnail_url();

					var image_options = {
						left: Math.round(x * original_width),
						top: Math.round(y * original_height),
						width: Math.round(original_width * width),
						height: Math.round(original_height * height)
					}
					if (size) {
						image_options.maxsize = size;
					}
					thumbnail_url += "?" + querystring.stringify(image_options);

					success({
						original_width: original_width,
						original_height: original_height,
						crop_left: image_options.left,
						crop_top: image_options.top,
						crop_width: image_options.width,
						crop_height: image_options.height,
						thumbnail_url: thumbnail_url
					});
				});
			}
		);
	});

}

var lowThresh = 0;
var highThresh = 100;
var nIters = 10;
var minAreaRatio = 0.10;

// TODO: Consider dismissing suggestions if their aspect ratio is out of bounds.

exports.suggest = function(catalog, id, callback, error_callback) {
	cip.session(function(client) {
		var preview_url = client.config.endpoint + "preview/thumbnail/"+ catalog +"/" + id;

		var suggestions = [];
		http.get(preview_url, function(thumbnail_res) {
			if(thumbnail_res.statusCode == 200) {
				var image_stream = new cv.ImageDataStream();
				image_stream.on('load', function(im) {
					console.log(im);
					var out = im.copy();
					// An image must be min 25% of the image.
					var minArea = im.width() * im.height() * minAreaRatio;

					im.convertGrayscale();
					im_canny = im.copy();

					im_canny.canny(lowThresh, highThresh);
					im_canny.dilate(nIters);
					// 150%
					im_canny.erode(nIters * 1.5);

					// im_canny.save(image + '-canny-out.png');

					contours = im_canny.findContours();

					var largestContour = -1;
					var largestContourArea = 0;

					for(i = 0; i < contours.size(); i++) {
						// Looking at the convex hull of the contour.
						contours.convexHull(i);
						var area = contours.area(i);
						// Is the area too small?
						if(area < minArea) {
							continue;
						}

						var boundingRect = contours.boundingRect(i);
						boundingRect.x /= im.width();
						boundingRect.y /= im.height();
						boundingRect.width /= im.width();
						boundingRect.height /= im.height();

						suggestions.push({
							left: boundingRect.x,
							top: boundingRect.y,
							width: boundingRect.width,
							height: boundingRect.height
						});
					}
					callback( suggestions );
				});
				thumbnail_res.pipe(image_stream);
			} else {
				if(error_callback !== undefined) {
					error_callback(thumbnail_res);
				}
			}
		});
	});
};