(function() {
	/*
	var previousState;
	var previousStateParams;
	angular
		.module('cropper')
		.run(['$rootScope', '$state', 'store', 'jwtHelper', 'auth', function($rootScope, $state, store, jwtHelper, auth) {
			$rootScope.$on('$stateChangeStart', function(e, toState, toStateParams) {
				if(toState.name !== 'signIn') {
					previousState = toState;
					previousStateParams = toStateParams;
				}
			});

			$rootScope.$on('$locationChangeStart', function() {
				var token = store.get('token');
				if (token) {
					if (!jwtHelper.isTokenExpired(token)) {
						if (!auth.isAuthenticated) {
							auth.authenticate(store.get('profile'), token);
						}
					} else {
						// Either show Login page or use the refresh token to get a new idToken
						$state.go('signIn');
					}
				}
			});
		}])
		.controller('signinCtrl', ['$rootScope', '$scope', '$state', 'store', 'auth',
			function($rootScope, $scope, $state, store, auth) {

			// TODO: Consider throwing this into the $rootScope instead of $scope.

			$scope.signed_in = true;
			$scope.busy = false;
			$scope.remember = false;
			
			$scope.signin = function() {
				auth.signin({
					// No options at the moment ...
				}, function(profile, token) {
					store.set('profile', profile);
					store.set('token', token);

					if(previousState) {
						console.log('Redirecting to privously requested state', previousState.name);
						//$state.go(previousState.name, previousStateParams);
						
						//$state.go('^');
					} else {
						$state.go('search');
					}
				}, function(err) {
					console.error("Error :(", err);
				});
			};

			// Let's do this!
			$scope.signin();

		}]);
	*/
})();