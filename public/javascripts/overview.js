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
	//var MAX_ASSETS_PR_ROW = 6;
	var MAXIMAL_ASSET_HEIGHT_PX = 200;
	var ASSET_MARGIN = (5 + 3 + 1)*2; // Margin, padding and border
	var ASSET_CONTAINER_PADDING = 10*2;
	var THUMBNAIL_MAX_SIZE = 500;

	// var ASSET_COL_WIDTH = parseInt(12 / ASSETS_PR_ROW);

	var HORIZONTAL_RESOLUTION_FIELD = "{af4b2e11-5f6a-11d2-8f20-0000c0e166dc}";
	var VERTICAL_RESOLUTION_FIELD = "{af4b2e12-5f6a-11d2-8f20-0000c0e166dc}";
	var CROPPING_STATUS_FIELD = "{bf7a30ac-e53b-4147-95e0-aea8c71340ca}";
	var ORIGINAL_FIELD = "{aed8e1c4-7b24-41dc-a13d-f1e3bf3276b2}";

	var asset_search_result;
	var asset_search_result_pointer;

	var asset_buffer = [];

	function generate_querystring( search_term ) {
		var result = "";
		//result += CROPPING_STATUS_FIELD + ' "has value"';
		//result += ORIGINAL_FIELD + ' == 1'; // 1 == 'Papirfoto'
		//result += CROPPING_STATUS_FIELD + ' "has no value"';
		//result += " AND ";
		result += CROPPING_STATUS_FIELD + ' == 1'; // 1 == 'Skal friskæres'
		return result;
	}

	function fetch_search_result( catalog_alias, search_term, callback ) {
    var catalog = new CIPCatalog(this, { alias: catalog_alias });
		var table = new cip_table.CIPTable(cip, catalog, "AssetRecords");

		var query_string = generate_querystring( search_term );

		cip.advancedsearch(
			table,
			query_string,
			search_term,
			CROPPING_STATUS_FIELD+":descending",
			callback,
			function( response ) {
				console.error("Woups - an error occurred when fetching search result.", response);
				redirect_if_unauthorized_handler( this );
			}
		);
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

	function load_cropping_suggestions( $asset ) {
		$spinner = $("<div>").
			addClass("loading-spinner").
			appendTo($asset);
		var asset = $asset.data('asset');
		var catalog_alias = $asset.data('catalog_alias');
		var suggestions_url = "/asset/" +
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
					// suggestion = scale_suggestion_to_square(suggestion, aspect_ratio);
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

	function calculate_accumulated_aspect_ratio($assets_in_row) {
		var accumulated_aspect_ratio = 0;
		$assets_in_row.each(function() {
			var image = $("img", this).get(0);
			var width = image.naturalWidth;
			var height = image.naturalHeight;
			var aspect_ratio = width / height;
			accumulated_aspect_ratio += aspect_ratio;
		});
		return accumulated_aspect_ratio;
	}

	function calculate_row_height($assets_in_row) {
		var accumulated_aspect_ratio = calculate_accumulated_aspect_ratio($assets_in_row);
		// Calculate the inner with of the row's container.
		var $container = $assets_in_row.parent();
		var container_width = $container.innerWidth();
		// Subtract the inner padding of the container.
		container_width -= ASSET_CONTAINER_PADDING;
		// Return the height that the row will have to be able to fit.
		return container_width / accumulated_aspect_ratio;
	}

	function update_asset_size($container) {
		var $current_row_assets = $();
		$container.find(".asset:not(.resized)").each(function() {
			var $asset = $(this);
			// Add this asset to the selection.
			$current_row_assets = $current_row_assets.add($asset);
			var current_row_height = calculate_row_height($current_row_assets);
			if(current_row_height+ASSET_MARGIN < MAXIMAL_ASSET_HEIGHT_PX) {
				$current_row_assets.each(function() {
					var image = $("img", this).get(0);
					var scale = current_row_height / image.naturalHeight;
					$(this).css({
						width: image.naturalWidth * scale,
						height: image.naturalHeight * scale
					}).addClass('resized');
				}).fadeIn();

				// Reset.
				$current_row_assets = $();
			}
		});
	}

	function load_more_assets( result, $result_container, is_this_enough_callback ) {
		// The list of current assets.
		$assets = $result_container.find(ASSET_CLASS);
		// Do we need more?
		if(is_this_enough_callback( $assets ) === false && $assets.length < result.total_rows) {
			// One more, please
			get_next_asset( result, function(asset) {
				if(asset !== null) {
					var cropping_status = asset.fields[CROPPING_STATUS_FIELD];

					var url = ["/asset", result.catalog.alias, asset.fields.id].join("/");
					var image_url = asset.get_thumbnail_url( { maxsize: THUMBNAIL_MAX_SIZE }, true );
					// var image_url = asset.get_thumbnail_url();
					var classes = (cropping_status && cropping_status.id === 1) ? "needs-cropping" : "";
					var metadata_text = cropping_status ? cropping_status.displaystring : "";

					$asset = $(get_template('overview-asset')({
						url: url,
						image_url: image_url,
						classes: classes,
						metadata_text: metadata_text
					}));

					$asset_suggestions = $asset.find(".suggestions");
					$asset_metadata = $asset.find(".metadata");

					$asset.data('asset', asset);
					$asset.data('catalog_alias', result.catalog.alias);

					// Hide the asset, until it is resized to fit a row.
					$asset.hide();
					$asset.find("img").
						load( function( e ) {
							var loaded = $(this).data('loaded');
							if(!loaded) {
								var $asset = $( e.target ).closest('.asset');
								var asset = $asset.data('asset');
								var cropping_status = asset.fields[CROPPING_STATUS_FIELD];
								if(!cropping_status || cropping_status.id === 1) {
									// Has to be cropped or has not status.
									load_cropping_suggestions( $asset );
								}
								$(this).data('loaded', true);
								update_asset_size( $asset.parent() );
							}
						}).
						each(function() {
							// Trigger load event if already loaded.
							if(this.complete) {
								$(this).trigger('load');
							}
						});

					$result_container.append( $asset );
					// Reload the result container.
					$result_container = $($result_container.selector, $result_container.context);

					// Keep 'em comming ..
					setTimeout(function() {
						load_more_assets( result, $result_container, is_this_enough_callback );
					}, 1);
				}
			} );
		}
	}

	function assets_are_outside_viewport($assets) {
		var $last_asset = $assets.filter(".resized:last");
		if($last_asset.length > 0) {
			var last_asset_offset = $last_asset.offset();
			var last_asset_top = last_asset_offset.top;
			
			var viewport_height = $(window).height();
			var viewport_scroll_top = $(window).scrollTop();
			var viewport_bottom = viewport_scroll_top + viewport_height;

			return last_asset_top > viewport_bottom;
		} else {
			return false;
		}
	}

	function clear_search_result() {
		$assets_container.empty();
		$assets_container.data('search-result', null);
		asset_buffer = [];
		$(window).unbind('resize scroll');
	}

	window.perform_search = function (search_term, catalog_alias) {
		$assets_container = $('#assets');
		// Remove any old results.
		clear_search_result();
		// TODO: Empty the search result buffers as well.
		$("body").addClass("searching");
		$("body").removeClass("empty-result");
		// Using a setTimeout to give some rendering power to the browser.
		setTimeout(function() {
			// Perform a search.
			fetch_search_result( catalog_alias, search_term, function( result ) {
				// TODO: Display the result.total_rows somewhere ..
				$("body").removeClass("searching");
				if(result.total_rows == 0) {
					$("body").addClass("empty-result");
				}
				// Save the result for later.
				$assets_container.data('search-result', result);
				$(window).on('resize scroll', {$assets_container: $assets_container}, function( e ) {
					var $assets_container = e.data.$assets_container;
					var result = $assets_container.data('search-result');
					// Search result is in.
					load_more_assets( result, $assets_container, assets_are_outside_viewport);
				}).on('resize', {$assets_container: $assets_container}, function(e) {
					// When resizing - forget all the resizings of all loaded assets,
					// and recalculate.
					var $assets_container = e.data.$assets_container;
					$assets_container.find(".asset").removeClass('resized');
					update_asset_size($assets_container);
				}).trigger('scroll');
			} );
		}, 1);
	}

})(jQuery);