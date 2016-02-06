var cache = require('memory-cache'),
	request = require('request'),
		Q = require('q');

var settings = require('../../settings.json');

// Refresh session every hour
SESSION_TIMEOUT = 1000 * 60 * 60;

var CROPPING_STATUS_FIELD = '{bf7a30ac-e53b-4147-95e0-aea8c71340ca}',
		FILENAME_FIELD = 'name';

function CIPClient() { }

CIPClient.prototype.setConfig = function(config) {
	this.config = {
		baseURL: config.baseURL,
		catalogAliases: config.catalogAliases,
		layoutAlias: config.layoutAlias
	};
};

CIPClient.prototype.keepSessionFresh = function() {
	var timeNow = (new Date()).getTime();
	var noSession = !this.jsessionid || !this.sessionLastUpdated;

	if(noSession || this.sessionLastUpdated + SESSION_TIMEOUT < timeNow) {
		return this.request('session/open', {
			user: this.username,
			password: this.password,
			serveraddress: 'localhost',
			apiversion: 5
		}, true).then(function(response) {
			this.jsessionid = response.jsessionid;
			this.sessionLastUpdated = (new Date()).getTime();
		}.bind(this));
	} else {
		return Q();
	}
};

CIPClient.prototype.setCredentials = function(username, password) {
	this.username = username;
	this.password = password;
	this.jsessionid = null;
	this.sessionLastUpdated = null;

	return this.keepSessionFresh();
};

CIPClient.prototype.buildURL = function(operation, querystring, withoutJSessionID) {
	if(typeof(operation) === 'object') {
		operation = operation.join('/');
	}
	var url = this.config.baseURL + operation;
	if(this.jsessionid && !withoutJSessionID) {
		url += ';jsessionid=' + this.jsessionid;
	}
	if(typeof(querystring) === 'object') {
		querystring = Object.keys(querystring).map(function(key) {
			var value = querystring[key];
			return key +'='+ value;
		});
		url += '?' + querystring.join('&');
	}
	return url;
};

CIPClient.prototype.request = function(operation, data, withoutJSessionID) {
	var promisedBefore;
	if(withoutJSessionID) {
		promisedBefore = Q();
	} else {
		promisedBefore = this.keepSessionFresh();
	}

	return promisedBefore.then(function() {
		console.log('CIP request to', operation);
		var deferred = Q.defer();

		if(!data) {
			data = {};
		}
		var url = this.buildURL(operation, undefined, withoutJSessionID);

		var r = request.post({
			url: url,
			form: data,
			json: true
		}, function (error, response, body) {
			if (!error && response.statusCode < 400) {
				deferred.resolve(body);
			} else {
				if(!error) {
					var msg = 'Error from CIP';

					msg += ' (status '+ response.statusCode + ')';
					if(body) {
						msg += ': '+ body;
					}
					error = new Error(msg);
				}
				error.response = response;
				error.body = body;
				deferred.reject(error);
			}
		});

		return deferred.promise;
	}.bind(this));
};

CIPClient.prototype.wrap_proxy = function( url ) {
	return url.replace( NatMusConfig.endpoint, "/CIP/" );
};

CIPClient.prototype.search = function(catalogAlias, term) {
	var querystring = CROPPING_STATUS_FIELD + ' == 1';

	return this.request([
		"metadata",
		"search",
		catalogAlias
	], {
		querystring: querystring,
		quicksearchstring: term,
		sortby: CROPPING_STATUS_FIELD+":descending",
		table: 'AssetRecords',
		collection: ''
	});
};

CIPClient.prototype.searchResults = function(collectionID, count, offset) {
	return this.request([
		'metadata',
		'getfieldvalues',
		this.config.layoutAlias
	], {
		collection: collectionID,
		maxreturned: count,
		startindex: offset
	}).then(function(response) {
		return response.items;
	});
};

CIPClient.prototype.getAsset = function(catalogAlias, id) {
	return this.request([
		"metadata",
		"search",
		catalogAlias,
		this.config.layoutAlias
	], {
		querystring: 'id == '+id,
		table: 'AssetRecords',
		maxreturned: 1
	}).then(function(response) {
		if(response.items && response.items.length === 1) {
			return response.items[0];
		} else {
			return null;
		}
	});
};

module.exports = new CIPClient();
