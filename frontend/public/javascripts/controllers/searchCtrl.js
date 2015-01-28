(function() {

	var ASSETS_PER_REQUEST = 5;

	var app = angular.module('cropper');

	app.directive('assetloaded', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.bind('load', function() {
					scope.$apply(function() {
						scope.asset.thumbnail_loaded = true;
					});
					// Check that all assets has been loaded.
					var all_assets_loaded = scope.assets.every(function(asset) {
						return asset.thumbnail_loaded;
					});
					if(all_assets_loaded) {
						// Fake a scroll event.
						$(window).scroll();
					}
				});
			}
		};
	});

	// Make sure that at resize event also triggers the infinite scroll.
	$(window).resize(function() {
		$(window).scroll();
	});

	app.controller('searchCtrl', ['$scope', '$http', '$state', '$stateParams', 'cip', 'catalogs',
		function($scope, $http, $state, $stateParams, cip, catalogs) {
		$scope.catalogs = catalogs;
		$scope.empty_result = false;
		$scope.assets = [];
		$scope.result = undefined;
		$scope.result_pointer = 0;

		function performSearch(term, catalog_alias) {
			$scope.is_searching = true;
			cip.search(term, catalog_alias).then(function(result) {
				$scope.is_searching = false;
				$scope.empty_result = result.total_rows === 0;
				if(!$scope.empty_result) {
					$scope.result = result;
					$scope.result_pointer = 0;
				}
			});
		}

		$scope.catalog_alias = $stateParams.catalog_alias;
		$scope.term = $stateParams.term;
		if(!$scope.catalog_alias) {
			var first_catalog_alias;
			for (first_catalog_alias in $scope.catalogs) break;
			$state.go('search', {
				catalog_alias: first_catalog_alias,
				term: $scope.term
			});
		} else {
			// We can start performing an actual search
			performSearch($scope.catalog_alias, $scope.term);
		}

		$scope.search = function() {
			var term = $scope.term,
					catalog_alias = $scope.catalog_alias;
			$state.go('search', {catalog_alias: catalog_alias, term: term});
		};

		$scope.setSelectedCatalog = function(catalog_alias) {
			$scope.catalog_alias = catalog_alias;
			$scope.search();
		};

		$scope.searchTermKeydown = function(keyCode) {
			if(keyCode === 13) {
				$scope.search();
			}
		};

		$scope.loadMoreSearchResult = function() {
			// If the result pointer is less than total rows.
			if($scope.result && $scope.result_pointer < $scope.result.total_rows) {
				$scope.result.get(ASSETS_PER_REQUEST, $scope.result_pointer, function(response) {
					response.forEach(function(new_asset) {
						new_asset.metadata = cip.transformAssetMetadata(new_asset);
						new_asset.loaded = false;
						$scope.assets.push(new_asset);
						$scope.result_pointer += 1;
					});
				});
			}
		};

	}]);
})();