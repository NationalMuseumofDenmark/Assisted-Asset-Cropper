var Q = require('q'),
		assert = require('assert');

var mockState = {
	jobs: [
		{
			description: 'Cropping asset #123 (in Cropper)',
			tasks: [
				{ description: 'Downloading image', progress: 20, progressMax: 100 },
				{ description: 'Cropping image', progress: 0, progressMax: 100 },
				{ description: 'Uploading image', progress: 0, progressMax: 100 }
			]
		}
	]
};

function State(state) {
	this.jobs = [];

	if(typeof(state) === 'object') {
		this.revive(state);
	}
}

State.prototype.revive = function(data) {
	this.jobs = data.jobs;
	this.revision = data.revision;
	return this;
};

State.prototype.getData = function() {
	var data = {};
	// Copy the values of every field, execpt some.
	for(var f in this) {
		if(f !== 'req' && typeof(this[f]) !== 'function') {
			data[f] = this[f];
		}
	}
	return data;
};

State.prototype.getJobIndex = function(jobId) {
	//console.log('Looking for', jobId, 'in', this.jobs);
	for(var j in this.jobs) {
		if(this.jobs[j].id === jobId) {
			return j;
		}
	}
	throw new Error('Job '+jobId+' not found.');
};

State.prototype.getJob = function(jobId) {
	var j = this.getJobIndex(jobId);
	return this.jobs[j];
};

State.prototype.getJobTaskIndex = function(jobId, taskDescription) {
	var j = this.getJobIndex(jobId);
	for(var t in this.jobs[j].tasks) {
		if(this.jobs[j].tasks[t].description === taskDescription) {
			return t;
		}
	}
	return -1;
};

State.prototype.getJobTask = function(jobId, taskDescription) {
	var j = this.getJobIndex(jobId);
	var t = this.getJobTaskIndex(jobId, taskDescription);
	if(t >= 0) {
		return this.jobs[j].tasks[t];
	} else {
		throw new Error('Task "'+taskDescription+'" of job '+jobId+' not found.');
	}
};

State.prototype.getJobTask = function(jobId, taskDescription) {
	var j = this.getJobIndex(jobId);
	var t = this.getJobTaskIndex(jobId, taskDescription);
	if(t >= 0) {
		return this.jobs[j].tasks[t];
	} else {
		throw new Error('Task "'+taskDescription+'" of job '+jobId+' not found.');
	}
};

State.prototype.getOrCreateJobTask = function(jobId, taskDescription) {
	try {
		return this.getJobTask(jobId, taskDescription);
	} catch(err) {
		this.updateJobTask(jobId, taskDescription, undefined, undefined);
		return this.getJobTask(jobId, taskDescription);
	}
};

State.prototype.createJob = function(jobDescription) {
	var jobId = process.hrtime();
	jobId = jobId[0] +'.'+ jobId[1];
	this.jobs.push({
		id: jobId,
		description: jobDescription,
		tasks: []
	});
	return jobId;
};

State.prototype.updateJobTask = function(jobId, taskDescription, progress, progressMax) {
	var j = this.getJobIndex(jobId);
	var t = this.getJobTaskIndex(jobId, taskDescription);
	if(t >= 0) {
		this.jobs[j].tasks[t].progress = progress;
		this.jobs[j].tasks[t].progressMax = progressMax;
	} else {
		// A new task has to be appended.
		this.jobs[j].tasks.push({
			description: taskDescription,
			progress: progress,
			progressMax: progressMax
		});
	}
	// Return this, so it's easier to chain methods.
	return this;
};

State.prototype.changeJobStatus = function(jobId, status) {
	var j = this.getJobIndex(jobId);
	this.jobs[j].status = status;
	return this;
};

State.prototype.save = function() {
	var deferred = Q.defer();

	var state = this.getData();
	this.req.session.state = state;

	// Bumping the revision.
	this.req.session.state.revision++;
	this.req.session.save(function(err) {
		if(err) {
			deferred.reject(err);
		} else {
			deferred.resolve(state);
		}
	});

	return deferred.promise;
};

function get(req) {
	var deferred = Q.defer();

	assert(req.session, 'Expected the req object to have a session attribute.');

	req.session.reload(function(err) {
		if(err) {
			deferred.reject(err);
		} else {
			var state = req.session.state;
			if(!state) {
				state = new State();
			} else {
				state = new State(state);
			}

			if(!state.revision) {
				state.revision = 1;
			}
			state.req = req;
			deferred.resolve(state);
		}
	});

	return deferred.promise;
}

function updateJobTask(req, jobId, taskDescription, progress, progressMax) {
	return get(req).then(function(currentState) {
		return currentState.updateJobTask(
			jobId,
			taskDescription,
			progress,
			progressMax
		).save();
	});
}

function changeJobStatus(req, jobId, status) {
	return get(req).then(function(currentState) {
		return currentState
			.changeJobStatus(jobId, status)
			.save();
	});
}

function createJob(req, jobDescription) {
	return get(req).then(function(currentState) {
		var jobId = currentState.createJob(jobDescription);
		currentState.save();
		return jobId;
	});
}


exports.get = get;

exports.updateJobTask = updateJobTask;

exports.changeJobStatus = changeJobStatus;

exports.createJob = createJob;
