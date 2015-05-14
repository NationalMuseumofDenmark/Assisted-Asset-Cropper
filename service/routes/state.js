var express = require('express'),
		router = express.Router(),
		state = require('../lib/state');

// Consider doing this even faster.
var LONGPOLL_INTERVAL = 50;

/*
var currentState = state.get(req);
for(var j in currentState.jobs) {
	var id = currentState.jobs[j].id;
	var task = currentState.getOrCreateJobTask(id, 'Uploading');
	task.progress += 1;
	task.progressMax = 100;
	currentState.updateJobTask(id, 'Uploading', task.progress, task.progressMax);
}
if(currentState.jobs.length === 0) {
	currentState.appendJob('testjob', 'Testing job ...');
}
currentState.busy = true;
state.save(req, currentState);
*/

router.get('/', function(req, res) {
	state.get(req).then(function(currentState) {
		res.send(currentState.getData());
	});
});

router.get('/long-poll/:revision*?', function(req, res) {
	state.get(req).then(function(initialState) {
		if(req.params.revision && req.params.revision < initialState.revision) {
			res.send(initialState.getData());
		} else {
			// Turn it into a string - for easy comparison.
			initialState = JSON.stringify(initialState.getData());

			var longPollInterval = setInterval(function() {
				// Once the requesting connection times out - let's stop checking for
				// state change.
				if(req.connection.destroyed) {
					// Stop checking for changes when the connection gets destroyed.
					clearInterval(longPollInterval);
				}

				state.get(req).then(function(currentState) {
					var currentStateData = currentState.getData();
					if(initialState !== JSON.stringify(currentStateData) ) {
						// Let's stop polling.
						clearInterval(longPollInterval);
						res.send(currentStateData);
					}
				});
			}, LONGPOLL_INTERVAL);
		}
	});
});

module.exports = router;