var express = require('express'),
		session = require('express-session'),
		crypto = require('crypto'),
		path = require('path'),
		logger = require('morgan'),
		cookieParser = require('cookie-parser'),
		bodyParser = require('body-parser'),
		request = require('request'),
		jwt = require('express-jwt');

// Initialize the cip client
var settings = require('./settings.json');
var cip = require('./service/lib/cip');
cip.setConfig({
	baseURL: "http://cumulus.natmus.dk/CIP/",
	catalogAliases: {
		"Alle": "ALL",
		"Antiksamlingen": "AS",
		"Bevaringsafdelingen": "BA",
		"Cropper": "Cropper",
		"Danmarks Middelalder og Renæssance": "DMR",
		"Danmarks Nyere Tid": "DNT",
		"Danmarks Oldtid": "DO",
		"Den Kgl. Mønt- og Medaljesamling": "KMM",
		"Etnografisk samling": "ES",
		"Frihedsmuseet": "FHM",
		"Frilandsmuseet": "FLM",
		"Musikmuseet": "MUM",
		"Orlogsmuseet": "OM",
		"Tøjhusmuseet": "THM"
	},
	layoutAlias: 'Registrering',
	serverAddress: 'ppcumulus.natmus.int'
});
cip.setCredentials(settings.cip.username, settings.cip.password);

var assets = require('./service/routes/assets');
var catalogs = require('./service/routes/catalogs');
var cip_proxy = require('./service/routes/cip_proxy');

var app = express();

// A proxy to the CIP - this way we concur challenges with
// same origin policies and www-authenticate headers.
// this has to be registered before the body and cookie parsers.
app.use('/CIP', cip_proxy);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Let's generate a long string that we will be using for securing the session.
var secret = crypto.randomBytes(64).toString('hex');
app.use(session({
	secret: secret,
	resave: false,
	saveUninitialized: true
}));

// Serve the static files from the public folder.
app.use(express.static(path.join(__dirname, 'frontend/public')));

app.get('/', function(req, res) {
  res.sendFile(__dirname + '/frontend/public/templates/index.html');
});

// Authentication using auth0
var settings = require('./settings.json');

var jwtCheck = jwt({
  secret: new Buffer(settings.auth0.secret, 'base64'),
  audience: settings.auth0.clientID
});

// This method adds a JWT from the query params to the request headers.
// We need this to communicate authentication when requesting images.
function jwtQuery2Header(req, res, next) {
	if(req.query.jwt) {
		req.headers.authorization = 'Bearer '+req.query.jwt;
	}
	next();
}
app.use(jwtQuery2Header);

// Register the various application routes.
app.use('/asset', jwtCheck, assets);
app.use('/catalogs', jwtCheck, catalogs);

/// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

/// error handlers
// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(logger('dev'));
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send({
			title: "An error occurred in development mode",
			message: err.message,
			error: err
		});
		console.error(err.stack);
	});
} else {
	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.send({
			title: "An error occurred",
			message: err.message,
			error: {}
		});
	});
}

module.exports = app;
