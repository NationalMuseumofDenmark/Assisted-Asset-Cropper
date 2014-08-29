var cip = require('cip-js');
var cache = require('memory-cache');

var NatMusConfig = {
	//endpoint: "http://samlinger.natmus.dk/CIP/",
	endpoint: "http://cumulus.natmus.dk/CIP/",
	constants: {
		catch_all_alias: "any",
		layout_alias: "web"
	},
	catalog_aliases: {
		"Alle": "ALL",
		"Antiksamlingen": "AS",
		"Bevaringsafdelingen": "BA",
		"Danmarks Middelalder og Renæssance": "DMR",
		"Danmarks Nyere Tid": "DNT",
		"Etnografisk samling": "ES",
		"Frihedsmuseet": "FHM",
		"Den Kgl. Mønt- og Medaljesamling": "KMM",
		"Musikmuseet": "MUM"
	}
};

var CIP_USERNAME = "cip-bitblueprint-readonly";
var CIP_PASSWORD = "JzxlDyo7KHgC";
var CACHE_TIME = 1000 * 60 * 5;

exports.session = function (callback) {
	var client = cache.get('cip-natmus-client');
	if(client) {
		callback(client);
	} else {
		client = new cip.CIPClient(NatMusConfig);
		client.session_open(
			CIP_USERNAME, CIP_PASSWORD,
			function() {
				cache.put('cip-natmus-client', client, CACHE_TIME);
				callback(client);
			}
		);
	}
};
