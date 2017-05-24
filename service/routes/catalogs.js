var express = require('express'),
		cip = require('../lib/cip'),
		router = express.Router();


router.get('/', function(req, res, next) {
	// Localizing parameters
	cip.request('metadata/getcatalogs')
    .then(function(response) {
		var catalogs = [];
		if(response.catalogs) {
			// Add in the aliases on the catalogs - filter out those without alias.
			catalogs = response.catalogs.map(catalog => {
				catalog.alias = cip.config.catalogAliases[catalog.name];
				return catalog;
			}).filter(catalog => catalog.alias);
		}
		res.send(catalogs);
	}, next);
});

module.exports = router;
