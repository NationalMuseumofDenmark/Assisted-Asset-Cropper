var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('signin', {
  	title: "Log ind i Nationalmuseet's Friskærer!"
  });
});

module.exports = router;
