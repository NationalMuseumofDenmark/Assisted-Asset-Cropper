var express = require('express'),
		cip = require('../lib/cip'),
		router = express.Router();


router.get('/', function(req, res, next) {
	// Localizing parameters
	cip.request('metadata/getcatalogs')
    .then(function(response) {
		var catalogs = [];
		if(response.catalogs) {
			// Add in the aliases on the catalogs.
			catalogs = response.catalogs.map(function(catalog) {
				catalog.alias = cip.config.catalogAliases[catalog.name];
				return catalog;
			});
		}
		res.send(catalogs);
	}, next);
});

module.exports = router;
