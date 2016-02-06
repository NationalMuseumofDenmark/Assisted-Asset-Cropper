(function() {
	angular
	.module('cropper', [
		'ui.router',
		'infinite-scroll',
		'angulartics',
		'angulartics.google.analytics.cordova',
		'auth0',
		'angular-storage',
		'angular-jwt',
		'angular-gestures'
	]).config(['$urlRouterProvider', '$stateProvider', 'authProvider', 'jwtInterceptorProvider', '$httpProvider', 'hammerDefaultOptsProvider',
	function($urlRouterProvider, $stateProvider, authProvider, jwtInterceptorProvider, $httpProvider, hammerDefaultOptsProvider) {

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
		.state('search.asset', {
			url: '/asset/:asset_id',
			templateUrl: 'templates/asset.html',
			controller: 'assetCtrl',
			resolve: {
				asset: ['assets', '$state', '$stateParams', function(assets, $state, $stateParams) {
					return assets.get($stateParams.catalog_alias, $stateParams.asset_id);
				}]
			}
		});

		// Initialize auth0
		if(!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
			console.error('Auth0 settings missing: Please re-grunt the app.');
		} else {
			authProvider.init({
				domain: AUTH0_DOMAIN,
				clientID: AUTH0_CLIENT_ID
			});
		}
		jwtInterceptorProvider.tokenGetter = ['store', function(store) {
			return store.get('token');
		}];

		$httpProvider.interceptors.push('jwtInterceptor');

		hammerDefaultOptsProvider.set({
			recognizers: [
				[Hammer.Tap, {time: 250}],
				[Hammer.Pan, {}]
			]
		});
	}])
	.run(['$rootScope', '$state', 'user', function($rootScope, $state, user) {

		$rootScope.signout = function() {
			// First - tell the user service to forget about the user.
			user.forget();
			$state.go('search', {}, { reload: true });
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
		/*
		$rootScope.$on('$stateChangeError',
		function (event, toState, toParams, fromState, fromParams, error) {
			console.error(error, error.stack);
			if(error && error.indexOf && error.indexOf('Unauthorized') !== -1) {
				event.preventDefault();
				$state.go('signIn');
			}
		});
		*/
		$rootScope.modalOpened = false;
		$rootScope.$on('$stateChangeSuccess',
		function (ev, to, toParams, from, fromParams) {
			// Save the params of the last search when leaving the state.
			if(from.name === 'search.asset') {
				$rootScope.modalOpened = false;
			}
			if(to.name === 'search.asset') {
				$rootScope.modalOpened = true;
			}
		});
	}])
	.directive('jobs', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/partials/jobs.html',
			replace: true,
			controller: ['$rootScope', '$timeout',
			function($rootScope, $timeout) {
				var AUTO_DISMISS_TIMEOUT = 3000;

				$rootScope.jobs = [];

				$rootScope.$watch('jobs', function(jobs) {
					jobs.forEach(function(job) {
						if(!job.timeout && job.status === 'success') {
							job.timeout = $timeout(function() {
								$rootScope.dismissJob(job);
							}, AUTO_DISMISS_TIMEOUT);
						}
					});
				}, true);

				$rootScope.dismissJob = function(job) {
					$rootScope.jobs = $rootScope.jobs.filter(function(j) {
						return j !== job;
					});
				};
			}]
		};
	})
	.directive('loadingDots', function() {
		return {
			restrict: 'E',
			templateUrl: '/templates/partials/loading-dots.html'
		};
	});
})();
