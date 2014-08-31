(function($) {

	var NatMusConfig = {
		endpoint: "http://cumulus.natmus.dk/CIP/",
		constants: {
				catch_all_alias: "any",
				layout_alias: "web"
		},
		catalog_aliases: {
			"Alle": "ALL",
			"Antiksamlingen": "AS",
			"Bevaringsafdelingen": "BA",
			"Danmarks Middelalder og Renæssance": "DMR",
			"Danmarks Nyere Tid": "DNT",
			"Etnografisk samling": "ES",
			"Frihedsmuseet": "FHM",
			"Den Kgl. Mønt- og Medaljesamling": "KMM",
			"Musikmuseet": "MUM"
		}
	};

	cip = new CIPClient(NatMusConfig);
	cip.jsessionid = CIP_JSESSIONID;

	var SUGGESTION_THUMBNAIL_SIZE = 90;

	var $canvas;

	function update_suggestion_thumbnail($suggestion) {
		var suggestion = $suggestion.data("suggestion");
		console.log(suggestion);
		var thumbnail_src = "/asset/" +
			CATALOG_ALIAS + "/" +
			ASSET_ID + "/crop/" +
			suggestion.left + ":" +
			suggestion.top + ":" +
			suggestion.width + ":" +
			suggestion.height + "/" + SUGGESTION_THUMBNAIL_SIZE + "/stream";
		$suggestion.
			find("img").
			attr("src", thumbnail_src);
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
			y2: suggestion.top + suggestion.height,
		}
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
		var $image = $canvas.find("img");
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
		$(".suggestion.editing").removeClass("editing");
		$canvas.removeClass("editing");
		var area_selection = $canvas.data('area_selection');
		if(area_selection) {
			area_selection.cancelSelection();
		}
	}

	function add_new_suggestion(suggestion) {
		var $suggestion = $("<div>").
			addClass("suggestion").
			data("suggestion", suggestion);

		var $controls = $("<div>").
			addClass("controls").
			appendTo($suggestion);

		var $edit_button = $("<button>").
			addClass("btn btn-primary btn-xs").
			html("<span class='glyphicon glyphicon-move'></span> Tilpas").
			appendTo($controls);

		var $download_button = $("<button>").
			addClass("btn btn-primary btn-xs").
			html("<span class='glyphicon glyphicon-download'></span> Download").
			appendTo($controls);

		var $delete_button = $("<button>").
			addClass("btn btn-primary btn-xs").
			html("<span class='glyphicon glyphicon-trash'></span> Fjern").
			appendTo($controls);

		var $arrow = $("<div>").
			addClass("arrow").
			html("<span class='glyphicon glyphicon-arrow-right'></span>").
			appendTo($suggestion);

		var $outline = $("<div>").
			addClass("outline").
			data("$suggestion", $suggestion).
			appendTo($canvas.find(".outlines"));
		update_outline_position($outline);
		$suggestion.
			data("$outline", $outline);

		var $image = $("<img>").
			load(function() {
				$(this).fadeIn();
			}).
			each(function(){
				// Trigger load event if already loaded.
				if(this.complete) {
					$(this).trigger('load');
				}
			}).
			appendTo($suggestion).
			hide();
		update_suggestion_thumbnail($suggestion);

		// Bring in the dynamics!
		var $both = $suggestion.add($outline);
		$both.
			mouseenter({
				$both: $both,
			}, function( e ) {
				e.data.$both.addClass("hover");
			}).
			mouseleave({
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
			$outline = $suggestion.data("$outline");
			$suggestion.add($outline).fadeOut(function() {
				$(this).remove();
			});
		});

		// Clicking the outline
		$outline.click({
			$suggestion: $suggestion
		}, function( e ) {
			// Enter edit mode on the suggestion.
			enter_edit_suggestion_mode( e.data.$suggestion );
		});

		// Add this to the suggestions.
		$suggestions.append( $suggestion );
	}

	// On document ready
	$(function() {
		var suggestions_url = location.origin + "/asset/" +
			CATALOG_ALIAS + "/" +
			ASSET_ID + "/suggestions/90";
		$canvas = $(".canvas");

		$("#back").click(function() {
			window.history.back();
		});

		$(".container").click(function() {
			leave_edit_suggestion_mode();
		}).find(".canvas").click(function( e ) {
			e.stopPropagation();
		});

		$("#add-suggestion-button").click(function() {
			add_new_suggestion( {
				left: 0.25,
				top: 0.25,
				width: 0.5,
				height: 0.5
			} );
		});

		$.ajax(suggestions_url, {
			success: function(suggestions) {
				$suggestions = $(".suggestions").empty();
				for(s in suggestions) {
					var suggestion = suggestions[s];
					add_new_suggestion( suggestion );
				}
			}
		});
	});

})(jQuery);