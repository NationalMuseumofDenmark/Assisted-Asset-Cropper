var express = require('express');
var router = express.Router();
var cip = require('../lib/cip-natmus');

var i18n = require('i18n'),
		__ = i18n.__;

/**
 * GET the overview page.
 * @param  {Object}   req  The request object.
 * @param  {Object}   res  The response object.
 * @param  {Function} next This function can be called to propagate the request
 *                         or errors.
 * @return {void}          Nothing in particular.
 */
router.get('/', function(req, res, next) {
	client = cip.client(req, next);
  res.render('overview', {
  	jsessionid: client.jsessionid,
  	title: __("Overview") +" - "+ __("Assisted asset cropper")
  });
});

module.exports = router;
