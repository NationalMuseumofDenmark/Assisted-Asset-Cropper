(function($) {

	function signin(username, password, remember, success_callback, error_callback) {
		// Is storage enabled at all?
		if(typeof(Storage) === "undefined") {
			alert("Sorry your browser doesn't support local storage.");
			return;
		}

		var storage = sessionStorage;
		/*
		// What type of storage should we use?
		var storage;
		if(remember) {
			storage = localStorage;
		} else {
			storage = sessionStorage;
		}

		// If we should remember - let's keep the credentials for later use.
		if(remember) {
			storage.setItem("username", username);
			storage.setItem("password", password);
		}
		*/

		// If a session exists - close it and forget about it.
		close_any_existing_session(function() {
			// Create a session using the cip client and save the jsession.
			cip.session_open(
				username,
				password,
				function(response) {
					verify_session(function() {
						createCookie('jsessionid', cip.jsessionid);
						success_callback(response);
					}, function() {
						error_callback("Session verification failed.");
					});
				},
				function(response) {
					error_callback(response);
				}
			);
		});
	}

	function successfully_authenticated() {
		location.replace("/overview");
	}

	// What storage type should be used?
	var storage;
	$(function() {
		var jsessionid_cookie = readCookie('jsessionid');
		if(jsessionid_cookie) {
			cip.jsessionid = jsessionid_cookie;
			// Do we have a session already?
			verify_session(successfully_authenticated, function() {
				cip.jsessionid = null;
				eraseCookie('jsessionid');
			});
		}

		$("form.form-signin").submit(function(e) {
			e.preventDefault();
			var values = $(e.target).serializeObject();
			values.remember = "remember" in values && values.remember === "yes";

			signin(values.username, values.password, values.remember, function() {
				successfully_authenticated();
			}, function( response ) {
				console.log(response);
				alert("Couldn't sign in - please check your credentials.");
			});
		});
	});
})(jQuery);