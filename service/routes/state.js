var express = require('express'),
		router = express.Router(),
		state = require('../lib/state');

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
	state.watch(req, req.params.revision).then(function(newState) {
		res.send(newState.getData());
	});
});

router.get('/dismiss-job/:jobId*?', function(req, res) {
	var jobId = req.params.jobId;
	state.dismissJob(req, jobId).then(function(newStateData) {
		res.send(newStateData);
	});
});

module.exports = router;