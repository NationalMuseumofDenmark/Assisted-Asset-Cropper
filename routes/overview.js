var express = require('express');
var router = express.Router();
var cip = require('../lib/cip-natmus');

/* GET home page. */
router.get('/', function(req, res, next) {
	client = cip.client(req, next);
  res.render('overview', {
  	jsessionid: client.jsessionid,
  	title: "Overview - Assisted asset cropper"
  });
});

module.exports = router;
