var NatMusConfig = {
	// endpoint: "http://cumulus.natmus.dk/CIP/",
	endpoint: location.origin + "/CIP/",
	constants: {
			catch_all_alias: "any",
			layout_alias: "web" // TODO: Change to registrering?
	},
	catalog_aliases: {
		"Alle": "ALL",
		"Antiksamlingen": "AS",
		"Bevaringsafdelingen": "BA",
		"Danmarks Middelalder og Renæssance": "DMR",
		"Danmarks Nyere Tid": "DNT",
		"Etnografisk samling": "ES",
		"Frihedsmuseet": "FHM",
		"Den Kgl. Mønt- og Medaljesamling": "KMM",
		"Musikmuseet": "MUM",
		"Cropper": "Cropper"
	}
};
window.cip = new CIPClient(NatMusConfig);
// window.cip.jsessionid = CIP_JSESSIONID;

// Extending with a method to serialize a form to an object.
$.fn.serializeObject = function()
{
	var o = {};
	var a = this.serializeArray();
	$.each(a, function() {
			if (o[this.name] !== undefined) {
					if (!o[this.name].push) {
							o[this.name] = [o[this.name]];
					}
					o[this.name].push(this.value || '');
			} else {
					o[this.name] = this.value || '';
			}
	});
	return o;
};

// Functions for cookie handling.
// See: http://stackoverflow.com/questions/1458724/how-to-set-unset-cookie-with-jquery
function createCookie(name, value, days) {
    var expires;

    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toGMTString();
    } else {
        expires = "";
    }
    document.cookie = escape(name) + "=" + escape(value) + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = escape(name) + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return unescape(c.substring(nameEQ.length, c.length));
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

function get_cip_client_or_redirect() {
	var cip = new CIPClient(NatMusConfig);
	var jsessionid_cookie = readCookie('jsessionid');
	if(jsessionid_cookie) {
		cip.jsessionid = jsessionid_cookie;
	} else {
		location.replace("/");
	}
	return cip;
}

// Authentication - use this function to log out.
function close_any_existing_session(success_callback) {
	eraseCookie('jsessionid');
	// Clear any existing cookies.
	if(cip.jsessionid) {
		cip.ciprequest("session/close", {},
			function(response) {
				cip.jsessionid = null;
				success_callback();
			},
			function(response) {
				// It will fail - because the qwest library will fails JSON parsing empty responses.
				cip.jsessionid = null;
				success_callback();
				//console.log("Error closing the existing session:", response);
			}
		);
	} else {
		success_callback();
	}
}

// Verify that we are successfully logged into the CIP.
function verify_session(success_callback, error_callback) {
	cip.ciprequest("metadata/getcatalogs", {}, function( response ) {
		success_callback();
	}, function( response ) {
		// A call to the metadata/getcatalogs will return a 500 error if
		// the username/password provided when opening the session was
		// unknown to Cumulus.
		error_callback();
	});
}

$(function() {
	$("#logout-btn").click(function() {
		close_any_existing_session(function() {
			location.href = "/";
		});
	});
});
