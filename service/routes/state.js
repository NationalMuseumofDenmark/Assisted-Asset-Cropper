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
	state.watch(req.params.revision).then(function(newState) {
		res.send(newState.getData());
	});
});

module.exports = router;