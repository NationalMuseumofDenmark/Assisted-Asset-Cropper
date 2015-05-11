(function() {
	angular
	.module('cropper')
	.controller('assetCtrl', ['$scope', '$state', '$stateParams', '$http', 'cip', 'asset',
		function($scope, $state, $stateParams, $http, cip, asset) {
			$scope.catalog_alias = $stateParams.catalog_alias;
			$scope.asset_id = $stateParams.asset_id;

			$scope.asset = asset;

			$scope.croppings = [];

			// Get all the cropping suggestions.
			var load_suggested_croppings_url = [
				'',
				'asset',
				$scope.catalog_alias,
				$scope.asset_id,
				'suggestions',
				'200'
				].join('/');

			$scope.loadSuggestedCroppings = function() {
				// Fetch all suggested croppings
				$http.get(load_suggested_croppings_url).then(function(response) {
					response.data.forEach( function(selection) {
						$scope.croppings.push(selection);
					} );
				});
			};

			// Call this right away.
			$scope.loadSuggestedCroppings();

			var save_croppings_url = [
				'',
				'asset',
				$scope.catalog_alias,
				$scope.asset_id,
				'croppings',
				'save'
				].join('/');

			$scope.saveCroppings = function() {
				console.log("Saving croppings!");
				$http.post(save_croppings_url, {
					croppings: $scope.croppings
				}).then(function(response) {
					console.log("Success!", response);
					$scope.showMessage( 'success', [
						'Det lykkedes at gemme ',
						$scope.croppings.length,
						' friskæringer af "',
						$scope.asset.metadata.filename,
						'" (#',
						$scope.asset_id,
						' i ',
						$scope.catalog_alias,
						' kataloget)'
					] );
				}, function(response) {
					var message = [
						'Der opstod en uventet fejl, da friskæringerne af "',
						$scope.asset.metadata.filename,
						'" (#',
						$scope.asset_id,
						' i ',
						$scope.catalog_alias,
						' kataloget) skulle gemmes.'
					];
					if(response.data && response.data.message) {
						message.push(' (');
						message.push(response.data.message);
						message.push(')');
					}
					// TODO: Include response.message if it is defined.
					$scope.showMessage( 'danger', message );
				});
			};

			$scope.selectCropping = function(cropping) {
				$scope.$broadcast('selectSelection', {selection: cropping});
			};

			$scope.removeCropping = function(cropping) {
				$scope.$broadcast('removeSelection', {selection: cropping});
			};

			function reflect(e, args) {
				// If this was emitted by a child scope of ours.
				if(e.targetScope.$parent === $scope) {
					// Reflect this back to all children.
					$scope.$broadcast(e.name, args);
				}
			}

			// When the image selection changes.
			$scope.$on('selectSelectionChanged', reflect);

			$scope.$on('imageUpdated', function(e, args) {
				$scope.image = args.image;
			});
	}])
	.directive('croppingThumbnail', function() {
		var THUMBNAIL_SIZE = 100;

		return {
			restrict: 'E',
			templateUrl: 'templates/partials/cropping-thumbnail.html',
			controller: ['$scope', function($scope) {
				function updateThumbnail() {
					// Don't do anything before the image has loaded.
					if(!$scope.$parent.image || !$scope.$parent.image.loaded) {
						console.log('updateThumbnail returned as no image was loaded.');
						return;
					}

					var large_thumbnail = {
						width: $scope.image.width,
						height: $scope.image.height
					};

					var cropping_width_px = $scope.cropping.width * large_thumbnail.width;
					var cropping_height_px = $scope.cropping.height * large_thumbnail.height;

					var aspect_ratio = cropping_width_px / cropping_height_px;

					var zoom_factor;
					if(aspect_ratio > 1.0) {
						zoom_factor = cropping_width_px / THUMBNAIL_SIZE;
					} else {
						zoom_factor = cropping_height_px / THUMBNAIL_SIZE;
					}

					var thumbnail_width;
					var thumbnail_height;
					if(aspect_ratio > 1.0) {
						thumbnail_width = THUMBNAIL_SIZE;
						thumbnail_height = thumbnail_width / aspect_ratio;
					} else {
						thumbnail_height = THUMBNAIL_SIZE;
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

					$scope.cropping_thumbnail_container = {
						width: thumbnail_width,
						height: thumbnail_height,
						margin: {
							top: thumbnail_margin_vertical,
							bottom: thumbnail_margin_vertical,
							left: thumbnail_margin_horizontal,
							right: thumbnail_margin_horizontal
						}
					};

					var rotate = $scope.cropping.rotation / Math.PI / 2 * 360;
					var left = (($scope.cropping.center_x-$scope.cropping.width/2) * large_thumbnail.width) / zoom_factor;
					var top = (($scope.cropping.center_y-$scope.cropping.height/2) * large_thumbnail.height) / zoom_factor;

					var transform_origin_x = (left+thumbnail_width/2)+ 'px';
					var transform_origin_y = (top+thumbnail_height/2)+ 'px';

					$scope.cropping_thumbnail = {
						width: large_thumbnail.width / zoom_factor,
						height: large_thumbnail.height / zoom_factor,
						left: 0-left,
						top: 0-top,
						transform: 'rotate('+rotate+'deg)',
						transform_origin: transform_origin_x+' '+transform_origin_y
					};
				}
				$scope.$watch('cropping.center_x', updateThumbnail);
				$scope.$watch('cropping.center_y', updateThumbnail);
				$scope.$watch('cropping.width', updateThumbnail);
				$scope.$watch('cropping.height', updateThumbnail);
				$scope.$watch('cropping.rotation', updateThumbnail);
				$scope.$parent.$watch('image', updateThumbnail);
				$scope.$on('selectSelectionChanged', function(e, args) {
					$scope.cropping.selected = $scope.cropping === args.selection;
				});
				/*
				$scope.$watch('thumbnail.loaded', updateThumbnail);
				$(window).on('resize', $scope.$apply);
				*/
			}],
			controllerAs: 'cropping_thumbnail'
		};
	});
	/*
	.directive('assetThumbnailOnload', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				function updateThumbnailDimensions() {
					scope.$apply(function() {
						scope.thumbnail.width = element.width();
						scope.thumbnail.height = element.height();
						scope.thumbnail.loaded = true;
					});
				}
				element.bind('load', updateThumbnailDimensions);
				$(window).bind('resize', updateThumbnailDimensions);
			}
		};
	});
	*/
})();