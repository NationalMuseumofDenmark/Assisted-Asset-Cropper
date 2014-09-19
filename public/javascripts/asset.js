(function($) {

	var SUGGESTION_THUMBNAIL_SIZE = 100;

	var $canvas;

	function update_suggestion_thumbnail($suggestion) {
		// TODO: Consider simply cropping this out of the full asset thumbnail.
		// as this is a lot less stressful for the CIP when editing.
		var $asset = $("#asset");
		var suggestion = $suggestion.data("suggestion");
		var $image = $suggestion.find(".image");

		var suggestion_width_px = suggestion.width * $asset.width();
		var suggestion_height_px = suggestion.height * $asset.height();
		var aspect_ratio = suggestion_width_px / suggestion_height_px;

		var zoom_factor;
		if(aspect_ratio > 1.0) {
			zoom_factor = suggestion_width_px / SUGGESTION_THUMBNAIL_SIZE;
		} else {
			zoom_factor = suggestion_height_px / SUGGESTION_THUMBNAIL_SIZE;
		}

		var thumbnail_width;
		var thumbnail_height;
		if(aspect_ratio > 1.0) {
			thumbnail_width = SUGGESTION_THUMBNAIL_SIZE;
			thumbnail_height = thumbnail_width / aspect_ratio;
		} else {
			thumbnail_height = SUGGESTION_THUMBNAIL_SIZE;
			thumbnail_width = thumbnail_height * aspect_ratio;
		}
		var thumbnail_margin = Math.abs(thumbnail_width - thumbnail_height) / 2.0;
		var thumbnail_margin_vertical = 0;
		var thumbnail_margin_horizontal = 0;
		if(aspect_ratio > 1.0) {
			thumbnail_margin_vertical = thumbnail_margin;
		} else {
			thumbnail_margin_horizontal = thumbnail_margin;
		}

		var thumbnail_src = $asset.attr('src');

		$image
			.css({
				'width': thumbnail_width,
				'height': thumbnail_height,
				'margin-top': thumbnail_margin_vertical,
				'margin-bottom': thumbnail_margin_vertical,
				'margin-left': thumbnail_margin_horizontal,
				'margin-right': thumbnail_margin_horizontal
			})
			.find("img")
			.css({
				'width': $asset.width() / zoom_factor,
				'height': $asset.height() / zoom_factor,
				'top': -(suggestion.top * $asset.height()) / zoom_factor,
				'left': -(suggestion.left * $asset.width()) / zoom_factor
			})
			.attr("src", thumbnail_src);
	}

	function update_outline_position($outline) {
		var suggestion = $outline.data("$suggestion").data("suggestion");
		$outline.css({
			left: suggestion.left * 100 + "%",
			top: suggestion.top * 100 + "%",
			width: suggestion.width * 100 + "%",
			height: suggestion.height * 100 + "%"
		});
	}

	function set_selection_from_suggestion($image, area_selection, $suggestion) {
		var suggestion = $suggestion.data("suggestion");
		var options = {
			x1: suggestion.left,
			y1: suggestion.top,
			x2: suggestion.left + suggestion.width,
			y2: suggestion.top + suggestion.height
		};
		options.x1 *= $image.width();
		options.y1 *= $image.height();
		options.x2 *= $image.width();
		options.y2 *= $image.height();
		area_selection.setOptions(options);
	}

	function set_suggestion_from_selection($image, $suggestion, selection) {
		var suggestion = {
			left: selection.x1 / $image.width(),
			top: selection.y1 / $image.height(),
			width: selection.width / $image.width(),
			height: selection.height / $image.height()
		};
		$suggestion.data("suggestion", suggestion);
	}

	function enter_edit_suggestion_mode( $suggestion ) {
		// Leave any edit mode that we are in.
		leave_edit_suggestion_mode();
		// What outline fits our selected suggestion?
		var $outline = $suggestion.data("$outline");
		$suggestion.addClass("editing");
		$canvas.addClass("editing");
		var $image = $canvas.find("#asset");
		var area_selection = $image.imgAreaSelect({
			instance: true,
			fadeSpeed: 100,
			imageWidth: $image.width,
			imageHeight: $image.height,
			onSelectEnd: function(img, selection) {
				if(selection.width === 0 && selection.height === 0) {
					leave_edit_suggestion_mode();
				} else {
					var $image = $(img);
					var $suggestion = $(".suggestion.editing");
					var $outline = $suggestion.data("$outline");
					set_suggestion_from_selection($image, $suggestion, selection);
					update_suggestion_thumbnail($suggestion);
					update_outline_position($outline);
				}
			}
		});
		set_selection_from_suggestion($image, area_selection, $suggestion);
		$canvas.data('area_selection', area_selection);
	}

	function leave_edit_suggestion_mode() {
		// Update the suggestion that we might be currently editing.
		var $suggestion = $(".suggestion.editing");

		$suggestion.removeClass("editing");
		$canvas.removeClass("editing");
		var area_selection = $canvas.data('area_selection');
		if(area_selection) {
			area_selection.cancelSelection();
		}
	}

	function save_croppings( callback ) {
		var croppings = [];
		$suggestions = $("#suggestions .suggestion");
		$croppings = $("#croppings .cropping");

		$suggestions.each(function() {
			var suggestion = $(this).data('suggestion');
			croppings.push(suggestion);
		});

		var save_croppings_url = "/asset/" +
			CATALOG_ALIAS + "/" +
			ASSET_ID + "/croppings/save";

		$.ajax(save_croppings_url, {
			type: 'POST',
			data: {
				croppings: croppings
			},
			success: callback
		});
	}

	function add_new_suggestion(suggestion) {
		$suggestions = $("#suggestions");
		if($suggestions.find('.suggestion').length == 0) {
			// Empty the #suggestions container
			$suggestions.empty();
		}
		
		var $suggestion = $("<div>")
			.addClass("suggestion")
			.data("suggestion", suggestion)
			.html("&nbsp;"); // Prevents the div from expanding when the img loads.

		var $controls = $("<div>")
			.addClass("controls")
			.appendTo($suggestion);

		var $edit_button = $("<button>")
			.addClass("btn btn-primary btn-xs")
			.html("<span class='glyphicon glyphicon-move'></span> Tilpas")
			.appendTo($controls);

		var $delete_button = $("<button>")
			.addClass("btn btn-primary btn-xs")
			.html("<span class='glyphicon glyphicon-trash'></span> Fjern")
			.appendTo($controls);

		var $download_button = $("<button>")
			.addClass("btn btn-primary btn-xs")
			.html("<span class='glyphicon glyphicon-download'></span> Download")
			.appendTo($controls);

		var $arrow = $("<div>")
			.addClass("arrow")
			.html("<span class='glyphicon glyphicon-arrow-right'></span>")
			.appendTo($suggestion);

		var $outline = $("<div>")
			.addClass("outline")
			.data("$suggestion", $suggestion)
			.appendTo($canvas.find(".outlines"));
		update_outline_position($outline);
		$suggestion
			.data("$outline", $outline);

		var $image = $("<div>")
			.addClass("image")
			.appendTo($suggestion);
		var $thumbnail_image = $("<img>");
		$image.append("<img>");

		update_suggestion_thumbnail($suggestion);

		// Bring in the dynamics!
		var $both = $suggestion.add($outline);
		$both
			.mouseenter({
				$both: $both,
			}, function( e ) {
				e.data.$both.addClass("hover");
			})
			.mouseleave({
				$both: $suggestion.add($outline),
			}, function( e ) {
				e.data.$both.removeClass("hover");
			});

		// Clicking the download button.
		$download_button.click(function( e ) {
			var suggestion = $(e.target).closest(".suggestion").data("suggestion");
			var download_url = "/asset/"+
				CATALOG_ALIAS + "/" +
				ASSET_ID + "/crop/" +
				suggestion.left + ":" +
				suggestion.top + ":" +
				suggestion.width + ":" +
				suggestion.height + "/maximal/download";
			window.open(download_url);
		});

		$edit_button.click(function( e ) {
			var $suggestion = $(e.target).closest(".suggestion");
			enter_edit_suggestion_mode($suggestion);
			e.stopPropagation();
		});

		$delete_button.click(function( e ) {
			var $suggestion = $(e.target).closest(".suggestion");
			remove_suggestion($suggestion);
		});

		// Clicking the outline
		$outline.click({
			$suggestion: $suggestion
		}, function( e ) {
			// Enter edit mode on the suggestion.
			enter_edit_suggestion_mode( e.data.$suggestion );
		});

		// Add this to the suggestions.
		$suggestions.prepend( $suggestion );

		return $suggestion;
	}

	function remove_suggestion($suggestion) {
		$outline = $suggestion.data("$outline");
		$suggestion.add($outline).fadeOut(function() {
			$(this).remove();
		});
	}

	function show_algorithm_state(s) {
		leave_edit_suggestion_mode();
		var $asset = $("#asset");
		var $algorithm_states = $("#asset-algorithm-states");
		var $algorithm_state_image = $algorithm_states.find("img");
		$algorithm_state_image.css('top', -1 * s * $asset.height());
		$algorithm_states.show();
		$(".outlines").hide();
	}

	function hide_algorithm_state() {
		var $algorithm_states = $("#asset-algorithm-states");
		$algorithm_states.hide();
		$(".outlines").show();
	}

	function calculate_algorithm_state_count() {
		var $asset = $("#asset");
		var asset_height = $asset.get(0).naturalHeight;
		var $algorithm_state_image = $("#asset-algorithm-states img");
		var algorithm_state_image_height = $algorithm_state_image.get(0).naturalHeight;
		var result = Math.ceil(algorithm_state_image_height / asset_height);
		// console.log(asset_height, algorithm_state_image_height, result);
		return result;
	}

	// On window load - with every image.
	$(window).load(function() {

		$("#overview-btn").click(function() {
			location.href = "/overview";
		});

		// If the delete key is pressed while a suggestion is selected,
		// it will get removed.
		$(document.body).keypress(function(e) {
			console.log(e);
			if(e.charCode == 127) { // Delete button
				$(".suggestion.editing").each(function() {
					leave_edit_suggestion_mode();
					$suggestion = $(this);
					remove_suggestion($suggestion);
				});
			}
		});

		var suggestions_url = "/asset/" +
			CATALOG_ALIAS + "/" +
			ASSET_ID + "/suggestions/80";
		$canvas = $(".canvas");

		$(".container").click(function() {
			leave_edit_suggestion_mode();
		}).find(".canvas").click(function( e ) {
			e.stopPropagation();
		});

		$("#add-suggestion-button").click(function( e ) {
			$suggestion = add_new_suggestion( {
				left: 0.25,
				top: 0.25,
				width: 0.5,
				height: 0.5
			} );
			enter_edit_suggestion_mode($suggestion);
			e.stopPropagation();
		});

		$("#save-croppings-button").click(function(e) {
			$("#save-croppings-button").addClass("disabled");
			save_croppings(function() {
				location.reload();
			});
		});

		$("#fetch-suggestions").click(function() {
			$.ajax(suggestions_url, {
				success: function(suggestions) {
					for(s in suggestions) {
						var suggestion = suggestions[s];
						add_new_suggestion( suggestion );
					}
				}
			});
		});

		if(CROPPING_STATUS === 1) {
			// Fetch suggestions automatically.
			$("#fetch-suggestions").trigger('click');
		}

		var state_count = calculate_algorithm_state_count();
		// Remove anything that is already there.
		console.log("state_count:", state_count);

		$("#state-controls").empty();
		// Iterate through the states.
		for(s = 0; s < state_count; s++) {
			var $link = $("<a>")
				.text(s + 1)
				.on('mouseenter', {state: s}, function(e) {
					var s = e.data.state;
					show_algorithm_state(s);
				})
				.on('mouseleave', function(e) {
					hide_algorithm_state();
				});
			$("<li>")
				.append($link)
				.appendTo("#state-controls");
		}
	});
})(jQuery);