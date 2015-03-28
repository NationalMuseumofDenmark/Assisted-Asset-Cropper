(function() {
	angular
	.module('cropper')
	.controller('assetCtrl', ['$scope', '$state', '$stateParams', '$http', 'cip', 'asset',
		function($scope, $state, $stateParams, $http, cip, asset) {
			$scope.catalog_alias = $stateParams.catalog_alias;
			$scope.asset_id = $stateParams.asset_id;

			$scope.asset = asset;
			$scope.thumbnail = {
				loaded: false,
				width: 1000, // Fake it, till we load it.
				height: 1000,
				url: asset.get_thumbnail_url()
			};

			$scope.croppings = [];
			$scope.cropping_selected = false;

			$scope.handle_padding = 5;
			$scope.rotational_handle_radius = 10;
			$scope.rotational_handle_length = 30;

			function cropping(location) {
				this.center_x = location.center_x;
				this.center_y = location.center_y;
				this.width = location.width;
				this.height = location.height;
				this.rotation = location.rotation;

				var valid_center_x = this.center_x >= 0 && this.center_x <= 1;
				var valid_center_y = this.center_y >= 0 && this.center_y <= 1;
				var valid_width = this.width >= 0 && this.width <= 1;
				var valid_height = this.height >= 0 && this.height <= 1;
				if(valid_center_x && valid_center_y && valid_width && valid_height) {
					$scope.croppings.push(this);
				} else {
					throw new Error("Trying to create an invalid cropping.");
				}
			}

			function deselectCroppings() {
				$scope.croppings.forEach(function(cropping) {
					cropping.deselect();
				});
			}

			function removeSelectedCropping() {
				$scope.croppings.forEach(function(cropping) {
					if(cropping.selected) {
						cropping.remove();
					}
				});
			}

			cropping.prototype.select = function() {
				deselectCroppings();
				$scope.cropping_selected = true;
				this.selected = true;
			};

			cropping.prototype.deselect = function() {
				$scope.cropping_selected = false;
				this.selected = false;
			};

			cropping.prototype.remove = function() {
				this.deselect();
				var to_be_removed = this;
				$scope.croppings = $scope.croppings.filter(function(cropping) {
					return cropping !== to_be_removed;
				});
			};

			cropping.prototype.grabOutlineHandle = function(direction) {
				var to_be_grabbed = this;
				$scope.croppings.forEach(function(cropping) {
					if(cropping === to_be_grabbed) {
						// Let's wait for outline to create itself, if this was
						// called, just after creating the cropping.
						setTimeout(function() {
							cropping.outline.handleGrabbed(direction);
						}, 1);
					}
				});
			};

			$scope.dragCreateCropping = function(x, y) {
				$scope.dragging_canvas = false;
				var location = {
					center_x: x,
					center_y: y,
					width: 0,
					height: 0,
					rotation: 0
				};
				var c = new cropping(location);
				c.select();
				c.grabOutlineHandle('south-east');
			};

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
					response.data.forEach( function(location) {
						new cropping(location);
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

			$(window).keypress(function(e) {
				if(e.keyCode === 127) { // The 'Delete' button
					removeSelectedCropping();
				}
			});

			// When clicking anywhere inside the canvas, don't propagate.
			$("#canvas, #suggestions, #outlines").click(function(e) {
				e.stopPropagation();
			});
			// When clicking anywhere outside the canvas, deselect all croppings.
			$(document.body).click(function() {
				$scope.$apply(function() {
					deselectCroppings();
				});
			});
	}])
	.directive('croppingOutline', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/partials/cropping-outline.html',
			replace: true,
			templateNamespace: 'svg',
			controller: ['$scope', function($scope) {

				this.direction = undefined;
				this.grabbed = false;
				this.grabbed_at = {
					x: undefined,
					y: undefined
				};
				this.grabbed_offset = {
					top: undefined,
					left: undefined,
					bottom: undefined,
					right: undefined
				};

				this.handleGrabbed = function(direction, x, y) {
					if($scope.cropping.selected) {
						this.grabbed_at = { x: x, y: y };
						this.grabbed_offset = {
							center_x: $scope.cropping.center_x,
							center_y: $scope.cropping.center_y,
							width: $scope.cropping.width,
							height: $scope.cropping.height,
							rotation: $scope.cropping.rotation
						};
						this.grabbed = true;
						this.direction = direction;
					}
				};

				this.handleReleased = function() {
					this.grabbed = false;
					this.direction = undefined;
				};

				this.handleMoved = function(x, y) {
					if($scope.cropping.selected) {
						if(this.grabbed) {
							if(this.direction.indexOf('move') >= 0) { // Moving the whole cropping.
								$scope.cropping.center_x = this.grabbed_offset.center_x - this.grabbed_at.x + x;
								$scope.cropping.center_y = this.grabbed_offset.center_y - this.grabbed_at.y + y;
								// Keeing the bounds.
								$scope.cropping.center_x = Math.max($scope.cropping.width/2, $scope.cropping.center_x);
								$scope.cropping.center_y = Math.max($scope.cropping.height/2, $scope.cropping.center_y);
								$scope.cropping.center_x = Math.min(1-$scope.cropping.width/2, $scope.cropping.center_x);
								$scope.cropping.center_y = Math.min(1-$scope.cropping.height/2, $scope.cropping.center_y);
							} else {
								var offsets = {
									left: $scope.cropping.center_x-$scope.cropping.width/2,
									top: $scope.cropping.center_y-$scope.cropping.height/2,
									right: $scope.cropping.center_x+$scope.cropping.width/2,
									bottom: $scope.cropping.center_y+$scope.cropping.height/2,
								};

								// TODO: Switch around north and south and east and west.
								/*
								if(offsets.left < x) {
									this.direction = this.direction.replace('west', 'east');
								} else if(offsets.right > x) {
									this.direction = this.direction.replace('east', 'west');
								}
								if(offsets.top < y) {
									this.direction = this.direction.replace('south', 'north');
								} else if(offsets.bottom > y) {
									this.direction = this.direction.replace('north', 'south');
								}
								*/

								if(this.direction.indexOf('north') >= 0) {
									offsets.top = y;
								}
								if(this.direction.indexOf('east') >= 0) {
									offsets.right = x;
								}
								if(this.direction.indexOf('south') >= 0) {
									offsets.bottom = y;
								}
								if(this.direction.indexOf('west') >= 0) {
									offsets.left = x;
								}
								$scope.cropping.center_x = offsets.left+(offsets.right-offsets.left)/2;
								$scope.cropping.center_y = offsets.top+(offsets.bottom-offsets.top)/2;
								$scope.cropping.height = Math.max(offsets.bottom - offsets.top, 0 );
								$scope.cropping.width = Math.max(offsets.right - offsets.left, 0 );
							}
						}
					}
				};

				$scope.cropping.outline = this;
			}],
			controllerAs: 'outline'
		};
	})
	.directive('croppingThumbnail', function() {
		var THUMBNAIL_SIZE = 100;

		return {
			restrict: 'E',
			templateUrl: 'templates/partials/cropping-thumbnail.html',
			controller: ['$scope', function($scope) {

				function updateThumbnail() {
					// Don't do anything before the large thumbnail has loaded.
					if(!$scope.thumbnail.loaded) {
						return;
					}
					var large_thumbnail = {
						width: $scope.thumbnail.width,
						height: $scope.thumbnail.height
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

					$scope.cropping_thumbnail = {
						width: large_thumbnail.width / zoom_factor,
						height: large_thumbnail.height / zoom_factor,
						left: -(($scope.cropping.center_x-$scope.cropping.width/2) * large_thumbnail.width) / zoom_factor,
						top: -(($scope.cropping.center_y-$scope.cropping.height/2) * large_thumbnail.height) / zoom_factor,
					};

				}

				$scope.$watch('cropping.center_x', updateThumbnail);
				$scope.$watch('cropping.center_y', updateThumbnail);
				$scope.$watch('cropping.width', updateThumbnail);
				$scope.$watch('cropping.height', updateThumbnail);
				$scope.$watch('thumbnail.loaded', updateThumbnail);
				$(window).on('resize', $scope.$apply);
			}],
			controllerAs: 'cropping_thumbnail'
		};
	})
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
})();