angular
	.module('cropper')
	.factory('state', ['$q', '$http', function($q, $http) {
		var BASE_URL = '/state';
		return {
			get: function() {
				return $http.get(BASE_URL+'/')
				.then(function(response) {
					return response.data;
				});
			},
			longPoll: function(currentStateRevision) {
				/*
				return $http({
					url: BASE_URL+'/long-poll/',
					timeout: 5000
				})
				*/
				if(!currentStateRevision) {
					currentStateRevision = '';
				}

				return $http.get(BASE_URL+'/long-poll/' + currentStateRevision)
				.then(function(response) {
					return response.data;
				});
			},
			dismissJob: function(jobId) {
				return $http.get(BASE_URL+'/dismiss-job/' + jobId)
				.then(function(response) {
					return response.data;
				});
			}
		};
	}]);
