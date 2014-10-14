(function($) {

	$(function() {
		if(typeof(perform_search) !== "function") {
			console.error("The searchbar partial expects a global function called perform_search.");
		}

		function select_catalog($catalog) {
			$catalogSelector = $("#catalog-selector");
			$catalogSelector
				.data("selected-alias", $catalog.data('alias'))
				.find(".loading").hide().end()
				.find(".text .catalog").text($catalog.text());
		}

		function update_catalogs_dropdown(catalogs) {
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
					});
				$catalogItem = $("<li>")
					.attr("role", "presentation")
					.append($catalogAnchor);
				$catalogSelector.append($catalogItem);
			}
			var $firstCatalog = $catalogSelector.find("a[role=menuitem]:first");
			select_catalog( $firstCatalog );
		}

		function pre_perform_search() {
			var search_term = $("#search-term").val();
			$catalogSelector = $("#catalog-selector");
			var catalog_alias = $catalogSelector.data('selected-alias');
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
			// Perform a simple search, in the initially selected catalog and
			// the empty search term.
			pre_perform_search();
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