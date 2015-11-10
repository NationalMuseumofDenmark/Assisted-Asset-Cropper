(function() {
	angular
	.module('cropper', [
		'ui.router',
		'infinite-scroll',
		'angulartics',
		'angulartics.google.analytics',
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
			$state.go('introduction');
			/*
			// Then ask for the user to authenticate.
			user.get().then(function(user) {
				$state.go('search');
			});
			*/
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
	.directive('stateJobs', function() {
		return {
			restrict: 'E',
			templateUrl: 'templates/partials/state-jobs.html',
			replace: true,
			controller: ['$rootScope', '$timeout', 'state',
			function($rootScope, $timeout, state) {
				var STATUS_LONG_POLL_TIMEOUT = 10000;
				var AUTO_DISMISS_TIMEOUT = 3000;

				$rootScope.state = {
					busy: false,
					jobs: []
				};

				// TODO: Watch the state's jobs and put a timeout that dismisses jobs
				// when they are done or has errors after some time.
				var autoDismissTimeouts = {};
				$rootScope.$watch('state.jobs', function(jobs) {
					jobs.forEach(function(job) {
						if(!autoDismissTimeouts[job.id] && job.status && job.status==='success') {
							autoDismissTimeouts[job.id] = $timeout(function() {
								$rootScope.dismissJob(job.id);
							}, AUTO_DISMISS_TIMEOUT);
						}
					});
				});

				function overwriteState(s) {
					$rootScope.status = s.status;
					$rootScope.state.jobs = s.jobs;
				}

				$rootScope.dismissJob = function(id) {
					state.dismissJob(id).then(overwriteState);
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
					return statePromise.then(overwriteState);
				}

				function keepUpdatingState() {
					// Update and keep updating.
					return updateState(true)
					.then(function() {
						return keepUpdatingState();
					}, function() {
						// Keep on trying - even when getting errors ...
						$timeout(keepUpdatingState, 5000);
					});
				}

				// Update the status once and keep updating it.
				updateState().then(keepUpdatingState);
			}]
		};
	});
})();