var cv = require('opencv');
var http = require('http');
var cip = require('../lib/cip.js');

var DEFAULT_PARAMETERS = {
	'image_size': 850,
	'canny_low_threshold': 50,
	'canny_high_threshold': 150,
	'dilate_iterations': 1,
	'min_area_ratio': 0.02,
	'max_area_ratio': 0.90,
	'solidity_threshold': 0.8
};
exports.DEFAULT_PARAMETERS = DEFAULT_PARAMETERS;

// TODO: Consider dismissing suggestions if their aspect ratio is out of bounds.

var algorithm_state = 0;
var SUGGESTION_ALGORITM_STATES = {
	GRAYSCALE: algorithm_state++,
	CANNY_1: algorithm_state++,
	DILATE_1: algorithm_state++,
	CONTOURS_1: algorithm_state++,
	CONVEX_HULLS_1: algorithm_state++,
	SATURATION: algorithm_state++,
	CANNY_2: algorithm_state++,
	DILATE_2: algorithm_state++,
	CONTOURS_2: algorithm_state++,
	CONVEX_HULLS_2: algorithm_state++,
};

exports.SUGGESTION_ALGORITM_STATES = SUGGESTION_ALGORITM_STATES;

var GREEN = [0, 255, 0];
var RED = [0, 0, 255];
var YELLOW = [0, 255, 255];
var BLUE = [255, 0, 0];

var PREVIEW_IMAGE_SIZE = 850;

function find_edges_contours_and_suggestions(im, parameters, produce_intermediary_states, state_change_callback, states) {
	var suggestions = [];

	im.canny(parameters.canny_low_threshold, parameters.canny_high_threshold);
	if(produce_intermediary_states) {
		state_change_callback(states[0], im.copy());
	}

	im.dilate(parameters.dilate_iterations);
	if(produce_intermediary_states) {
		state_change_callback(states[1], im.copy());
	}

	contours = im.findContours();
	if(produce_intermediary_states) {
		contours_out = im.copy();
		contours_hull_out = im.copy();
		contours_out.cvtColor("CV_GRAY2BGR");
		contours_hull_out.cvtColor("CV_GRAY2BGR");
	}

	// An image must be min 25% of the image.
	var minArea = im.width() * im.height() * parameters.min_area_ratio;
	var maxArea = im.width() * im.height() * parameters.max_area_ratio;

	for(i = 0; i < contours.size(); i++) {
		if(produce_intermediary_states) {
			contours_out.drawContour(contours, i, YELLOW);
			contours_hull_out.drawContour(contours, i, YELLOW);
		}

		var contour_area = contours.area(i);
		// Looking at the convex hull of the contour.
		contours.convexHull(i);
		var hull_area = contours.area(i);

		var solidity = contour_area/hull_area;

		var area_too_small_or_big = hull_area < minArea || hull_area > maxArea;
		var not_solid_enough = solidity < parameters.solidity_threshold;

		if(produce_intermediary_states) {
			if(area_too_small_or_big) {
				var contour_colour = RED;
			} else if(not_solid_enough) {
				var contour_colour = BLUE;
			} else {
				var contour_colour = GREEN;
			}
			contours_hull_out.drawContour(contours, i, contour_colour, 3);
		}

		// Is the area too small?
		if(area_too_small_or_big || not_solid_enough) {
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
		state_change_callback(states[3], contours_out);
		state_change_callback(states[4], contours_hull_out);
	}

	return suggestions;
}

exports.suggest = function(client, catalog_alias, id, callback, error_callback, given_parameters, state_change_callback) {
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

	// var preview_url = client.generate_url("preview/image/"+ catalog_alias +"/" + id, { maxsize: parameters.image_size });
	var preview_url = client.generate_url("preview/thumbnail/"+ catalog_alias +"/" + id);

	var suggestions = [];
	http.get(preview_url, function(thumbnail_res) {
		if(thumbnail_res.statusCode == 200) {
			var image_stream = new cv.ImageDataStream();
			image_stream.on('load', function(im) {
				var grayscale = im.copy();
				grayscale.convertGrayscale();
				if(produce_intermediary_states) {
					state_change_callback(SUGGESTION_ALGORITM_STATES.GRAYSCALE, grayscale.copy());
				}
				var suggestions_grayscale = find_edges_contours_and_suggestions(
					grayscale.copy(),
					parameters,
					produce_intermediary_states,
					state_change_callback,
					[
						SUGGESTION_ALGORITM_STATES.CANNY_1,
						SUGGESTION_ALGORITM_STATES.DILATE_1,
						SUGGESTION_ALGORITM_STATES.CONTOURS_1,
						SUGGESTION_ALGORITM_STATES.CONVEX_HULLS_1
					] );


				im_saturation = im.copy();
				im_saturation.cvtColor("CV_BGR2HSV");
				im_saturation = im_saturation.split();
				im_saturation = im_saturation[1];
				if(produce_intermediary_states) {
					state_change_callback(SUGGESTION_ALGORITM_STATES.SATURATION, im_saturation.copy());
				}
				var suggestions_saturation = find_edges_contours_and_suggestions(
					im_saturation.copy(),
					parameters,
					produce_intermediary_states,
					state_change_callback,
					[
						SUGGESTION_ALGORITM_STATES.CANNY_2,
						SUGGESTION_ALGORITM_STATES.DILATE_2,
						SUGGESTION_ALGORITM_STATES.CONTOURS_2,
						SUGGESTION_ALGORITM_STATES.CONVEX_HULLS_2
					] );

				// TODO: Make wise selections between these suggestions.
				// Consider calculating overlapping suggestions and taking the
				// suggesion with the median area among overlapping suggestions.su

				for(s in suggestions_grayscale) {
					suggestions.push(suggestions_grayscale[s]);
				}
				for(s in suggestions_saturation) {
					suggestions.push(suggestions_saturation[s]);
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
};