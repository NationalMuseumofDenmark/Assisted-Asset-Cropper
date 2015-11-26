var cv = require('opencv');
var http = require('http');
var cip = require('../lib/cip.js');

var DEFAULT_PARAMETERS = {
	'canny_low_threshold': 50,
	'canny_high_threshold': 255,
	'dilate_iterations': 1,
	'erode_iterations': 0,
	'min_area_ratio': 0.02,
	'max_area_ratio': 0.90,
};
// TODO: Consider dismissing suggestions if their aspect ratio is out of bounds.

var algorithm_state = 0;
var SUGGESTION_ALGORITM_STATES = {
	LOAD: algorithm_state++,
	GRAYSCALE: algorithm_state++,
	CANNY: algorithm_state++,
	DILATE: algorithm_state++,
	ERODE: algorithm_state++,
	CONTOURS: algorithm_state++,
	CONVEX_HULLS: algorithm_state++,
};

exports.SUGGESTION_ALGORITM_STATES = SUGGESTION_ALGORITM_STATES;

var GREEN = [0, 255, 0];
var RED = [0, 0, 255];
var YELLOW = [0, 255, 255];

exports.suggest = function(catalog_alias, id, callback, error_callback, given_parameters, state_change_callback) {
	var parameters = {};
	if(typeof(given_parameters) !== 'object') {
		given_parameters = {};
	}
	for(p in DEFAULT_PARAMETERS) {
		if(p in given_parameters) {
			parameters[p] = given_parameters[p];
		} else {
			parameters[p] = DEFAULT_PARAMETERS[p];
		}
	}

	var produce_intermediary_states = (typeof(state_change_callback) === 'function');

	cip.session(function(client) {
		var preview_url = client.generate_url("preview/thumbnail/"+ catalog_alias +"/" + id);

		var suggestions = [];
		http.get(preview_url, function(thumbnail_res) {
			if(thumbnail_res.statusCode == 200) {
				var image_stream = new cv.ImageDataStream();
				image_stream.on('load', function(im) {
					if(produce_intermediary_states) {
						original = im.copy();
						state_change_callback(SUGGESTION_ALGORITM_STATES.LOAD, original);
					}

					im.convertGrayscale();
					if(produce_intermediary_states) {
						state_change_callback(SUGGESTION_ALGORITM_STATES.GRAYSCALE, im.copy());
					}

					im.canny(parameters.canny_low_threshold, parameters.canny_high_threshold);
					if(produce_intermediary_states) {
						state_change_callback(SUGGESTION_ALGORITM_STATES.CANNY, im.copy());
					}

					im.dilate(parameters.dilate_iterations);
					if(produce_intermediary_states) {
						state_change_callback(SUGGESTION_ALGORITM_STATES.DILATE, im.copy());
					}

					im.erode(parameters.erode_iterations);
					if(produce_intermediary_states) {
						state_change_callback(SUGGESTION_ALGORITM_STATES.ERODE, im.copy());
					}

					contours = im.findContours();
					if(produce_intermediary_states) {
						contours_out = im.copy();
						contours_hull_out = im.copy();
						contours_out.cvtColor("CV_GRAY2BGR");
						contours_hull_out.cvtColor("CV_GRAY2BGR");
					}

					var largestContour = -1;
					var largestContourArea = 0;

					// An image must be min 25% of the image.
					var minArea = im.width() * im.height() * parameters.min_area_ratio;
					var maxArea = im.width() * im.height() * parameters.max_area_ratio;

					for(i = 0; i < contours.size(); i++) {
						if(produce_intermediary_states) {
							contours_out.drawContour(contours, i, YELLOW);
							contours_hull_out.drawContour(contours, i, YELLOW);
						}

						// Looking at the convex hull of the contour.
						contours.convexHull(i);
						var area = contours.area(i);

						var area_too_small_or_big = area < minArea || area > maxArea;

						if(produce_intermediary_states) {
							if(area_too_small_or_big) {
								var contour_colour = RED;
							} else {
								var contour_colour = GREEN;
							}
							contours_hull_out.drawContour(contours, i, contour_colour, 3);
						}

						// Is the area too small?
						if(area_too_small_or_big) {
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

					if(produce_intermediary_states) {
						state_change_callback(SUGGESTION_ALGORITM_STATES.CONTOURS, contours_out);
						state_change_callback(SUGGESTION_ALGORITM_STATES.CONVEX_HULLS, contours_hull_out);
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