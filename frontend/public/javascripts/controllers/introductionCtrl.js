(function() {
	angular
		.module('cropper')
		.controller('introductionCtrl', ['$scope', '$state',
			function($scope, $state) {
				$scope.searchTerm = {
					value: ''
				};

				$scope.search = function(term) {
					$state.go('search', { term: term });
				};

				$scope.termKeyPress = function($event) {
					if($event.which==13) {
						$scope.search($scope.searchTerm.value);
					}
				};
		}]);
})();