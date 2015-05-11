var cv = require('opencv');
var http = require('http');
var cip = require('../lib/cip-natmus.js');

var DEFAULT_PARAMETERS = {
	'image_size': 850,
	'canny_low_threshold': 50,
	'canny_high_threshold': 225,
	'dilate_iterations': 1,
	'erode_iterations': 0,
	'min_area_ratio': 0.02,
	'max_area_ratio': 0.90,
	'solidity_threshold': 0.8,
	'card_similary_threshold': 45, // This is 15% off on every channel
	'post_scale': 0.96, // Take 2% from each side
};
exports.DEFAULT_PARAMETERS = DEFAULT_PARAMETERS;

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
var BLUE = [255, 0, 0];
var GRAY = [100, 100, 100];

var PREVIEW_IMAGE_SIZE = 850;

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

				// Find the card's color
				var cardBaseColorPoints = [
					{
						x: parseInt(0.01 * im.width(), 10),
						y: parseInt(0.50 * im.height(), 10)
					}, {
						x: parseInt(0.99 * im.width(), 10),
						y: parseInt(0.50 * im.height(), 10)
					}, {
						x: parseInt(0.50 * im.width(), 10),
						y: parseInt(0.01 * im.height(), 10)
					}, {
						x: parseInt(0.50 * im.width(), 10),
						y: parseInt(0.99 * im.height(), 10)
					}
				];

				var blurred = im.copy();
				blurred.gaussianBlur();

				if(produce_intermediary_states) {
					original = blurred.copy();
					state_change_callback(SUGGESTION_ALGORITM_STATES.LOAD, original);
				}

				var cardBaseColor = [0, 0, 0];
				cardBaseColorPoints.forEach(function(point) {
					var color = blurred.pixel(point.y, point.x);
					//console.log(color);
					cardBaseColor[0] += color[0] / cardBaseColorPoints.length;
					cardBaseColor[1] += color[1] / cardBaseColorPoints.length;
					cardBaseColor[2] += color[2] / cardBaseColorPoints.length;
				});

				var cardBaseColorGray = cardBaseColor[0];
				cardBaseColorGray += cardBaseColor[1];
				cardBaseColorGray += cardBaseColor[2];
				cardBaseColorGray /= 3;

				// Convert the image to a grayscale image.
				im.convertGrayscale();
				// Make it binary black or white based on how much it looks like
				// the image background.
				for(var r = 0; r < blurred.height(); r++) {
					var row = blurred.pixelRow(r);
					for(var c = 0; c < blurred.width(); c++) {
						var rowOffset = c*3;
						var color = [
							row[rowOffset],
							row[rowOffset+1],
							row[rowOffset+2]
						];
						var colorDifference = Math.abs(cardBaseColor[0] - color[0]);
						colorDifference += Math.abs(cardBaseColor[1] - color[1]);
						colorDifference += Math.abs(cardBaseColor[2] - color[2]);
						if(colorDifference < parameters.card_similary_threshold) {
							im.pixel(r, c, [cardBaseColorGray]);
						} else {
							im.pixel(r, c, [0.0]);
						}
					}
				}

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

				var CV_RETR_LIST = 1;
				var CV_RETR_CCOMP = 2;
				var CV_RETR_TREE = 3;
				contours = im.findContours(CV_RETR_CCOMP);
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

					var contourHierarchy = contours.hierarchy(i);
					var outerContour = contourHierarchy[3] == -1;

					var contour_area = contours.area(i);
					// Looking at the convex hull of the contour.
					contours.convexHull(i);
					var hull_area = contours.area(i);

					var solidity = contour_area/hull_area;

					var area_too_small_or_big = hull_area < minArea || hull_area > maxArea;
					var not_solid_enough = solidity < parameters.solidity_threshold;

					if(produce_intermediary_states) {
						var contour_colour;
						if(!outerContour) {
							contour_colour = GRAY;
						} else if(area_too_small_or_big) {
							contour_colour = RED;
						} else if(not_solid_enough) {
							console.log(solidity);
							contour_colour = BLUE;
						} else {
							contour_colour = GREEN;
						}
						contours_hull_out.drawContour(contours, i, contour_colour, 3);
					}

					// Is the area too small?
					if(!outerContour || area_too_small_or_big || not_solid_enough) {
						continue;
					}

					/*
					var boundingRect = contours.boundingRect(i);
					boundingRect.x /= im.width();
					boundingRect.y /= im.height();
					boundingRect.width /= im.width();
					boundingRect.height /= im.height();
					*/
					var minAreaRect = contours.minAreaRect(i);

					var center_x = minAreaRect.points[0].x;
					var center_y = minAreaRect.points[0].y;
					center_x += minAreaRect.points[1].x;
					center_y += minAreaRect.points[1].y;
					center_x += minAreaRect.points[2].x;
					center_y += minAreaRect.points[2].y;
					center_x += minAreaRect.points[3].x;
					center_y += minAreaRect.points[3].y;
					center_x /= 4;
					center_y /= 4;

					var turnedOnSide = false;
					if(minAreaRect.angle > 45) {
						minAreaRect.angle -= 90;
						turnedOnSide = true;
					} else if(minAreaRect.angle < -45) {
						minAreaRect.angle += 90;
						turnedOnSide = true;
					}

					if(turnedOnSide) {
						var tmp = minAreaRect.size.width;
						minAreaRect.size.width = minAreaRect.size.height;
						minAreaRect.size.height = tmp;
					}

					var selection = {
						center_x: center_x,
						center_y: center_y,
						width: minAreaRect.size.width,
						height: minAreaRect.size.height,
						// We use radians.
						rotation: 0-minAreaRect.angle / 360 * Math.PI * 2
					};

					selection.center_x /= im.width();
					selection.center_y /= im.height();
					selection.width /= im.width();
					selection.height /= im.height();

					// Taking off 2.5% on each side - we fit in most cases.
					selection.width *= parameters.post_scale;
					selection.height *= parameters.post_scale;

					suggestions.push(selection);
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
};