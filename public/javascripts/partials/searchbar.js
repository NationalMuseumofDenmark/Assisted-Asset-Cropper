(function($) {

	$(function() {
		if(typeof(perform_search) !== "function") {
			console.error("The searchbar partial expects a global function called perform_search.");
		}

		function select_catalog_from_alias(catalog_alias) {
			$catalogSelector = $("ul[aria-labelledby='catalog-selector']");
			$catalogSelector.find("a[role=menuitem]").each(function() {
				var $catalog = $(this);
				if($catalog.data('alias') == catalog_alias) {
					select_catalog($catalog);
				}
			});
		}

		function select_catalog($catalog) {
			$catalogSelector = $("#catalog-selector");
			$catalogSelector
				.data("selected-alias", $catalog.data('alias'))
				.find(".loading").hide().end()
				.find(".text .catalog").text($catalog.text());
		}

		function set_search_location_hash(search_term, catalog_alias) {
			location.hash = catalog_alias + "/" + search_term;
		}

		function check_search_location_hash() {
			var hash = location.hash.substring(1);
			var lastSlashIndex = hash.indexOf("/");
			if(lastSlashIndex >= 0) {
				var catalog_alias = hash.substring(0, lastSlashIndex);
				var search_term = hash.substring(lastSlashIndex + 1);
				// console.log("search_term =", search_term, "catalog_alias =", catalog_alias);
				if(catalog_alias !== "") {
					$("#search-term").val(search_term);
					select_catalog_from_alias(catalog_alias);
					pre_perform_search();
					return true;
				}
			}
			return false;
		}

		function update_catalogs_dropdown(catalogs, select_first) {
			$catalogSelector = $("ul[aria-labelledby='catalog-selector']");
			$catalogSelector.empty();

			for(var c in catalogs) {
				var catalog = catalogs[c];
				$catalogAnchor = $("<a>")
					.attr("role", "menuitem")
					.attr("tabindex", "-1")
					.data("alias", catalog.alias)
					.text(catalog.name)
					.click(function() {
						select_catalog( $(this) );
						pre_perform_search();
					});
				$catalogItem = $("<li>")
					.attr("role", "presentation")
					.append($catalogAnchor);
				$catalogSelector.append($catalogItem);
			}
			if(select_first === true || typeof(select_first) === "undefined") {
				var $firstCatalog = $catalogSelector.find("a[role=menuitem]:first");
				select_catalog( $firstCatalog );
			}
		}

		function pre_perform_search() {
			var search_term = $("#search-term").val();
			$catalogSelector = $("#catalog-selector");
			var catalog_alias = $catalogSelector.data('selected-alias');
			set_search_location_hash(search_term, catalog_alias);
			perform_search(search_term, catalog_alias);
		}

		cip.get_catalogs(function(catalogs) {
			// Add an option for any catalog.
			/*
			catalogs = [{
				name: "All catalogs",
				alias: cip.config.constants.catch_all_alias
			}].concat(catalogs);
			*/
			// Update the catalogs dropdown menu items.
			update_catalogs_dropdown(catalogs);
			// Check the location hash, to see if the URL refers to
			// a concrete search.
			var had_location_hash = check_search_location_hash();
			// Perform a simple search, in the initially selected catalog and
			// the empty search term.
			if(had_location_hash !== true) {
				pre_perform_search();
			}
			$("#search-term").keyup(function(e) {
				if(e.keyCode == 13) {
					pre_perform_search();
				}
			});
			$("#search-button").click(pre_perform_search);
		}, function() {
			redirect_if_unauthorized_handler(this);
		});
	});

})(jQuery);