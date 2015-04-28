(function() {
	angular
	.module('cropper')
	.controller('imageSelectionCanvasCtrl', ['$scope', function($scope) {

		$scope.image = {
			loaded: false,
			src: $scope.imageSrc,
			width: 1000,
			height: 1000 // Fake it till you know it.
		};

		$scope.canRotate = false;

		$scope.toggleCanRotate = function() {
			$scope.canRotate = !$scope.canRotate;
		};

		$scope.handlePadding = 5;
		$scope.rotationalHandleRadius = 6;
		$scope.rotationalHandleLength = 15;

		$scope.selectedSelection = undefined;

		$scope.draggingCanvas = false;

		$scope.selectSelection = function(selection) {
			$scope.selectedSelection = selection;
			// Parent controllers might want to know when the selection changes.
			$scope.$emit('selectSelectionChanged', { selection: selection });
		};

		$scope.deselectSelection = function() {
			$scope.selectSelection(undefined);
		};

		// TODO: Might be deleted - it's probably not used.
		$scope.isSelected = function(selection) {
			return $scope.selectedSelection === selection;
		};

		$scope.removeSelection = function(selection) {
			if($scope.isSelected(selection)) {
				$scope.deselectSelection();
			}
			if(typeof(selection) === 'number') {
				// The selection argument is the index.
				$scope.selections.splice(selection, 1);
			} else {
				$scope.selections = $scope.selections.filter(function(someSelection) {
					console.log(someSelection, selection, someSelection !== selection);
					return someSelection !== selection;
				});
			}
		};

		$scope.removeSelectedSelection = function() {
			$scope.selections.forEach(function(selection, index) {
				if($scope.selectedSelection === selection) {
					$scope.selections.splice(index, 1);
				}
			});
			$scope.deselectSelection();
		};

		$scope.dragCreateSelection = function(offsetX, offsetY) {
			$scope.dragging_canvas = false;
			var selection = {
				center_x: offsetX / $scope.image.width,
				center_y: offsetY / $scope.image.height,
				width: 0,
				height: 0,
				rotation: 0
			};
			$scope.selections.push(selection);
			// Wait just a ms for the selection to bind.
			setTimeout(function() {
				$scope.$broadcast('onSelectionDragCreated', {
					selection: selection,
					offsetX: offsetX,
					offsetY: offsetY
				});
			}, 1);
		};

		// Manipulating the canvas
		$scope.mouseDown = function() {
			$scope.draggingCanvas = true;
			$scope.deselectSelection();
		};

		$scope.mouseUp = function() {
			$scope.draggingCanvas = false;
		};

		$scope.mouseMove = function(offsetX, offsetY) {
			var nothingSelected = typeof($scope.selectedSelection) === 'undefined';
			if($scope.draggingCanvas && nothingSelected) {
				$scope.dragCreateSelection(offsetX, offsetY);
			}
		};

		// Parent controllers might want to affect the selection.
		$scope.$on('selectSelection', function(e, args) {
			$scope.selectSelection(args.selection);
		});

		// Parent controllers might want to remove selections.
		$scope.$on('removeSelection', function(e, args) {
			$scope.removeSelection(args.selection);
		});

		$(window).keypress(function(e) {
			if(e.keyCode === 127) { // The 'Delete' button
				$scope.removeSelectedSelection();
			}
		});

		// When clicking anywhere outside the canvas, deselect all selections.
		$(document.body).click(function() {
			$scope.$apply(function() {
				$scope.deselectSelection();
			});
		});

	}])
	.directive('imageSelectionCanvas', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/image-selection/canvas.html',
			templateNamespace: 'svg',
			controller: 'imageSelectionCanvasCtrl',
			scope: {
				'imageSrc': '@src',
				'selections': '='
			},
			link: function(scope, element, attrs) {
				$image = element.find('img');
				function updateThumbnailDimensions() {
					scope.$apply(function() {
						scope.image.width = $image.width();
						scope.image.height = $image.height();
						scope.$emit('imageUpdated', { image: scope.image });
					});
				}
				$image.bind('load', function() {
					scope.image.loaded = true;
					updateThumbnailDimensions();
				});
				$(window).bind('resize', updateThumbnailDimensions);
				$(element).bind('click', function(e) {
					// This prevents the click from deselecting.
					e.stopPropagation();
				});
			}
		};
	})
	.controller('imageSelectionCtrl', ['$scope', function($scope) {
		// The corner in which 
		$scope.grabbed = false;
		$scope.grabbedAt = {
			x: undefined,
			y: undefined
		};
		$scope.grabbedHandleDirection = undefined;
		$scope.grabbedOffset = {
			top: undefined,
			left: undefined,
			bottom: undefined,
			right: undefined
		};

		$scope.visible = false;
		$scope.hovering = false;

		$scope.deriveScope = function() {
			var selection = $scope.selection;
			var image = $scope.image;

			$scope.maskId = 'Mask-' + $scope.$index;
			$scope.left = (selection.center_x-selection.width/2) * image.width;
			$scope.top = (selection.center_y-selection.height/2) * image.height;
			$scope.width = selection.width * image.width;
			$scope.height = selection.height * image.height;
			$scope.centerX = selection.center_x * image.width;
			$scope.centerY = selection.center_y * image.height;
			$scope.rotationStyle = [
				'transform: rotate(' +selection.rotation+ 'deg)',
				'transform-origin: '+$scope.centerX+ 'px ' +$scope.centerY+ 'px'
			].join(';');
		};

		$scope.handleGrabbed = function(direction, $event) {
			var x = $event.offsetX / $scope.image.width;
			var y = $event.offsetY / $scope.image.height;
			// Make this selection, the selected selection.
			$scope.$parent.selectSelection($scope.selection);
			
			$scope.grabbedAt = {
				x: x,
				y: y
			};
			// Save a copy of the selection when grapped.
			$scope.grabbedOffset = {
				center_x: $scope.selection.center_x,
				center_y: $scope.selection.center_y,
				width: $scope.selection.width,
				height: $scope.selection.height,
				rotation: $scope.selection.rotation
			};
			$scope.grabbed = true;
			$scope.grabbedHandleDirection = direction;

			// If this is infact a real $event and not just an object with
			// offsetX and offsetY. Let's make sure this click does not propagate.
			if($event.stopPropagation) {
				$event.stopPropagation();
			}
		};

		$scope.handleReleased = function() {
			$scope.grabbed = false;
			$scope.grabbedHandleDirection = undefined;
		};

		$scope.mouseMoved = function(x, y) {
			// Normalize the coordinates.
			x /= $scope.image.width;
			y /= $scope.image.height;

			if($scope.selected && $scope.grabbed) {
				if($scope.grabbedHandleDirection === 'move') {
					// Moving the whole selection.
					$scope.selection.center_x = $scope.grabbedOffset.center_x - $scope.grabbedAt.x + x;
					$scope.selection.center_y = $scope.grabbedOffset.center_y - $scope.grabbedAt.y + y;
					// Keeing the bounds.
					$scope.selection.center_x = Math.max($scope.selection.width/2, $scope.selection.center_x);
					$scope.selection.center_y = Math.max($scope.selection.height/2, $scope.selection.center_y);
					$scope.selection.center_x = Math.min(1-$scope.selection.width/2, $scope.selection.center_x);
					$scope.selection.center_y = Math.min(1-$scope.selection.height/2, $scope.selection.center_y);
				} else if($scope.grabbedHandleDirection === 'rotational') {
					var diffX = $scope.selection.center_x - x;
					var diffY = $scope.selection.center_y - y;
					var radians = Math.atan2(diffY, diffX);
					$scope.selection.rotation = (radians / Math.PI / 2 * 360) - 90;
				} else {
					var offsets = {
						left: $scope.selection.center_x - $scope.selection.width/2,
						top: $scope.selection.center_y - $scope.selection.height/2,
						right: $scope.selection.center_x + $scope.selection.width/2,
						bottom: $scope.selection.center_y + $scope.selection.height/2,
					};

					// TODO: Switch around north and south and east and west.
					/*
					if(offsets.left < x) {
						$scope.grabbedHandleDirection = $scope.grabbedHandleDirection.replace('west', 'east');
					} else if(offsets.right > x) {
						$scope.grabbedHandleDirection = $scope.grabbedHandleDirection.replace('east', 'west');
					}
					if(offsets.top < y) {
						$scope.grabbedHandleDirection = $scope.grabbedHandleDirection.replace('south', 'north');
					} else if(offsets.bottom > y) {
						$scope.grabbedHandleDirection = $scope.grabbedHandleDirection.replace('north', 'south');
					}
					*/

					if($scope.grabbedHandleDirection.indexOf('north') >= 0) {
						offsets.top = y;
					}
					if($scope.grabbedHandleDirection.indexOf('east') >= 0) {
						offsets.right = x;
					}
					if($scope.grabbedHandleDirection.indexOf('south') >= 0) {
						offsets.bottom = y;
					}
					if($scope.grabbedHandleDirection.indexOf('west') >= 0) {
						offsets.left = x;
					}
					$scope.selection.center_x = offsets.left+(offsets.right-offsets.left)/2;
					$scope.selection.center_y = offsets.top+(offsets.bottom-offsets.top)/2;
					$scope.selection.height = Math.max(offsets.bottom - offsets.top, 0 );
					$scope.selection.width = Math.max(offsets.right - offsets.left, 0 );
				}
			}
		};

		// Derive the scope when the image loads.
		$scope.$watch('image.loaded', function(nowLoaded, oldLoaded) {
			var justLoaded = nowLoaded && nowLoaded !== oldLoaded;
			if(justLoaded) {
				$scope.deriveScope();
			}
		});

		// Or when the selection changes.
		$scope.$watch('selection', $scope.deriveScope, true);

		// When the selected selection changes
		$scope.$parent.$watch('selectedSelection', function(selectedSelection) {
			// Propagate this value to the current scope
			$scope.selected = selectedSelection === $scope.selection;
			// And hide this outline if something was selected and it wasn't this.
			$scope.visible = typeof(selectedSelection) === 'undefined' || $scope.selected;
		});

		$scope.$on('onSelectionDragCreated', function(e, args) {
			if(args.selection === $scope.selection) {
				// This is the selection that was just added.
				$scope.handleGrabbed('south-east', {
					offsetX: args.offsetX,
					offsetY: args.offsetY
				});
			}
		});
	}])
	.directive('imageSelectionOutline', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/image-selection/outline.html',
			replace: true,
			templateNamespace: 'svg',
			controller: 'imageSelectionCtrl'
		};
	});
})();