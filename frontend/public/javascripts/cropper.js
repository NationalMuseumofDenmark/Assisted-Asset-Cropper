(function() {
	angular
	.module('cropper', [
		'ui.router',
		'infinite-scroll',
		'angulartics',
		'angulartics.google.analytics',
		'auth0',
		'angular-storage',
		'angular-jwt'
	]).config(['$urlRouterProvider', '$stateProvider', 'authProvider', 'jwtInterceptorProvider', '$httpProvider',
	function($urlRouterProvider, $stateProvider, authProvider, jwtInterceptorProvider, $httpProvider) {

		$urlRouterProvider.otherwise('/search//');

		var catalogs;

		$stateProvider
		.state('search', {
			url: '/search/:catalog_alias/:term',
			templateUrl: 'templates/search.html',
			controller: 'searchCtrl',
			resolve: {
				catalogs: ['assets', function(assets) {
					if(!catalogs) {
						return assets.getCatalogs()
						.then(function(catalogs_response) {
							// TODO: Consider moving this transformation to the backend.
							catalogs = {};
							catalogs_response.forEach(function(catalog) {
								catalogs[catalog.alias] = catalog.name;
							});
							return catalogs;
						});
					}
					return catalogs;
				}]
			}
		})
		.state('asset', {
			url: '/asset/:catalog_alias/:asset_id',
			templateUrl: 'templates/asset.html',
			controller: 'assetCtrl',
			resolve: {
				asset: ['assets', '$state', '$stateParams', function(assets, $state, $stateParams) {
					return assets.get($stateParams.catalog_alias, $stateParams.asset_id);
				}]
			}
		});
	
		// Initialize auth0
		authProvider.init({
			domain: 'socialsquare.eu.auth0.com',
			clientID: 'lERh4X3aiJJN6SFLbySZI6R6YO2DI8RS'
		});


		jwtInterceptorProvider.tokenGetter = ['store', function(store) {
			return store.get('token');
		}];

		$httpProvider.interceptors.push('jwtInterceptor');

	}])
	.run(['$rootScope', '$state', 'user', function($rootScope, $state, user) {

		$rootScope.signout = function() {
			user.forget();
			user.get().then(function(user) {
				$state.go('search');
			});
		};

		$rootScope.messages = [];
		$rootScope.showMessage = function(style, body) {
			if( typeof body === 'string' ) {
				body = [ body ];
			}
			$rootScope.messages.push({
				style: style,
				body: body.join('')
			});
		};

		$rootScope.removeMessage = function($index) {
			$rootScope.messages.splice($index, 1);
		};
	
		// If a state change error occurs due to Unauthorized, change to the signIn state.
		$rootScope.$on('$stateChangeError',
		function (event, toState, toParams, fromState, fromParams, error) {
			console.error(error, error.stackkraen);
			if(error && error.indexOf && error.indexOf('Unauthorized') !== -1) {
				event.preventDefault();
				$state.go('signIn');
			}
		});
		$rootScope.$on('$stateChangeSuccess',
		function (ev, to, toParams, from, fromParams) {
			// Save the params of the last search when leaving the state.
			if(from.name === 'search') {
				$rootScope.previous_search = fromParams;
			}
		});
	}])
	.directive('stateJobs', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/partials/state-jobs.html',
			replace: true,
			controller: ['$rootScope', 'state', function($rootScope, state) {
				var STATUS_LONG_POLL_TIMEOUT = 10000;
				$rootScope.state = {
					busy: false,
					jobs: []
				};

				function updateState(longPoll) {
					var statePromise, currentStateRevision;

					if($rootScope.state && $rootScope.state.revision) {
						currentStateRevision = $rootScope.state.revision;
					}

					if(longPoll) {
						statePromise = state.longPoll(currentStateRevision);
					} else {
						statePromise = state.get();
					}
					// Update the root scope with the new status.
					return statePromise.then(function(newState) {
						$rootScope.status = newState.status;
						$rootScope.state.jobs = newState.jobs;
					});
				}

				var fails = 0;

				function keepUpdatingState() {
					// Update and keep updating.
					return updateState(true)
					.then(function() {
						return keepUpdatingState();
					}, function() {
						fails++;
						if(fails > 3) {
							console.error('Stopped updating state after', fails, 'fails.');
						} else {
							// Keep on trying - event when getting errors ...
							return keepUpdatingState();
						}
					});
				}

				// Update the status once and keep updating it.
				updateState().then(keepUpdatingState);
			}]
		};
	});
})();