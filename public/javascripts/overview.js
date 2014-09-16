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
			"Musikmuseet": "MUM",
			"Cropper": "Cropper"
		}
	};

	cip = get_cip_client_or_redirect();

	var CATALOG_ALIAS = "Cropper";
	var ASSETS_PR_REQUEST = 10;

	var ASSET_CLASS = '.asset';
	var ASSETS_PR_ROW = 6;
	var ASSET_COL_WIDTH = parseInt(12 / ASSETS_PR_ROW);

	var HORIZONTAL_RESOLUTION_FIELD = "{af4b2e11-5f6a-11d2-8f20-0000c0e166dc}";
	var VERTICAL_RESOLUTION_FIELD = "{af4b2e12-5f6a-11d2-8f20-0000c0e166dc}";
	var CROPPING_STATUS_FIELD = "{bf7a30ac-e53b-4147-95e0-aea8c71340ca}";
	var ORIGINAL_FIELD = "{aed8e1c4-7b24-41dc-a13d-f1e3bf3276b2}";

	var asset_search_result;
	var asset_search_result_pointer;

	var asset_buffer = [];

	function generate_querystring( search_term ) {
		var result = "";
		result += CROPPING_STATUS_FIELD + ' "has value"';
		//result += ORIGINAL_FIELD + ' == 1'; // 1 == 'Papirfoto'
		//result += CROPPING_STATUS_FIELD + ' "has no value"';
		//result += " AND ";
		//result += CROPPING_STATUS_FIELD + ' == 3'; // 1 == 'Skal friskæres'
		return result;
	}

	function fetch_search_result( catalog_alias, search_term, callback ) {
    var catalog = new CIPCatalog(this, { alias: catalog_alias });
		var table = new cip_table.CIPTable(cip, catalog, "AssetRecords");

		var query_string = generate_querystring( search_term );
		cip.criteriasearch(table, query_string, CROPPING_STATUS_FIELD+":descending"/*[CROPPING_STATUS_FIELD + ":descending"]*/, function(result) {
			callback( result );
		});
		/* cip.search(table, search_term, function(result) {
			callback( result );
		}); */
	}

	function get_next_asset( result, callback ) {
		if(typeof(result) !== 'object') {
			console.error( "You should not call get_next_asset before fetch_search_result." );
			return;
		}
		if(typeof(result.pointer) == 'undefined') {
			result.pointer = 0;
		}
		// Is the local buffer of assets empty?
		if(asset_buffer.length == 0) {
			// Download some more asset metadata!
			result.get(ASSETS_PR_REQUEST, result.pointer, function(assets) {
				asset_buffer = assets;
				result.pointer += asset_buffer.length;

				var next_asset = null;
				if(asset_buffer.length > 0) {
					next_asset = asset_buffer.shift();
				}
				callback( next_asset );
			});
		} else {
			callback( asset_buffer.shift() );
		}
	}

	function scale_suggestion_to_square(suggestion, aspect_ratio) {
		if(aspect_ratio > 1.0) {
			width = aspect_ratio;
			height = 1.0;
		} else {
			width = 1.0;
			height = 1.0 / aspect_ratio;
		}
		suggestion.width *= width;
		suggestion.height *= height;
		suggestion.left *= width;
		suggestion.top *= height;
		// Subtract one half of what is outside the image.
		suggestion.left -= (width - 1.0) / 2;
		suggestion.top -= (height - 1.0) / 2;
		return suggestion;
	}

	function load_cropping_suggestions( $asset ) {
		$spinner = $("<div>").
			addClass("loading-spinner").
			appendTo($asset);
		var asset = $asset.data('asset');
		var catalog_alias = $asset.data('catalog_alias');
		var suggestions_url = location.origin + "/asset/" +
			catalog_alias + "/" +
			asset.fields.id + "/suggestions/" +
			200;
		$.ajax(suggestions_url, {
			$spinner: $spinner,
			$asset: $asset,
			asset: asset,
			success: function(suggestions) {
				var aspect_ratio = this.asset.fields[HORIZONTAL_RESOLUTION_FIELD] / this.asset.fields[VERTICAL_RESOLUTION_FIELD];
				var $suggestion_count = $("<span>").
					addClass("suggestion_count")
					.text(suggestions.length);
				this.$asset.find('.metadata').append($suggestion_count);
				for(s in suggestions) {
					var suggestion = suggestions[s];
					suggestion = scale_suggestion_to_square(suggestion, aspect_ratio);
					suggestion.left *= 100;
					suggestion.top *= 100;
					suggestion.width *= 100;
					suggestion.height *= 100;

					var $suggestion = $("<div>").
						addClass('suggestion').
						css({
							left: suggestion.left + "%",
							top: suggestion.top + "%",
							width: suggestion.width + "%",
							height: suggestion.height + "%"
						});
					this.$asset.find('.suggestions').
						append($suggestion);
				}
			},
			complete: function() {
				this.$spinner.hide();
			}
		});
	}

	function load_more_assets( result, $result_container, is_this_enough_callback ) {
		// The list of current assets.
		$assets = $result_container.find(ASSET_CLASS);
		// Do we need more?
		if(is_this_enough_callback( $assets ) === false) {
			// One more, please
			get_next_asset( result, function(asset) {
				if(asset !== null) {
					$asset = $("<a>").
						attr('href', '/asset/' + result.catalog.alias + "/" + asset.fields.id).
						addClass("asset").
						addClass("col-md-" + ASSET_COL_WIDTH);

					$asset_suggestions = $("<div>").
						appendTo($asset).
						addClass("suggestions");

					$asset_metadata = $("<div>").
						appendTo($asset).
						addClass("metadata");

					var cropping_status = asset.fields[CROPPING_STATUS_FIELD];
					// Based on the value of the cropping status field, add classes.
					if(cropping_status && cropping_status.id === 1) {
						$asset.addClass("needs-cropping");
					}
					// Based on the value of the cropping status field, add text.
					if(cropping_status) {
						$asset_metadata.text(cropping_status.displaystring);
					}

					$asset.data('asset', asset);
					$asset.data('catalog_alias', result.catalog.alias);

					$asset_image = $("<img>").
						appendTo($asset).
						attr('src', asset.get_thumbnail_url( {
							size: 140
						}, true )).
						load( function( e ) {
							var $asset = $( e.target ).closest('.asset');
							var asset = $asset.data('asset');
							var cropping_status = asset.fields[CROPPING_STATUS_FIELD];
							if(!cropping_status || cropping_status.id === 1) {
								// Has to be cropped or has not status.
								load_cropping_suggestions( $asset );
							}
						}).
						each(function(){
							// Trigger load event if already loaded.
							if(this.complete) {
								$(this).trigger('load');
							}
						});

					$asset.click(function( e ) {
						var $asset = $( e.target ).closest('.asset');
						var metadata = $asset.data('asset').fields;
						// console.log( metadata );
					});

					$result_container.append( $asset );

					// Keep 'em comming ..
					setTimeout(function() {
						load_more_assets( result, $result_container, is_this_enough_callback );
					}, 1);
				}
			} );
		}
	}

	// On document ready
	$(function() {
		$assets = $('#assets');
		// Perform a search.
		fetch_search_result( CATALOG_ALIAS, "a", function( result ) {
			// Save the result for later.
			$assets.data('search-result', result);
			// Search result is in.
			load_more_assets( result, $assets, function( $assets ) {
				return $assets.length >= 6 * 30;
			} );
		} );
	});

})(jQuery);