var express = require('express');
var router = express.Router();
var cip = require('../lib/cip-natmus');

router.all('/*', function(req, res) {
  var url = cip.config.endpoint + req.url.substring(1);
  req.pipe(request(url)).pipe(res);
});

module.exports = router;
